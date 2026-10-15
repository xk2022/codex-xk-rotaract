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

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@org.springframework.context.annotation.Import(TaskIntegrationTest.TimeConfig.class)
class TaskIntegrationTest {
  static {
    String url=System.getenv("DATABASE_URL");
    if(!"true".equals(System.getenv("CORE_TEST_ALLOW_RESET"))||url==null||!url.matches("jdbc:postgresql://[^/]+/[^?]*_test(?:\\?.*)?")||Arrays.asList(System.getenv().getOrDefault("SPRING_PROFILES_ACTIVE","").split(",")).contains("local"))
      throw new IllegalStateException("Dedicated *_test database and reset consent required");
  }
  static class TestClock extends Clock {
    Instant at=Instant.parse("2026-10-15T04:00:00Z");
    public ZoneId getZone(){return ZoneOffset.UTC;}
    public Clock withZone(ZoneId zone){return Clock.fixed(at,zone);}
    public Instant instant(){return at;}
  }
  @org.springframework.boot.test.context.TestConfiguration static class TimeConfig {
    @org.springframework.context.annotation.Bean @org.springframework.context.annotation.Primary TestClock tasksClock(){return new TestClock();}
  }
  @Autowired TestClock clock;
  @Autowired CoreService core;
  @Autowired ObjectMapper json;
  @Autowired MockMvc mvc;
  UUID owner,other,manager,support,club,district,company;
  @BeforeEach void reset(){
    clock.at=Instant.parse("2026-10-15T04:00:00Z");
    core.db.execute("TRUNCATE accounts,members,clubs,districts,api_sessions,role_grants,rate_limits,idempotency_records,audit_events CASCADE");
    owner=account();other=account();manager=account();support=account();club=UUID.randomUUID();district=UUID.randomUUID();company=UUID.randomUUID();
    core.db.update("INSERT INTO districts VALUES(?,'TASKS','合成地區')",district);
    core.db.update("INSERT INTO clubs(id,name,type_code,district_id) VALUES(?,'合成社團','ROTARACT',?)",club,district);
    grant(manager,"club_president","club",club);grant(support,"account_support","platform",null);
    core.db.update("INSERT INTO business_companies(id,owner_member_id,name,status,created_at,updated_at) VALUES(?,?,'私人公司草稿','draft',?,?)",company,member(owner),core.now(),core.now());
  }
  UUID account(){UUID id=UUID.randomUUID();String code="T"+id.toString().replace("-","").substring(0,15);core.db.update("INSERT INTO accounts(id,account_code,email,email_key,password_hash) VALUES(?,?,?,?,?)",id,code,id+"@example.test",id+"@example.test","unused-test-password");core.db.update("INSERT INTO members(id,account_id,name,call_name) VALUES(?,?,'合成姓名','合成稱呼')",UUID.randomUUID(),id);return id;}
  UUID member(UUID account){return (UUID)core.member(account).get("id");}
  void grant(UUID account,String role,String scope,UUID target){core.db.update("INSERT INTO role_grants(id,account_id,role,club_id,scope_type,scope_id,starts_at,ends_at,granted_by,reason) VALUES(?,?,?,?,?,?,?,?,?,'test')",UUID.randomUUID(),account,role,scope.equals("club")?target:null,scope,target,Timestamp.from(core.clock.instant().minusSeconds(60)),Timestamp.from(core.clock.instant().plusSeconds(3600)),account);}
  MvcResult read(UUID account,String query)throws Exception{var session=core.sessions.createPending(account);return mvc.perform(get("/api/v1/me/tasks"+query).secure(true).cookie(new Cookie(SessionService.COOKIE,session.token()))).andReturn();}
  JsonNode node(MvcResult r)throws Exception{return json.readTree(r.getResponse().getContentAsString());}
  void expect(int status,MvcResult r)throws Exception{assertEquals(status,r.getResponse().getStatus(),r.getResponse().getContentAsString());}
  @Test void businessRemindersRequireExplicitScopeAndNeverRevealOtherCompanies()throws Exception{
    expect(401,mvc.perform(get("/api/v1/me/tasks")).andReturn());
    var own=read(owner,"");expect(200,own);assertEquals(0,node(own).path("total").asInt());assertFalse(own.getResponse().getContentAsString().contains("私人公司"));
    var business=read(owner,"?scope=business");expect(200,business);assertEquals(1,node(business).path("total").asInt());assertEquals(company.toString(),node(business).path("items").get(0).path("companyId").asText());
    assertEquals(0,node(read(other,"?scope=business")).path("total").asInt());
    expect(400,read(owner,"?scope=business&clubId="+club));expect(400,read(owner,"?pageSize=1"));expect(400,read(owner,"?scope=platform"));expect(400,read(owner,"?memberId="+member(other)));
    var filtered=read(owner,"?scope=business&priority=waiting");expect(200,filtered);assertEquals(0,node(filtered).path("total").asInt());assertEquals(1,node(filtered).path("summary").path("action").asInt());
  }
  @Test void clubTasksUseCurrentScopeAndDoNotExposeApplicantsToDistrictManagers()throws Exception{
    core.db.update("INSERT INTO join_applications(id,member_id,club_id,type_code,status,requested_at,expires_at) VALUES(?,?,?,'ROTARACT','pending',?,?)",UUID.randomUUID(),member(owner),club,core.now(),Timestamp.from(core.clock.instant().plusSeconds(3600)));
    assertEquals("waiting",node(read(owner,"")).path("items").get(0).path("priority").asText());
    expect(404,read(other,"?scope=club&clubId="+club));
    var own=read(manager,"?scope=club&clubId="+club);expect(200,own);assertEquals(1,node(own).path("total").asInt());assertFalse(own.getResponse().getContentAsString().contains("@example.test"));
    grant(other,"district_manager","district",district);var districtTasks=read(other,"?scope=club&clubId="+club);expect(200,districtTasks);assertEquals(0,node(districtTasks).path("total").asInt());
    core.db.update("UPDATE role_grants SET revoked_at=? WHERE account_id=?",core.now(),manager);expect(404,read(manager,"?scope=club&clubId="+club));
  }
  @Test void supportScopeOnlyShowsAssignedCasesAndOwnSupplementRequests()throws Exception{
    UUID assigned=UUID.randomUUID(),unassigned=UUID.randomUUID();
    for(UUID id:List.of(assigned,unassigned))core.db.update("INSERT INTO support_cases(id,requester_account_id,type,status,description,created_at,updated_at) VALUES(?,?,'account_recovery','awaiting_evidence','不應出現在任務中的補件內容',?,?)",id,owner,core.now(),core.now());
    core.db.update("INSERT INTO support_case_assignments(case_id,account_id,assigned_by,assigned_at) VALUES(?,?,?,?)",assigned,support,support,core.now());
    var handler=read(support,"?scope=support");expect(200,handler);assertEquals(1,node(handler).path("total").asInt());assertFalse(handler.getResponse().getContentAsString().contains(unassigned.toString()));assertFalse(handler.getResponse().getContentAsString().contains("不應出現"));
    assertEquals(2,node(read(owner,"")).path("total").asInt());expect(404,read(owner,"?scope=support"));
    core.db.update("DELETE FROM support_case_assignments WHERE case_id=?",assigned);assertEquals(0,node(read(support,"?scope=support")).path("total").asInt());
  }
  @Test void exposureRemindersUseFixedTrialDeadlineAndDoNotExtendPublication()throws Exception{
    Timestamp published=Timestamp.from(core.clock.instant().minus(Duration.ofHours(71)));
    core.db.update("UPDATE business_companies SET status='approved',first_published_at=? WHERE id=?",published,company);
    var reminder=read(owner,"?scope=business");expect(200,reminder);assertEquals("reminder",node(reminder).path("items").get(0).path("priority").asText());
    assertEquals(published,core.one("SELECT first_published_at FROM business_companies WHERE id=?",company).get("first_published_at"));
    core.db.update("UPDATE business_companies SET first_published_at=? WHERE id=?",Timestamp.from(core.clock.instant().minus(Duration.ofHours(73))),company);
    assertEquals("action",node(read(owner,"?scope=business")).path("items").get(0).path("priority").asText());
    assertEquals(0,core.db.queryForObject("SELECT version FROM business_companies WHERE id=?",Integer.class,company));
  }
  UUID membership(UUID account,UUID targetClub,int confirmedYear){
    UUID id=UUID.randomUUID();
    core.db.update("INSERT INTO memberships(id,member_id,club_id,type_code,status,starts_on,name_snapshot,call_name_snapshot,club_name_snapshot,district_name_snapshot,confirmed_year) VALUES(?,?,?,'ROTARACT','active',?,'合成姓名','合成稱呼','合成社團','合成地區',?)",id,member(account),targetClub,core.today().minusDays(30),confirmedYear);
    return id;
  }
  JsonNode task(UUID account,String query,String id)throws Exception{
    var response=read(account,query);expect(200,response);
    for(JsonNode item:node(response).path("items"))if(id.equals(item.path("id").asText()))return item;
    return null;
  }
  UUID managerGrant(){return (UUID)core.one("SELECT id FROM role_grants WHERE account_id=? AND revoked_at IS NULL",manager).get("id");}
  @Test void julyGraceDoesNotCreateAnnualTaskButExplicitUnconfirmationDoes()throws Exception{
    clock.at=Instant.parse("2027-07-15T04:00:00Z");
    core.db.update("UPDATE role_grants SET starts_at=?,ends_at=?",Timestamp.from(clock.instant().minusSeconds(60)),Timestamp.from(clock.instant().plusSeconds(3600)));
    UUID ms=membership(owner,club,2026);
    assertEquals("grace",core.annual(core.one("SELECT * FROM memberships WHERE id=?",ms)));
    assertNull(task(owner,"","annual-own"));assertNull(task(manager,"?scope=club&clubId="+club,"annual-"+club));
    core.db.update("UPDATE memberships SET annual_unconfirmed_year=2027 WHERE id=?",ms);
    assertEquals("waiting",task(owner,"","annual-own").path("priority").asText());
    assertEquals("action",task(manager,"?scope=club&clubId="+club,"annual-"+club).path("priority").asText());
    core.db.update("UPDATE memberships SET ends_on=? WHERE id=?",core.today(),ms);
    assertNull(task(owner,"","annual-own"));assertNull(task(manager,"?scope=club&clubId="+club,"annual-"+club));
  }
  @Test void changedTransferVersionOrRevokedApprovalRequiresReviewInsteadOfMemberExecution()throws Exception{
    UUID target=UUID.randomUUID();core.db.update("INSERT INTO clubs(id,name,type_code,district_id) VALUES(?,'目標社','ROTARACT',?)",target,district);grant(other,"club_president","club",target);
    UUID ms=membership(owner,club,core.yearStart()),fromGrant=managerGrant(),toGrant=(UUID)core.one("SELECT id FROM role_grants WHERE account_id=?",other).get("id"),transfer=UUID.randomUUID();
    core.db.update("INSERT INTO membership_transfers(id,member_id,from_membership_id,from_club_id,to_club_id,reason,status,source_version,from_actor,from_grant,from_approved_at,to_actor,to_grant,to_approved_at,requested_at,expires_at,ready_expires_at) VALUES(?,?,?,?,?,'合成轉社','ready_for_member',0,?,?,?,?,?,?,?,?,?)",transfer,member(owner),ms,club,target,manager,fromGrant,core.now(),other,toGrant,core.now(),core.now(),Timestamp.from(clock.instant().plus(Duration.ofDays(30))),Timestamp.from(clock.instant().plus(Duration.ofDays(7))));
    String id="transfer-"+transfer;
    assertEquals("action",task(owner,"",id).path("priority").asText());assertNull(task(manager,"?scope=club&clubId="+club,id));
    core.db.update("UPDATE memberships SET version=version+1 WHERE id=?",ms);
    assertEquals("waiting",task(owner,"",id).path("priority").asText());assertEquals("action",task(manager,"?scope=club&clubId="+club,id).path("priority").asText());
    core.db.update("UPDATE membership_transfers SET source_version=1 WHERE id=?",transfer);
    core.db.update("UPDATE role_grants SET revoked_at=? WHERE id=?",core.now(),fromGrant);grant(manager,"club_president","club",club);
    assertEquals("waiting",task(owner,"",id).path("priority").asText());assertEquals("action",task(manager,"?scope=club&clubId="+club,id).path("priority").asText());
  }
  @Test void staleOrRevokedPublicationConsentIsAbsentFromActionTasks()throws Exception{
    UUID ms=membership(owner,club,core.yearStart()),grant=managerGrant(),request=UUID.randomUUID();
    core.db.update("UPDATE role_grants SET permissions=ARRAY['history:moderate'] WHERE id=?",grant);
    core.db.update("INSERT INTO publication_requests(id,membership_id,subject_member_id,requested_by,requester_name,grant_id,content_version,visibility_version,content,status,requested_at,expires_at) VALUES(?,?,?,?,?,?,0,0,'{}','pending',?,?)",request,ms,member(owner),manager,"合成管理者",grant,core.now(),Timestamp.from(clock.instant().plus(Duration.ofDays(7))));
    String id="publication-"+request;
    assertEquals("action",task(owner,"",id).path("priority").asText());
    core.db.update("UPDATE memberships SET content_version=1 WHERE id=?",ms);assertNull(task(owner,"",id));
    core.db.update("UPDATE memberships SET content_version=0,visibility_version=1 WHERE id=?",ms);assertNull(task(owner,"",id));
    core.db.update("UPDATE memberships SET visibility_version=0 WHERE id=?",ms);core.db.update("UPDATE role_grants SET revoked_at=? WHERE id=?",core.now(),grant);assertNull(task(owner,"",id));
    assertEquals("pending",core.one("SELECT status FROM publication_requests WHERE id=?",request).get("status"));
  }

}
