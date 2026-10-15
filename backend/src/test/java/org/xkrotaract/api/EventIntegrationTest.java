package org.xkrotaract.api;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import com.fasterxml.jackson.databind.*;
import jakarta.servlet.http.Cookie;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.*;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

@SpringBootTest
@AutoConfigureMockMvc
@org.springframework.test.context.ActiveProfiles("test")
class EventIntegrationTest {
  static {
    String url=System.getenv("DATABASE_URL"), profiles=System.getenv("SPRING_PROFILES_ACTIVE");
    if(!"true".equals(System.getenv("CORE_TEST_ALLOW_RESET"))||url==null||!url.matches("jdbc:postgresql://[^/]+/[^?]*_test(?:\\?.*)?")||profiles!=null&&Arrays.asList(profiles.split(",")).contains("local"))throw new IllegalStateException("Dedicated *_test database and CORE_TEST_ALLOW_RESET=true required; no data reset.");
  }
  @Autowired CoreService core;
  @Autowired ObjectMapper json;
  @Autowired MockMvc mvc;
  UUID district,club,other,actor;
  String password,cookie,csrf;
  @BeforeEach void setup() throws Exception {
    core.db.execute("TRUNCATE events,audit_events,idempotency_records,rate_limits,join_applications,memberships,role_grants,api_sessions,members,accounts,clubs,districts CASCADE");
    district=UUID.randomUUID();club=UUID.randomUUID();other=UUID.randomUUID();actor=UUID.randomUUID();password=" A-long-safe-"+UUID.randomUUID()+" ";
    core.db.update("INSERT INTO districts VALUES(?,'EVENTS','Events test')",district);
    core.db.update("INSERT INTO clubs(id,name,type_code,district_id,contact_email,contact_visibility) VALUES(?,'Public club','ROTARACT',?,'secret@example.test','{\"email\":false}'),(?,'Other club','ROTARACT',?,NULL,'{}')",club,district,other,district);
    core.db.update("INSERT INTO accounts(id,account_code,email,email_key,password_hash) VALUES(?,'EventUser','events@example.test','events@example.test',?)",actor,core.passwords.encode(password));
    core.db.update("INSERT INTO members(id,account_id,name,call_name) VALUES(?,?,'Events','Test')",UUID.randomUUID(),actor);
    grant("club_president");
    var token=send(get("/api/v1/csrf-token")); cookie=token.getResponse().getHeader("Set-Cookie").split(";",2)[0].split("=",2)[1];csrf=node(token).path("csrfToken").asText();
    var login=post("/sessions",Map.of("identifier","events@example.test","password",password),null);assertEquals(200,login.getResponse().getStatus());cookie=login.getResponse().getHeader("Set-Cookie").split(";",2)[0].split("=",2)[1];csrf=node(login).path("csrfToken").asText();
  }
  void grant(String role) {
    core.db.update("DELETE FROM role_grants WHERE account_id=?",actor);
    core.db.update("INSERT INTO role_grants(id,account_id,role,club_id,scope_type,scope_id,starts_at,ends_at,granted_by,reason) VALUES(?,?,?,?,'club',?,?,?,?, 'test')",UUID.randomUUID(),actor,role,club,club,java.sql.Timestamp.from(core.clock.instant().minusSeconds(60)),java.sql.Timestamp.from(core.clock.instant().plusSeconds(3600)),actor);
  }
  MvcResult send(MockHttpServletRequestBuilder request) throws Exception {
    if(cookie!=null)request.cookie(new Cookie(SessionService.COOKIE,cookie));
    return mvc.perform(request.secure(true).header("Origin","https://localhost:5173").header("X-CSRF-Token",csrf==null?"":csrf)).andReturn();
  }
  MvcResult post(String path,Object body,String key) throws Exception {
    var r=org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/v1"+path).contentType("application/json").content(json.writeValueAsBytes(body));if(key!=null)r.header("Idempotency-Key",key);return send(r);
  }
  JsonNode node(MvcResult r)throws Exception{return json.readTree(r.getResponse().getContentAsString());}
  String key(){return UUID.randomUUID().toString();}
  Map<String,Object> input(String visibility) {return new LinkedHashMap<>(Map.of("title","Event","description","Description","location","Venue","organizerType","club","organizerId",club,"visibility",visibility,"time",Map.of("kind","timed","startAt","2027-01-31T15:00:00Z","endAt","2027-02-01T02:00:00Z","timeZone","Asia/Taipei")));}
  UUID create(String visibility)throws Exception{var r=post("/events",input(visibility),key());assertEquals(201,r.getResponse().getStatus(),r.getResponse().getContentAsString());return UUID.fromString(node(r).path("id").asText());}
  @Test void lifecycleCorrectionsAndPublicProjection()throws Exception {
    UUID id=create("public");assertEquals(404,send(get("/api/v1/public/events/"+id)).getResponse().getStatus());
    String k=key();var published=post("/events/"+id+"/publish",Map.of("version",0),k);assertEquals(200,published.getResponse().getStatus());assertEquals(node(published),node(post("/events/"+id+"/publish",Map.of("version",0),k)));
    // A dangling organizer must not turn a public calendar into a 404 response.
    UUID orphan=UUID.randomUUID();
    core.db.update("INSERT INTO events(id,title,description,location,organizer_type,organizer_id,visibility,status,time_kind,time_zone,starts_at,ends_at) SELECT ?,title,description,location,organizer_type,?,visibility,status,time_kind,time_zone,starts_at,ends_at FROM events WHERE id=?",orphan,UUID.randomUUID(),id);
    assertEquals(404,send(get("/api/v1/public/events/"+orphan)).getResponse().getStatus());
    var monthResponse=send(get("/api/v1/public/calendar").param("month","2027-02"));assertEquals(200,monthResponse.getResponse().getStatus(),monthResponse.getResponse().getContentAsString());var month=node(monthResponse);assertEquals(1,month.path("total").asInt());assertFalse(month.path("items").get(0).has("version"));
    var changed=input("members");changed.put("version",1);var edit=send(patch("/api/v1/events/"+id).contentType("application/json").header("Idempotency-Key",key()).content(json.writeValueAsBytes(changed)));assertEquals(200,edit.getResponse().getStatus());assertEquals(404,send(get("/api/v1/public/events/"+id)).getResponse().getStatus());
    assertEquals(409,send(patch("/api/v1/events/"+id).contentType("application/json").header("Idempotency-Key",key()).content(json.writeValueAsBytes(changed))).getResponse().getStatus());
    assertEquals(200,post("/events/"+id+"/cancel",Map.of("version",2,"reason","Weather"),key()).getResponse().getStatus());
    var copied=post("/events/"+id+"/copy",Map.of("version",3),key());assertEquals(201,copied.getResponse().getStatus());assertEquals("draft",node(copied).path("status").asText());assertFalse(node(copied).has("cancellationReason"));
    assertEquals(409,post("/events/"+id+"/archive",Map.of("version",3),key()).getResponse().getStatus());
    UUID archive=create("public");assertEquals(200,post("/events/"+archive+"/publish",Map.of("version",0),key()).getResponse().getStatus());assertEquals(200,post("/events/"+archive+"/archive",Map.of("version",1),key()).getResponse().getStatus());assertEquals(409,post("/events/"+archive+"/publish",Map.of("version",2),key()).getResponse().getStatus());
  }
  @Test void scopesValidationAndPrivateContact()throws Exception {
    var wrong=input("public");wrong.put("organizerId",other);assertEquals(404,post("/events",wrong,key()).getResponse().getStatus());
    UUID id=create("public");grant("club_manager");assertEquals(404,post("/events/"+id+"/publish",Map.of("version",0),key()).getResponse().getStatus());
    var invalid=input("public");invalid.put("time",Map.of("kind","allDay","timeZone","Asia/Taipei","startDate","2027-02-02","endDateExclusive","2027-02-02"));assertEquals(400,post("/events",invalid,key()).getResponse().getStatus());
    invalid.put("time",Map.of("kind","timed","timeZone","Invalid/Zone","startAt","2027-01-01T00:00:00Z","endAt","2027-01-01T01:00:00Z"));assertEquals(400,post("/events",invalid,key()).getResponse().getStatus());
    var publicClub=send(get("/api/v1/public/clubs/"+club));assertEquals(200,publicClub.getResponse().getStatus());assertFalse(publicClub.getResponse().getContentAsString().contains("secret@example.test"));
    core.db.update("UPDATE clubs SET status='disabled',disabled_at=? WHERE id=?",core.now(),club);assertEquals(404,send(get("/api/v1/public/clubs/"+club)).getResponse().getStatus());assertEquals(404,post("/events",input("public"),key()).getResponse().getStatus());
  }
  @Test void allDayHalfOpenMonthAndMemberReadScopes()throws Exception {
    var data=input("public");data.put("time",Map.of("kind","allDay","timeZone","Asia/Taipei","startDate","2027-01-30","endDateExclusive","2027-02-01"));
    var created=post("/events",data,key());assertEquals(201,created.getResponse().getStatus());UUID all=UUID.fromString(node(created).path("id").asText());
    assertEquals(200,post("/events/"+all+"/publish",Map.of("version",0),key()).getResponse().getStatus());
    var january=send(get("/api/v1/public/calendar").param("month","2027-01"));assertEquals(200,january.getResponse().getStatus(),january.getResponse().getContentAsString());assertEquals(1,node(january).path("total").asInt());
    var february=send(get("/api/v1/public/calendar").param("month","2027-02"));assertEquals(200,february.getResponse().getStatus(),february.getResponse().getContentAsString());assertEquals(0,node(february).path("total").asInt());
    UUID members=create("members"),own=create("club");
    assertEquals(200,post("/events/"+members+"/publish",Map.of("version",0),key()).getResponse().getStatus());
    assertEquals(200,post("/events/"+own+"/publish",Map.of("version",0),key()).getResponse().getStatus());
    core.db.update("DELETE FROM role_grants WHERE account_id=?",actor);
    assertEquals(404,send(get("/api/v1/events/"+members)).getResponse().getStatus());
    UUID member=(UUID)core.member(actor).get("id");
    core.db.update("INSERT INTO memberships(id,member_id,club_id,type_code,status,starts_on,name_snapshot,call_name_snapshot,club_name_snapshot,district_name_snapshot,confirmed_year) VALUES(?,?,?,'ROTARACT','active',?,'Test','Test','Test','Test',2027)",UUID.randomUUID(),member,club,core.today().minusDays(1));
    assertEquals(200,send(get("/api/v1/events/"+members)).getResponse().getStatus());
    assertEquals(200,send(get("/api/v1/events/"+own)).getResponse().getStatus());
    core.db.update("UPDATE memberships SET club_id=? WHERE member_id=?",other,member);
    assertEquals(404,send(get("/api/v1/events/"+own)).getResponse().getStatus());
    assertEquals(200,send(get("/api/v1/events/"+members)).getResponse().getStatus());
    assertEquals(404,send(get("/api/v1/public/events/"+members)).getResponse().getStatus());
  }
  @Test void disabledHistoryAndWithdrawnEventsStayHiddenAfterRestore()throws Exception {
    UUID history=create("public"),future=create("public");
    for(UUID id:List.of(history,future))assertEquals(200,post("/events/"+id+"/publish",Map.of("version",0),key()).getResponse().getStatus());
    Instant now=core.clock.instant();
    core.db.update("UPDATE events SET starts_at=?,ends_at=? WHERE id=?",java.sql.Timestamp.from(now.minusSeconds(7200)),java.sql.Timestamp.from(now.minusSeconds(3600)),history);
    core.db.update("UPDATE events SET starts_at=?,ends_at=?,public_withdrawn_at=?,version=version+1 WHERE id=?",java.sql.Timestamp.from(now.minusSeconds(60)),java.sql.Timestamp.from(now.plusSeconds(3600)),core.now(),future);
    core.db.update("UPDATE clubs SET status='disabled',disabled_at=? WHERE id=?",core.now(),club);
    assertEquals(200,send(get("/api/v1/public/events/"+history)).getResponse().getStatus());
    assertEquals(404,send(get("/api/v1/public/events/"+future)).getResponse().getStatus());
    core.db.update("UPDATE clubs SET status='active' WHERE id=?",club);
    assertEquals(404,send(get("/api/v1/public/events/"+future)).getResponse().getStatus());
    var revised=input("public");revised.put("version",2);
    assertEquals(200,send(patch("/api/v1/events/"+future).contentType("application/json").header("Idempotency-Key",key()).content(json.writeValueAsBytes(revised))).getResponse().getStatus());
    assertEquals(404,send(get("/api/v1/public/events/"+future)).getResponse().getStatus());
    String replayKey=key();var copy=post("/events/"+future+"/copy",Map.of("version",3),replayKey);assertEquals(201,copy.getResponse().getStatus());assertFalse(node(copy).has("publicWithdrawnAt"));
    core.db.update("DELETE FROM role_grants WHERE account_id=?",actor);
    assertEquals(404,post("/events/"+future+"/copy",Map.of("version",3),replayKey).getResponse().getStatus());
  }

  @Test void concurrentVersionAndDistrictOrganizerScope()throws Exception {
    UUID id=create("public");
    try(var pool=java.util.concurrent.Executors.newFixedThreadPool(2)) {
      var a=pool.submit(()->post("/events/"+id+"/publish",Map.of("version",0),key()).getResponse().getStatus());
      var b=pool.submit(()->post("/events/"+id+"/publish",Map.of("version",0),key()).getResponse().getStatus());
      assertEquals(Set.of(200,409),Set.of(a.get(),b.get()));
    }
    core.db.update("DELETE FROM role_grants WHERE account_id=?",actor);
    core.db.update("INSERT INTO role_grants(id,account_id,role,scope_type,scope_id,starts_at,ends_at,granted_by,reason) VALUES(?,?,'district_manager','district',?,?,?,?, 'test')",UUID.randomUUID(),actor,district,java.sql.Timestamp.from(core.clock.instant().minusSeconds(60)),java.sql.Timestamp.from(core.clock.instant().plusSeconds(3600)),actor);
    var data=input("public");data.put("organizerType","district");data.put("organizerId",district);
    var districtEvent=post("/events",data,key());assertEquals(201,districtEvent.getResponse().getStatus(),districtEvent.getResponse().getContentAsString());
    assertEquals(404,post("/events/"+id+"/cancel",Map.of("version",1,"reason","Wrong scope"),key()).getResponse().getStatus());
    data.put("visibility","club");assertEquals(400,post("/events",data,key()).getResponse().getStatus());
  }

}
