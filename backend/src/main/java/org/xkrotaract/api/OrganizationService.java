package org.xkrotaract.api;

import static org.xkrotaract.api.Input.*;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.servlet.http.HttpServletRequest;
import java.net.URI;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import org.springframework.stereotype.Service;

/** Organization boundaries, dated role delegation, and bilateral district moves. */
@Service
class OrganizationService {
  static final Set<String> CLUB_ROLES = Set.of("club_president","club_secretary","club_manager","club_backup");
  static final Set<String> PLATFORM_ROLES = Set.of("permission_admin","account_support","content_manager","operations","history_admin");
  final CoreService core;
  final ApiSupport support;
  final Queries queries;

  OrganizationService(CoreService core, ApiSupport support, Queries queries) {
    this.core=core;
    this.support=support;
    this.queries=queries;
  }

  Map<String,Object> clubRow(UUID id, boolean lock) {
    return core.one("SELECT * FROM clubs WHERE id=?"+(lock?" FOR UPDATE":""),id);
  }

  void checkVersion(JsonNode b,Map<String,Object> row) {
    if(version(b)!=(Integer)row.get("version"))
      throw new ApiException(409,"VERSION_CONFLICT","資料已更新，請重新載入後再確認。");
  }

  void forbidden() { throw new ApiException(403,"FORBIDDEN","沒有此範圍的操作權限。"); }

  void requireDistrict(UUID actor,UUID district) {
    if(!support.districtRole(actor,district)) forbidden();
  }

  void requireManage(UUID actor,UUID club) {
    if(!support.managesClub(actor,club)) forbidden();
  }

  boolean managesRoles(UUID actor,UUID club) {
    var row=clubRow(club,false);
    return support.districtRole(actor,(UUID)row.get("district_id")) ||
        support.clubRole(actor,club,"club_president","club_secretary","club_backup");
  }

  void authorizePatch(UUID actor,UUID id,JsonNode b) {
    requireManage(actor,id);
    if((b.has("name")||b.has("logoAssetId")) && !managesRoles(actor,id)) forbidden();
    if(b.has("clubTypeCode")||b.has("districtId"))
      requireDistrict(actor,(UUID)clubRow(id,false).get("district_id"));
  }

  JsonNode node(Object value) {
    try { return value==null?core.json.createArrayNode():core.json.readTree(value.toString()); }
    catch(Exception e) { throw new IllegalStateException(e); }
  }

  Map<String,Object> visibility(Map<String,Object> row) {
    var v=node(row.get("contact_visibility"));
    var links=node(row.get("social_links"));
    var flags=new ArrayList<Boolean>();
    for(int i=0;i<links.size();i++) flags.add(v.path("socialLinks").path(i).asBoolean(false));
    return map("email",v.path("email").asBoolean(false),"website",v.path("website").asBoolean(false),"socialLinks",flags);
  }

  Map<String,Object> publicClub(Map<String,Object> row) {
    var out=map("id",row.get("id"),"name",row.get("name"),"clubTypeCode",row.get("type_code"),
        "districtId",row.get("district_id"),"logoAssetId",row.get("logo_asset_id"),"description",row.get("description"));
    var v=visibility(row);
    if(Boolean.TRUE.equals(v.get("email")) && row.get("contact_email")!=null) out.put("contactEmail",row.get("contact_email"));
    if(Boolean.TRUE.equals(v.get("website")) && row.get("website")!=null) out.put("website",row.get("website"));
    var links=node(row.get("social_links"));
    var allowed=(List<?>)v.get("socialLinks");
    var visible=new ArrayList<String>();
    for(int i=0;i<links.size();i++) if(Boolean.TRUE.equals(allowed.get(i))) visible.add(links.get(i).asText());
    if(!visible.isEmpty()) out.put("socialLinks",visible);
    return out;
  }

  Map<String,Object> managedClub(Map<String,Object> row) {
    var out=publicClub(row);
    out.put("contactEmail",row.get("contact_email"));
    out.put("website",row.get("website"));
    out.put("socialLinks",node(row.get("social_links")));
    out.put("contactVisibility",visibility(row));
    out.put("status",row.get("status"));
    out.put("version",row.get("version"));
    return out;
  }

  Object club(UUID id,String view,UUID actor) {
    if(!Set.of("public","managed").contains(view)) throw ApiException.bad();
    var row=clubRow(id,false);
    if(view.equals("managed")) {
      requireManage(actor,id);
      return map("projection","managed","data",managedClub(row));
    }
    if(!"active".equals(row.get("status"))||!Boolean.TRUE.equals(row.get("is_public"))) throw ApiException.missing();
    return map("projection","public","data",publicClub(row));
  }

  Object publicClubs(Map<String,String> q) {
    queries.validate(q,Set.of("page","pageSize","keyword","districtId","clubTypeCode"));
    return ApiSupport.page(core.db.queryForList("SELECT * FROM clubs WHERE status='active' AND is_public=true ORDER BY name,id").stream()
        .filter(r->queries.keyword(q,(String)r.get("name")))
        .filter(r->!q.containsKey("districtId")||r.get("district_id").toString().equals(q.get("districtId")))
        .filter(r->!q.containsKey("clubTypeCode")||r.get("type_code").equals(q.get("clubTypeCode")))
        .map(this::publicClub).toList(),q);
  }

  Object districts(Map<String,String> q) {
    queries.validate(q,Set.of("page","pageSize","keyword"));
    return ApiSupport.page(core.db.queryForList("SELECT * FROM districts ORDER BY code,id").stream()
        .filter(r->queries.keyword(q,r.get("code")+" "+r.get("name")))
        .map(r->map("id",r.get("id"),"code",r.get("code"),"name",r.get("name"),"status","active")).toList(),q);
  }

  Object overview(UUID actor,Map<String,String> q) {
    queries.validate(q,Set.of("page","pageSize","districtId","status"));
    if(q.containsKey("districtId")) requireDistrict(actor,UUID.fromString(q.get("districtId")));
    if(q.containsKey("status")&&!Set.of("active","disabled").contains(q.get("status"))) throw ApiException.bad();
    var rows=core.db.queryForList("SELECT * FROM clubs ORDER BY name,id").stream()
        .filter(r->support.managesClub(actor,(UUID)r.get("id")))
        .filter(r->!q.containsKey("districtId")||r.get("district_id").toString().equals(q.get("districtId")))
        .filter(r->!q.containsKey("status")||r.get("status").equals(q.get("status")))
        .map(this::managedClub).toList();
    return ApiSupport.page(rows,q);
  }

  void validateContacts(JsonNode b,Map<String,Object> current) {
    if(b.has("description")) optional(b,"description",5000);
    if(b.has("contactEmail")&&!b.get("contactEmail").isNull()) {
      String email=text(b,"contactEmail",3,254);
      if(!email.matches("[^\\s@]+@[^\\s@]+\\.[^\\s@]+")) throw ApiException.bad();
    }
    if(b.has("website")&&!b.get("website").isNull()) url(text(b,"website",1,2048));
    JsonNode links=b.has("socialLinks")?b.get("socialLinks"):node(current.get("social_links"));
    if(!links.isArray()||links.size()>10) throw ApiException.bad();
    for(var link:links) { if(!link.isTextual()) throw ApiException.bad(); url(link.asText()); }
    if(b.has("contactVisibility")) {
      var v=b.get("contactVisibility");
      fields(v,"email","website","socialLinks");
      if(!v.path("email").isBoolean()||!v.path("website").isBoolean()||!v.path("socialLinks").isArray()
          ||v.get("socialLinks").size()!=links.size()) throw ApiException.bad();
      for(var flag:v.get("socialLinks")) if(!flag.isBoolean()) throw ApiException.bad();
    }
  }

  String contactVisibility(JsonNode b,Map<String,Object> row) {
    if(b.has("contactVisibility")) return b.get("contactVisibility").toString();
    var old=node(row.get("contact_visibility"));
    var links=b.has("socialLinks")?b.get("socialLinks"):node(row.get("social_links"));
    // New or changed links default to hidden rather than inheriting publication consent.
    if(b.has("socialLinks")&&!links.equals(node(row.get("social_links")))) {
      var flags=new ArrayList<Boolean>();
      for(int i=0;i<links.size();i++) flags.add(false);
      try { return core.json.writeValueAsString(map("email",old.path("email").asBoolean(false),"website",old.path("website").asBoolean(false),"address",old.path("address").asBoolean(false),"socialLinks",flags)); }
      catch(com.fasterxml.jackson.core.JsonProcessingException e) { throw new IllegalStateException(e); }
    }
    return row.get("contact_visibility")==null?"{\"email\":false,\"website\":false,\"socialLinks\":[]}":row.get("contact_visibility").toString();
  }

  void url(String value) {
    try {
      URI u=URI.create(value);
      if(value.length()>2048||!Set.of("http","https").contains(u.getScheme())||u.getHost()==null||u.getUserInfo()!=null)
        throw ApiException.bad();
    } catch(IllegalArgumentException e) { throw ApiException.bad(); }
  }

  Object create(UUID actor,JsonNode b) {
    fields(b,"name","clubTypeCode","districtId","logoAssetId","description","contactEmail","website","socialLinks","contactVisibility");
    UUID district=uuid(b,"districtId");
    requireDistrict(actor,district);
    core.one("SELECT * FROM districts WHERE id=?",district);
    String type=text(b,"clubTypeCode",1,20);
    if(!Set.of("ROTARACT","ROTARY").contains(type)) throw ApiException.bad();
    // Create the club first, then upload a club-scoped verified image and PATCH its ID.
    if(b.has("logoAssetId")&&!b.get("logoAssetId").isNull()) {uuid(b,"logoAssetId");throw ApiException.missing();}
    var empty=new HashMap<String,Object>();
    empty.put("social_links","[]");
    validateContacts(b,empty);
    UUID id=UUID.randomUUID();
    core.db.update("INSERT INTO clubs(id,name,type_code,district_id,description,contact_email,website,social_links,contact_visibility) VALUES(?,?,?,?,?,?,?,?::jsonb,?::jsonb)",
        id,text(b,"name",1,100),type,district,optional(b,"description",5000),optional(b,"contactEmail",254),optional(b,"website",2048),
        b.has("socialLinks")?b.get("socialLinks").toString():"[]",
        contactVisibility(b,empty));
    audit(actor,"club.create",id,"新增社團",map("districtId",district,"clubTypeCode",type));
    return managedClub(clubRow(id,false));
  }

  Object patch(UUID actor,UUID id,JsonNode b) {
    fields(b,"version","name","clubTypeCode","districtId","logoAssetId","description","contactEmail","website","socialLinks","contactVisibility");
    if(b.size()<2) throw ApiException.bad();
    var row=clubRow(id,true);
    authorizePatch(actor,id,b);
    checkVersion(b,row);
    if(b.has("districtId")&&!uuid(b,"districtId").equals(row.get("district_id")))
      throw new ApiException(409,"STATE_CONFLICT","跨區必須透過雙方地區核准的轉區流程。");
    String type=b.has("clubTypeCode")?text(b,"clubTypeCode",1,20):(String)row.get("type_code");
    if(!Set.of("ROTARACT","ROTARY").contains(type)) throw ApiException.bad();
    if(!type.equals(row.get("type_code")) && core.db.queryForObject("SELECT count(*) FROM memberships WHERE club_id=?",Integer.class,id)>0)
      throw new ApiException(409,"STATE_CONFLICT","已有社籍的社團類型需以更正案件處理。");
    if(!type.equals(row.get("type_code")) && core.db.queryForObject("SELECT count(*) FROM join_applications WHERE club_id=? AND status='pending'",Integer.class,id)>0)
      throw ApiException.conflict();
    validateContacts(b,row);
    UUID logo=b.has("logoAssetId")?(b.get("logoAssetId").isNull()?null:uuid(b,"logoAssetId")):(UUID)row.get("logo_asset_id");
    if(logo!=null && b.has("logoAssetId")) {
      var asset=core.one("SELECT * FROM assets WHERE id=?",logo);
      if(!"club_logo".equals(asset.get("purpose"))||!id.equals(asset.get("club_id"))||asset.get("case_id")!=null)
        throw ApiException.missing();
      if(!actor.equals(asset.get("owner_account_id"))&&!managesRoles(actor,id)) forbidden();
    }
    core.db.update("UPDATE clubs SET name=?,type_code=?,logo_asset_id=?,description=?,contact_email=?,website=?,social_links=?::jsonb,contact_visibility=?::jsonb,version=version+1 WHERE id=?",
        b.has("name")?text(b,"name",1,100):row.get("name"),type,logo,
        b.has("description")?optional(b,"description",5000):row.get("description"),
        b.has("contactEmail")?optional(b,"contactEmail",254):row.get("contact_email"),
        b.has("website")?optional(b,"website",2048):row.get("website"),
        b.has("socialLinks")?b.get("socialLinks").toString():node(row.get("social_links")).toString(),
        contactVisibility(b,row),id);
    audit(actor,"club.update",id,"修改社團資料",map("version",version(b)));
    return managedClub(clubRow(id,false));
  }

  Object status(UUID actor,UUID id,JsonNode b,boolean active) {
    fields(b,"version","reason");
    var row=clubRow(id,true);
    requireDistrict(actor,(UUID)row.get("district_id"));
    checkVersion(b,row);
    if(active=="active".equals(row.get("status"))) throw ApiException.conflict();
    String reason=text(b,"reason",1,1000);
    core.db.update("UPDATE clubs SET status=?,disabled_at=?,disabled_reason=?,version=version+1 WHERE id=?",
        active?"active":"disabled",active?null:core.now(),active?null:reason,id);
    if(!active) {
      core.db.update("UPDATE join_applications SET status='terminated',reason='club_disabled',decided_at=?,version=version+1 WHERE club_id=? AND status='pending'",core.now(),id);
      core.db.update("UPDATE membership_transfers SET status='terminated',decision_reason='club_disabled',version=version+1 WHERE (from_club_id=? OR to_club_id=?) AND status IN ('pending','ready_for_member','needs_reapproval')",id,id);
      core.db.update("UPDATE events SET public_withdrawn_at=?,version=version+1 WHERE organizer_type='club' AND organizer_id=? AND ends_at>? AND status IN ('published','cancelled')",core.now(),id,core.now());
      core.db.update("UPDATE club_move_requests SET status='expired',version=version+1 WHERE club_id=? AND status IN ('pending','ready')",id);
    }
    audit(actor,active?"club.restore":"club.disable",id,reason,map("status",active?"active":"disabled"));
    return managedClub(clubRow(id,false));
  }

  void expireMoves() {
    core.db.update("UPDATE club_move_requests SET status='expired',version=version+1 WHERE status IN ('pending','ready') AND expires_at<=?",core.now());
  }

  Object requestMove(UUID actor,JsonNode b) {
    fields(b,"clubId","targetDistrictId","reason","clubVersion");
    UUID club=uuid(b,"clubId"), target=uuid(b,"targetDistrictId");
    var row=clubRow(club,true);
    requireDistrict(actor,(UUID)row.get("district_id"));
    core.one("SELECT id FROM districts WHERE id=?",target);
    if(!"active".equals(row.get("status"))||target.equals(row.get("district_id"))) throw ApiException.conflict();
    if(!b.path("clubVersion").isIntegralNumber()||!b.path("clubVersion").canConvertToInt()||b.path("clubVersion").intValue()!=(Integer)row.get("version"))
      throw ApiException.conflict();
    expireMoves();
    invalidateStaleMoves(actor,row);
    UUID id=UUID.randomUUID();
    String reason=text(b,"reason",1,1000);
    core.db.update("INSERT INTO club_move_requests(id,club_id,source_district_id,target_district_id,reason,club_version,requested_at,expires_at) VALUES(?,?,?,?,?,?,?,?)",
        id,club,row.get("district_id"),target,reason,row.get("version"),core.now(),Timestamp.from(core.clock.instant().plus(Duration.ofDays(30))));
    audit(actor,"club.move.request",id,reason,map("clubId",club,"targetDistrictId",target));
    return moveDto(core.one("SELECT * FROM club_move_requests WHERE id=?",id));
  }

  Object moves(UUID actor,Map<String,String> q) {
    queries.validate(q,Set.of("page","pageSize","districtId","status"));
    if(q.containsKey("districtId")) requireDistrict(actor,UUID.fromString(q.get("districtId")));
    if(q.containsKey("status")&&!Set.of("pending","ready","completed","rejected","expired").contains(q.get("status"))) throw ApiException.bad();
    expireMoves();
    return ApiSupport.page(core.db.queryForList("SELECT * FROM club_move_requests ORDER BY requested_at DESC,id").stream()
        .filter(r->support.districtRole(actor,(UUID)r.get("source_district_id"))||support.districtRole(actor,(UUID)r.get("target_district_id")))
        .filter(r->!q.containsKey("districtId")||q.get("districtId").equals(r.get("source_district_id").toString())||q.get("districtId").equals(r.get("target_district_id").toString()))
        .filter(r->!q.containsKey("status")||q.get("status").equals(r.get("status")))
        .map(this::moveDto).toList(),q);
  }

  Map<String,Object> moveDto(Map<String,Object> row) {
    return map("id",row.get("id"),"clubId",row.get("club_id"),"sourceDistrictId",row.get("source_district_id"),
        "targetDistrictId",row.get("target_district_id"),"status",row.get("status"),"sourceApprovedBy",row.get("source_approved_by"),
        "targetApprovedBy",row.get("target_approved_by"),"reason",row.get("reason"),"version",row.get("version"),"clubVersion",row.get("club_version"));
  }

  void authorizeMove(UUID actor,UUID id,JsonNode b,boolean execute) {
    var row=core.one("SELECT * FROM club_move_requests WHERE id=?",id);
    if(execute) {
      if(!support.districtRole(actor,(UUID)row.get("source_district_id"))&&!support.districtRole(actor,(UUID)row.get("target_district_id"))) forbidden();
    } else {
      String side=text(b,"side",1,10);
      if(!Set.of("source","target").contains(side)) throw ApiException.bad();
      requireDistrict(actor,(UUID)row.get(side+"_district_id"));
    }
  }

  Map<String,Object> districtGrant(UUID actor,UUID district) {
    requireDistrict(actor,district);
    return support.grants(actor).stream().filter(r->"district_manager".equals(r.get("role"))&&district.equals(r.get("effective_scope_id"))).findFirst().orElseThrow(ApiException::missing);
  }

  Object approveMove(UUID actor,UUID id,JsonNode b) {
    fields(b,"version","side");
    var initial=core.one("SELECT * FROM club_move_requests WHERE id=?",id);
    var club=clubRow((UUID)initial.get("club_id"),true);
    var row=core.one("SELECT * FROM club_move_requests WHERE id=? FOR UPDATE",id);
    authorizeMove(actor,id,b,false);
    checkVersion(b,row);
    if(!"pending".equals(row.get("status"))||!((Timestamp)row.get("expires_at")).toInstant().isAfter(core.clock.instant())
        ||!"active".equals(club.get("status"))||!club.get("district_id").equals(row.get("source_district_id"))||!club.get("version").equals(row.get("club_version"))) throw ApiException.conflict();
    String side=text(b,"side",1,10),other=side.equals("source")?"target":"source";
    if(row.get(side+"_approved_by")!=null) throw ApiException.conflict();
    // The two independent scopes must be approved by different named operators.
    if(actor.equals(row.get(other+"_approved_by"))) forbidden();
    var grant=districtGrant(actor,(UUID)row.get(side+"_district_id"));
    core.db.update("UPDATE club_move_requests SET "+side+"_approved_by=?,"+side+"_grant_id=?,status=?,version=version+1 WHERE id=?",
        actor,grant.get("id"),row.get(other+"_approved_by")==null?"pending":"ready",id);
    audit(actor,"club.move.approve."+side,id,(String)row.get("reason"),map("clubId",row.get("club_id")));
    return moveDto(core.one("SELECT * FROM club_move_requests WHERE id=?",id));
  }

  boolean approvalValid(Object grantId,Object actor,Object district) {
    return core.db.queryForList("SELECT r.id FROM role_grants r JOIN accounts a ON a.id=r.account_id WHERE r.id=? AND r.account_id=? AND r.role='district_manager' AND r.scope_type='district' AND r.scope_id=? AND r.revoked_at IS NULL AND r.starts_at<=? AND r.ends_at>? AND a.status='active' FOR SHARE OF r",
        grantId,actor,district,core.now(),core.now()).size()==1;
  }

  void invalidateStaleMoves(UUID actor,Map<String,Object> club) {
    for(var move:core.db.queryForList("SELECT * FROM club_move_requests WHERE club_id=? AND status IN ('pending','ready') FOR UPDATE",club.get("id"))) {
      if(!move.get("club_version").equals(club.get("version"))||!move.get("source_district_id").equals(club.get("district_id"))
          ||(move.get("source_approved_by")!=null&&!approvalValid(move.get("source_grant_id"),move.get("source_approved_by"),move.get("source_district_id")))
          ||(move.get("target_approved_by")!=null&&!approvalValid(move.get("target_grant_id"),move.get("target_approved_by"),move.get("target_district_id")))) {
        core.db.update("UPDATE club_move_requests SET status='expired',version=version+1 WHERE id=?",move.get("id"));
        audit(actor,"club.move.invalidate",(UUID)move.get("id"),"社團版本或地區核准已失效",map("clubId",club.get("id")));
      }
    }
  }

  static class MoveInvalidated extends RuntimeException {}

  Object executeMove(UUID actor,UUID id,JsonNode b) {
    fields(b,"version");
    var initial=core.one("SELECT * FROM club_move_requests WHERE id=?",id);
    var club=clubRow((UUID)initial.get("club_id"),true);
    var row=core.one("SELECT * FROM club_move_requests WHERE id=? FOR UPDATE",id);
    authorizeMove(actor,id,b,true);
    checkVersion(b,row);
    if(!"ready".equals(row.get("status"))) throw ApiException.conflict();
    if(!((Timestamp)row.get("expires_at")).toInstant().isAfter(core.clock.instant())
        ||!"active".equals(club.get("status"))||!club.get("district_id").equals(row.get("source_district_id"))
        ||!club.get("version").equals(row.get("club_version"))
        ||!approvalValid(row.get("source_grant_id"),row.get("source_approved_by"),row.get("source_district_id"))
        ||!approvalValid(row.get("target_grant_id"),row.get("target_approved_by"),row.get("target_district_id"))) {
      core.db.update("UPDATE club_move_requests SET status='expired',version=version+1 WHERE id=?",id);
      audit(actor,"club.move.invalidate",id,"社團版本或地區核准已失效",map("clubId",club.get("id")));
      // Controller handles this inside the mutation transaction so expiration commits with 409.
      throw new MoveInvalidated();
    }
    core.db.update("UPDATE clubs SET district_id=?,version=version+1 WHERE id=?",row.get("target_district_id"),club.get("id"));
    core.db.update("UPDATE club_move_requests SET status='completed',version=version+1 WHERE id=?",id);
    audit(actor,"club.move.execute",id,(String)row.get("reason"),map("clubId",club.get("id"),"from",row.get("source_district_id"),"to",row.get("target_district_id")));
    return managedClub(clubRow((UUID)club.get("id"),false));
  }

  Map<String,Object> roleDto(Map<String,Object> row) {
    return map("id",row.get("id"),"accountId",row.get("account_id"),"role",row.get("role"),
        "scope",map("scopeType",row.get("scope_type"),"scopeId",row.get("scope_id")==null?row.get("club_id"):row.get("scope_id")),"permissions",permissions(row),
        "startsAt",((Timestamp)row.get("starts_at")).toInstant().toString(),"endsAt",((Timestamp)row.get("ends_at")).toInstant().toString(),
        "grantedBy",row.get("granted_by"),"reason",row.get("reason"),"version",row.get("version"));
  }

  List<String> permissions(Map<String,Object> row) {
    try {
      Object raw=row.get("permissions");
      if(raw instanceof java.sql.Array a) return Arrays.asList((String[])a.getArray());
      if(raw instanceof String[] a) return Arrays.asList(a);
      return List.of();
    } catch(java.sql.SQLException e) { throw new IllegalStateException(e); }
  }

  Object roles(HttpServletRequest req,Map<String,String> q) {
    UUID actor=support.actor(req);
    if(support.platformRole(actor,"permission_admin")) support.requireMfa(req);
    queries.validate(q,Set.of("page","pageSize","scopeType","scopeId","accountId"));
    if(q.containsKey("scopeType")&&!Set.of("club","district","platform").contains(q.get("scopeType"))) throw ApiException.bad();
    if(q.containsKey("scopeId")) UUID.fromString(q.get("scopeId"));
    if(q.containsKey("accountId")) UUID.fromString(q.get("accountId"));
    return ApiSupport.page(core.db.queryForList("SELECT * FROM role_grants WHERE revoked_at IS NULL ORDER BY starts_at DESC,id").stream()
        .filter(r->actor.equals(r.get("account_id"))||support.platformRole(actor,"permission_admin")
            ||("club".equals(r.get("scope_type"))&&managesRoles(actor,(UUID)(r.get("scope_id")==null?r.get("club_id"):r.get("scope_id")))))
        .filter(r->!q.containsKey("scopeType")||q.get("scopeType").equals(r.get("scope_type")))
        .filter(r->!q.containsKey("scopeId")||q.get("scopeId").equals(Objects.toString(r.get("scope_id")==null?r.get("club_id"):r.get("scope_id"),"")))
        .filter(r->!q.containsKey("accountId")||q.get("accountId").equals(r.get("account_id").toString()))
        .map(this::roleDto).toList(),q);
  }

  void authorizeGrant(JsonNode b,HttpServletRequest req) {
    UUID actor=support.actor(req);
    String role=text(b,"role",1,40);
    var scope=b.path("scope");
    fields(scope,"scopeType","scopeId");
    String scopeType=text(scope,"scopeType",1,20);
    if(CLUB_ROLES.contains(role)) {
      if(!scopeType.equals("club")) throw ApiException.bad();
      UUID club=uuid(scope,"scopeId");
      boolean admin=support.platformRole(actor,"permission_admin");
      if(!admin&&!managesRoles(actor,club)) forbidden();
      if(admin) support.requireMfa(req);
      if(b.path("permissions").size()>0) { support.requirePlatform(actor,"permission_admin"); support.requireMfa(req); if(uuid(b,"accountId").equals(actor)) forbidden(); }
    } else {
      if(!role.equals("district_manager")&&!PLATFORM_ROLES.contains(role)) throw ApiException.bad();
      support.requirePlatform(actor,"permission_admin");
      support.requireMfa(req);
      if(uuid(b,"accountId").equals(actor)) forbidden();
      if(role.equals("district_manager")) {
        if(!scopeType.equals("district")) throw ApiException.bad();
        core.one("SELECT id FROM districts WHERE id=?",uuid(scope,"scopeId"));
      } else if(role.equals("content_manager")&&scopeType.equals("content")) {
        if(!scope.has("scopeId")) throw ApiException.bad();
        if(!scope.get("scopeId").isNull()) clubRow(uuid(scope,"scopeId"),false);
        else if(b.path("permissions").size()>0) throw ApiException.bad();
      } else if(!scopeType.equals("platform")||!scope.has("scopeId")||!scope.get("scopeId").isNull()) throw ApiException.bad();
    }
  }

  Object grant(JsonNode b,HttpServletRequest req) {
    fields(b,"accountId","role","scope","permissions","startsAt","endsAt","reason");
    authorizeGrant(b,req);
    UUID actor=support.actor(req), account=uuid(b,"accountId");
    String role=text(b,"role",1,40), scopeType=text(b.get("scope"),"scopeType",1,20);
    UUID scopeId=b.get("scope").get("scopeId").isNull()?null:uuid(b.get("scope"),"scopeId");
    var target=core.one("SELECT * FROM accounts WHERE id=?",account);
    if(!"active".equals(target.get("status"))) throw ApiException.conflict();
    Instant starts,ends;
    try { starts=Instant.parse(text(b,"startsAt",1,64));ends=Instant.parse(text(b,"endsAt",1,64)); }
    catch(DateTimeException e) { throw ApiException.bad(); }
    Instant today=core.today().atStartOfDay(ZoneId.of("Asia/Taipei")).toInstant();
    if(starts.isBefore(today)||!ends.isAfter(starts)||!ends.isAfter(core.clock.instant())) throw ApiException.bad();
    var local=starts.atZone(ZoneId.of("Asia/Taipei")).toLocalDate();
    Instant yearEnd=LocalDate.of(local.getYear()+(local.getMonthValue()>=7?1:0),7,1).atStartOfDay(ZoneId.of("Asia/Taipei")).toInstant();
    if((CLUB_ROLES.contains(role)||role.equals("district_manager"))&&ends.isAfter(yearEnd)) throw ApiException.bad();
    if(role.equals("history_admin")&&Duration.between(starts,ends).compareTo(Duration.ofDays(90))>0) throw ApiException.bad();
    if(!b.path("permissions").isArray()||b.get("permissions").size()>3) throw ApiException.bad();
    var perms=new ArrayList<String>();
    for(var p:b.get("permissions")) {
      if(!p.isTextual()||!Set.of("history:moderate","history:override","export:members").contains(p.asText())||perms.contains(p.asText())) throw ApiException.bad();
      perms.add(p.asText());
    }
    if(perms.contains("history:override")&&!role.equals("history_admin")) throw ApiException.bad();
    if(role.equals("history_admin")&&!perms.equals(List.of("history:override"))) throw ApiException.bad();
    if(perms.contains("history:moderate")&&!Set.of("club_president","club_secretary","district_manager","content_manager").contains(role)) throw ApiException.bad();
    if(perms.contains("history:moderate")&&role.equals("content_manager")&&!scopeType.equals("content")) throw ApiException.bad();
    if(perms.contains("export:members")&&!role.equals("district_manager")) throw ApiException.bad();
    if((role.equals("history_admin")||role.equals("permission_admin"))&&target.get("totp_secret_ciphertext")==null)
      throw new ApiException(409,"MFA_REQUIRED","此高權角色必須先完成本人 MFA 設定。");
    if(CLUB_ROLES.contains(role)) {
      var club=clubRow(scopeId,true);
      if(!"active".equals(club.get("status"))) throw ApiException.conflict();
      if(!role.equals("club_backup")&&core.db.queryForObject("SELECT count(*) FROM memberships m JOIN members mb ON mb.id=m.member_id WHERE mb.account_id=? AND m.club_id=? AND m.status='active'",Integer.class,account,scopeId)!=1)
        throw new ApiException(409,"STATE_CONFLICT","只有本社有效社員可以獲得個人社團職務。");
    }
    core.db.queryForObject("SELECT pg_advisory_xact_lock(hashtextextended(?,0)) IS NULL",Boolean.class,"role:"+scopeType+":"+scopeId+":"+role);
    String collision="SELECT count(*) FROM role_grants WHERE role=? AND scope_type=? AND COALESCE(scope_id,club_id) IS NOT DISTINCT FROM ? AND revoked_at IS NULL AND starts_at<? AND ends_at>?";
    var args=new ArrayList<Object>(List.of(role,scopeType)); args.add(scopeId);args.add(Timestamp.from(ends));args.add(Timestamp.from(starts));
    if(!Set.of("club_president","club_secretary","club_backup").contains(role)) { collision+=" AND account_id=?";args.add(account); }
    if(core.db.queryForObject(collision,Integer.class,args.toArray())>0) throw ApiException.conflict();
    UUID id=UUID.randomUUID();
    String reason=text(b,"reason",1,1000);
    core.db.update("INSERT INTO role_grants(id,account_id,role,club_id,starts_at,ends_at,granted_by,reason,scope_type,scope_id,permissions) VALUES(?,?,?,?,?,?,?,?,?,?,?::text[])",
        id,account,role,scopeType.equals("club")?scopeId:null,Timestamp.from(starts),Timestamp.from(ends),actor,reason,scopeType,scopeId,"{"+String.join(",",perms)+"}");
    audit(actor,"role.grant",id,reason,map("accountId",account,"role",role,"scopeType",scopeType,"scopeId",scopeId));
    return roleDto(core.one("SELECT * FROM role_grants WHERE id=?",id));
  }

  void authorizeRevoke(UUID id,HttpServletRequest req) {
    UUID actor=support.actor(req);
    var row=core.one("SELECT * FROM role_grants WHERE id=?",id);
    if("club".equals(row.get("scope_type"))&&permissions(row).isEmpty()) {
      if(!support.platformRole(actor,"permission_admin")&&!managesRoles(actor,(UUID)(row.get("scope_id")==null?row.get("club_id"):row.get("scope_id")))) forbidden();
      if(support.platformRole(actor,"permission_admin")) support.requireMfa(req);
    } else { support.requirePlatform(actor,"permission_admin");support.requireMfa(req); }
  }

  Object revoke(UUID id,JsonNode b,HttpServletRequest req) {
    fields(b,"version","reason");
    authorizeRevoke(id,req);
    var row=core.one("SELECT * FROM role_grants WHERE id=? FOR UPDATE",id);
    checkVersion(b,row);
    if(row.get("revoked_at")!=null) throw ApiException.conflict();
    String reason=text(b,"reason",1,1000);
    core.db.update("UPDATE role_grants SET revoked_at=?,version=version+1 WHERE id=?",core.now(),id);
    audit(support.actor(req),"role.revoke",id,reason,map("accountId",row.get("account_id"),"role",row.get("role")));
    return roleDto(core.one("SELECT * FROM role_grants WHERE id=?",id));
  }

  void audit(UUID actor,String action,UUID target,String reason,Map<String,Object> changes) {
    UUID event=UUID.randomUUID();
    core.db.update("INSERT INTO audit_events VALUES(?,?,?,?,?)",event,actor,action,target,core.now());
    try { core.db.update("INSERT INTO organization_audit_details(event_id,reason,changes) VALUES(?,?,?::jsonb)",event,reason,core.json.writeValueAsString(changes)); }
    catch(com.fasterxml.jackson.core.JsonProcessingException e) { throw new IllegalStateException(e); }
  }
}
