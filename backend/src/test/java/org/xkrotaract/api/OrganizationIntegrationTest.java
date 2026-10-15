package org.xkrotaract.api;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;

import com.fasterxml.jackson.databind.*;
import jakarta.servlet.http.Cookie;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.*;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class OrganizationIntegrationTest {
  static {
    String url=System.getenv("DATABASE_URL"), profiles=System.getenv("SPRING_PROFILES_ACTIVE");
    if(!"true".equals(System.getenv("CORE_TEST_ALLOW_RESET")) || url==null
        || !url.matches("jdbc:postgresql://[^/]+/[^?]*_test(?:\\?.*)?")
        || (profiles!=null && Arrays.asList(profiles.split(",")).contains("local")))
      throw new IllegalStateException("Dedicated _test database and CORE_TEST_ALLOW_RESET=true required; no data was reset.");
  }
  @Autowired MockMvc mvc;
  @Autowired ObjectMapper json;
  @Autowired CoreService core;
  @Autowired AssetService assets;
  UUID source,target,club,otherClub,president,manager,sourceAdmin,targetAdmin,member;
  static final String ORIGIN="https://localhost:5173";

  @BeforeEach void reset() {
    core.db.execute("TRUNCATE audit_events,idempotency_records,rate_limits,join_applications,memberships,role_grants,api_sessions,members,accounts,clubs,districts CASCADE");
    source=UUID.randomUUID();target=UUID.randomUUID();club=UUID.randomUUID();otherClub=UUID.randomUUID();
    core.db.update("INSERT INTO districts(id,code,name) VALUES(?,'SRC','來源地區'),(?,'DST','目標地區')",source,target);
    core.db.update("INSERT INTO clubs(id,name,type_code,district_id) VALUES(?,'測試扶青社','ROTARACT',?),(?,'其他扶青社','ROTARACT',?)",club,source,otherClub,target);
    president=account("president");manager=account("manager");sourceAdmin=account("source");targetAdmin=account("target");member=account("member");
    membership(president,club);membership(manager,club);membership(member,club);
    grant(president,"club_president","club",club);
    grant(manager,"club_manager","club",club);
    grant(sourceAdmin,"district_manager","district",source);
    grant(targetAdmin,"district_manager","district",target);
  }

  UUID account(String code) {
    UUID id=UUID.randomUUID();
    core.db.update("INSERT INTO accounts(id,account_code,email,email_key,password_hash) VALUES(?,?,?,?,?)",id,code+"Code",code+"@example.test",code+"@example.test","unused-test-hash");
    core.db.update("INSERT INTO members(id,account_id,name,call_name) VALUES(?,?,?,?)",UUID.randomUUID(),id,code,code);
    return id;
  }

  void membership(UUID account,UUID clubId) {
    UUID memberId=(UUID)core.member(account).get("id");
    core.db.update("INSERT INTO memberships(id,member_id,club_id,type_code,status,starts_on,name_snapshot,call_name_snapshot,club_name_snapshot,district_name_snapshot,confirmed_year) VALUES(?,?,?,'ROTARACT','active',?,'合成姓名','合成稱呼','合成社團','合成地區',?)",
        UUID.randomUUID(),memberId,clubId,java.sql.Date.valueOf(core.today().minusDays(10)),core.today().getYear());
  }

  UUID grant(UUID account,String role,String scope,UUID scopeId) {
    UUID id=UUID.randomUUID();
    core.db.update("INSERT INTO role_grants(id,account_id,role,club_id,starts_at,ends_at,granted_by,reason,scope_type,scope_id) VALUES(?,?,?,?,?,?,?,'test',?,?)",
        id,account,role,scope.equals("club")?scopeId:null,Timestamp.from(core.clock.instant().minusSeconds(60)),Timestamp.from(core.clock.instant().plus(Duration.ofDays(1))),account,scope,scopeId);
    return id;
  }

  class Client {
    final SessionService.PendingSession session;
    Client(UUID account) {session=core.sessions.createPending(account);}
    MvcResult request(MockHttpServletRequestBuilder b) throws Exception {
      return mvc.perform(b.secure(true).cookie(new Cookie(SessionService.COOKIE,session.token()))
          .header("Origin",ORIGIN).header("X-CSRF-Token",session.session().csrf())).andReturn();
    }
    MvcResult post(String path,Object b) throws Exception { return post(path,b,UUID.randomUUID().toString()); }
    MvcResult post(String path,Object b,String key) throws Exception {
      return request(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/v1"+path)
          .contentType("application/json").content(json.writeValueAsBytes(b)).header("Idempotency-Key",key));
    }
    MvcResult patch(String path,Object b) throws Exception {
      return request(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch("/api/v1"+path)
          .contentType("application/json").content(json.writeValueAsBytes(b)));
    }
    JsonNode getJson(String path) throws Exception {
      var r=request(get("/api/v1"+path));expect(200,r);return node(r);
    }
  }
  JsonNode node(MvcResult r) throws Exception {return json.readTree(r.getResponse().getContentAsString());}
  void expect(int status,MvcResult r) throws Exception {assertEquals(status,r.getResponse().getStatus(),r.getResponse().getContentAsString());}

  @Test void managedProjectionSeparatesContactsAndFieldAuthority() throws Exception {
    var p=new Client(president);var m=new Client(manager);var foreign=new Client(targetAdmin);
    expect(200,p.patch("/clubs/"+club,Map.of("version",0,"contactEmail","club@example.test","website","https://example.test","socialLinks",List.of("https://example.test/social"),"contactVisibility",Map.of("email",false,"website",true,"socialLinks",List.of(false)))));
    var publicView=p.getJson("/clubs/"+club);
    assertFalse(publicView.path("data").has("contactEmail"));
    assertEquals("https://example.test",publicView.path("data").path("website").asText());
    assertFalse(publicView.path("data").has("socialLinks"));
    assertEquals("club@example.test",p.getJson("/clubs/"+club+"?view=managed").path("data").path("contactEmail").asText());
    expect(403,foreign.request(get("/api/v1/clubs/"+club+"?view=managed")));
    expect(403,m.patch("/clubs/"+club,Map.of("version",1,"name","不允許名稱")));
    expect(200,m.patch("/clubs/"+club,Map.of("version",1,"description","可維護社團介紹")));
    expect(409,p.patch("/clubs/"+club,Map.of("version",1,"description","過期版本")));
    expect(400,p.patch("/clubs/"+club,Map.of("version",2,"website","javascript:alert(1)")));
    expect(409,new Client(sourceAdmin).patch("/clubs/"+club,Map.of("version",2,"districtId",target)));
  }

  @Test void districtCreatesOnlyWithinScopeAndRoleDelegationCannotExpand() throws Exception {
    var district=new Client(sourceAdmin);
    expect(403,district.post("/clubs",Map.of("name","越區社團","clubTypeCode","ROTARACT","districtId",target)));
    var created=district.post("/clubs",Map.of("name","新社團","clubTypeCode","ROTARACT","districtId",source));
    expect(201,created);
    assertEquals(source.toString(),node(created).path("districtId").asText());
    var body=roleBody(member,"club_manager",club);
    var p=new Client(president);String key=UUID.randomUUID().toString();
    var assigned=p.post("/role-grants",body,key);expect(201,assigned);
    expect(201,p.post("/role-grants",body,key));
    assertEquals(1,core.db.queryForObject("SELECT count(*) FROM role_grants WHERE account_id=? AND role='club_manager'",Integer.class,member));
    expect(403,new Client(manager).post("/role-grants",roleBody(manager,"club_president",club)));
    var excessive=new HashMap<String,Object>(body);excessive.put("permissions",List.of("history:moderate"));
    assertTrue(Set.of(403,404).contains(p.post("/role-grants",excessive).getResponse().getStatus()));
    UUID assignedId=UUID.fromString(node(assigned).path("id").asText());
    expect(200,p.post("/role-grants/"+assignedId+"/revoke",Map.of("version",0,"reason","結束授權")));
    expect(409,p.post("/role-grants/"+assignedId+"/revoke",Map.of("version",1,"reason","重複撤權")));
    core.db.update("UPDATE role_grants SET revoked_at=? WHERE account_id=? AND role='club_president'",core.now(),president);
    expect(403,p.post("/role-grants",body,key));
  }

  Map<String,Object> roleBody(UUID account,String role,UUID scope) {
    var today=core.today();
    var end=LocalDate.of(today.getYear()+(today.getMonthValue()>=7?1:0),7,1).atStartOfDay(ZoneId.of("Asia/Taipei")).toInstant();
    return Map.of("accountId",account,"role",role,"scope",Map.of("scopeType","club","scopeId",scope),"permissions",List.of(),
        "startsAt",core.clock.instant().toString(),"endsAt",end.toString(),"reason","正式指定任期");
  }

  @Test void bilateralDistrictMoveRechecksBothApprovalsAndMovesScopeAtomically() throws Exception {
    var a=new Client(sourceAdmin);var b=new Client(targetAdmin);
    var created=a.post("/club-move-requests",Map.of("clubId",club,"targetDistrictId",target,"clubVersion",0,"reason","地區重編"));
    expect(201,created);UUID id=UUID.fromString(node(created).path("id").asText());
    expect(403,a.post("/club-move-requests/"+id+"/approve",Map.of("version",0,"side","target")));
    expect(200,a.post("/club-move-requests/"+id+"/approve",Map.of("version",0,"side","source")));
    var ready=b.post("/club-move-requests/"+id+"/approve",Map.of("version",1,"side","target"));
    expect(200,ready);assertEquals("ready",node(ready).path("status").asText());
    assertEquals(source,core.one("SELECT district_id FROM clubs WHERE id=?",club).get("district_id"));
    var done=b.post("/club-move-requests/"+id+"/execute",Map.of("version",2));expect(200,done);
    assertEquals(target.toString(),node(done).path("districtId").asText());
    expect(403,a.request(get("/api/v1/clubs/"+club+"?view=managed")));
    expect(200,b.request(get("/api/v1/clubs/"+club+"?view=managed")));
    assertTrue(core.db.queryForObject("SELECT count(*) FROM organization_audit_details",Integer.class)>=4);
  }

  @Test void revokedApproverCannotBeUsedToExecuteMove() throws Exception {
    var a=new Client(sourceAdmin);var b=new Client(targetAdmin);
    var created=a.post("/club-move-requests",Map.of("clubId",club,"targetDistrictId",target,"clubVersion",0,"reason","異動"));
    expect(201,created);String id=node(created).path("id").asText();
    expect(200,a.post("/club-move-requests/"+id+"/approve",Map.of("version",0,"side","source")));
    expect(200,b.post("/club-move-requests/"+id+"/approve",Map.of("version",1,"side","target")));
    core.db.update("UPDATE role_grants SET revoked_at=? WHERE account_id=?",core.now(),sourceAdmin);
    String executionKey=UUID.randomUUID().toString();
    expect(409,b.post("/club-move-requests/"+id+"/execute",Map.of("version",2),executionKey));
    expect(409,b.post("/club-move-requests/"+id+"/execute",Map.of("version",2),executionKey));
    assertEquals(source,core.one("SELECT district_id FROM clubs WHERE id=?",club).get("district_id"));
    assertEquals("expired",core.one("SELECT status FROM club_move_requests WHERE id=?",UUID.fromString(id)).get("status"));
    UUID replacement=account("replacement");grant(replacement,"district_manager","district",source);
    expect(201,new Client(replacement).post("/club-move-requests",Map.of("clubId",club,"targetDistrictId",target,"clubVersion",0,"reason","重新核准新案件")));
  }

  @Test void changedClubVersionExpiresReadyMoveAndAllowsFreshProposal() throws Exception {
    var a=new Client(sourceAdmin);var b=new Client(targetAdmin);
    var created=a.post("/club-move-requests",Map.of("clubId",club,"targetDistrictId",target,"clubVersion",0,"reason","轉區"));
    expect(201,created);String id=node(created).path("id").asText();
    expect(200,a.post("/club-move-requests/"+id+"/approve",Map.of("version",0,"side","source")));
    expect(200,b.post("/club-move-requests/"+id+"/approve",Map.of("version",1,"side","target")));
    expect(200,a.patch("/clubs/"+club,Map.of("version",0,"name","社團更名")));
    expect(409,b.post("/club-move-requests/"+id+"/execute",Map.of("version",2)));
    assertEquals("expired",core.one("SELECT status FROM club_move_requests WHERE id=?",UUID.fromString(id)).get("status"));
    expect(201,a.post("/club-move-requests",Map.of("clubId",club,"targetDistrictId",target,"clubVersion",1,"reason","依更名後版本重送")));
  }

  @Test void disableTerminatesPendingRequestsWithdrawsCurrentEventsAndRestoreDoesNotRepublish() throws Exception {
    UUID applicant=account("applicant"),application=UUID.randomUUID(),event=UUID.randomUUID();
    core.db.update("INSERT INTO join_applications(id,member_id,club_id,type_code,status,requested_at,expires_at) VALUES(?,?,?,'ROTARACT','pending',?,?)",application,core.member(applicant).get("id"),club,core.now(),Timestamp.from(core.clock.instant().plusSeconds(3600)));
    core.db.update("INSERT INTO events(id,title,organizer_type,organizer_id,visibility,status,time_kind,time_zone,starts_at,ends_at) VALUES(?,'合成活動','club',?,'public','published','timed','Asia/Taipei',?,?)",event,club,Timestamp.from(core.clock.instant().plusSeconds(3600)),Timestamp.from(core.clock.instant().plusSeconds(7200)));
    var admin=new Client(sourceAdmin);expect(200,admin.post("/clubs/"+club+"/disable",Map.of("version",0,"reason","暫停營運")));
    assertEquals("terminated",core.one("SELECT status FROM join_applications WHERE id=?",application).get("status"));
    assertNotNull(core.one("SELECT public_withdrawn_at FROM events WHERE id=?",event).get("public_withdrawn_at"));
    expect(404,admin.request(get("/api/v1/clubs/"+club)));
    expect(200,admin.post("/clubs/"+club+"/restore",Map.of("version",1,"reason","恢復營運")));
    assertEquals("terminated",core.one("SELECT status FROM join_applications WHERE id=?",application).get("status"));
    assertNotNull(core.one("SELECT public_withdrawn_at FROM events WHERE id=?",event).get("public_withdrawn_at"));
    assertEquals("active",core.one("SELECT status FROM memberships WHERE member_id=?",core.member(member).get("id")).get("status"));
  }

  @Test void privilegedGrantsNeedIndependentMfaOperatorAndTargetMfaEnrollment() throws Exception {
    UUID admin=account("permissions"),recipient=account("recipient");
    grant(admin,"permission_admin","platform",null);
    var c=new Client(admin);
    var body=new HashMap<String,Object>(roleBody(recipient,"permission_admin",club));
    body.put("scope",Collections.singletonMap("scopeType","platform"));
    var scope=new HashMap<String,Object>();scope.put("scopeType","platform");scope.put("scopeId",null);body.put("scope",scope);
    expect(403,c.post("/role-grants",body));
    core.db.update("UPDATE accounts SET totp_secret_ciphertext='test-enrolled' WHERE id=?",admin);
    core.db.update("UPDATE api_sessions SET mfa_verified_at=? WHERE account_id=?",core.now(),admin);
    expect(409,c.post("/role-grants",body));
    core.db.update("UPDATE accounts SET totp_secret_ciphertext='test-enrolled' WHERE id=?",recipient);
    expect(201,c.post("/role-grants",body));
    body.put("accountId",admin);
    expect(403,c.post("/role-grants",body));
  }

  @Test void logoReferenceMustUseVerifiedImageForTheSameClubAndAuthorizedEditor() throws Exception {
    var image=new java.awt.image.BufferedImage(2,2,java.awt.image.BufferedImage.TYPE_INT_RGB);
    var output=new java.io.ByteArrayOutputStream();
    javax.imageio.ImageIO.write(image,"png",output);
    var file=new org.springframework.mock.web.MockMultipartFile("file","logo.png","image/png",output.toByteArray());
    var clean=assets.inspect(file,false);
    UUID logo=(UUID)assets.store(sourceAdmin,null,club,"club_logo",clean).get("assetId");
    UUID wrongClub=(UUID)assets.store(targetAdmin,null,otherClub,"club_logo",clean).get("assetId");
    UUID avatar=(UUID)assets.store(president,null,null,"avatar",clean).get("assetId");
    var p=new Client(president);
    expect(404,p.patch("/clubs/"+club,Map.of("version",0,"logoAssetId",wrongClub)));
    expect(404,p.patch("/clubs/"+club,Map.of("version",0,"logoAssetId",avatar)));
    expect(403,new Client(manager).patch("/clubs/"+club,Map.of("version",0,"logoAssetId",logo)));
    expect(200,p.patch("/clubs/"+club,Map.of("version",0,"logoAssetId",logo)));
    assertEquals(logo.toString(),p.getJson("/clubs/"+club).path("data").path("logoAssetId").asText());
    var clear=new HashMap<String,Object>();clear.put("version",1);clear.put("logoAssetId",null);
    expect(200,p.patch("/clubs/"+club,clear));
    assertTrue(p.getJson("/clubs/"+club).path("data").path("logoAssetId").isNull());
  }
}
