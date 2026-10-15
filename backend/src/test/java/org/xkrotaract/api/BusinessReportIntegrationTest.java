package org.xkrotaract.api;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import com.fasterxml.jackson.databind.*;
import jakarta.servlet.http.Cookie;
import java.sql.Timestamp;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.*;
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
class BusinessReportIntegrationTest {
  static {
    String url=System.getenv("DATABASE_URL"),profiles=System.getenv("SPRING_PROFILES_ACTIVE");
    if(!"true".equals(System.getenv("CORE_TEST_ALLOW_RESET"))||url==null||!url.matches("jdbc:postgresql://[^/]+/[^?]*_test(?:\\?.*)?")
        ||(profiles!=null&&Arrays.asList(profiles.split(",")).contains("local")))
      throw new IllegalStateException("Reports tests require CORE_TEST_ALLOW_RESET=true and dedicated _test database; no data was reset.");
  }
  @Autowired CoreService core;
  @Autowired ObjectMapper json;
  @Autowired MockMvc mvc;
  UUID reporter,other,admin,company;

  @BeforeEach void reset() {
    core.db.execute("TRUNCATE audit_events,idempotency_records,rate_limits,join_applications,memberships,role_grants,api_sessions,members,accounts,clubs,districts CASCADE");
    reporter=account();other=account();admin=account();
    core.db.update("INSERT INTO role_grants(id,account_id,role,scope_type,starts_at,ends_at,granted_by,reason) VALUES(?,?,'content_manager','content',?,?,?,'test')",
        UUID.randomUUID(),admin,Timestamp.from(core.clock.instant().minusSeconds(60)),Timestamp.from(core.clock.instant().plus(Duration.ofDays(1))),admin);
    company=UUID.randomUUID();
    core.db.update("INSERT INTO business_companies(id,owner_member_id,name,city,phone,phone_public,status,first_published_at,created_at,updated_at) VALUES(?,?,'公開合成公司','台北','02-00000000',true,'approved',?,?,?)",
        company,core.member(other).get("id"),core.now(),core.now(),core.now());
    core.db.update("INSERT INTO business_company_industries(company_id,industry_id) VALUES(?,'food')",company);
  }
  UUID account() {
    UUID id=UUID.randomUUID();String code="T"+id.toString().replace("-","").substring(0,14),email=id+"@example.test";
    core.db.update("INSERT INTO accounts(id,account_code,email,email_key,password_hash) VALUES(?,?,?,?,?)",id,code,email,email,"unused-test-password");
    core.db.update("INSERT INTO members(id,account_id,name,call_name) VALUES(?,?,'私人姓名','示範稱呼')",UUID.randomUUID(),id);
    return id;
  }
  class Client {
    final SessionService.PendingSession session;
    Client(UUID actor) {session=core.sessions.createPending(actor);}
    MvcResult run(MockHttpServletRequestBuilder b) throws Exception {
      return mvc.perform(b.secure(true).cookie(new Cookie(SessionService.COOKIE,session.token()))
          .header("Origin","https://localhost:5173").header("X-CSRF-Token",session.session().csrf())).andReturn();
    }
    MvcResult post(String path,Object b) throws Exception {return post(path,b,UUID.randomUUID().toString());}
    MvcResult post(String path,Object b,String key) throws Exception {
      return run(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/v1"+path)
          .contentType("application/json").content(json.writeValueAsBytes(b)).header("Idempotency-Key",key));
    }
  }
  Map<String,Object> input() {return Map.of("companyId",company,"reason","address","description","公開地址與實際位置不符，請確認。");}
  JsonNode node(MvcResult r) throws Exception {return json.readTree(r.getResponse().getContentAsString());}
  void expect(int status,MvcResult r) throws Exception {assertEquals(status,r.getResponse().getStatus(),r.getResponse().getContentAsString());}
  String create(Client c) throws Exception {var r=c.post("/business-reports",input());expect(201,r);return node(r).path("id").asText();}

  @Test void profileWithoutCurrentMembershipCanReportAndDuplicateDoesNotChangeCompany() throws Exception {
    var c=new Client(reporter);String key=UUID.randomUUID().toString();
    var first=c.post("/business-reports",input(),key);expect(201,first);
    assertEquals(1,node(first).path("version").asInt());
    assertEquals(core.member(reporter).get("id").toString(),node(first).path("reporterId").asText());
    expect(201,c.post("/business-reports",input(),key));
    expect(409,c.post("/business-reports",input()));
    assertEquals(1,core.db.queryForObject("SELECT count(*) FROM business_reports",Integer.class));
    assertEquals(0,core.db.queryForObject("SELECT version FROM business_companies WHERE id=?",Integer.class,company));
    assertEquals("approved",core.one("SELECT status FROM business_companies WHERE id=?",company).get("status"));
    assertEquals(0,core.db.queryForObject("SELECT count(*) FROM memberships",Integer.class));
  }

  @Test void otherReporterAnonymousAndUnrelatedScopedManagerCannotReadCases() throws Exception {
    var own=new Client(reporter);String id=create(own);var outsider=new Client(other);
    expect(401,mvc.perform(get("/api/v1/business-reports")).andReturn());
    expect(401,mvc.perform(get("/api/v1/business-reports/"+id)).andReturn());
    expect(404,outsider.run(get("/api/v1/business-reports/"+id)));
    var list=outsider.run(get("/api/v1/business-reports"));expect(200,list);assertEquals(0,node(list).path("total").asInt());
    expect(404,outsider.run(get("/api/v1/business-reports?scope=managed")));
    UUID scoped=account();
    core.db.update("INSERT INTO role_grants(id,account_id,role,scope_type,scope_id,starts_at,ends_at,granted_by,reason) VALUES(?,?,'content_manager','content',?,?,?,?,'only explicit history scope')",
        UUID.randomUUID(),scoped,UUID.randomUUID(),Timestamp.from(core.clock.instant().minusSeconds(60)),Timestamp.from(core.clock.instant().plusSeconds(3600)),admin);
    expect(404,new Client(scoped).run(get("/api/v1/business-reports/"+id)));
    var managed=new Client(admin).run(get("/api/v1/business-reports?scope=managed"));expect(200,managed);assertEquals(1,node(managed).path("total").asInt());
    expect(400,own.run(get("/api/v1/business-reports?pageSize=1")));
    expect(400,own.run(get("/api/v1/business-reports?reporterId="+core.member(other).get("id"))));
  }

  @Test void companyHiddenAfterCreationStillAllowsOriginalReporterTrackingWithoutCompanyLeaks() throws Exception {
    var own=new Client(reporter);String id=create(own);
    core.db.update("UPDATE business_companies SET status='suspended',name='隱藏後內部公司名稱',address='隱藏地址',phone='隱藏電話',version=version+1 WHERE id=?",company);
    expect(404,new Client(other).post("/business-reports",input()));
    var detail=own.run(get("/api/v1/business-reports/"+id));expect(200,detail);
    assertEquals("公開合成公司",node(detail).path("companyName").asText());
    for(var field:List.of("address","phone","email","ownerId","owner_member_id","company"))assertFalse(node(detail).has(field));
    assertFalse(detail.getResponse().getContentAsString().contains("隱藏後內部公司名稱"));
    var list=own.run(get("/api/v1/business-reports?companyId="+company));expect(200,list);assertEquals(1,node(list).path("total").asInt());
    var adminClient=new Client(admin);
    expect(200,adminClient.post("/business-reports/"+id+"/accept",Map.of("version",1,"resolution","已接案查證")));
    expect(200,adminClient.post("/business-reports/"+id+"/close",Map.of("version",2,"resolution","已通知維護者，保留原公司資料。")));
    assertEquals("suspended",core.one("SELECT status FROM business_companies WHERE id=?",company).get("status"));
    assertEquals(1,core.db.queryForObject("SELECT version FROM business_companies WHERE id=?",Integer.class,company));
  }

  @Test void acceptThenCloseRequiresExplanationCurrentVersionAndAllowsFreshReportAfterClosure() throws Exception {
    var own=new Client(reporter);String id=create(own);var handler=new Client(admin);
    expect(404,own.post("/business-reports/"+id+"/accept",Map.of("version",1,"resolution","越權")));
    expect(409,handler.post("/business-reports/"+id+"/close",Map.of("version",1,"resolution","未接案結案")));
    expect(400,handler.post("/business-reports/"+id+"/accept",Map.of("version",1,"resolution","  ")));
    String key=UUID.randomUUID().toString();
    var accepted=handler.post("/business-reports/"+id+"/accept",Map.of("version",1,"resolution","先調查公開來源"),key);expect(200,accepted);
    assertEquals("processing",node(accepted).path("status").asText());assertEquals(2,node(accepted).path("version").asInt());
    expect(200,handler.post("/business-reports/"+id+"/accept",Map.of("version",1,"resolution","先調查公開來源"),key));
    expect(409,handler.post("/business-reports/"+id+"/close",Map.of("version",1,"resolution","過期版本")));
    expect(200,handler.post("/business-reports/"+id+"/close",Map.of("version",2,"resolution","查證後通知維護者更正")));
    var tracked=own.run(get("/api/v1/business-reports/"+id));expect(200,tracked);assertEquals("closed",node(tracked).path("status").asText());
    expect(201,own.post("/business-reports",input()));
    assertEquals(3,core.db.queryForObject("SELECT version FROM business_reports WHERE id=?",Integer.class,UUID.fromString(id)));
    assertEquals(3,core.db.queryForObject("SELECT count(*) FROM business_report_audit_details WHERE report_id=?",Integer.class,UUID.fromString(id)));
  }

  @Test void revocationBlocksManagedReadsWritesAndIdempotentReplay() throws Exception {
    var own=new Client(reporter);String id=create(own);var handler=new Client(admin);String key=UUID.randomUUID().toString();
    var body=Map.of("version",1,"resolution","已受理");
    expect(200,handler.post("/business-reports/"+id+"/accept",body,key));
    core.db.update("UPDATE role_grants SET revoked_at=? WHERE account_id=?",core.now(),admin);
    expect(404,handler.post("/business-reports/"+id+"/accept",body,key));
    expect(404,handler.post("/business-reports/"+id+"/close",Map.of("version",2,"resolution","撤權後嘗試")));
    expect(404,handler.run(get("/api/v1/business-reports?scope=managed")));
    expect(404,handler.run(get("/api/v1/business-reports/"+id)));
    assertEquals("processing",core.one("SELECT status FROM business_reports WHERE id=?",UUID.fromString(id)).get("status"));
  }

  @Test void concurrentDuplicateReportCreationHasSingleWinnerAndDatabaseConstraint() throws Exception {
    var c=new Client(reporter);
    try(var pool=Executors.newFixedThreadPool(2)) {
      var start=new CountDownLatch(1);var futures=new ArrayList<Future<Integer>>();
      for(int i=0;i<2;i++) futures.add(pool.submit(()->{start.await();return c.post("/business-reports",input()).getResponse().getStatus();}));
      start.countDown();var statuses=new ArrayList<Integer>();
      for(var f:futures)statuses.add(f.get(30,TimeUnit.SECONDS));
      Collections.sort(statuses);assertEquals(List.of(201,409),statuses);
    }
    assertEquals(1,core.db.queryForObject("SELECT count(*) FROM business_reports",Integer.class));
    assertThrows(org.springframework.dao.DataIntegrityViolationException.class,()->core.db.update("INSERT INTO business_reports(id,company_id,company_name_snapshot,reporter_member_id,reason,description,created_at,updated_at) VALUES(?,?,'不應重複',?,'other','重複',?,?)",UUID.randomUUID(),company,core.member(reporter).get("id"),core.now(),core.now()));
  }
  @Test void competingIndependentHandlersCannotAcceptOrCloseSameVersionTwice() throws Exception {
    var own=new Client(reporter);String id=create(own);
    UUID secondAdmin=account();
    core.db.update("INSERT INTO role_grants(id,account_id,role,scope_type,starts_at,ends_at,granted_by,reason) VALUES(?,?,'content_manager','content',?,?,?,'test second independent handler')",
        UUID.randomUUID(),secondAdmin,Timestamp.from(core.clock.instant().minusSeconds(60)),Timestamp.from(core.clock.instant().plus(Duration.ofDays(1))),admin);
    var first=new Client(admin);var second=new Client(secondAdmin);
    for(String action:List.of("accept","close")) {
      int version=action.equals("accept")?1:2;
      try(var pool=Executors.newFixedThreadPool(2)) {
        var gate=new CountDownLatch(1);var futures=new ArrayList<Future<Integer>>();
        for(var handler:List.of(first,second)) futures.add(pool.submit(()->{
          gate.await();return handler.post("/business-reports/"+id+"/"+action,Map.of("version",version,"resolution","獨立管理者競爭處理合成案件")).getResponse().getStatus();
        }));
        gate.countDown();var statuses=new ArrayList<Integer>();for(var future:futures)statuses.add(future.get(30,TimeUnit.SECONDS));
        Collections.sort(statuses);assertEquals(List.of(200,409),statuses);
      }
    }
    var current=core.one("SELECT * FROM business_reports WHERE id=?",UUID.fromString(id));
    assertEquals("closed",current.get("status"));assertEquals(3,current.get("version"));
    assertEquals(3,core.db.queryForObject("SELECT count(*) FROM business_report_audit_details WHERE report_id=?",Integer.class,UUID.fromString(id)));
    assertEquals("approved",core.one("SELECT status FROM business_companies WHERE id=?",company).get("status"));
    assertEquals(0,core.db.queryForObject("SELECT version FROM business_companies WHERE id=?",Integer.class,company));
  }

}
