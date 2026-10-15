package org.xkrotaract.api;

import static org.xkrotaract.api.Input.*;

import com.fasterxml.jackson.databind.JsonNode;
import java.net.URI;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import org.springframework.stereotype.Service;

@Service
class BusinessService {
  final CoreService core;
  final ApiSupport access;
  static final ZoneId TAIPEI = ZoneId.of("Asia/Taipei");
  static final String[] INPUT = {"name","description","industryIds","city","phone","email","website","address","publicFlags","locationConsent","latitude","longitude"};

  BusinessService(CoreService core, ApiSupport access) { this.core=core; this.access=access; }

  public Map<String,Object> company(UUID id) { return core.one("SELECT * FROM business_companies WHERE id=?",id); }
  Map<String,Object> locked(UUID id) { return core.one("SELECT * FROM business_companies WHERE id=? FOR UPDATE",id); }
  UUID memberId(UUID account) { return (UUID)core.member(account).get("id"); }

  public boolean owner(UUID account,UUID companyId) {
    return core.db.queryForObject("SELECT count(*) FROM business_companies c JOIN members m ON m.id=c.owner_member_id WHERE c.id=? AND m.account_id=?",Integer.class,companyId,account)==1;
  }
  public boolean suspended(UUID companyId) { return "suspended".equals(company(companyId).get("status")); }
  public boolean isPublic(UUID companyId) {
    var rows=core.db.queryForList("SELECT * FROM business_companies WHERE id=?",companyId);
    return !rows.isEmpty() && publicProjection(rows.getFirst())!=null;
  }
  boolean maintains(UUID account,UUID id) {
    return owner(account,id) || core.db.queryForObject("SELECT count(*) FROM business_company_links l JOIN members m ON m.id=l.member_id WHERE l.company_id=? AND m.account_id=? AND l.kind='editor' AND l.status='accepted'",Integer.class,id,account)>0;
  }
  void requireMaintain(UUID account,UUID id) { company(id); if (!maintains(account,id)) throw ApiException.missing(); }
  void requireOwner(UUID account,UUID id) { company(id); if (!owner(account,id)) throw ApiException.missing(); }
  void requireContent(UUID account) { access.requirePlatform(account,"content_manager"); }
  void writable(Map<String,Object> c) { if ("suspended".equals(c.get("status"))) throw ApiException.conflict(); }
  void expected(Map<String,Object> row,JsonNode b) { if (version(b)!=(Integer)row.get("version")) throw ApiException.conflict(); }
  UUID id(Map<String,Object> row) { return (UUID)row.get("id"); }
  String string(Map<String,Object> c,String key) { return (String)c.get(key); }
  boolean yes(Map<String,Object> c,String key) { return Boolean.TRUE.equals(c.get(key)); }
  String instant(Object value) { return value==null ? null : ((Timestamp)value).toInstant().toString(); }

  Object industries() { return Map.of("items",core.db.queryForList("SELECT id,name FROM business_industries WHERE enabled=true ORDER BY id")); }

  List<String> industryIds(UUID id) {
    return core.db.queryForList("SELECT industry_id FROM business_company_industries WHERE company_id=? ORDER BY industry_id",String.class,id);
  }
  List<UUID> accepted(UUID id,String kind) {
    return core.db.queryForList("SELECT member_id FROM business_company_links WHERE company_id=? AND kind=? AND status='accepted' ORDER BY member_id",UUID.class,id,kind);
  }
  Set<UUID> associated(Map<String,Object> c) {
    var result=new LinkedHashSet<UUID>(); result.add((UUID)c.get("owner_member_id")); result.addAll(accepted(id(c),"member")); return result;
  }
  boolean validMember(UUID member) {
    return validMemberships(member).size()>0;
  }
  List<Map<String,Object>> validMemberships(UUID member) {
    var rows=core.db.queryForList("SELECT ms.*,c.name club_name,c.is_public club_public FROM memberships ms JOIN clubs c ON c.id=ms.club_id JOIN members m ON m.id=ms.member_id JOIN accounts a ON a.id=m.account_id WHERE ms.member_id=? AND ms.status='active' AND ms.starts_on<=? AND (ms.ends_on IS NULL OR ms.ends_on>?) AND c.status='active' AND a.status='active'",member,core.today(),core.today());
    return rows.stream().filter(r -> {
      int current=core.yearStart();
      if (Objects.equals(r.get("annual_unconfirmed_year"),current)) return false;
      return Set.of("confirmed","grace").contains(core.annual(r));
    }).toList();
  }

  Map<String,Object> eligibility(Map<String,Object> c) {
    boolean free=associated(c).stream().anyMatch(this::validMember);
    boolean paid=core.db.queryForList("SELECT starts_on FROM business_exposure_grants WHERE company_id=? AND status='active'",id(c)).stream().anyMatch(r -> {
      LocalDate start=((java.sql.Date)r.get("starts_on")).toLocalDate();
      return !core.today().isBefore(start) && core.today().isBefore(start.plusYears(1));
    });
    Instant first=c.get("first_published_at")==null ? null : ((Timestamp)c.get("first_published_at")).toInstant();
    boolean trial=first!=null && !core.clock.instant().isBefore(first) && core.clock.instant().isBefore(first.plus(Duration.ofHours(72)));
    return map("free",free,"paid",paid,"trial",trial,"eligible",free||paid||trial);
  }

  Map<String,Object> confirmationSummary(Map<String,Object> c) {
    var excluded=new HashSet<>(accepted(id(c),"editor")); excluded.add((UUID)c.get("owner_member_id"));
    var rows=core.db.queryForList("SELECT * FROM business_confirmations WHERE company_id=? ORDER BY confirmed_at DESC",id(c));
    Instant now=core.clock.instant(),last=null; int count=0;
    for (var r: rows) {
      UUID member=(UUID)r.get("member_id"); Instant start=((Timestamp)r.get("confirmed_at")).toInstant();
      Instant end=start.atZone(TAIPEI).plusYears(1).toInstant();
      if (!excluded.contains(member) && !now.isBefore(start) && now.isBefore(end) && validMember(member)) {
        count++; if (last==null) last=start;
      }
    }
    var out=map("confirmationCount",count,"communityConfirmed",count>=6);
    if (last!=null) out.put("lastConfirmedAt",last.toString());
    return out;
  }

  boolean website(String value) {
    if (value==null || value.isBlank()) return false;
    try { URI u=URI.create(value); return Set.of("https","http").contains(u.getScheme()==null?"":u.getScheme().toLowerCase(Locale.ROOT)) && u.getHost()!=null && !u.getHost().isBlank() && u.getRawUserInfo()==null; }
    catch (IllegalArgumentException e) { return false; }
  }
  boolean coordinates(Map<String,Object> c) {
    if (!(c.get("latitude") instanceof Number lat) || !(c.get("longitude") instanceof Number lon)) return false;
    return Double.isFinite(lat.doubleValue()) && Double.isFinite(lon.doubleValue()) && Math.abs(lat.doubleValue())<=90 && Math.abs(lon.doubleValue())<=180;
  }
  boolean publishable(Map<String,Object> c) {
    if (string(c,"name").isBlank() || string(c,"city").isBlank() || industryIds(id(c)).isEmpty()) return false;
    if (!string(c,"email").isBlank() && !string(c,"email").matches("[^\\s@]+@[^\\s@]+\\.[^\\s@]+")) return false;
    if (!string(c,"website").isBlank() && !website(string(c,"website"))) return false;
    if ((c.get("latitude")!=null || c.get("longitude")!=null) && !coordinates(c)) return false;
    for (var key:List.of("phone","email","website","address"))
      if (yes(c,key+"_public") && !string(c,key).isBlank() && (!key.equals("website") || website(string(c,key)))) return true;
    return false;
  }

  Map<String,Object> publicProjection(Map<String,Object> c) {
    if (!"approved".equals(c.get("status")) || !publishable(c)) return null;
    var qualification=eligibility(c); if (!yes(qualification,"eligible")) return null;
    var out=map("id",id(c),"name",c.get("name"),"description",c.get("description"),"industryIds",industryIds(id(c)),"city",c.get("city"));
    for (var key:List.of("phone","email","website","address"))
      if (yes(c,key+"_public") && !string(c,key).isBlank()) out.put(key,c.get(key));
    boolean located=yes(c,"location_consent") && coordinates(c);
    out.put("mapVisible",located); if (located) { out.put("latitude",c.get("latitude")); out.put("longitude",c.get("longitude")); }
    out.put("exposure",yes(qualification,"paid") ? "advertisement" : yes(qualification,"free") ? "free" : "trial");
    if (c.get("first_published_at")!=null) out.put("trialEndsAt",((Timestamp)c.get("first_published_at")).toInstant().plus(Duration.ofHours(72)).toString());
    var contacts=new ArrayList<Map<String,Object>>();
    for (UUID member:associated(c)) {
      boolean independent=yes(qualification,"paid")||yes(qualification,"trial");
      var memberships=independent ? core.db.queryForList("SELECT DISTINCT ON (ms.type_code) ms.*,c.name club_name,c.is_public club_public FROM memberships ms JOIN clubs c ON c.id=ms.club_id WHERE ms.member_id=? AND ms.status<>'void' ORDER BY ms.type_code,(ms.status='active') DESC,ms.starts_on DESC,ms.id",member) : validMemberships(member);
      var names=core.db.queryForList("SELECT call_name FROM members WHERE id=?",member);
      if (names.isEmpty() || ((String)names.getFirst().get("call_name")).isBlank()) continue;
      var seen=new HashSet<UUID>();
      for (var ms:memberships) {
        UUID club=(UUID)ms.get("club_id"); if (!yes(ms,"club_public") || !seen.add(club)) continue;
        if (!independent && !validMember(member)) continue;
        contacts.add(map("callName",names.getFirst().get("call_name"),"clubId",club,"clubName",ms.get("club_name")));
      }
    }
    out.put("contacts",contacts); out.putAll(confirmationSummary(c)); return out;
  }

  Object publicDetail(UUID id) { var out=publicProjection(company(id)); if(out==null) throw ApiException.missing(); return out; }

  Object publicList(Map<String,String> q,boolean mapOnly) {
    checkQueries(q,Set.of("keyword","city","clubId","industryId","mapOnly","bounds","south","north","west","east","page","pageSize"));
    if (q.containsKey("mapOnly") && !Set.of("true","false").contains(q.get("mapOnly"))) throw ApiException.bad();
    final boolean requireMap=mapOnly||"true".equals(q.get("mapOnly"));
    double[] bounds=bounds(q); String keyword=q.getOrDefault("keyword","").strip().toLowerCase(Locale.ROOT);
    if (keyword.length()>200) throw ApiException.bad();
    if(q.containsKey("clubId")) UUID.fromString(q.get("clubId"));
    var projected=new ArrayList<Map<String,Object>>();
    for (var c:core.db.queryForList("SELECT * FROM business_companies WHERE status='approved' ORDER BY name,id")) {
      var p=publicProjection(c); if (p==null) continue;
      if (requireMap && !yes(p,"mapVisible")) continue;
      if (q.containsKey("city") && !q.get("city").equals(p.get("city"))) continue;
      if (q.containsKey("industryId") && !((List<?>)p.get("industryIds")).contains(q.get("industryId"))) continue;
      @SuppressWarnings("unchecked") var contacts=(List<Map<String,Object>>)p.get("contacts");
      if (q.containsKey("clubId") && contacts.stream().noneMatch(x -> q.get("clubId").equals(x.get("clubId").toString()))) continue;
      String haystack=p.get("name")+" "+p.get("description")+" "+contacts.stream().map(x -> x.get("callName")+" "+x.get("clubName")).reduce("",(a,b)->a+" "+b);
      if (!haystack.toLowerCase(Locale.ROOT).contains(keyword)) continue;
      if (bounds!=null) {
        if (!yes(p,"mapVisible")) continue;
        double lat=((Number)p.get("latitude")).doubleValue(),lon=((Number)p.get("longitude")).doubleValue();
        if (lat<bounds[0]||lat>bounds[2] || (bounds[1]<=bounds[3] ? lon<bounds[1]||lon>bounds[3] : lon<bounds[1]&&lon>bounds[3])) continue;
      }
      projected.add(p);
    }
    return ApiSupport.page(projected,q);
  }

  void checkQueries(Map<String,String> q,Set<String> permitted) {
    if (!permitted.containsAll(q.keySet())) throw ApiException.bad();
  }
  double[] bounds(Map<String,String> q) {
    String[] raw=null;
    if(q.containsKey("bounds")) {
      if (List.of("south","west","north","east").stream().anyMatch(q::containsKey)) throw ApiException.bad();
      raw=q.get("bounds").split(",",-1); if(raw.length!=4) throw ApiException.bad();
    } else if (List.of("south","west","north","east").stream().anyMatch(q::containsKey)) {
      if(!List.of("south","west","north","east").stream().allMatch(q::containsKey)) throw ApiException.bad();
      raw=new String[]{q.get("south"),q.get("west"),q.get("north"),q.get("east")};
    }
    if(raw==null) return null;
    double[] values=new double[4];
    try { for(int i=0;i<4;i++) { values[i]=Double.parseDouble(raw[i]); if(!Double.isFinite(values[i])) throw ApiException.bad(); } }
    catch(NumberFormatException e) { throw ApiException.bad(); }
    if(Math.abs(values[0])>90||Math.abs(values[2])>90||Math.abs(values[1])>180||Math.abs(values[3])>180||values[0]>values[2]) throw ApiException.bad();
    return values;
  }

  Map<String,Object> managementProjection(Map<String,Object> c,boolean reviewer) {
    var out=map("id",id(c),"name",c.get("name"),"description",c.get("description"),"city",c.get("city"),"industryIds",industryIds(id(c)),"status",c.get("status"),"version",c.get("version"),"locationConsent",c.get("location_consent"),"publicFlags",map("phone",c.get("phone_public"),"email",c.get("email_public"),"website",c.get("website_public"),"address",c.get("address_public")));
    for(var key:List.of("phone","email","website","address")) if(!reviewer||yes(c,key+"_public")) out.put(key,c.get(key));
    if(!reviewer||yes(c,"location_consent")) { out.put("latitude",c.get("latitude")); out.put("longitude",c.get("longitude")); }
    if(!reviewer) { out.put("ownerId",c.get("owner_member_id")); out.put("acceptedMaintainerIds",accepted(id(c),"editor")); out.put("acceptedMemberIds",accepted(id(c),"member")); }
    if(c.get("review_reason")!=null) out.put("reviewReason",c.get("review_reason"));
    if(c.get("first_published_at")!=null) { out.put("firstPublishedAt",instant(c.get("first_published_at"))); out.put("trialEndsAt",((Timestamp)c.get("first_published_at")).toInstant().plus(Duration.ofHours(72)).toString()); }
    out.put("eligibility",eligibility(c)); out.putAll(confirmationSummary(c)); return out;
  }
  Object list(UUID actor,Map<String,String> q,boolean reviewer) {
    if(reviewer) requireContent(actor);
    checkQueries(q,Set.of("status","keyword","page","pageSize"));
    if(q.containsKey("status")&&!Set.of("draft","pending","approved","rejected","suspended").contains(q.get("status"))) throw ApiException.bad();
    String keyword=q.getOrDefault("keyword","").strip().toLowerCase(Locale.ROOT); if(keyword.length()>200) throw ApiException.bad();
    var list=new ArrayList<Map<String,Object>>();
    for(var c:core.db.queryForList("SELECT * FROM business_companies ORDER BY updated_at DESC,id")) {
      if(!reviewer&&!maintains(actor,id(c))) continue;
      if(q.containsKey("status")&&!q.get("status").equals(c.get("status"))) continue;
      if(!string(c,"name").toLowerCase(Locale.ROOT).contains(keyword)) continue;
      list.add(managementProjection(c,reviewer));
    }
    return ApiSupport.page(list,q);
  }
  Object detail(UUID actor,UUID id,boolean reviewer) { if(reviewer) requireContent(actor); else requireMaintain(actor,id); return managementProjection(company(id),reviewer); }

  Map<String,Object> input(JsonNode b,boolean update) {
    var allowed=new ArrayList<>(List.of(INPUT)); if(update) allowed.add("version"); fields(b,allowed.toArray(String[]::new));
    var result=map("name",text(b,"name",1,200),"description",empty(optional(b,"description",2000)),"city",empty(optional(b,"city",80)));
    for(var key:List.of("phone","email","website","address")) result.put(key,empty(optional(b,key,500)));
    if(!string(result,"email").isEmpty()&&!string(result,"email").matches("[^\\s@]+@[^\\s@]+\\.[^\\s@]+")) throw ApiException.bad();
    if(!string(result,"website").isEmpty()&&!website(string(result,"website"))) throw ApiException.bad();
    var flag=b.get("publicFlags"); fields(flag,"phone","email","website","address");
    for(var key:List.of("phone","email","website","address")) result.put(key+"_public",bool(flag,key));
    result.put("location_consent",bool(b,"locationConsent"));
    for(var key:List.of("latitude","longitude")) {
      JsonNode v=b.get(key); if(v!=null&&!v.isNull()&&(!v.isNumber()||!Double.isFinite(v.asDouble()))) throw ApiException.bad();
      result.put(key,v==null||v.isNull()?null:v.asDouble());
    }
    if((result.get("latitude")!=null||result.get("longitude")!=null)&&!coordinates(result)) throw ApiException.bad();
    JsonNode industries=b.get("industryIds"); if(industries==null||!industries.isArray()||industries.size()>30) throw ApiException.bad();
    var ids=new LinkedHashSet<String>();
    for(var v:industries) {
      if(!v.isTextual() || !ids.add(v.asText()) || core.db.queryForObject("SELECT count(*) FROM business_industries WHERE id=? AND enabled=true",Integer.class,v.asText())!=1) throw ApiException.bad();
    }
    result.put("industryIds",List.copyOf(ids)); return result;
  }
  boolean bool(JsonNode b,String key) { var v=b.get(key); if(v==null||!v.isBoolean()) throw ApiException.bad(); return v.asBoolean(); }
  String empty(String value) { return value==null?"":value; }
  void setIndustries(UUID company,Map<String,Object> data) {
    core.db.update("DELETE FROM business_company_industries WHERE company_id=?",company);
    for(var industry:(List<?>)data.get("industryIds")) core.db.update("INSERT INTO business_company_industries VALUES(?,?)",company,industry);
  }
  void audit(UUID actor,String action,UUID company,String reason) {
    UUID event=UUID.randomUUID();
    core.db.update("INSERT INTO audit_events VALUES(?,?,?,?,?)",event,actor,"business."+action,company,core.now());
    core.db.update("INSERT INTO business_audit_details VALUES(?,?,?)",event,company,reason);
  }
  Object create(UUID actor,JsonNode b) {
    var data=input(b,false); UUID company=UUID.randomUUID();
    core.db.update("INSERT INTO business_companies(id,owner_member_id,name,description,city,phone,email,website,address,phone_public,email_public,website_public,address_public,location_consent,latitude,longitude,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",company,memberId(actor),data.get("name"),data.get("description"),data.get("city"),data.get("phone"),data.get("email"),data.get("website"),data.get("address"),data.get("phone_public"),data.get("email_public"),data.get("website_public"),data.get("address_public"),data.get("location_consent"),data.get("latitude"),data.get("longitude"),core.now(),core.now());
    setIndustries(company,data); audit(actor,"create",company,null); return managementProjection(company(company),false);
  }
  Object update(UUID actor,UUID id,JsonNode b) {
    var c=locked(id); requireMaintain(actor,id); writable(c); expected(c,b); var data=input(b,true);
    boolean significant=List.of("name","address","latitude","longitude").stream().anyMatch(k -> !Objects.equals(c.get(k),data.get(k)));
    core.db.update("UPDATE business_companies SET name=?,description=?,city=?,phone=?,email=?,website=?,address=?,phone_public=?,email_public=?,website_public=?,address_public=?,location_consent=?,latitude=?,longitude=?,status='draft',review_reason=NULL,version=version+1,updated_at=? WHERE id=?",data.get("name"),data.get("description"),data.get("city"),data.get("phone"),data.get("email"),data.get("website"),data.get("address"),data.get("phone_public"),data.get("email_public"),data.get("website_public"),data.get("address_public"),data.get("location_consent"),data.get("latitude"),data.get("longitude"),core.now(),id);
    setIndustries(id,data); if(significant) core.db.update("DELETE FROM business_confirmations WHERE company_id=?",id);
    audit(actor,"update",id,significant?"重大資料異動，存在確認重新累計。":null); return managementProjection(company(id),false);
  }
  Object publish(UUID actor,UUID id,JsonNode b) {
    fields(b,"version"); var c=locked(id); requireMaintain(actor,id); writable(c); expected(c,b);
    if(!publishable(c)) throw ApiException.bad();
    core.db.update("UPDATE business_companies SET status='approved',first_published_at=COALESCE(first_published_at,?),review_reason=NULL,version=version+1,updated_at=? WHERE id=?",core.now(),core.now(),id);
    audit(actor,"publish",id,null); return managementProjection(company(id),false);
  }
  Object moderate(UUID actor,UUID id,String action,JsonNode b) {
    fields(b,"version","reason"); requireContent(actor); var c=locked(id); expected(c,b); String reason=text(b,"reason",1,1000);
    if(action.equals("reject") ? !Set.of("pending","approved").contains(c.get("status")) : !"approved".equals(c.get("status"))) throw ApiException.conflict();
    core.db.update("UPDATE business_companies SET status=?,review_reason=?,version=version+1,updated_at=? WHERE id=?",action.equals("reject")?"rejected":"suspended",reason,core.now(),id);
    audit(actor,action,id,reason);
    var changed=company(id);
    return map("companyId",id,"status",changed.get("status"),"version",changed.get("version"),"reviewReason",reason);
  }

  Map<String,Object> linkDto(Map<String,Object> row,boolean includeMember) {
    var c=company((UUID)row.get("company_id"));
    var out=map("id",row.get("id"),"companyId",row.get("company_id"),"companyName",c.get("name"),"companyVersion",c.get("version"),"ownerId",c.get("owner_member_id"),"inviteeId",row.get("member_id"),"kind",row.get("kind"),"status",row.get("status"),"version",row.get("version"),"invitedAt",instant(row.get("invited_at")),"createdAt",instant(row.get("invited_at")),"updatedAt",instant(row.get("decided_at")==null?row.get("invited_at"):row.get("decided_at")));
    if(includeMember) out.put("memberId",row.get("member_id"));
    if(row.get("decided_at")!=null) out.put("decidedAt",instant(row.get("decided_at"))); return out;
  }
  Object links(UUID actor,UUID id) {
    requireMaintain(actor,id); return Map.of("items",core.db.queryForList("SELECT * FROM business_company_links WHERE company_id=? ORDER BY invited_at,id",id).stream().map(r->linkDto(r,true)).toList());
  }
  Object invitations(UUID actor) {
    UUID member=memberId(actor);
    return Map.of("items",core.db.queryForList("SELECT l.* FROM business_company_links l JOIN business_companies c ON c.id=l.company_id WHERE l.member_id=? OR c.owner_member_id=? ORDER BY COALESCE(l.decided_at,l.invited_at) DESC,l.id",member,member).stream().map(r->linkDto(r,false)).toList());
  }
  Object invite(UUID actor,UUID id,JsonNode b) {
    fields(b,"version","companyVersion","memberId","kind"); var c=locked(id); requireOwner(actor,id); writable(c); expected(c,b); companyVersion(c,b);
    UUID member=uuid(b,"memberId"); String kind=text(b,"kind",1,10); if(!Set.of("member","editor").contains(kind)||member.equals(c.get("owner_member_id"))) throw ApiException.bad();
    if(core.db.queryForObject("SELECT count(*) FROM members m JOIN accounts a ON a.id=m.account_id WHERE m.id=? AND a.status='active'",Integer.class,member)!=1) throw ApiException.missing();
    var rows=core.db.queryForList("SELECT * FROM business_company_links WHERE company_id=? AND member_id=? AND kind=? AND status IN ('pending','accepted') FOR UPDATE",id,member,kind);
    if(!rows.isEmpty()) throw ApiException.conflict();
    UUID link=UUID.randomUUID();
    core.db.update("INSERT INTO business_company_links(id,company_id,member_id,kind,status,invited_by,invited_at) VALUES(?,?,?,?,'pending',?,?)",link,id,member,kind,actor,core.now());
    bump(id); audit(actor,"invite."+kind,id,null); return linkDto(core.one("SELECT * FROM business_company_links WHERE id=?",link),true);
  }
  void requireInvitee(UUID actor,UUID link) {
    var row=core.one("SELECT * FROM business_company_links WHERE id=?",link);
    if(!memberId(actor).equals(row.get("member_id"))) throw ApiException.missing();
  }
  void requireInvitationAction(UUID actor,UUID link,String action) {
    if(Set.of("cancel","revoke").contains(action)) {
      var row=core.one("SELECT * FROM business_company_links WHERE id=?",link);
      requireOwner(actor,(UUID)row.get("company_id"));
    } else requireInvitee(actor,link);
  }
  int namedVersion(JsonNode b,String key) {
    var value=b.get(key);
    if(value==null||!value.isIntegralNumber()||!value.canConvertToInt()||value.intValue()<0) throw ApiException.bad();
    return value.intValue();
  }
  void companyVersion(Map<String,Object> company,JsonNode b) {
    if(b.has("companyVersion") && namedVersion(b,"companyVersion")!=(Integer)company.get("version")) throw ApiException.conflict();
  }
  Object decideInvitation(UUID actor,UUID link,String action,JsonNode b) {
    fields(b,"version","companyVersion"); var first=core.one("SELECT * FROM business_company_links WHERE id=?",link); UUID company=(UUID)first.get("company_id");
    var c=locked(company); requireInvitationAction(actor,link,action); companyVersion(c,b);
    var row=core.one("SELECT * FROM business_company_links WHERE id=? FOR UPDATE",link); expected(row,b);
    if(action.equals("accept")) writable(c);
    String next;
    if(action.equals("revoke")) {
      if(!"accepted".equals(row.get("status"))||!"editor".equals(row.get("kind"))) throw ApiException.conflict();
      next="revoked";
    } else {
      if(!"pending".equals(row.get("status"))) throw ApiException.conflict();
      next=switch(action) { case "accept"->"accepted";case "reject"->"rejected";case "cancel"->"cancelled";default->throw ApiException.bad(); };
    }
    core.db.update("UPDATE business_company_links SET status=?,decided_at=?,version=version+1 WHERE id=?",next,core.now(),link);
    bump(company); audit(actor,"invitation."+action,company,null); return linkDto(core.one("SELECT * FROM business_company_links WHERE id=?",link),true);
  }
  void requireRemove(UUID actor,UUID company,UUID link) {
    var row=core.one("SELECT * FROM business_company_links WHERE id=? AND company_id=?",link,company);
    if(!owner(actor,company)&&!memberId(actor).equals(row.get("member_id"))) throw ApiException.missing();
  }
  Object removeLink(UUID actor,UUID company,UUID link,JsonNode b) {
    fields(b,"version","companyVersion"); var c=locked(company); requireRemove(actor,company,link); companyVersion(c,b);
    var row=core.one("SELECT * FROM business_company_links WHERE id=? AND company_id=? FOR UPDATE",link,company); expected(row,b);
    if(!Set.of("pending","accepted").contains(row.get("status"))) throw ApiException.conflict();
    boolean owner=owner(actor,company);
    String next="pending".equals(row.get("status")) ? (owner?"cancelled":"rejected") : (owner?"revoked":"removed");
    core.db.update("UPDATE business_company_links SET status=?,decided_at=?,version=version+1 WHERE id=?",next,core.now(),link);
    bump(company); audit(actor,"link.remove",company,null); return linkDto(core.one("SELECT * FROM business_company_links WHERE id=?",link),true);
  }
  void bump(UUID company) { core.db.update("UPDATE business_companies SET version=version+1,updated_at=? WHERE id=?",core.now(),company); }

  Object grants(UUID company) {
    return Map.of("items",core.db.queryForList("SELECT * FROM business_exposure_grants WHERE company_id=? ORDER BY starts_on DESC,id",company).stream().map(r->{LocalDate start=((java.sql.Date)r.get("starts_on")).toLocalDate();return map("id",r.get("id"),"companyId",company,"startsOn",start.toString(),"endsOn",start.plusYears(1).toString(),"status",r.get("status"),"version",r.get("version"));}).toList());
  }
  Object myConfirmations(UUID actor) {
    UUID member=memberId(actor);
    return Map.of("items",core.db.queryForList("SELECT bc.*,c.name company_name,c.version FROM business_confirmations bc JOIN business_companies c ON c.id=bc.company_id WHERE bc.member_id=? ORDER BY bc.confirmed_at DESC,bc.company_id",member).stream().map(r -> {
      UUID company=(UUID)r.get("company_id");
      Instant start=((Timestamp)r.get("confirmed_at")).toInstant(),end=start.atZone(TAIPEI).plusYears(1).toInstant();
      var c=company(company);
      boolean counted=!member.equals(c.get("owner_member_id"))&&!accepted(company,"editor").contains(member)&&validMember(member)&&!core.clock.instant().isBefore(start)&&core.clock.instant().isBefore(end);
      return map("companyId",company,"companyName",r.get("company_name"),"confirmedAt",start.toString(),"expiresAt",end.toString(),"endsAt",end.toString(),"counted",counted,"publiclyVisible",publicProjection(c)!=null,"version",r.get("version"));
    }).toList());
  }
  void requireConfirm(UUID actor,UUID company) {
    if(!validMember(memberId(actor))||maintains(actor,company)||!isPublic(company)) throw ApiException.missing();
  }
  Object confirm(UUID actor,UUID company,JsonNode b,boolean withdraw) {
    fields(b,"version"); var c=locked(company); expected(c,b); UUID member=memberId(actor);
    var rows=core.db.queryForList("SELECT * FROM business_confirmations WHERE company_id=? AND member_id=?",company,member);
    if(withdraw) {
      if(rows.isEmpty()) throw ApiException.conflict();
      core.db.update("DELETE FROM business_confirmations WHERE company_id=? AND member_id=?",company,member);
    } else {
      core.db.queryForList("SELECT id FROM memberships WHERE member_id=? ORDER BY id FOR SHARE",member);
      core.db.queryForList("SELECT id FROM clubs WHERE id IN (SELECT club_id FROM memberships WHERE member_id=?) ORDER BY id FOR SHARE",member);
      if(!validMember(member)||maintains(actor,company)||publicProjection(c)==null) throw ApiException.missing();
      if(!rows.isEmpty()) throw ApiException.conflict();
      core.db.update("INSERT INTO business_confirmations VALUES(?,?,?)",company,member,core.now());
    }
    bump(company); audit(actor,withdraw?"confirmation.withdraw":"confirmation.create",company,null);
    var out=confirmationSummary(company(company)); out.put("companyId",company); out.put("version",((Integer)c.get("version"))+1); return out;
  }
}
