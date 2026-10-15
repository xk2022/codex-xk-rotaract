package org.xkrotaract.api;

import static org.xkrotaract.api.Input.*;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.servlet.http.HttpServletRequest;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import org.springframework.stereotype.Service;

/** Transactional membership workflows. All mutations run inside CoreService.idempotent. */
@Service
class MembershipService {
  final CoreService core;
  final ApiSupport access;
  MembershipService(CoreService core, ApiSupport access) { this.core=core; this.access=access; }
  UUID actor(HttpServletRequest req) { return core.sessions.require(req).accountId(); }
  UUID self(UUID account) {var rows=core.db.queryForList("SELECT id FROM members WHERE account_id=?",account);return rows.isEmpty()?null:(UUID)rows.getFirst().get("id");}
  void owner(UUID account, Object member) { if(!Objects.equals(self(account),member)) throw ApiException.missing(); }
  void checkVersion(Map<String,Object> row,int v) { if(!Objects.equals(row.get("version"),v)) throw new ApiException(409,"VERSION_CONFLICT","資料已更新，請重新載入。"); }
  UUID id(Map<String,Object> r,String k) {return (UUID)r.get(k);}
  String stamp(Object v) {return v==null?null:((Timestamp)v).toInstant().toString();}
  LocalDate day(Object v) {return ((java.sql.Date)v).toLocalDate();}
  int integer(JsonNode b,String field) {if(!b.has(field)||!b.get(field).isIntegralNumber()||!b.get(field).canConvertToInt()||b.get(field).intValue()<0)throw ApiException.bad(); return b.get(field).intValue();}
  String choice(JsonNode b,String field,String... choices) {String v=text(b,field,1,100);if(!Set.of(choices).contains(v))throw ApiException.bad();return v;}
  Map<String,Object> membership(UUID id) {return core.one("SELECT * FROM memberships WHERE id=?",id);}
  Map<String,Object> lockMember(Object member) {return core.one("SELECT * FROM members WHERE id=? FOR UPDATE",member);}
  Map<String,Object> lockMembership(UUID membership) {
    var r=membership(membership);lockMember(r.get("member_id"));
    return core.one("SELECT * FROM memberships WHERE id=? FOR UPDATE",membership);
  }
  Map<String,Object> dto(Map<String,Object> r) {
    var d=new LinkedHashMap<String,Object>((Map<String,Object>)core.membershipDto(r));
    d.put("endReason",r.get("end_reason"));d.put("datePrecision",r.get("date_precision"));
    d.put("visibility",r.get("visibility"));d.put("contentVersion",r.get("content_version"));d.put("visibilityVersion",r.get("visibility_version"));
    if(Objects.equals(r.get("annual_unconfirmed_year"),core.yearStart()))d.put("annualStatus","unconfirmed");
    return d;
  }
  Map<String,Object> experience(Map<String,Object> r) {return map("id",r.get("id"),"typeCode",r.get("type_code"),"clubNameSnapshot",r.get("club_name_snapshot"),"districtNameSnapshot",r.get("district_name_snapshot"),"startsOn",r.get("starts_on")==null?null:r.get("starts_on").toString(),"endsOn",r.get("ends_on")==null?null:r.get("ends_on").toString(),"datePrecision",r.get("date_precision"),"status",r.get("status"));}
  Object former(Map<String,Object> r) {return map("id",r.get("id"),"typeCode",r.get("type_code"),"nameSnapshot",r.get("name_snapshot"),"callNameSnapshot",r.get("call_name_snapshot"),"clubNameSnapshot",r.get("club_name_snapshot"),"startsOn",r.get("starts_on")==null?null:r.get("starts_on").toString(),"endsOn",r.get("ends_on")==null?null:r.get("ends_on").toString(),"datePrecision",r.get("date_precision"),"endReason",r.get("end_reason"),"version",r.get("version"));}
  Object page(List<?> items,Map<String,String> q) {
    int page=number(q.getOrDefault("page","1"),1,Integer.MAX_VALUE),size=number(q.getOrDefault("pageSize","20"),20,100);
    long start=((long)page-1)*size;int from=(int)Math.min(start,items.size()),to=Math.min(from+size,items.size());
    return map("items",items.subList(from,to),"page",page,"pageSize",size,"total",items.size());
  }
  int number(String s,int min,int max) {try{int n=Integer.parseInt(s);if(n<min||n>max)throw ApiException.bad();return n;}catch(NumberFormatException e){throw ApiException.bad();}}
  void filterStatus(Map<String,String> q,String... statuses) {if(q.containsKey("status")&&!Set.of(statuses).contains(q.get("status")))throw ApiException.bad();}
  void query(Map<String,String> q,String... extras) {var names=new HashSet<String>(List.of(extras));names.addAll(List.of("page","pageSize"));if(!names.containsAll(q.keySet()))throw ApiException.bad();}
  UUID audit(UUID account,String action,UUID target,String targetType,UUID member,UUID club,String reason,HttpServletRequest req) {
    UUID event=UUID.randomUUID(); core.db.update("INSERT INTO audit_events VALUES(?,?,?,?,?)",event,account,action,target,core.now());
    core.db.update("INSERT INTO membership_audit_details(event_id,subject_member_id,club_id,target_type,reason,request_id) VALUES(?,?,?,?,?,?)",event,member,club,targetType,reason,req.getAttribute("requestId") instanceof String rid?UUID.fromString(rid):UUID.randomUUID());
    return event;
  }
  void changed(UUID event,String field,Object before,Object after) {
    try {core.db.update("UPDATE membership_audit_details SET changes=?::jsonb WHERE event_id=?",core.json.writeValueAsString(List.of(map("field",field,"before",before==null?null:before.toString(),"after",after==null?null:after.toString()))),event);}
    catch(com.fasterxml.jackson.core.JsonProcessingException e){throw new IllegalStateException(e);}
  }
  boolean canReview(UUID actor,UUID club) {try{core.reviewer(actor,club);return true;}catch(ApiException e){return false;}}
  UUID reviewGrant(UUID actor,UUID club) {
    core.reviewer(actor,club);
    return (UUID)core.one("SELECT r.id FROM role_grants r JOIN accounts a ON a.id=r.account_id WHERE r.account_id=? AND r.club_id=? AND r.scope_type='club' AND r.role IN ('club_president','club_secretary','club_manager','club_backup') AND r.revoked_at IS NULL AND r.starts_at<=? AND r.ends_at>? AND a.status='active' ORDER BY r.id LIMIT 1 FOR SHARE OF r",actor,club,core.now(),core.now()).get("id");
  }
  boolean validReviewGrant(Object grant,Object actor,Object club) {
    return grant!=null&&core.db.queryForObject("SELECT count(*) FROM role_grants r JOIN accounts a ON a.id=r.account_id JOIN clubs c ON c.id=r.club_id WHERE r.id=? AND r.account_id=? AND r.club_id=? AND r.scope_type='club' AND r.role IN ('club_president','club_secretary','club_manager','club_backup') AND r.revoked_at IS NULL AND r.starts_at<=? AND r.ends_at>? AND a.status='active' AND c.status='active'",Integer.class,grant,actor,club,core.now(),core.now())==1;
  }
  Object memberships(UUID account,UUID member,Map<String,String> q) {
    query(q);core.one("SELECT id FROM members WHERE id=?",member);
    boolean mine=Objects.equals(self(account),member);var out=new ArrayList<Object>();
    for(var r:core.db.queryForList("SELECT * FROM memberships WHERE member_id=? ORDER BY starts_on DESC,id",member)){
      if(mine)out.add(map("projection","self","data",dto(r)));
      else if(access.managesClub(account,id(r,"club_id"))) {
        if("active".equals(r.get("status")))out.add(map("projection","managed","data",dto(r)));
        else if(r.get("ends_on")!=null&&!day(r.get("ends_on")).plusYears(5).isBefore(core.today()))out.add(map("projection","former_club","data",former(r)));
      }else if("public".equals(r.get("visibility"))&& !"void".equals(r.get("status")))out.add(map("projection","public","data",experience(r)));
    }
    if(!mine&&out.isEmpty())throw ApiException.missing();
    return page(out,q);
  }
  void expireTransfers() {
    core.db.update("UPDATE membership_transfers SET status='expired',version=version+1 WHERE status IN ('pending','ready_for_member','needs_reapproval') AND (expires_at<=? OR ready_expires_at<=?)",core.now(),core.now());
    core.db.update("UPDATE membership_transfers t SET status='terminated',decision_reason='club_disabled',version=version+1 WHERE t.status IN ('pending','ready_for_member','needs_reapproval') AND EXISTS(SELECT 1 FROM clubs c WHERE c.id IN(t.from_club_id,t.to_club_id) AND c.status<>'active')");
  }
  Object createTransfer(UUID actor,JsonNode b,HttpServletRequest req) {
    fields(b,"fromMembershipId","toClubId","reason");UUID source=uuid(b,"fromMembershipId"),target=uuid(b,"toClubId");String reason=text(b,"reason",1,1000);
    var m=lockMembership(source);owner(actor,m.get("member_id"));expireTransfers();
    if(!"active".equals(m.get("status"))||target.equals(m.get("club_id")))throw ApiException.conflict();
    var clubs=core.db.queryForList("SELECT * FROM clubs WHERE id IN (?,?) ORDER BY id FOR SHARE",m.get("club_id"),target);
    if(clubs.size()!=2||clubs.stream().anyMatch(c->!"active".equals(c.get("status"))||!Objects.equals(c.get("type_code"),m.get("type_code"))))throw ApiException.conflict();
    if(core.db.queryForObject("SELECT count(*) FROM membership_transfers WHERE from_membership_id=? AND status IN ('pending','ready_for_member','needs_reapproval')",Integer.class,source)>0)throw ApiException.conflict();
    UUID transfer=UUID.randomUUID();core.db.update("INSERT INTO membership_transfers(id,member_id,from_membership_id,from_club_id,to_club_id,reason,status,source_version,requested_at,expires_at) VALUES(?,?,?,?,?,?,'pending',?,?,?)",transfer,m.get("member_id"),source,m.get("club_id"),target,reason,m.get("version"),core.now(),Timestamp.from(core.clock.instant().plus(Duration.ofDays(30))));
    audit(actor,"transfer.create",transfer,"transfer",id(m,"member_id"),id(m,"club_id"),reason,req);return transferDto(core.one("SELECT * FROM membership_transfers WHERE id=?",transfer));
  }
  Object approval(Map<String,Object> r,String side) {return r.get(side+"_actor")==null?null:map("side",side,"approvedBy",r.get(side+"_actor"),"approvedAt",stamp(r.get(side+"_approved_at")),"grantId",r.get(side+"_grant"),"contentVersion",r.get("source_version"));}
  Map<String,Object> transferDto(Map<String,Object> r) {return map("id",r.get("id"),"memberId",r.get("member_id"),"fromMembershipId",r.get("from_membership_id"),"fromClubId",r.get("from_club_id"),"toClubId",r.get("to_club_id"),"reason",r.get("reason"),"status",r.get("status"),"fromApproval",approval(r,"from"),"toApproval",approval(r,"to"),"requestedAt",stamp(r.get("requested_at")),"expiresAt",stamp(r.get("expires_at")),"readyExpiresAt",stamp(r.get("ready_expires_at")),"executedAt",stamp(r.get("executed_at")),"version",r.get("version"));}
  Object transfers(UUID actor,Map<String,String> q) {
    query(q,"scope","clubId","status");String scope=q.get("scope");UUID club=null;
    if("club".equals(scope)){club=UUID.fromString(q.getOrDefault("clubId",""));core.reviewer(actor,club);}else if(!"self".equals(scope))throw ApiException.bad();
    filterStatus(q,"pending","ready_for_member","needs_reapproval","completed","rejected","withdrawn","expired","terminated");
    expireTransfers();var rows=scope.equals("self")?core.db.queryForList("SELECT * FROM membership_transfers WHERE member_id=? ORDER BY requested_at DESC,id",self(actor)):core.db.queryForList("SELECT * FROM membership_transfers WHERE from_club_id=? OR to_club_id=? ORDER BY requested_at DESC,id",club,club);
    return page(rows.stream().filter(r->q.get("status")==null||q.get("status").equals(r.get("status"))).map(this::transferDto).toList(),q);
  }
  Map<String,Object> lockedTransfer(UUID transfer) {
    var r=core.one("SELECT * FROM membership_transfers WHERE id=?",transfer);lockMember(r.get("member_id"));
    return core.one("SELECT * FROM membership_transfers WHERE id=? FOR UPDATE",transfer);
  }
  boolean openTransfer(Map<String,Object> r) {return Set.of("pending","ready_for_member","needs_reapproval").contains(r.get("status"))&&((Timestamp)r.get("expires_at")).toInstant().isAfter(core.clock.instant())&&(r.get("ready_expires_at")==null||((Timestamp)r.get("ready_expires_at")).toInstant().isAfter(core.clock.instant()));}
  Object decideTransfer(UUID actor,UUID transfer,JsonNode b,String action,HttpServletRequest req) {
    if(action.equals("approve"))fields(b,"version","side");else if(action.equals("reject"))fields(b,"version","reason");else fields(b,"version");
    var r=lockedTransfer(transfer);checkVersion(r,version(b));
    if(action.equals("withdraw")||action.equals("execute"))owner(actor,r.get("member_id"));
    else if(action.equals("reject")&&!canReview(actor,id(r,"from_club_id"))&&!canReview(actor,id(r,"to_club_id")))throw ApiException.missing();
    if(!openTransfer(r))throw ApiException.conflict();
    if(action.equals("execute"))return executeTransfer(actor,r,req);
    if(action.equals("approve")){
      String side=choice(b,"side","from","to");UUID grant=reviewGrant(actor,id(r,side+"_club_id"));
      if(!"active".equals(membership(id(r,"from_membership_id")).get("status")))throw ApiException.conflict();
      core.db.update("UPDATE membership_transfers SET "+side+"_actor=?,"+side+"_grant=?,"+side+"_approved_at=?,version=version+1 WHERE id=?",actor,grant,core.now(),transfer);
      var updated=core.one("SELECT * FROM membership_transfers WHERE id=?",transfer);
      if(validReviewGrant(updated.get("from_grant"),updated.get("from_actor"),updated.get("from_club_id"))&&validReviewGrant(updated.get("to_grant"),updated.get("to_actor"),updated.get("to_club_id")))
        core.db.update("UPDATE membership_transfers SET status='ready_for_member',ready_expires_at=LEAST(expires_at,?) WHERE id=?",Timestamp.from(core.clock.instant().plus(Duration.ofDays(7))),transfer);
    }else core.db.update("UPDATE membership_transfers SET status=?,decision_reason=?,version=version+1 WHERE id=?",action.equals("reject")?"rejected":"withdrawn",action.equals("reject")?text(b,"reason",1,1000):null,transfer);
    audit(actor,"transfer."+action,transfer,"transfer",id(r,"member_id"),id(r,"from_club_id"),action.equals("reject")?text(b,"reason",1,1000):null,req);
    return transferDto(core.one("SELECT * FROM membership_transfers WHERE id=?",transfer));
  }
  Object executeTransfer(UUID actor,Map<String,Object> r,HttpServletRequest req) {
    if(!"ready_for_member".equals(r.get("status")))throw ApiException.conflict();
    UUID source=id(r,"from_membership_id"),target=id(r,"to_club_id"),transfer=id(r,"id");var old=lockMembership(source);
    core.db.queryForList("SELECT id FROM clubs WHERE id IN (?,?) ORDER BY id FOR SHARE",r.get("from_club_id"),target);
    // Lock both approval grants so revocation cannot race the final membership transaction.
    core.db.queryForList("SELECT id FROM accounts WHERE id IN (?,?) ORDER BY id FOR SHARE",r.get("from_actor"),r.get("to_actor"));
    core.db.queryForList("SELECT id FROM role_grants WHERE id IN (?,?) ORDER BY id FOR SHARE",r.get("from_grant"),r.get("to_grant"));
    if(!validReviewGrant(r.get("from_grant"),r.get("from_actor"),r.get("from_club_id"))||!validReviewGrant(r.get("to_grant"),r.get("to_actor"),target)||!Objects.equals(r.get("source_version"),old.get("version"))||!"active".equals(old.get("status"))){
      boolean sourceChanged=!Objects.equals(r.get("source_version"),old.get("version"));
      boolean keepFrom=!sourceChanged&&validReviewGrant(r.get("from_grant"),r.get("from_actor"),r.get("from_club_id"));
      boolean keepTo=!sourceChanged&&validReviewGrant(r.get("to_grant"),r.get("to_actor"),r.get("to_club_id"));
      core.db.update("UPDATE membership_transfers SET status='needs_reapproval',from_actor=?,from_grant=?,from_approved_at=?,to_actor=?,to_grant=?,to_approved_at=?,ready_expires_at=NULL,source_version=?,version=version+1 WHERE id=?",keepFrom?r.get("from_actor"):null,keepFrom?r.get("from_grant"):null,keepFrom?r.get("from_approved_at"):null,keepTo?r.get("to_actor"):null,keepTo?r.get("to_grant"):null,keepTo?r.get("to_approved_at"):null,old.get("version"),transfer);
      // Return the persisted workflow state; no membership mutation occurred.
      throw new ReapprovalRequired(transferDto(core.one("SELECT * FROM membership_transfers WHERE id=?",transfer)));
    }
    var c=core.one("SELECT c.*,d.name district_name FROM clubs c JOIN districts d ON d.id=c.district_id WHERE c.id=? AND c.status='active'",target);
    if(!Objects.equals(c.get("type_code"),old.get("type_code")))throw ApiException.conflict();
    if(old.get("starts_on")==null||day(old.get("starts_on")).isAfter(core.today()))throw ApiException.conflict();
    var m=core.one("SELECT * FROM members WHERE id=?",old.get("member_id"));UUID fresh=UUID.randomUUID();
    closeMembership(old,core.today(),"transferred");
    core.db.update("INSERT INTO memberships(id,member_id,club_id,type_code,status,starts_on,name_snapshot,call_name_snapshot,club_name_snapshot,district_name_snapshot,confirmed_year) VALUES(?,?,?,?,'active',?,?,?,?,?,?)",fresh,m.get("id"),target,c.get("type_code"),core.today(),m.get("name"),m.get("call_name"),c.get("name"),c.get("district_name"),core.yearStart());
    core.db.update("UPDATE membership_transfers SET status='completed',executed_at=?,version=version+1 WHERE id=?",core.now(),transfer);
    core.db.update("UPDATE membership_end_requests SET status='terminated',version=version+1 WHERE membership_id=? AND status='pending'",source);
    changed(audit(actor,"transfer.execute",transfer,"transfer",id(old,"member_id"),id(old,"club_id"),String.valueOf(r.get("reason")),req),"status",r.get("status"),"completed");
    return map("transfer",transferDto(core.one("SELECT * FROM membership_transfers WHERE id=?",transfer)),"previousMembership",dto(membership(source)),"newMembership",dto(membership(fresh)));
  }
  // Controller catches inside the transaction to commit needs_reapproval without pretending execution succeeded.
  static class ReapprovalRequired extends RuntimeException {final Object transfer;ReapprovalRequired(Object t){transfer=t;}}
  void closeMembership(Map<String,Object> m,LocalDate ends,String reason) {
    if(!"active".equals(m.get("status"))||m.get("starts_on")==null||ends.isAfter(core.today())||ends.isBefore(day(m.get("starts_on"))))throw ApiException.conflict();
    core.db.update("UPDATE memberships SET status='ended',ends_on=?,end_reason=?,visibility='hidden',content_version=content_version+1,visibility_version=visibility_version+1,version=version+1 WHERE id=?",ends,reason,m.get("id"));
    invalidatePublications(id(m,"id"));
  }
  Object createEnd(UUID actor,JsonNode b,HttpServletRequest req) {
    fields(b,"membershipId","reason","endsOn");var m=lockMembership(uuid(b,"membershipId"));owner(actor,m.get("member_id"));
    String reason=choice(b,"reason","resigned","ob");LocalDate ends=date(b,"endsOn");
    if(!"active".equals(m.get("status"))||ends.isAfter(core.today())||ends.isBefore(day(m.get("starts_on"))))throw ApiException.bad();
    if(core.db.queryForObject("SELECT count(*) FROM membership_end_requests WHERE membership_id=? AND status='pending'",Integer.class,m.get("id"))>0)throw ApiException.conflict();
    UUID request=UUID.randomUUID();core.db.update("INSERT INTO membership_end_requests(id,member_id,membership_id,club_id,reason,ends_on,source_version,requested_at) VALUES(?,?,?,?,?,?,?,?)",request,m.get("member_id"),m.get("id"),m.get("club_id"),reason,ends,m.get("version"),core.now());
    audit(actor,"membership.end.request",id(m,"id"),"membership",id(m,"member_id"),id(m,"club_id"),reason,req);return endDto(core.one("SELECT * FROM membership_end_requests WHERE id=?",request));
  }
  Object endDto(Map<String,Object> r) {return map("id",r.get("id"),"memberId",r.get("member_id"),"membershipId",r.get("membership_id"),"reason",r.get("reason"),"endsOn",r.get("ends_on").toString(),"status",r.get("status"),"requestedAt",stamp(r.get("requested_at")),"version",r.get("version"));}
  Object ends(UUID actor,Map<String,String> q) {
    query(q,"scope","clubId","status");String scope=q.get("scope");UUID club=null;
    if("club".equals(scope)){club=UUID.fromString(q.getOrDefault("clubId",""));core.reviewer(actor,club);}else if(!"self".equals(scope))throw ApiException.bad();
    filterStatus(q,"pending","approved","rejected","withdrawn","expired","terminated");
    core.db.update("UPDATE membership_end_requests SET status='expired',version=version+1 WHERE status='pending' AND requested_at<=?",Timestamp.from(core.clock.instant().minus(Duration.ofDays(30))));
    var rows=scope.equals("self")?core.db.queryForList("SELECT * FROM membership_end_requests WHERE member_id=? ORDER BY requested_at DESC,id",self(actor)):core.db.queryForList("SELECT * FROM membership_end_requests WHERE club_id=? ORDER BY requested_at DESC,id",club);
    return page(rows.stream().filter(r->q.get("status")==null||q.get("status").equals(r.get("status"))).map(this::endDto).toList(),q);
  }
  Object approveEnd(UUID actor,UUID request,JsonNode b,HttpServletRequest req) {
    fields(b,"version");var initial=core.one("SELECT * FROM membership_end_requests WHERE id=?",request);core.reviewer(actor,id(initial,"club_id"));lockMember(initial.get("member_id"));
    var r=core.one("SELECT * FROM membership_end_requests WHERE id=? FOR UPDATE",request);checkVersion(r,version(b));
    if(!"pending".equals(r.get("status"))||!((Timestamp)r.get("requested_at")).toInstant().plus(Duration.ofDays(30)).isAfter(core.clock.instant()))throw ApiException.conflict();
    var m=lockMembership(id(r,"membership_id"));checkVersion(m,(Integer)r.get("source_version"));closeMembership(m,day(r.get("ends_on")),(String)r.get("reason"));
    core.db.update("UPDATE membership_end_requests SET status='approved',version=version+1 WHERE id=?",request);terminateTransfers(id(m,"id"));
    changed(audit(actor,"membership.end.approve",id(m,"id"),"membership",id(m,"member_id"),id(m,"club_id"),(String)r.get("reason"),req),"status",m.get("status"),"ended");return dto(membership(id(m,"id")));
  }
  void terminateTransfers(UUID m) {core.db.update("UPDATE membership_transfers SET status='terminated',decision_reason='membership_ended',version=version+1 WHERE from_membership_id=? AND status IN ('pending','ready_for_member','needs_reapproval')",m);}
  Object directEnd(UUID actor,UUID membership,JsonNode b,HttpServletRequest req) {
    fields(b,"version","endsOn","endReason","reason");var m=lockMembership(membership);core.reviewer(actor,id(m,"club_id"));checkVersion(m,version(b));
    String reason=text(b,"reason",1,1000),endReason=choice(b,"endReason","resigned","ob");closeMembership(m,date(b,"endsOn"),endReason);terminateTransfers(membership);
    core.db.update("UPDATE membership_end_requests SET status='terminated',version=version+1 WHERE membership_id=? AND status='pending'",membership);
    changed(audit(actor,"membership.end",membership,"membership",id(m,"member_id"),id(m,"club_id"),reason,req),"status",m.get("status"),"ended");return dto(membership(membership));
  }
  LocalDate year(String value) {try{LocalDate y=LocalDate.parse(value);if(y.getMonthValue()!=7||y.getDayOfMonth()!=1||y.getYear()!=core.yearStart())throw ApiException.bad();return y;}catch(java.time.format.DateTimeParseException|NullPointerException e){throw ApiException.bad();}}
  Object confirmYear(UUID actor,UUID club,JsonNode b,HttpServletRequest req) {
    fields(b,"yearStart","membershipId","version","status");access.requireClub(actor,club);LocalDate y=year(text(b,"yearStart",10,10));String state=choice(b,"status","confirmed","unconfirmed");
    var m=lockMembership(uuid(b,"membershipId"));if(!club.equals(m.get("club_id")))throw ApiException.missing();if(!"active".equals(m.get("status")))throw ApiException.conflict();
    var rows=core.db.queryForList("SELECT * FROM membership_years WHERE membership_id=? AND year_start=? FOR UPDATE",m.get("id"),y);
    int old=rows.isEmpty()?0:(Integer)rows.getFirst().get("version");if(version(b)!=old)throw new ApiException(409,"VERSION_CONFLICT","資料已更新，請重新載入。");
    core.db.update("INSERT INTO membership_years(membership_id,year_start,status,confirmed_by,confirmed_at,version) VALUES(?,?,?,?,?,?) ON CONFLICT(membership_id,year_start) DO UPDATE SET status=excluded.status,confirmed_by=excluded.confirmed_by,confirmed_at=excluded.confirmed_at,version=excluded.version",m.get("id"),y,state,actor,core.now(),old+1);
    if(state.equals("confirmed"))core.db.update("UPDATE memberships SET confirmed_year=?,annual_unconfirmed_year=NULL,version=version+1 WHERE id=?",y.getYear(),m.get("id"));
    else core.db.update("UPDATE memberships SET annual_unconfirmed_year=?,version=version+1 WHERE id=?",y.getYear(),m.get("id"));
    changed(audit(actor,"membership.year."+state,id(m,"id"),"membership",id(m,"member_id"),club,null,req),"annualStatus",dto(m).get("annualStatus"),state);
    return yearDto(membership(id(m,"id")),y);
  }
  Object yearDto(Map<String,Object> m,LocalDate y) {
    var rows=core.db.queryForList("SELECT * FROM membership_years WHERE membership_id=? AND year_start=?",m.get("id"),y);
    if(rows.isEmpty())return map("membershipId",m.get("id"),"yearStart",y.toString(),"confirmationStatus",dto(m).get("annualStatus"),"confirmedBy",null,"confirmedAt",null,"version",0);
    var r=rows.getFirst();return map("membershipId",m.get("id"),"yearStart",y.toString(),"confirmationStatus",r.get("status"),"confirmedBy",r.get("confirmed_by"),"confirmedAt",stamp(r.get("confirmed_at")),"version",r.get("version"));
  }
  Object years(UUID actor,UUID club,Map<String,String> q) {query(q,"yearStart");access.requireClub(actor,club);LocalDate y=year(q.get("yearStart"));return page(core.db.queryForList("SELECT * FROM memberships WHERE club_id=? AND status='active' ORDER BY id",club).stream().map(m->yearDto(m,y)).toList(),q);}
  void moderate(UUID actor,UUID club) {if(!access.permission(actor,"history:moderate",club))throw ApiException.missing();}
  boolean validModerationGrant(Object grant,UUID club) {
    var rows=core.db.queryForList("SELECT r.*,COALESCE(r.scope_id,r.club_id) effective_scope_id FROM role_grants r JOIN accounts a ON a.id=r.account_id WHERE r.id=? AND r.revoked_at IS NULL AND r.starts_at<=? AND r.ends_at>? AND a.status='active'",grant,core.now(),core.now());
    return !rows.isEmpty()&&grantModerates(rows.getFirst(),club);
  }
  boolean grantModerates(Map<String,Object> g,UUID club) {
    var permissions=g.get("permissions");
    boolean has=permissions instanceof java.sql.Array a?arrayContains(a,"history:moderate"):permissions instanceof Collection<?> c&&c.contains("history:moderate");
    if(!has)return false;
    String scope=(String)g.get("scope_type"),role=(String)g.get("role");Object scopeId=g.get("effective_scope_id");
    var c=core.one("SELECT * FROM clubs WHERE id=?",club);
    if("club".equals(scope))return Set.of("club_president","club_secretary").contains(role)&&club.equals(scopeId)&&"active".equals(c.get("status"));
    if("district".equals(scope))return "district_manager".equals(role)&&c.get("district_id").equals(scopeId);
    return "content_manager".equals(role)&&Set.of("content","platform").contains(scope)&&(scopeId==null||club.equals(scopeId)||c.get("district_id").equals(scopeId));
  }
  UUID moderationGrant(UUID actor,UUID club) {
    moderate(actor,club);
    for(var g:access.grants(actor))if(grantModerates(g,club))return id(g,"id");
    throw ApiException.missing();
  }
  boolean arrayContains(java.sql.Array a,String p){try{return Arrays.asList((Object[])a.getArray()).contains(p);}catch(java.sql.SQLException e){throw new IllegalStateException(e);}}
  void invalidatePublications(UUID membership) {core.db.update("UPDATE publication_requests SET status='invalidated',decided_at=?,version=version+1 WHERE membership_id=? AND status='pending'",core.now(),membership);}
  void changeVisibility(UUID membership,String visibility) {core.db.update("UPDATE memberships SET visibility=?,visibility_version=visibility_version+1,version=version+1 WHERE id=?",visibility,membership);invalidatePublications(membership);}
  Object visibility(UUID actor,UUID membership,JsonNode b,boolean override,HttpServletRequest req) {
    if(override)fields(b,"version","visibility","reason","currentPassword");else fields(b,"version","visibility");
    var m=lockMembership(membership);String state=choice(b,"visibility","hidden","public");checkVersion(m,version(b));String reason=null;
    if(override){
      if(!access.permission(actor,"history:override",id(m,"club_id")))throw ApiException.missing();access.requireMfa(req);
      reason=text(b,"reason",1,1000);if(!b.path("currentPassword").isTextual()||b.get("currentPassword").asText().isEmpty()||b.get("currentPassword").asText().codePointCount(0,b.get("currentPassword").asText().length())>128)throw ApiException.bad();
      var a=core.one("SELECT * FROM accounts WHERE id=?",actor);
      if(!core.passwords.matches(b.get("currentPassword").asText(),(String)a.get("password_hash")))throw ApiException.auth();
    }else if(!Objects.equals(self(actor),m.get("member_id"))){moderate(actor,id(m,"club_id"));if(!"hidden".equals(state))throw new ApiException(403,"FORBIDDEN","公開須會員本人同意。");}
    if("void".equals(m.get("status"))&&"public".equals(state))throw ApiException.conflict();
    changeVisibility(membership,state);changed(audit(actor,override?"history.override":"history.visibility",membership,"membership",id(m,"member_id"),id(m,"club_id"),reason,req),"visibility",m.get("visibility"),state);return dto(membership(membership));
  }
  void refreshPublications(UUID member) {
    core.db.update("UPDATE publication_requests SET status='expired',decided_at=?,version=version+1 WHERE subject_member_id=? AND status='pending' AND expires_at<=?",core.now(),member,core.now());
    for(var p:core.db.queryForList("SELECT p.*,m.club_id,m.content_version actual_content,m.visibility_version actual_visibility FROM publication_requests p JOIN memberships m ON m.id=p.membership_id WHERE p.subject_member_id=? AND p.status='pending'",member))
      if(!Objects.equals(p.get("content_version"),p.get("actual_content"))||!Objects.equals(p.get("visibility_version"),p.get("actual_visibility"))||!validModerationGrant(p.get("grant_id"),id(p,"club_id")))core.db.update("UPDATE publication_requests SET status='invalidated',decided_at=?,version=version+1 WHERE id=? AND status='pending'",core.now(),p.get("id"));
  }
  Object requestPublication(UUID actor,UUID membership,JsonNode b,HttpServletRequest req) {
    fields(b,"contentVersion","visibilityVersion");var m=lockMembership(membership);UUID grant=moderationGrant(actor,id(m,"club_id"));refreshPublications(id(m,"member_id"));
    if(!Objects.equals(m.get("content_version"),integer(b,"contentVersion"))||!Objects.equals(m.get("visibility_version"),integer(b,"visibilityVersion")))throw new ApiException(409,"VERSION_CONFLICT","內容已更新。");
    if(!"hidden".equals(m.get("visibility"))||"void".equals(m.get("status")))throw ApiException.conflict();
    if(core.db.queryForObject("SELECT count(*) FROM publication_requests WHERE membership_id=? AND (status='pending' OR (status IN ('rejected','expired') AND decided_at>?))",Integer.class,membership,Timestamp.from(core.clock.instant().minus(Duration.ofDays(7))))>0)throw ApiException.conflict();
    UUID request=UUID.randomUUID();String content;try{content=core.json.writeValueAsString(experience(m));}catch(Exception e){throw new IllegalStateException(e);}
    core.db.update("INSERT INTO publication_requests(id,membership_id,subject_member_id,requested_by,requester_name,grant_id,content_version,visibility_version,content,status,requested_at,expires_at) VALUES(?,?,?,?,?,?,?,?,?::jsonb,'pending',?,?)",request,membership,m.get("member_id"),actor,core.one("SELECT COALESCE(m.call_name,a.account_code) display_name FROM accounts a LEFT JOIN members m ON m.account_id=a.id WHERE a.id=?",actor).get("display_name"),grant,m.get("content_version"),m.get("visibility_version"),content,core.now(),Timestamp.from(core.clock.instant().plus(Duration.ofDays(7))));
    audit(actor,"history.publication.request",request,"publication",id(m,"member_id"),id(m,"club_id"),null,req);return publicationDto(core.one("SELECT * FROM publication_requests WHERE id=?",request));
  }
  Object publicationDto(Map<String,Object> r) {Object content;try{content=core.json.readTree(r.get("content").toString());}catch(Exception e){throw new IllegalStateException(e);}return map("id",r.get("id"),"membershipId",r.get("membership_id"),"subjectMemberId",r.get("subject_member_id"),"requestedBy",r.get("requested_by"),"requesterDisplayName",r.get("requester_name"),"content",content,"audience","authenticated_members","contentVersion",r.get("content_version"),"visibilityVersion",r.get("visibility_version"),"status",r.get("status"),"requestedAt",stamp(r.get("requested_at")),"expiresAt",stamp(r.get("expires_at")),"decidedAt",stamp(r.get("decided_at")),"version",r.get("version"));}
  Object publications(UUID actor,Map<String,String> q) {query(q,"status");filterStatus(q,"pending","approved","rejected","expired","invalidated");UUID member=self(actor);refreshPublications(member);return page(core.db.queryForList("SELECT * FROM publication_requests WHERE subject_member_id=? ORDER BY requested_at DESC,id",member).stream().filter(r->q.get("status")==null||q.get("status").equals(r.get("status"))).map(this::publicationDto).toList(),q);}
  Object decidePublication(UUID actor,UUID request,JsonNode b,HttpServletRequest req) {
    fields(b,"version","decision");String decision=choice(b,"decision","approve","reject");var initial=core.one("SELECT * FROM publication_requests WHERE id=?",request);owner(actor,initial.get("subject_member_id"));
    var m=lockMembership(id(initial,"membership_id"));var r=core.one("SELECT * FROM publication_requests WHERE id=? FOR UPDATE",request);checkVersion(r,version(b));
    core.db.queryForList("SELECT id FROM accounts WHERE id=? FOR SHARE",r.get("requested_by"));
    core.db.queryForList("SELECT id FROM role_grants WHERE id=? FOR SHARE",r.get("grant_id"));
    if(!"pending".equals(r.get("status"))||!((Timestamp)r.get("expires_at")).toInstant().isAfter(core.clock.instant())||!Objects.equals(r.get("content_version"),m.get("content_version"))||!Objects.equals(r.get("visibility_version"),m.get("visibility_version"))||!validModerationGrant(r.get("grant_id"),id(m,"club_id")))throw ApiException.conflict();
    core.db.update("UPDATE publication_requests SET status=?,decided_at=?,version=version+1 WHERE id=?",decision.equals("approve")?"approved":"rejected",core.now(),request);
    if(decision.equals("approve"))changeVisibility(id(m,"id"),"public");
    audit(actor,"history.publication."+decision,request,"publication",id(m,"member_id"),id(m,"club_id"),null,req);return publicationDto(core.one("SELECT * FROM publication_requests WHERE id=?",request));
  }
  Object audits(UUID actor,boolean mine,Map<String,String> q) {
    query(q,"scopeType","scopeId","targetType","targetId","action","from","to");UUID member=self(actor);StringBuilder where=new StringBuilder(" WHERE 1=1");List<Object> params=new ArrayList<>();
    if(mine){where.append(" AND (a.target_id IN (?,?) OR d.subject_member_id=? OR rg.account_id=?)");params.add(actor);params.add(member);params.add(member);params.add(actor);}
    else {String scope=q.get("scopeType");UUID scopeId=q.get("scopeId")==null?null:UUID.fromString(q.get("scopeId"));
      if("club".equals(scope)){access.requireClub(actor,scopeId);where.append(" AND "+auditClub()+"=?");params.add(scopeId);}
      else if("district".equals(scope)){if(!access.districtRole(actor,scopeId))throw ApiException.missing();where.append(" AND "+auditClub()+" IN (SELECT id FROM clubs WHERE district_id=?)");params.add(scopeId);}
      else if("platform".equals(scope)){access.requirePlatform(actor,"permission_admin");where.append(" AND a.action LIKE 'role.%'");}
      else throw ApiException.bad();
    }
    if(q.get("targetType")!=null){where.append(" AND COALESCE(d.target_type,CASE WHEN a.action LIKE 'account.%' THEN 'account' WHEN a.action LIKE 'join.%' THEN 'join_application' WHEN a.action LIKE 'role.%' THEN 'role_grant' WHEN a.action LIKE 'club.%' THEN 'club' ELSE 'member' END)=?");params.add(q.get("targetType"));}
    if(q.get("targetId")!=null){where.append(" AND a.target_id=?");params.add(UUID.fromString(q.get("targetId")));}
    if(q.get("action")!=null){where.append(" AND a.action=?");params.add(q.get("action"));}
    if(q.get("from")!=null){where.append(" AND a.recorded_at>=?");params.add(Timestamp.from(Instant.parse(q.get("from"))));}
    if(q.get("to")!=null){where.append(" AND a.recorded_at<?");params.add(Timestamp.from(Instant.parse(q.get("to"))));}
    var rows=core.db.queryForList("SELECT a.*,d.target_type,COALESCE(d.reason,od.reason) reason,d.request_id,d.changes,od.changes organization_changes FROM audit_events a LEFT JOIN membership_audit_details d ON d.event_id=a.id LEFT JOIN organization_audit_details od ON od.event_id=a.id LEFT JOIN role_grants rg ON a.action LIKE 'role.%' AND rg.id=a.target_id LEFT JOIN join_applications ja ON a.action LIKE 'join.%' AND ja.id=a.target_id"+where+" ORDER BY a.recorded_at DESC,a.id",params.toArray());
    return page(rows.stream().map(r->{String action=(String)r.get("action");String type=(String)r.get("target_type");if(type==null)type=action.startsWith("account.")?"account":action.startsWith("join.")?"join_application":action.startsWith("role.")?"role_grant":action.startsWith("club.")?"club":"member";
      // Only controlled workflow reasons; raw contact values and support evidence never enter this projection.
      return map("id",r.get("id"),"actorAccountId",r.get("actor_id"),"action",action,"targetType",type,"targetId",r.get("target_id"),"recordedAt",stamp(r.get("recorded_at")),"reason",r.get("reason"),"requestId",r.get("request_id")==null?r.get("id"):r.get("request_id"),"changes",r.get("changes")!=null?auditChanges(r.get("changes")):organizationChanges(r.get("organization_changes")));}).toList(),q);
  }
  JsonNode auditChanges(Object value) {try{return value==null?core.json.createArrayNode():core.json.readTree(value.toString());}catch(com.fasterxml.jackson.core.JsonProcessingException e){throw new IllegalStateException(e);}}

  String auditClub() {return "COALESCE(d.club_id,rg.club_id,ja.club_id,(od.changes->>'clubId')::uuid,CASE WHEN a.action LIKE 'club.%' AND a.action NOT LIKE 'club.move.%' THEN a.target_id END)";}
  JsonNode organizationChanges(Object raw) {
    var input=auditChanges(raw);var result=core.json.createArrayNode();
    for(String field:List.of("role","scopeType","scopeId","status","version","clubId","from","to"))if(input.has(field))result.add(core.json.valueToTree(map("field",field,"before",null,"after",input.get(field).asText())));
    return result;
  }

}
