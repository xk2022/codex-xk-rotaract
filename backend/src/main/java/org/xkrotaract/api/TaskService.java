package org.xkrotaract.api;

import static org.xkrotaract.api.Input.*;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import org.springframework.stereotype.Service;

/** On-demand private reminders; this read API does not dispatch notifications or extend eligibility. */
@Service
class TaskService {
  final CoreService core;
  final ApiSupport access;
  final BusinessService business;
  final MembershipService memberships;
  TaskService(CoreService core,ApiSupport access,BusinessService business,MembershipService memberships){this.core=core;this.access=access;this.business=business;this.memberships=memberships;}
  Map<String,Object> item(String id,String title,String detail,String view,String priority,UUID company){
    var out=map("id",id,"title",title,"detail",detail,"view",view,"priority",priority);
    if(company!=null)out.put("companyId",company);
    return out;
  }
  UUID member(UUID account){var rows=core.db.queryForList("SELECT id FROM members WHERE account_id=?",account);return rows.isEmpty()?null:(UUID)rows.getFirst().get("id");}
  @SuppressWarnings("unchecked")
  Object tasks(UUID actor,Map<String,String> q){
    if(!Set.of("scope","clubId","priority","page","pageSize").containsAll(q.keySet()))throw ApiException.bad();
    String scope=q.getOrDefault("scope","self"),priority=q.getOrDefault("priority","all");
    if(!Set.of("self","club","support","business").contains(scope)||!Set.of("all","action","waiting","reminder").contains(priority))throw ApiException.bad();
    if(q.containsKey("clubId")&&!scope.equals("club"))throw ApiException.bad();
    List<Map<String,Object>> items=new ArrayList<>();
    UUID member=member(actor);
    switch(scope){
      case "self" -> self(actor,member,items);
      case "club" -> {if(!q.containsKey("clubId"))throw ApiException.bad();UUID club=UUID.fromString(q.get("clubId"));access.requireClub(actor,club);club(actor,club,items);}
      case "support" -> {access.requirePlatform(actor,"account_support");support(actor,items);}
      case "business" -> {if(member==null)throw ApiException.missing();business(actor,member,items);}
      default -> throw ApiException.bad();
    }
    var counts=map("action",items.stream().filter(i->i.get("priority").equals("action")).count(),"waiting",items.stream().filter(i->i.get("priority").equals("waiting")).count(),"reminder",items.stream().filter(i->i.get("priority").equals("reminder")).count(),"total",items.size());
    var filtered=items.stream().filter(i->priority.equals("all")||i.get("priority").equals(priority)).toList();
    var result=new LinkedHashMap<>((Map<String,Object>)ApiSupport.page(filtered,q));
    result.put("summary",counts);result.put("scope",scope);result.put("asOf",core.clock.instant().toString());
    return result;
  }
  void self(UUID actor,UUID member,List<Map<String,Object>> out){
    if(member!=null){
      for(var r:core.db.queryForList("SELECT id FROM join_applications WHERE member_id=? AND status='pending' AND expires_at>? ORDER BY requested_at,id",member,core.now()))out.add(item("application-"+r.get("id"),"入社申請等待回覆","查看申請進度與處理說明。","applications","waiting",null));
      for(var r:core.db.queryForList("SELECT * FROM membership_transfers WHERE member_id=? AND status IN ('pending','ready_for_member','needs_reapproval') AND expires_at>? AND (ready_expires_at IS NULL OR ready_expires_at>?) ORDER BY requested_at,id",member,core.now(),core.now())){
        boolean ready=r.get("status").equals("ready_for_member")&&validTransferApproval(r,"from")&&validTransferApproval(r,"to")&&Objects.equals(r.get("source_version"),memberships.membership((UUID)r.get("from_membership_id")).get("version"));out.add(item("transfer-"+r.get("id"),ready?"轉社待本人最終確認":"轉社等待兩社核可","完成本人最終確認後才變更社籍。","transfers",ready?"action":"waiting",null));
      }
      boolean pendingYear=core.db.queryForList("SELECT ms.* FROM memberships ms JOIN clubs c ON c.id=ms.club_id WHERE ms.member_id=? AND ms.status='active' AND c.status='active' AND ms.starts_on<=? AND (ms.ends_on IS NULL OR ms.ends_on>?)",member,core.today(),core.today()).stream().anyMatch(m->core.annual(m).equals("unconfirmed"));
      if(pendingYear)out.add(item("annual-own","等待社團確認當年度社籍","請聯絡社團管理者，查看目前社籍狀態。","profile","waiting",null));
      for(var r:core.db.queryForList("SELECT p.* , m.club_id FROM publication_requests p JOIN memberships m ON m.id=p.membership_id WHERE p.subject_member_id=? AND p.status='pending' AND p.expires_at>? AND p.content_version=m.content_version AND p.visibility_version=m.visibility_version AND m.visibility='hidden' AND m.status<>'void' ORDER BY p.requested_at,p.id",member,core.now()))
        if(memberships.validModerationGrant(r.get("grant_id"),(UUID)r.get("club_id")))out.add(item("publication-"+r.get("id"),"歷史公開請求待本人決定","未同意前資料仍保持隱藏。","history","action",null));
    }
    for(var r:core.db.queryForList("SELECT id FROM support_cases WHERE requester_account_id=? AND status='awaiting_evidence' ORDER BY updated_at,id",actor))out.add(item("support-"+r.get("id"),"帳號案件需要補件","查看補件需求並回覆。","support","action",null));
  }
  boolean validTransferApproval(Map<String,Object> transfer,String side){
    return memberships.validReviewGrant(transfer.get(side+"_grant"),transfer.get(side+"_actor"),transfer.get(side+"_club_id"));
  }
  void club(UUID actor,UUID club,List<Map<String,Object>> out){
    if(!"active".equals(core.one("SELECT status FROM clubs WHERE id=?",club).get("status")))return;
    boolean reviews=access.clubRole(actor,club,"club_president","club_secretary","club_manager","club_backup");
    if(reviews){
      for(var r:core.db.queryForList("SELECT id FROM join_applications WHERE club_id=? AND status='pending' AND expires_at>? ORDER BY requested_at,id",club,core.now()))out.add(item("application-"+r.get("id"),"入社申請待審核","查看本社申請與處理說明。","applications","action",null));
      for(var r:core.db.queryForList("SELECT * FROM membership_transfers WHERE status IN ('pending','ready_for_member','needs_reapproval') AND expires_at>? AND (ready_expires_at IS NULL OR ready_expires_at>?) AND (from_club_id=? OR to_club_id=?) ORDER BY requested_at,id",core.now(),core.now(),club,club)){
        boolean sourceChanged=!Objects.equals(r.get("source_version"),memberships.membership((UUID)r.get("from_membership_id")).get("version"));
        if(club.equals(r.get("from_club_id"))&&(sourceChanged||!validTransferApproval(r,"from"))||club.equals(r.get("to_club_id"))&&(sourceChanged||!validTransferApproval(r,"to")))
          out.add(item("transfer-"+r.get("id"),"轉社申請待本社核可","兩社核可後仍須本人最終確認。","transfers","action",null));
      }
    }
    long count=core.db.queryForList("SELECT * FROM memberships WHERE club_id=? AND status='active' AND starts_on<=? AND (ends_on IS NULL OR ends_on>?)",club,core.today(),core.today()).stream().filter(r->core.annual(r).equals("unconfirmed")).count();
    if(count>0)out.add(item("annual-"+club,count+" 位社員待年度確認","確認當年度社員狀態，避免影響曝光資格。","annual","action",null));
  }
  void support(UUID actor,List<Map<String,Object>> out){
    for(var r:core.db.queryForList("SELECT c.id,c.status FROM support_cases c JOIN support_case_assignments a ON a.case_id=c.id WHERE a.account_id=? AND c.status IN ('pending','awaiting_evidence') ORDER BY c.updated_at,c.id",actor)){
      boolean waiting=r.get("status").equals("awaiting_evidence");out.add(item("support-"+r.get("id"),waiting?"核身案件等待補件":"帳號案件待人工核身","查看已指派案件進度。","support",waiting?"waiting":"action",null));
    }
  }
  void business(UUID actor,UUID member,List<Map<String,Object>> out){
    var companies=core.db.queryForList("SELECT DISTINCT c.* FROM business_companies c LEFT JOIN business_company_links l ON l.company_id=c.id AND l.kind='editor' AND l.status='accepted' WHERE c.owner_member_id=? OR l.member_id=? ORDER BY c.name,c.id",member,member);
    for(var c:companies){
      UUID id=(UUID)c.get("id");String name=(String)c.get("name"),status=(String)c.get("status");
      if(Set.of("draft","pending","rejected").contains(status))out.add(item("exposure-"+id,name+"：待完善並發布","查看草稿與處理說明，儲存不會自動曝光。","businesses","action",id));
      else if(status.equals("suspended"))out.add(item("exposure-"+id,name+"：曝光已暫停","查看平台處理說明，依原因更正資料。","businesses","action",id));
      else if(status.equals("approved")){
        var eligible=business.eligibility(c);
        if(!Boolean.TRUE.equals(eligible.get("eligible")))out.add(item("exposure-"+id,name+"：曝光資格已到期","確認當年度社籍或有效廣告，重新發布不會重啟三日曝光。","businesses","action",id));
        else if(!Boolean.TRUE.equals(eligible.get("free"))){
          Instant end=Instant.MIN,now=core.clock.instant();
          if(Boolean.TRUE.equals(eligible.get("trial")))end=((Timestamp)c.get("first_published_at")).toInstant().plus(Duration.ofHours(72));
          for(var g:core.db.queryForList("SELECT starts_on FROM business_exposure_grants WHERE company_id=? AND status='active'",id)){
            LocalDate start=((java.sql.Date)g.get("starts_on")).toLocalDate();Instant s=start.atStartOfDay(BusinessService.TAIPEI).toInstant(),e=start.plusYears(1).atStartOfDay(BusinessService.TAIPEI).toInstant();
            if(!now.isBefore(s)&&now.isBefore(e)&&e.isAfter(end))end=e;
          }
          if(end.isAfter(now)&&!end.isAfter(now.plus(Duration.ofDays(7))))out.add(item("exposure-"+id,name+"：曝光即將到期","目前有效曝光最晚至 "+end+"；確認社籍或廣告資格才能繼續曝光。","businesses","reminder",id));
        }
      }
    }
    for(var r:core.db.queryForList("SELECT l.id,l.member_id,c.id company_id,c.name,c.owner_member_id FROM business_company_links l JOIN business_companies c ON c.id=l.company_id WHERE l.kind='editor' AND l.status='pending' AND (l.member_id=? OR c.owner_member_id=?) ORDER BY l.invited_at,l.id",member,member)){
      boolean incoming=member.equals(r.get("member_id"));out.add(item("invitation-"+r.get("id"),r.get("name")+ (incoming?"：共同維護邀請待回覆":"：等待共同維護邀請回覆"),"接受只取得公司維護權，不授予優惠核銷或會員資格。","invitations",incoming?"action":"waiting",(UUID)r.get("company_id")));
    }
  }
}
