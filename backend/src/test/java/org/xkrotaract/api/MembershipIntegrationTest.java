package org.xkrotaract.api;

import static org.junit.jupiter.api.Assertions.*;
import static org.xkrotaract.api.Input.*;

import com.fasterxml.jackson.databind.JsonNode;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.function.Supplier;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.transaction.PlatformTransactionManager;

/** Real PostgreSQL transactions, with an explicit guard before any destructive fixture reset. */
@SpringBootTest
@org.springframework.test.context.ActiveProfiles("test")
class MembershipIntegrationTest {
  static {
    String url=System.getenv("DATABASE_URL"),profiles=System.getenv("SPRING_PROFILES_ACTIVE");
    if(!"true".equals(System.getenv("CORE_TEST_ALLOW_RESET"))||url==null||!url.matches("jdbc:postgresql://[^/]+/[^?]*_test(?:\\?.*)?")||(profiles!=null&&Arrays.asList(profiles.split(",")).contains("local")))throw new IllegalStateException("Dedicated *_test DATABASE_URL and CORE_TEST_ALLOW_RESET=true required; no data reset.");
  }
  @Autowired CoreService core;
  @Autowired MembershipService service;
  @Autowired ApiSupport access;
  @Autowired MembershipController controller;
  @Autowired PlatformTransactionManager tm;
  UUID district,club,target,other,account,member,reviewer,targetReviewer,membership,fromGrant,toGrant;
  String password;
  MockHttpServletRequest req;
  JsonNode body(Object value){return core.json.valueToTree(value);}
  <T>T tx(Supplier<T> action){return core.tx.execute(t->action.get());}
  UUID account(String code){UUID a=UUID.randomUUID();core.db.update("INSERT INTO accounts(id,account_code,email,email_key,password_hash) VALUES(?,?,?,?,?)",a,code,code+"@example.test",code+"@example.test",core.passwords.encode(password));core.db.update("INSERT INTO members(id,account_id,name,call_name) VALUES(?,?,?,?)",UUID.randomUUID(),a,"合成測試 "+code,code);return a;}
  UUID grant(UUID actor,UUID c,String role,String... permissions){UUID g=UUID.randomUUID();core.db.update("INSERT INTO role_grants(id,account_id,role,club_id,scope_type,scope_id,starts_at,ends_at,granted_by,reason,permissions) VALUES(?,?,?,?,'club',?,?,?,?,?,?::text[])",g,actor,role,c,c,Timestamp.from(core.clock.instant().minusSeconds(60)),Timestamp.from(core.clock.instant().plusSeconds(3600)),actor,"synthetic fixture","{"+String.join(",",permissions)+"}");return g;}
  @BeforeEach void reset(){
    core.db.execute("TRUNCATE audit_events,idempotency_records,rate_limits,join_applications,memberships,role_grants,api_sessions,members,accounts,clubs,districts CASCADE");
    password=" "+UUID.randomUUID()+" ";district=UUID.randomUUID();club=UUID.randomUUID();target=UUID.randomUUID();other=UUID.randomUUID();
    core.db.update("INSERT INTO districts(id,code,name) VALUES(?,'MEMBERTEST','合成測試地區')",district);
    core.db.update("INSERT INTO clubs(id,name,type_code,district_id) VALUES(?,'原社','ROTARACT',?),(?,'新社','ROTARACT',?),(?,'無關社','ROTARACT',?)",club,district,target,district,other,district);
    account=account("Applicant");member=(UUID)core.member(account).get("id");reviewer=account("SourceReviewer");targetReviewer=account("TargetReviewer");
    fromGrant=grant(reviewer,club,"club_president","history:moderate");toGrant=grant(targetReviewer,target,"club_manager");
    membership=UUID.randomUUID();core.db.update("INSERT INTO memberships(id,member_id,club_id,type_code,status,starts_on,name_snapshot,call_name_snapshot,club_name_snapshot,district_name_snapshot,confirmed_year) VALUES(?,?,?,'ROTARACT','active',?,'合成姓名','Synthetic','原社','合成地區',?)",membership,member,club,core.today().minusMonths(2),core.yearStart());req=new MockHttpServletRequest();
  }
  UUID transfer(){var t=(Map<?,?>)tx(()->service.createTransfer(account,body(map("fromMembershipId",membership,"toClubId",target,"reason","合成轉社理由")),req));return (UUID)t.get("id");}
  void approveBoth(UUID t){tx(()->service.decideTransfer(reviewer,t,body(map("version",0,"side","from")),"approve",req));tx(()->service.decideTransfer(targetReviewer,t,body(map("version",1,"side","to")),"approve",req));}
  @Test void transferNeedsBothSidesAndMemberThenAtomicallyKeepsHistory(){
    UUID t=transfer();var first=tx(()->service.decideTransfer(reviewer,t,body(map("version",0,"side","from")),"approve",req));assertEquals("pending",((Map<?,?>)first).get("status"));
    assertThrows(ApiException.class,()->tx(()->service.decideTransfer(account,t,body(map("version",1)),"execute",req)));
    assertThrows(ApiException.class,()->tx(()->service.decideTransfer(reviewer,t,body(map("version",1,"side","to")),"approve",req)));
    tx(()->service.decideTransfer(targetReviewer,t,body(map("version",1,"side","to")),"approve",req));
    assertThrows(ApiException.class,()->tx(()->service.decideTransfer(reviewer,t,body(map("version",2)),"execute",req)));
    var done=(Map<?,?>)tx(()->service.decideTransfer(account,t,body(map("version",2)),"execute",req));assertTrue(done.containsKey("newMembership"));
    var old=service.membership(membership);assertEquals("ended",old.get("status"));assertEquals("transferred",old.get("end_reason"));assertEquals(core.today(),((java.sql.Date)old.get("ends_on")).toLocalDate());
    assertEquals(1,core.db.queryForObject("SELECT count(*) FROM memberships WHERE member_id=? AND type_code='ROTARACT' AND status='active'",Integer.class,member));
    assertEquals("completed",core.one("SELECT status FROM membership_transfers WHERE id=?",t).get("status"));
  }
  @Test void revokeApprovalRequiresReapprovalWithoutEndingSource(){
    UUID t=transfer();approveBoth(t);core.db.update("UPDATE role_grants SET revoked_at=? WHERE id=?",core.now(),toGrant);
    tx(()->{try{service.decideTransfer(account,t,body(map("version",2)),"execute",req);fail("must not execute");}catch(MembershipService.ReapprovalRequired expected){assertNotNull(expected.transfer);}return null;});
    assertEquals("needs_reapproval",core.one("SELECT status FROM membership_transfers WHERE id=?",t).get("status"));assertEquals("active",service.membership(membership).get("status"));
  }
  @Test void withdrawalVersusExecutionHasOneWinner() throws Exception {
    UUID t=transfer();approveBoth(t);ExecutorService pool=Executors.newFixedThreadPool(2);CountDownLatch gate=new CountDownLatch(1);
    try{List<Future<Boolean>> jobs=new ArrayList<>();for(String action:List.of("withdraw","execute"))jobs.add(pool.submit(()->{gate.await();try{tx(()->service.decideTransfer(account,t,body(map("version",2)),action,req));return true;}catch(ApiException e){assertEquals(409,e.status);return false;}}));gate.countDown();int winners=0;for(var job:jobs)if(job.get(10,TimeUnit.SECONDS))winners++;assertEquals(1,winners);
      assertEquals(1,core.db.queryForObject("SELECT count(*) FROM memberships WHERE member_id=? AND status='active'",Integer.class,member));
    }finally{pool.shutdownNow();}
  }
  @Test void transferFailureRollsBackTheEndedSource(){
    UUID t=transfer();approveBoth(t);
    // Fail the target insert after the original membership has been ended.
    core.db.execute("ALTER TABLE memberships ADD CONSTRAINT synthetic_target_failure CHECK(club_id<>'"+target+"'::uuid)");
    try{assertThrows(org.springframework.dao.DataIntegrityViolationException.class,()->tx(()->service.decideTransfer(account,t,body(map("version",2)),"execute",req)));assertEquals("active",service.membership(membership).get("status"));assertEquals("ready_for_member",core.one("SELECT status FROM membership_transfers WHERE id=?",t).get("status"));}
    finally{core.db.execute("ALTER TABLE memberships DROP CONSTRAINT synthetic_target_failure");}
  }
  @Test void endRequestRequiresClubReviewerAndObDoesNotRemainActive(){
    var end=(Map<?,?>)tx(()->service.createEnd(account,body(map("membershipId",membership,"reason","ob","endsOn",core.today().toString())),req));UUID request=(UUID)end.get("id");
    assertThrows(ApiException.class,()->tx(()->service.approveEnd(targetReviewer,request,body(map("version",0)),req)));
    tx(()->service.approveEnd(reviewer,request,body(map("version",0)),req));assertEquals("ended",service.membership(membership).get("status"));assertEquals("ob",service.membership(membership).get("end_reason"));assertEquals("unconfirmed",service.dto(service.membership(membership)).get("annualStatus"));
    assertThrows(ApiException.class,()->tx(()->service.confirmYear(reviewer,club,body(map("membershipId",membership,"yearStart",LocalDate.of(core.yearStart(),7,1).toString(),"status","confirmed","version",0)),req)));
  }
  @Test void publicationIsHiddenUntilExactMemberApprovesAndOldConsentCannotReplay(){
    var p=(Map<?,?>)tx(()->service.requestPublication(reviewer,membership,body(map("contentVersion",0,"visibilityVersion",0)),req));UUID request=(UUID)p.get("id");assertEquals("hidden",service.membership(membership).get("visibility"));
    assertThrows(ApiException.class,()->tx(()->service.decidePublication(targetReviewer,request,body(map("version",0,"decision","approve")),req)));
    tx(()->service.decidePublication(account,request,body(map("version",0,"decision","approve")),req));assertEquals("public",service.membership(membership).get("visibility"));
    tx(()->service.visibility(account,membership,body(map("version",1,"visibility","hidden")),false,req));
    assertThrows(ApiException.class,()->tx(()->service.decidePublication(account,request,body(map("version",0,"decision","approve")),req)));assertEquals("hidden",service.membership(membership).get("visibility"));
  }
  @Test void hidingInvalidatesPendingAndRevokedRequesterCannotPublish(){
    var p=(Map<?,?>)tx(()->service.requestPublication(reviewer,membership,body(map("contentVersion",0,"visibilityVersion",0)),req));UUID request=(UUID)p.get("id");
    core.db.update("UPDATE role_grants SET revoked_at=? WHERE id=?",core.now(),fromGrant);
    assertThrows(ApiException.class,()->tx(()->service.decidePublication(account,request,body(map("version",0,"decision","approve")),req)));assertEquals("hidden",service.membership(membership).get("visibility"));
    tx(()->service.visibility(account,membership,body(map("version",0,"visibility","hidden")),false,req));assertEquals("invalidated",core.one("SELECT status FROM publication_requests WHERE id=?",request).get("status"));
  }
  @Test void annualBoundaryUsesTaipeiDateAndExplicitUnconfirmationCannotRegainGrace(){
    var m=service.membership(membership);m.put("confirmed_year",2026);
    for(var boundary:List.of(map("instant","2027-06-30T15:59:59Z","expected","confirmed"),map("instant","2027-06-30T16:00:00Z","expected","grace"),map("instant","2027-07-31T16:00:00Z","expected","unconfirmed"))){
      var clock=Clock.fixed(Instant.parse((String)boundary.get("instant")),ZoneOffset.UTC);var at=new CoreService(core.db,clock,core.json,tm,core.sessions,core.idemSecret);assertEquals(boundary.get("expected"),at.annual(m));
    }
    LocalDate y=LocalDate.of(core.yearStart(),7,1);tx(()->service.confirmYear(reviewer,club,body(map("membershipId",membership,"yearStart",y.toString(),"version",0,"status","unconfirmed")),req));assertEquals("unconfirmed",service.dto(service.membership(membership)).get("annualStatus"));
    tx(()->service.confirmYear(reviewer,club,body(map("membershipId",membership,"yearStart",y.toString(),"version",1,"status","confirmed")),req));assertEquals("confirmed",service.dto(service.membership(membership)).get("annualStatus"));
  }
  @Test void adminOverrideNeedsExplicitGrantPasswordAndMfa(){
    var b=body(map("version",0,"visibility","public","reason","合成例外","currentPassword",password));
    assertThrows(ApiException.class,()->tx(()->service.visibility(reviewer,membership,b,true,req)));
    UUID grant=UUID.randomUUID();core.db.update("INSERT INTO role_grants(id,account_id,role,scope_type,starts_at,ends_at,granted_by,reason,permissions) VALUES(?,?,'history_admin','platform',?,?,?,'synthetic','{history:override}')",grant,reviewer,Timestamp.from(core.clock.instant().minusSeconds(60)),Timestamp.from(core.clock.instant().plusSeconds(3600)),targetReviewer);
    var session=core.sessions.createPending(reviewer).session();req.setAttribute("session",session);
    assertThrows(ApiException.class,()->tx(()->service.visibility(reviewer,membership,b,true,req)));
    core.db.update("UPDATE accounts SET totp_secret_ciphertext='test-present-only' WHERE id=?",reviewer);core.db.update("UPDATE api_sessions SET mfa_verified_at=? WHERE token_hash=?",core.now(),session.hash());
    var wrong=body(map("version",0,"visibility","public","reason","合成例外","currentPassword","wrong password"));assertThrows(ApiException.class,()->tx(()->service.visibility(reviewer,membership,wrong,true,req)));
    tx(()->service.visibility(reviewer,membership,b,true,req));assertEquals("public",service.membership(membership).get("visibility"));
  }
  @Test void wrongOverridePasswordsAreRateLimitedBeforeMutationOrReplay() {
    UUID grant=UUID.randomUUID();core.db.update("INSERT INTO role_grants(id,account_id,role,scope_type,starts_at,ends_at,granted_by,reason,permissions) VALUES(?,?,'history_admin','platform',?,?,?,'synthetic','{history:override}')",grant,reviewer,Timestamp.from(core.clock.instant().minusSeconds(60)),Timestamp.from(core.clock.instant().plusSeconds(3600)),targetReviewer);
    var session=core.sessions.createPending(reviewer).session();req.setAttribute("session",session);
    core.db.update("UPDATE accounts SET totp_secret_ciphertext='test-present-only' WHERE id=?",reviewer);core.db.update("UPDATE api_sessions SET mfa_verified_at=? WHERE token_hash=?",core.now(),session.hash());
    var wrong=body(map("version",0,"visibility","public","reason","合成例外","currentPassword","definitely incorrect"));
    for(int i=0;i<10;i++){ApiException failure=assertThrows(ApiException.class,()->controller.authorize(req,"override",membership,wrong));assertEquals(401,failure.status);}
    ApiException limited=assertThrows(ApiException.class,()->controller.authorize(req,"override",membership,wrong));assertEquals(429,limited.status);
    assertEquals("hidden",service.membership(membership).get("visibility"));
  }

}
