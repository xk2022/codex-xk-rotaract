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
import org.springframework.boot.test.context.*;
import org.springframework.context.annotation.*;
import org.springframework.test.web.servlet.*;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

@SpringBootTest
@AutoConfigureMockMvc
@org.springframework.test.context.ActiveProfiles("test")
@Import(BusinessIntegrationTest.TimeConfig.class)
class BusinessIntegrationTest {
  static {
    String url=System.getenv("DATABASE_URL"),profiles=System.getenv("SPRING_PROFILES_ACTIVE");
    if(!"true".equals(System.getenv("CORE_TEST_ALLOW_RESET")) || url==null || !url.matches("jdbc:postgresql://[^/]+/[^?]*_test(?:\\?.*)?") || (profiles!=null&&Arrays.asList(profiles.split(",")).contains("local")))
      throw new IllegalStateException("Business tests require CORE_TEST_ALLOW_RESET=true and a dedicated DATABASE_URL ending in _test; no data was reset.");
  }
  static class TestClock extends Clock {
    Instant at=Instant.parse("2026-10-15T04:00:00Z");
    public ZoneId getZone(){ return ZoneOffset.UTC; }
    public Clock withZone(ZoneId zone){ return Clock.fixed(at,zone); }
    public Instant instant(){ return at; }
  }
  @TestConfiguration static class TimeConfig { @Bean @Primary TestClock businessClock(){ return new TestClock(); } }
  @Autowired CoreService core;
  @Autowired BusinessService businesses;
  @Autowired MockMvc mvc;
  @Autowired ObjectMapper json;
  @Autowired TestClock clock;
  UUID district,club,owner,ownerMember;

  @BeforeEach void reset() {
    core.db.execute("TRUNCATE audit_events,idempotency_records,rate_limits,join_applications,memberships,role_grants,api_sessions,members,accounts,clubs,districts CASCADE");
    clock.at=Instant.parse("2026-10-15T04:00:00Z"); district=UUID.randomUUID();club=UUID.randomUUID();owner=account();ownerMember=businesses.memberId(owner);
    core.db.update("INSERT INTO districts VALUES(?,'BIZTEST','合成商家地區')",district);
    core.db.update("INSERT INTO clubs(id,name,type_code,district_id) VALUES(?,'合成扶青社','ROTARACT',?)",club,district);
  }
  UUID account() {
    UUID account=UUID.randomUUID();String code="T"+account.toString().replace("-","").substring(0,14),email=account+"@example.test";
    core.db.update("INSERT INTO accounts(id,account_code,email,email_key,password_hash) VALUES(?,?,?,?,?)",account,code,email,email,"unused-test-password-hash");
    core.db.update("INSERT INTO members(id,account_id,name,call_name) VALUES(?,?,'私人姓名','PublicCall')",UUID.randomUUID(),account);
    return account;
  }
  void membership(UUID account,int year) {
    UUID member=businesses.memberId(account);
    core.db.update("INSERT INTO memberships(id,member_id,club_id,type_code,status,starts_on,name_snapshot,call_name_snapshot,club_name_snapshot,district_name_snapshot,confirmed_year) VALUES(?,?,?,'ROTARACT','active','2020-01-01','私人姓名','PublicCall','合成扶青社','合成地區',?)",UUID.randomUUID(),member,club,year);
  }
  void contentRole(UUID account) {
    core.db.update("INSERT INTO role_grants(id,account_id,role,scope_type,starts_at,ends_at,granted_by,reason) VALUES(?,?,'content_manager','content',?,?,?,'test')",UUID.randomUUID(),account,core.now(),java.sql.Timestamp.from(clock.instant().plus(Duration.ofDays(366))),owner);
  }
  Map<String,Object> input(String name) {
    return new LinkedHashMap<>(Map.ofEntries(Map.entry("name",name),Map.entry("description","公開介紹"),Map.entry("city","台北"),Map.entry("industryIds",List.of("food")),Map.entry("phone","02-00000000"),Map.entry("email","hidden-company@example.test"),Map.entry("website","https://example.test"),Map.entry("address","合成私人地址"),Map.entry("publicFlags",Map.of("phone",true,"email",false,"website",false,"address",false)),Map.entry("locationConsent",false)));
  }
  class Client {
    String cookie,csrf;
    Client(UUID actor) {
      var pending=core.sessions.createPending(actor);cookie=pending.token();csrf=pending.session().csrf();
    }
    MvcResult run(MockHttpServletRequestBuilder request) throws Exception {
      return mvc.perform(request.secure(true).cookie(new Cookie(SessionService.COOKIE,cookie)).header("Origin","https://localhost:5173").header("X-CSRF-Token",csrf)).andReturn();
    }
    MvcResult write(String method,String path,Object body,String key) throws Exception {
      MockHttpServletRequestBuilder request=method.equals("PATCH")?patch("/api/v1"+path):org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/v1"+path);
      return run(request.contentType("application/json").content(json.writeValueAsBytes(body)).header("Idempotency-Key",key));
    }
    JsonNode post(String path,Object body,int status) throws Exception { var r=write("POST",path,body,UUID.randomUUID().toString());assertEquals(status,r.getResponse().getStatus(),r.getResponse().getContentAsString());return node(r); }
    JsonNode getCompany(UUID company) throws Exception { var r=run(get("/api/v1/companies/"+company));assertEquals(200,r.getResponse().getStatus(),r.getResponse().getContentAsString());return node(r); }
  }
  JsonNode node(MvcResult result) throws Exception { return json.readTree(result.getResponse().getContentAsString()); }
  UUID create(Client client,String name) throws Exception {return UUID.fromString(client.post("/companies",input(name),201).path("id").asText());}
  JsonNode publish(Client client,UUID id) throws Exception { return client.post("/companies/"+id+"/publish",Map.of("version",client.getCompany(id).path("version").asInt()),200); }
  JsonNode publicCompany(UUID id) throws Exception {var r=mvc.perform(get("/api/v1/public/companies/"+id)).andReturn();assertEquals(200,r.getResponse().getStatus(),r.getResponse().getContentAsString());return node(r);}
  void oldPublication(UUID id) {core.db.update("UPDATE business_companies SET first_published_at=? WHERE id=?",java.sql.Timestamp.from(clock.instant().minus(Duration.ofDays(5))),id);}
  void paid(UUID id,LocalDate start) {core.db.update("INSERT INTO business_exposure_grants(id,company_id,starts_on,status,reason,recorded_by,recorded_at) VALUES(?,?,?,'active','已核對合成權益',?,?)",UUID.randomUUID(),id,start,owner,core.now());}

  @Test void trialProjectionAndRepublishCannotResetItsClock() throws Exception {
    var client=new Client(owner);UUID company=create(client,"三日公司");var first=publish(client,company);
    var pub=publicCompany(company);assertEquals("trial",pub.path("exposure").asText());
    for(String field:List.of("email","address","website","ownerId","owner_member_id","nameSnapshot","reviewReason","latitude","longitude")) assertFalse(pub.has(field),field);
    assertEquals("02-00000000",pub.path("phone").asText());assertFalse(pub.path("mapVisible").asBoolean());
    var update=input("三日公司");update.put("description","修改介紹");update.put("version",first.path("version").asInt());
    var changed=client.write("PATCH","/companies/"+company,update,UUID.randomUUID().toString());assertEquals(200,changed.getResponse().getStatus());
    assertFalse(businesses.isPublic(company));var second=publish(client,company);assertEquals(first.path("firstPublishedAt"),second.path("firstPublishedAt"));
    core.db.update("UPDATE business_companies SET first_published_at=? WHERE id=?",java.sql.Timestamp.from(clock.instant().minus(Duration.ofHours(72))),company);
    assertEquals(404,mvc.perform(get("/api/v1/public/companies/"+company)).andReturn().getResponse().getStatus());
    publish(client,company);assertFalse(businesses.isPublic(company));
  }

  @Test void acceptedInvitationAndRevocationEnforceEditingAndReplayAuthorization() throws Exception {
    var own=new Client(owner);UUID company=create(own,"共享公司"),editor=account();var other=new Client(editor);
    assertEquals(404,other.run(get("/api/v1/companies/"+company)).getResponse().getStatus());
    var invitation=own.post("/companies/"+company+"/links",Map.of("version",0,"memberId",businesses.memberId(editor),"kind","editor"),201);
    assertEquals(404,other.run(get("/api/v1/companies/"+company)).getResponse().getStatus());
    other.post("/company-invitations/"+invitation.path("id").asText()+"/accept",Map.of("version",0),200);
    var update=input("共同編輯");update.put("version",other.getCompany(company).path("version").asInt());String key=UUID.randomUUID().toString();
    assertEquals(200,other.write("PATCH","/companies/"+company,update,key).getResponse().getStatus());
    own.post("/companies/"+company+"/links/"+invitation.path("id").asText()+"/remove",Map.of("version",1),200);
    assertEquals(404,other.write("PATCH","/companies/"+company,update,key).getResponse().getStatus());
    assertEquals(404,other.run(get("/api/v1/companies/"+company)).getResponse().getStatus());
    var stale=input("過期寫入");stale.put("version",0);assertEquals(409,own.write("PATCH","/companies/"+company,stale,UUID.randomUUID().toString()).getResponse().getStatus());
  }

  @Test void freeEligibilityRequiresAcceptedAssociationAndCurrentMembershipButAdvertisementIsIndependent() throws Exception {
    var own=new Client(owner);UUID company=create(own,"資格公司"),associated=account();membership(associated,2026);publish(own,company);oldPublication(company);
    assertFalse(businesses.isPublic(company));
    var link=own.post("/companies/"+company+"/links",Map.of("version",own.getCompany(company).path("version").asInt(),"memberId",businesses.memberId(associated),"kind","member"),201);
    assertFalse(businesses.isPublic(company));new Client(associated).post("/company-invitations/"+link.path("id").asText()+"/accept",Map.of("version",0),200);
    assertEquals("free",publicCompany(company).path("exposure").asText());
    core.db.update("UPDATE clubs SET status='disabled' WHERE id=?",club);assertFalse(businesses.isPublic(company));
    paid(company,LocalDate.of(2026,10,1));assertEquals("advertisement",publicCompany(company).path("exposure").asText());
    assertFalse(publicCompany(company).toString().contains("hidden-company"));
    core.db.update("UPDATE clubs SET is_public=false WHERE id=?",club);assertEquals(0,publicCompany(company).path("contacts").size());
  }

  @Test void sixUniqueActivePeersAndWithdrawalWhileHiddenAndAfterLostMembership() throws Exception {
    var own=new Client(owner);membership(owner,2026);UUID company=create(own,"存在確認");publish(own,company);
    own.post("/companies/"+company+"/confirmations",Map.of("version",own.getCompany(company).path("version").asInt()),404);
    var peers=new ArrayList<UUID>();
    for(int i=0;i<6;i++) {UUID peer=account();peers.add(peer);membership(peer,2026);new Client(peer).post("/companies/"+company+"/confirmations",Map.of("version",own.getCompany(company).path("version").asInt()),200);}
    var pub=publicCompany(company);assertEquals(6,pub.path("confirmationCount").asInt());assertTrue(pub.path("communityConfirmed").asBoolean());assertFalse(pub.has("endorsements"));
    new Client(peers.getFirst()).post("/companies/"+company+"/confirmations",Map.of("version",own.getCompany(company).path("version").asInt()),409);
    core.db.update("UPDATE memberships SET status='ended',ends_on='2026-10-15',end_reason='ob' WHERE member_id=?",businesses.memberId(peers.getFirst()));
    core.db.update("UPDATE business_companies SET status='draft' WHERE id=?",company);
    new Client(peers.getFirst()).post("/companies/"+company+"/confirmations/withdraw",Map.of("version",own.getCompany(company).path("version").asInt()),200);
    assertEquals(5,core.db.queryForObject("SELECT count(*) FROM business_confirmations WHERE company_id=?",Integer.class,company));
    var update=input("重大名稱變更");update.put("version",own.getCompany(company).path("version").asInt());assertEquals(200,own.write("PATCH","/companies/"+company,update,UUID.randomUUID().toString()).getResponse().getStatus());
    assertEquals(0,core.db.queryForObject("SELECT count(*) FROM business_confirmations WHERE company_id=?",Integer.class,company));
  }

  @Test void confirmationCalendarYearExpiryDoesNotGrantExposure() throws Exception {
    var own=new Client(owner);UUID company=create(own,"確認不授予曝光");publish(own,company);
    for(int i=0;i<6;i++) {UUID peer=account();membership(peer,2026);core.db.update("INSERT INTO business_confirmations VALUES(?,?,?)",company,businesses.memberId(peer),java.sql.Timestamp.from(clock.instant().atZone(ZoneId.of("Asia/Taipei")).minusYears(1).toInstant()));}
    assertEquals(0,publicCompany(company).path("confirmationCount").asInt());
    core.db.update("UPDATE business_confirmations SET confirmed_at=? WHERE company_id=?",core.now(),company);
    assertTrue(publicCompany(company).path("communityConfirmed").asBoolean());oldPublication(company);assertFalse(businesses.isPublic(company));
  }

  @Test void contentScopeDoesNotRevealPrivateFieldsAndSuspensionCannotBeBypassed() throws Exception {
    var own=new Client(owner);UUID company=create(own,"事後治理");publish(own,company);UUID reviewer=account();var manager=new Client(reviewer);
    core.db.update("INSERT INTO role_grants(id,account_id,role,club_id,starts_at,ends_at,granted_by,reason) VALUES(?,?,'club_manager',?,?,?,?, 'test')",UUID.randomUUID(),reviewer,club,core.now(),java.sql.Timestamp.from(clock.instant().plusSeconds(3600)),owner);
    assertEquals(404,manager.run(get("/api/v1/business-review/companies/"+company)).getResponse().getStatus());contentRole(reviewer);
    var detail=node(manager.run(get("/api/v1/business-review/companies/"+company)));for(String f:List.of("email","address","website","latitude","longitude","ownerId","acceptedMemberIds"))assertFalse(detail.has(f),f);
    manager.post("/business-review/companies/"+company+"/suspend",Map.of("version",detail.path("version").asInt(),"reason",""),400);
    manager.post("/business-review/companies/"+company+"/suspend",Map.of("version",detail.path("version").asInt(),"reason","合成內容處理原因"),200);
    paid(company,LocalDate.of(2026,10,1));assertFalse(businesses.isPublic(company));
    own.post("/companies/"+company+"/publish",Map.of("version",own.getCompany(company).path("version").asInt()),409);
    assertEquals(1,core.db.queryForObject("SELECT count(*) FROM business_audit_details WHERE company_id=? AND reason='合成內容處理原因'",Integer.class,company));
  }

  @Test void mapBoundsAndSearchOnlyUseProjectedPublicRecords() throws Exception {
    var own=new Client(owner);var data=input("地圖公司");data.put("latitude",25.04);data.put("longitude",121.53);data.put("locationConsent",true);
    UUID located=UUID.fromString(own.post("/companies",data,201).path("id").asText());publish(own,located);publish(own,create(own,"無座標公司"));create(own,"隱藏公司搜尋詞");
    var map=node(mvc.perform(get("/api/v1/public/map/companies").param("bounds","25,121,26,122")).andReturn());assertEquals(1,map.path("total").asInt());
    assertEquals(0,node(mvc.perform(get("/api/v1/public/companies").param("keyword","隱藏公司搜尋詞")).andReturn()).path("total").asInt());
    assertEquals(0,node(mvc.perform(get("/api/v1/public/companies").param("keyword","hidden-company@example.test")).andReturn()).path("total").asInt());
    assertEquals(0,node(mvc.perform(get("/api/v1/public/companies").param("industryId","retail")).andReturn()).path("total").asInt());
    assertEquals(400,mvc.perform(get("/api/v1/public/map/companies").param("bounds","NaN,121,26,122")).andReturn().getResponse().getStatus());
  }

  @Test void julyGraceAndLeapDayAdvertisementExpiryUseTaipeiCalendar() throws Exception {
    var own=new Client(owner);membership(owner,2025);UUID company=create(own,"年度資格");publish(own,company);oldPublication(company);
    clock.at=Instant.parse("2026-07-31T15:59:59Z");assertTrue(businesses.isPublic(company));
    clock.at=Instant.parse("2026-07-31T16:00:00Z");assertFalse(businesses.isPublic(company));
    core.db.update("UPDATE memberships SET confirmed_year=2026 WHERE member_id=?",ownerMember);assertTrue(businesses.isPublic(company));
    core.db.update("UPDATE memberships SET annual_unconfirmed_year=2026 WHERE member_id=?",ownerMember);assertFalse(businesses.isPublic(company));
    paid(company,LocalDate.of(2024,2,29));clock.at=Instant.parse("2025-02-27T15:59:59Z");assertTrue(businesses.isPublic(company));
    clock.at=Instant.parse("2025-02-27T16:00:00Z");assertFalse(businesses.isPublic(company));
  }

  @Test void membershipEndDateIsExclusiveForExposureAndExistenceConfirmation() throws Exception {
    var own=new Client(owner);membership(owner,2026);UUID company=create(own,"社籍迄日邊界");publish(own,company);oldPublication(company);
    assertTrue(businesses.isPublic(company));
    core.db.update("UPDATE memberships SET ends_on=? WHERE member_id=?",core.today(),ownerMember);
    assertFalse(businesses.isPublic(company));assertFalse(businesses.validMember(ownerMember));
    paid(company,core.today());assertTrue(businesses.isPublic(company));
    UUID peer=account();membership(peer,2026);core.db.update("UPDATE memberships SET ends_on=? WHERE member_id=?",core.today(),businesses.memberId(peer));
    new Client(peer).post("/companies/"+company+"/confirmations",Map.of("version",own.getCompany(company).path("version").asInt()),404);
  }

  @Test void simultaneousCompanyEditsOnlyCommitOneVersion() throws Exception {
    var first=new Client(owner);var second=new Client(owner);UUID company=create(first,"並行版本");
    var a=input("甲版本");a.put("version",0);var b=input("乙版本");b.put("version",0);
    var pool=java.util.concurrent.Executors.newFixedThreadPool(2);
    try {
      var ready=new java.util.concurrent.CountDownLatch(2);var start=new java.util.concurrent.CountDownLatch(1);
      var fa=pool.submit(()->{ready.countDown();start.await();return first.write("PATCH","/companies/"+company,a,UUID.randomUUID().toString()).getResponse().getStatus();});
      var fb=pool.submit(()->{ready.countDown();start.await();return second.write("PATCH","/companies/"+company,b,UUID.randomUUID().toString()).getResponse().getStatus();});
      assertTrue(ready.await(5,java.util.concurrent.TimeUnit.SECONDS));start.countDown();
      var statuses=new ArrayList<>(List.of(fa.get(10,java.util.concurrent.TimeUnit.SECONDS),fb.get(10,java.util.concurrent.TimeUnit.SECONDS)));Collections.sort(statuses);assertEquals(List.of(200,409),statuses);
      assertEquals(1,first.getCompany(company).path("version").asInt());
    } finally {pool.shutdownNow();}
  }

  @Test void invitationHistoryIncludesSentAndReceivedAndRechecksBothVersions() throws Exception {
    var own=new Client(owner);UUID company=create(own,"邀請版本公司"),invitee=account(),stranger=account();var recipient=new Client(invitee);
    var invitation=own.post("/companies/"+company+"/links",Map.of("version",0,"companyVersion",0,"memberId",businesses.memberId(invitee),"kind","editor"),201);
    String link=invitation.path("id").asText();assertEquals(1,invitation.path("companyVersion").asInt());
    var outgoing=node(own.run(get("/api/v1/me/company-invitations"))).path("items");var incoming=node(recipient.run(get("/api/v1/me/company-invitations"))).path("items");
    assertEquals(1,outgoing.size());assertEquals(outgoing,incoming);assertEquals(ownerMember.toString(),incoming.get(0).path("ownerId").asText());
    assertEquals(businesses.memberId(invitee).toString(),incoming.get(0).path("inviteeId").asText());assertTrue(incoming.get(0).has("createdAt"));assertTrue(incoming.get(0).has("updatedAt"));
    assertEquals(0,node(new Client(stranger).run(get("/api/v1/me/company-invitations"))).path("items").size());
    assertEquals(404,recipient.run(get("/api/v1/companies/"+company)).getResponse().getStatus());
    for(String privateField:List.of("phone","email","address","latitude","longitude","publicFlags"))assertFalse(incoming.get(0).has(privateField),privateField);
    recipient.post("/company-invitations/"+link+"/accept",Map.of("version",0,"companyVersion",0),409);
    recipient.post("/company-invitations/"+link+"/accept",Map.of("version",1,"companyVersion",1),409);
    recipient.post("/company-invitations/"+link+"/accept",Map.of("version",0,"companyVersion","1"),400);
    var accepted=recipient.post("/company-invitations/"+link+"/accept",Map.of("version",0,"companyVersion",1),200);assertEquals("accepted",accepted.path("status").asText());
    assertEquals(2,accepted.path("companyVersion").asInt());assertEquals("accepted",node(own.run(get("/api/v1/me/company-invitations"))).path("items").get(0).path("status").asText());
    own.post("/company-invitations/"+link+"/revoke",Map.of("version",1,"companyVersion",2),200);
    assertEquals("revoked",node(recipient.run(get("/api/v1/me/company-invitations"))).path("items").get(0).path("status").asText());
    assertEquals(404,recipient.run(get("/api/v1/companies/"+company)).getResponse().getStatus());
  }

  @Test void ownerCancellationAndReinvitationKeepOldHistoryAndWorkWhileSuspended() throws Exception {
    var own=new Client(owner);UUID company=create(own,"取消邀請"),invitee=account();var recipient=new Client(invitee);
    var first=own.post("/companies/"+company+"/links",Map.of("version",0,"memberId",businesses.memberId(invitee),"kind","editor"),201);String link=first.path("id").asText();
    recipient.post("/company-invitations/"+link+"/cancel",Map.of("version",0,"companyVersion",1),404);
    own.post("/company-invitations/"+link+"/cancel",Map.of("version",0,"companyVersion",0),409);
    core.db.update("UPDATE business_companies SET status='suspended' WHERE id=?",company);
    recipient.post("/company-invitations/"+link+"/accept",Map.of("version",0,"companyVersion",1),409);
    var cancelled=own.post("/company-invitations/"+link+"/cancel",Map.of("version",0,"companyVersion",1),200);assertEquals("cancelled",cancelled.path("status").asText());
    recipient.post("/company-invitations/"+link+"/accept",Map.of("version",1,"companyVersion",2),409);
    core.db.update("UPDATE business_companies SET status='draft' WHERE id=?",company);
    var second=own.post("/companies/"+company+"/links",Map.of("version",2,"companyVersion",2,"memberId",businesses.memberId(invitee),"kind","editor"),201);assertNotEquals(link,second.path("id").asText());
    recipient.post("/company-invitations/"+second.path("id").asText()+"/reject",Map.of("version",0,"companyVersion",3),200);
    var history=node(own.run(get("/api/v1/me/company-invitations"))).path("items");assertEquals(2,history.size());
    var statuses=new HashSet<String>();history.forEach(row->statuses.add(row.path("status").asText()));assertEquals(Set.of("cancelled","rejected"),statuses);
  }

  @Test void revokingEditorPreservesIndependentAssociationPublicationAndFreeQualification() throws Exception {
    var own=new Client(owner);UUID company=create(own,"獨立公司權限"),invitee=account();membership(invitee,2026);var recipient=new Client(invitee);
    var published=publish(own,company);
    var memberLink=own.post("/companies/"+company+"/links",Map.of("version",own.getCompany(company).path("version").asInt(),"memberId",businesses.memberId(invitee),"kind","member"),201);
    recipient.post("/company-invitations/"+memberLink.path("id").asText()+"/accept",Map.of("version",0,"companyVersion",memberLink.path("companyVersion").asInt()),200);
    var editorLink=own.post("/companies/"+company+"/links",Map.of("version",own.getCompany(company).path("version").asInt(),"memberId",businesses.memberId(invitee),"kind","editor"),201);
    var accepted=recipient.post("/company-invitations/"+editorLink.path("id").asText()+"/accept",Map.of("version",0,"companyVersion",editorLink.path("companyVersion").asInt()),200);
    own.post("/company-invitations/"+memberLink.path("id").asText()+"/revoke",Map.of("version",1,"companyVersion",accepted.path("companyVersion").asInt()),409);
    own.post("/company-invitations/"+editorLink.path("id").asText()+"/revoke",Map.of("version",1,"companyVersion",accepted.path("companyVersion").asInt()),200);
    var current=own.getCompany(company);assertEquals(0,current.path("acceptedMaintainerIds").size());assertEquals(1,current.path("acceptedMemberIds").size());assertTrue(current.path("eligibility").path("free").asBoolean());
    assertEquals(published.path("firstPublishedAt"),current.path("firstPublishedAt"));assertEquals("approved",current.path("status").asText());assertEquals(ownerMember.toString(),current.path("ownerId").asText());
    assertEquals(404,recipient.run(get("/api/v1/companies/"+company)).getResponse().getStatus());
  }

  @Test void ownConfirmationHistoryReportsEligibilityVisibilityAndExclusiveLeapExpiryPrivately() throws Exception {
    var own=new Client(owner);UUID company=create(own,"確認紀錄公司"),peer=account(),anotherPeer=account();membership(peer,2026);membership(anotherPeer,2026);publish(own,company);
    var member=new Client(peer);member.post("/companies/"+company+"/confirmations",Map.of("version",own.getCompany(company).path("version").asInt()),200);
    new Client(anotherPeer).post("/companies/"+company+"/confirmations",Map.of("version",own.getCompany(company).path("version").asInt()),200);
    var records=node(member.run(get("/api/v1/me/business-confirmations"))).path("items");assertEquals(1,records.size());var record=records.get(0);assertTrue(record.path("counted").asBoolean());assertTrue(record.path("publiclyVisible").asBoolean());assertEquals("2027-10-15T04:00:00Z",record.path("expiresAt").asText());
    for(String privateField:List.of("email","phone","address","latitude","longitude","memberId","endorsements","confirmationCount"))assertFalse(record.has(privateField),privateField);
    core.db.update("UPDATE business_companies SET status='draft' WHERE id=?",company);
    record=node(member.run(get("/api/v1/me/business-confirmations"))).path("items").get(0);assertTrue(record.path("counted").asBoolean());assertFalse(record.path("publiclyVisible").asBoolean());
    core.db.update("UPDATE memberships SET confirmed_year=2024 WHERE member_id=?",businesses.memberId(peer));
    core.db.update("UPDATE business_confirmations SET confirmed_at='2024-02-29T04:00:00Z' WHERE company_id=? AND member_id=?",company,businesses.memberId(peer));
    clock.at=Instant.parse("2025-02-28T03:59:59Z");member=new Client(peer);
    record=node(member.run(get("/api/v1/me/business-confirmations"))).path("items").get(0);assertTrue(record.path("counted").asBoolean());assertEquals("2025-02-28T04:00:00Z",record.path("expiresAt").asText());
    clock.at=Instant.parse("2025-02-28T04:00:00Z");assertFalse(node(member.run(get("/api/v1/me/business-confirmations"))).path("items").get(0).path("counted").asBoolean());
    assertEquals(0,node(new Client(owner).run(get("/api/v1/me/business-confirmations"))).path("items").size());
  }

  @Test void concurrentInvitationsAllocateOnlyOneOpenLink() throws Exception {
    var first=new Client(owner);var second=new Client(owner);UUID company=create(first,"邀請競爭公司"),invitee=account();
    UUID member=businesses.memberId(invitee);
    var body=Map.of("version",0,"companyVersion",0,"memberId",member,"kind","editor");
    var pool=java.util.concurrent.Executors.newFixedThreadPool(2);
    try {
      var ready=new java.util.concurrent.CountDownLatch(2);var start=new java.util.concurrent.CountDownLatch(1);
      var a=pool.submit(()->{ready.countDown();start.await();return first.write("POST","/companies/"+company+"/links",body,UUID.randomUUID().toString()).getResponse().getStatus();});
      var b=pool.submit(()->{ready.countDown();start.await();return second.write("POST","/companies/"+company+"/links",body,UUID.randomUUID().toString()).getResponse().getStatus();});
      assertTrue(ready.await(5,java.util.concurrent.TimeUnit.SECONDS));start.countDown();
      var statuses=new ArrayList<>(List.of(a.get(10,java.util.concurrent.TimeUnit.SECONDS),b.get(10,java.util.concurrent.TimeUnit.SECONDS)));Collections.sort(statuses);assertEquals(List.of(201,409),statuses);
      assertEquals(1,core.db.queryForObject("SELECT count(*) FROM business_company_links WHERE company_id=? AND member_id=? AND kind='editor' AND status IN ('pending','accepted')",Integer.class,company,member));
      assertEquals(1,first.getCompany(company).path("version").asInt());
      first.post("/companies/"+company+"/links",Map.of("version",1,"companyVersion",1,"memberId",member,"kind","editor"),409);
      assertEquals(1,node(first.run(get("/api/v1/me/company-invitations"))).path("items").size());
    } finally {pool.shutdownNow();}
  }

  @Test void invitationAcceptanceAndOwnerCancellationCommitOneConsistentOutcome() throws Exception {
    var own=new Client(owner);UUID company=create(own,"回覆取消競爭"),invitee=account();var recipient=new Client(invitee);
    var invitation=own.post("/companies/"+company+"/links",Map.of("version",0,"memberId",businesses.memberId(invitee),"kind","editor"),201);
    String link=invitation.path("id").asText();var body=Map.of("version",0,"companyVersion",1);
    var pool=java.util.concurrent.Executors.newFixedThreadPool(2);
    try {
      var ready=new java.util.concurrent.CountDownLatch(2);var start=new java.util.concurrent.CountDownLatch(1);
      var accept=pool.submit(()->{ready.countDown();start.await();return recipient.write("POST","/company-invitations/"+link+"/accept",body,UUID.randomUUID().toString()).getResponse().getStatus();});
      var cancel=pool.submit(()->{ready.countDown();start.await();return own.write("POST","/company-invitations/"+link+"/cancel",body,UUID.randomUUID().toString()).getResponse().getStatus();});
      assertTrue(ready.await(5,java.util.concurrent.TimeUnit.SECONDS));start.countDown();
      var statuses=new ArrayList<>(List.of(accept.get(10,java.util.concurrent.TimeUnit.SECONDS),cancel.get(10,java.util.concurrent.TimeUnit.SECONDS)));Collections.sort(statuses);assertEquals(List.of(200,409),statuses);
      var row=core.one("SELECT * FROM business_company_links WHERE id=?",UUID.fromString(link));
      assertTrue(Set.of("accepted","cancelled").contains(row.get("status")));assertEquals(1,row.get("version"));
      assertEquals(2,own.getCompany(company).path("version").asInt());
      assertEquals(row.get("status").equals("accepted")?200:404,recipient.run(get("/api/v1/companies/"+company)).getResponse().getStatus());
      assertEquals(1,core.db.queryForObject("SELECT count(*) FROM business_company_links WHERE company_id=? AND member_id=?",Integer.class,company,businesses.memberId(invitee)));
      assertEquals(1,core.db.queryForObject("SELECT count(*) FROM audit_events WHERE target_id=? AND action IN ('business.invitation.accept','business.invitation.cancel')",Integer.class,company));
    } finally {pool.shutdownNow();}
  }

}
