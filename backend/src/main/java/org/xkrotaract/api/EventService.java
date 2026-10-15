package org.xkrotaract.api;

import static org.xkrotaract.api.Input.*;
import com.fasterxml.jackson.databind.JsonNode;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import org.springframework.stereotype.Service;

@Service
class EventService {
  final CoreService core;
  final Queries queries;
  final ApiSupport support;
  EventService(CoreService core, Queries queries, ApiSupport support) { this.core=core; this.queries=queries; this.support=support; }
  Map<String,Object> row(UUID id) { return core.one("SELECT * FROM events WHERE id=?",id); }
  Instant instant(Object value) { return ((Timestamp)value).toInstant(); }
  boolean manage(UUID actor,Map<String,Object> e,boolean publish) {
    if(actor==null) return false;
    if(e.get("organizer_type").equals("club"))
      return publish ? support.clubRole(actor,(UUID)e.get("organizer_id"),"club_president","club_secretary","club_backup") : support.clubRole(actor,(UUID)e.get("organizer_id"),"club_president","club_secretary","club_backup","club_manager");
    return support.districtRole(actor,(UUID)e.get("organizer_id"));
  }
  void requireEdit(UUID actor,UUID id) { var e=row(id); if(!manage(actor,e,!e.get("status").equals("draft")))throw ApiException.missing(); }
  Map<String,Object> requireManage(UUID actor,UUID id,boolean publish) {
    var e=row(id); if(!manage(actor,e,publish)) throw ApiException.missing(); return e;
  }
  boolean active(Map<String,Object> e) {
    if(e.get("organizer_type").equals("district")) return true;
    var clubs=core.db.queryForList("SELECT status FROM clubs WHERE id=?",e.get("organizer_id"));
    return !clubs.isEmpty()&&"active".equals(clubs.getFirst().get("status"));
  }
  boolean publicVisible(Map<String,Object> e) {
    if(!e.get("visibility").equals("public") || !Set.of("published","cancelled").contains(e.get("status")) || e.get("public_withdrawn_at")!=null) return false;
    if(e.get("organizer_type").equals("district")) return core.db.queryForObject("SELECT count(*) FROM districts WHERE id=?",Integer.class,e.get("organizer_id"))==1;
    var clubs=core.db.queryForList("SELECT * FROM clubs WHERE id=?",e.get("organizer_id"));
    if(clubs.isEmpty())return false;
    var c=clubs.getFirst();
    return "active".equals(c.get("status")) || c.get("disabled_at")!=null && !instant(e.get("ends_at")).isAfter(instant(c.get("disabled_at"))) && !instant(e.get("ends_at")).isAfter(core.clock.instant());
  }
  boolean readManage(UUID actor,Map<String,Object> e) {
    if(manage(actor,e,false))return true;
    if(actor==null||!e.get("organizer_type").equals("club")||active(e))return false;
    var clubs=core.db.queryForList("SELECT district_id FROM clubs WHERE id=?",e.get("organizer_id"));
    return !clubs.isEmpty()&&support.districtRole(actor,(UUID)clubs.getFirst().get("district_id"));
  }
  boolean visible(UUID actor,Map<String,Object> e) {
    if(publicVisible(e) || readManage(actor,e)) return true;
    if(actor==null || !active(e) || !Set.of("published","cancelled").contains(e.get("status"))) return false;
    boolean member=core.db.queryForObject("SELECT count(*) FROM memberships ms JOIN members m ON m.id=ms.member_id JOIN clubs c ON c.id=ms.club_id WHERE m.account_id=? AND ms.status='active' AND c.status='active' AND ms.starts_on<=? AND (ms.ends_on IS NULL OR ms.ends_on>=?)",Integer.class,actor,core.today(),core.today())>0;
    if(e.get("visibility").equals("members")) return member;
    return e.get("visibility").equals("club") && core.db.queryForObject("SELECT count(*) FROM memberships ms JOIN members m ON m.id=ms.member_id WHERE m.account_id=? AND ms.club_id=? AND ms.status='active' AND ms.starts_on<=? AND (ms.ends_on IS NULL OR ms.ends_on>=?)",Integer.class,actor,e.get("organizer_id"),core.today(),core.today())>0;
  }
  Map<String,Object> dto(Map<String,Object> e,boolean publicOnly) {
    Object time=e.get("time_kind").equals("timed")?map("kind","timed","startAt",instant(e.get("starts_at")).toString(),"endAt",instant(e.get("ends_at")).toString(),"timeZone",e.get("time_zone")):map("kind","allDay","startDate",e.get("start_date").toString(),"endDateExclusive",e.get("end_date_exclusive").toString(),"timeZone",e.get("time_zone"));
    var d=map("id",e.get("id"),"title",e.get("title"),"description",e.get("description"),"location",e.get("location"),"organizerType",e.get("organizer_type"),"organizerId",e.get("organizer_id"),"visibility",e.get("visibility"),"status",e.get("status"),"time",time);
    if(e.get("cancellation_reason")!=null) d.put("cancellationReason",e.get("cancellation_reason"));
    if(!publicOnly) { d.put("version",e.get("version")); if(e.get("public_withdrawn_at")!=null)d.put("publicWithdrawnAt",instant(e.get("public_withdrawn_at")).toString()); }
    return d;
  }
  Object detail(UUID actor,UUID id,boolean publicOnly) { var e=row(id); if(!(publicOnly?publicVisible(e):visible(actor,e)))throw ApiException.missing(); return dto(e,publicOnly); }
  Object list(UUID actor,Map<String,String> q,boolean publicOnly) {
    queries.validate(q,Set.of("page","pageSize","keyword","districtId","clubId","from","to","status","scope"));
    if(publicOnly && (q.containsKey("scope") || q.containsKey("status")))throw ApiException.bad();
    if(q.containsKey("scope")&&!Set.of("manage","read").contains(q.get("scope")))throw ApiException.bad();
    if(q.containsKey("status")&&!Set.of("draft","published","cancelled","archived").contains(q.get("status")))throw ApiException.bad();
    Instant from=q.containsKey("from")?OffsetDateTime.parse(q.get("from")).toInstant():null,to=q.containsKey("to")?OffsetDateTime.parse(q.get("to")).toInstant():null;
    if(from!=null&&to!=null&&!to.isAfter(from))throw ApiException.bad();
    var result=new ArrayList<Map<String,Object>>();
    for(var e:core.db.queryForList("SELECT * FROM events ORDER BY starts_at,id")) {
      if(!(publicOnly?publicVisible(e):"manage".equals(q.get("scope"))?readManage(actor,e):visible(actor,e)))continue;
      if(q.containsKey("status")&&!q.get("status").equals(e.get("status")))continue;
      if(q.containsKey("clubId")&&!(e.get("organizer_type").equals("club")&&q.get("clubId").equals(e.get("organizer_id").toString())))continue;
      String district=e.get("organizer_type").equals("district")?e.get("organizer_id").toString():core.one("SELECT district_id FROM clubs WHERE id=?",e.get("organizer_id")).get("district_id").toString();
      if(q.containsKey("districtId")&&!q.get("districtId").equals(district))continue;
      String organizer=e.get("organizer_type").equals("club")?core.one("SELECT name FROM clubs WHERE id=?",e.get("organizer_id")).get("name").toString():"";
      if(!queries.keyword(q,e.get("title")+" "+e.get("description")+" "+e.get("location")+" "+organizer))continue;
      if(from!=null&&!instant(e.get("ends_at")).isAfter(from)||to!=null&&!instant(e.get("starts_at")).isBefore(to))continue;
      result.add(dto(e,publicOnly));
    }
    return ApiSupport.page(result,q);
  }
  Object calendar(Map<String,String> q) {
    if(!q.containsKey("month")||!q.get("month").matches("[0-9]{4}-[0-9]{2}")||q.get("month").startsWith("0000"))throw ApiException.bad();
    var month=YearMonth.parse(q.get("month")); var args=new HashMap<>(q);args.remove("month");
    if(args.containsKey("from")||args.containsKey("to"))throw ApiException.bad();
    args.put("from",month.atDay(1).atStartOfDay(ZoneId.of("Asia/Taipei")).toOffsetDateTime().toString());
    args.put("to",month.plusMonths(1).atDay(1).atStartOfDay(ZoneId.of("Asia/Taipei")).toOffsetDateTime().toString());
    return list(null,args,true);
  }
  Map<String,Object> input(JsonNode b,boolean updating) {
    if(updating)fields(b,"title","description","location","organizerType","organizerId","visibility","time","version");
    else fields(b,"title","description","location","organizerType","organizerId","visibility","time");
    String type=text(b,"organizerType",1,20),visibility=text(b,"visibility",1,20);
    if(!Set.of("club","district").contains(type)||!Set.of("public","members","club").contains(visibility)||type.equals("district")&&visibility.equals("club"))throw ApiException.bad();
    UUID organizer=uuid(b,"organizerId"); core.one("SELECT id FROM "+(type.equals("club")?"clubs":"districts")+" WHERE id=?",organizer);
    var t=b.get("time");if(t==null||!t.isObject())throw ApiException.bad();String kind=text(t,"kind",1,10); String zone=text(t,"timeZone",1,100); if(!ZoneId.getAvailableZoneIds().contains(zone)&&!zone.equals("UTC"))throw ApiException.bad();
    ZoneId z=ZoneId.of(zone);
    Instant start,end;LocalDate date=null,exclusive=null;
    if(kind.equals("timed")) { fields(t,"kind","timeZone","startAt","endAt");start=OffsetDateTime.parse(text(t,"startAt",20,50)).toInstant();end=OffsetDateTime.parse(text(t,"endAt",20,50)).toInstant(); }
    else if(kind.equals("allDay")) { fields(t,"kind","timeZone","startDate","endDateExclusive"); date=date(t,"startDate");exclusive=date(t,"endDateExclusive"); var s=date.atStartOfDay(z);var e=exclusive.atStartOfDay(z); if(!s.toLocalDate().equals(date)||!e.toLocalDate().equals(exclusive)||!s.toLocalTime().equals(LocalTime.MIDNIGHT)||!e.toLocalTime().equals(LocalTime.MIDNIGHT))throw ApiException.bad();start=s.toInstant();end=e.toInstant(); }
    else throw ApiException.bad();
    if(!end.isAfter(start)||start.atZone(ZoneOffset.UTC).getYear()<1||end.atZone(ZoneOffset.UTC).getYear()>9999)throw ApiException.bad();
    return map("title",text(b,"title",1,200),"description",text(b,"description",0,10000),"location",text(b,"location",0,300),"organizer_type",type,"organizer_id",organizer,"visibility",visibility,"time_kind",kind,"time_zone",zone,"starts_at",Timestamp.from(start),"ends_at",Timestamp.from(end),"start_date",date,"end_date_exclusive",exclusive);
  }
  void insert(UUID id,Map<String,Object> e) {
    core.db.update("INSERT INTO events(id,title,description,location,organizer_type,organizer_id,visibility,time_kind,time_zone,starts_at,ends_at,start_date,end_date_exclusive) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",id,e.get("title"),e.get("description"),e.get("location"),e.get("organizer_type"),e.get("organizer_id"),e.get("visibility"),e.get("time_kind"),e.get("time_zone"),e.get("starts_at"),e.get("ends_at"),e.get("start_date"),e.get("end_date_exclusive"));
  }
  void lockOrganizer(Map<String,Object> e) {
    core.one("SELECT id FROM "+(e.get("organizer_type").equals("club")?"clubs":"districts")+" WHERE id=? FOR UPDATE",e.get("organizer_id"));
  }
  void authorizeCreate(UUID actor,JsonNode b) { if(!manage(actor,input(b,false),false))throw ApiException.missing(); }
  Object create(UUID actor,JsonNode b) {
    var e=input(b,false);lockOrganizer(e);if(!manage(actor,e,false))throw ApiException.missing();if(!active(e))throw ApiException.conflict();
    UUID id=UUID.randomUUID();insert(id,e);core.audit(actor,"event.create",id);return dto(row(id),false);
  }
  Object update(UUID actor,UUID id,JsonNode b) {
    var values=input(b,true);var initial=row(id);lockOrganizer(initial);var e=core.one("SELECT * FROM events WHERE id=? FOR UPDATE",id);
    if(!manage(actor,e,e.get("status").equals("published")))throw ApiException.missing();
    int version=version(b);if(!Integer.valueOf(version).equals(e.get("version")))throw ApiException.conflict();
    if(!Set.of("draft","published").contains(e.get("status"))||!e.get("organizer_type").equals(values.get("organizer_type"))||!e.get("organizer_id").equals(values.get("organizer_id"))||e.get("status").equals("published")&&!active(e))throw ApiException.conflict();
    int changed=core.db.update("UPDATE events SET title=?,description=?,location=?,visibility=?,time_kind=?,time_zone=?,starts_at=?,ends_at=?,start_date=?,end_date_exclusive=?,version=version+1 WHERE id=? AND version=?",values.get("title"),values.get("description"),values.get("location"),values.get("visibility"),values.get("time_kind"),values.get("time_zone"),values.get("starts_at"),values.get("ends_at"),values.get("start_date"),values.get("end_date_exclusive"),id,version);
    if(changed!=1)throw ApiException.conflict();core.audit(actor,"event.update",id);return dto(row(id),false);
  }
  Object action(UUID actor,UUID id,String action,JsonNode b) {
    if(action.equals("cancel"))fields(b,"version","reason");else fields(b,"version");
    var initial=row(id);lockOrganizer(initial);var e=core.one("SELECT * FROM events WHERE id=? FOR UPDATE",id);
    if(!manage(actor,e,!action.equals("copy")))throw ApiException.missing();int version=version(b);if(!Integer.valueOf(version).equals(e.get("version")))throw ApiException.conflict();
    String status=e.get("status").toString();
    if(action.equals("copy")) { if(!active(e))throw ApiException.conflict();UUID copy=UUID.randomUUID();String title=e.get("title").toString();e.put("title",title.substring(0,Math.min(title.length(),194))+"（副本）");insert(copy,e);core.audit(actor,"event.copy",copy);return dto(row(copy),false); }
    String next;String reason=null;
    if(action.equals("publish")) {if(!status.equals("draft")||!active(e))throw ApiException.conflict();next="published";}
    else if(action.equals("cancel")){if(!status.equals("published"))throw ApiException.conflict();reason=text(b,"reason",1,1000);next="cancelled";}
    else {if(!status.equals("published"))throw ApiException.conflict();next="archived";}
    int changed=core.db.update("UPDATE events SET status=?,cancellation_reason=COALESCE(?,cancellation_reason),version=version+1 WHERE id=? AND version=?",next,reason,id,version);
    if(changed!=1)throw ApiException.conflict();core.audit(actor,"event."+action,id);return dto(row(id),false);
  }
  Map<String,Object> clubDto(Map<String,Object> c) {
    var dto=map("id",c.get("id"),"name",c.get("name"),"clubTypeCode",c.get("type_code"),"districtId",c.get("district_id"),"districtName",c.get("district_name"),"city",c.get("city"),"description",c.get("description"),"logoAssetId",c.get("logo_asset_id"));
    try {
      JsonNode visibility=core.json.readTree(Objects.toString(c.get("contact_visibility"),"{}"));
      JsonNode social=core.json.readTree(Objects.toString(c.get("social_links"),"[]"));
      var links=new ArrayList<String>();
      for(int i=0;i<social.size();i++)if(visibility.path("socialLinks").path(i).asBoolean(false))links.add(social.get(i).asText());
      if(!links.isEmpty())dto.put("socialLinks",links);
      for(String field:List.of("email","website","address")) {
        Object value=c.get(field.equals("email")?"contact_email":field);
        if(visibility.path(field).asBoolean(false)&&value!=null)dto.put(field,value);
      }
    } catch(com.fasterxml.jackson.core.JsonProcessingException ex) { throw new IllegalStateException(ex); }
    return dto;
  }
  String publicClubsSql() {return "SELECT c.*,d.name district_name FROM clubs c JOIN districts d ON d.id=c.district_id WHERE c.status='active' AND c.is_public=true";}
  Object club(UUID id) {return clubDto(core.one(publicClubsSql()+" AND c.id=?",id));}
  Object clubs(Map<String,String> q) {
    queries.validate(q,Set.of("page","pageSize","keyword","districtId","clubTypeCode","city"));
    return ApiSupport.page(core.db.queryForList(publicClubsSql()+" ORDER BY c.name,c.id").stream().filter(c->queries.keyword(q,c.get("name")+" "+Objects.toString(c.get("description"),""))).filter(c->!q.containsKey("districtId")||q.get("districtId").equals(c.get("district_id").toString())).filter(c->!q.containsKey("clubTypeCode")||q.get("clubTypeCode").equals(c.get("type_code"))).filter(c->!q.containsKey("city")||q.get("city").equals(c.get("city"))).map(this::clubDto).toList(),q);
  }
}
