package org.xkrotaract.api;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import com.fasterxml.jackson.databind.*;
import jakarta.servlet.http.Cookie;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.sql.Timestamp;
import java.time.Duration;
import java.util.*;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.*;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

@SpringBootTest
@AutoConfigureMockMvc
@org.springframework.test.context.ActiveProfiles("test")
class SupportIntegrationTest {
  static {
    String url=System.getenv("DATABASE_URL"),profiles=System.getenv("SPRING_PROFILES_ACTIVE");
    if(!"true".equals(System.getenv("CORE_TEST_ALLOW_RESET"))||url==null||!url.matches("jdbc:postgresql://[^/]+/[^?]*_test(?:\\?.*)?")||(profiles!=null&&Arrays.asList(profiles.split(",")).contains("local")))
      throw new IllegalStateException("Dedicated _test database and CORE_TEST_ALLOW_RESET=true required; no data reset.");
  }
  @Autowired MockMvc mvc;
  @Autowired ObjectMapper json;
  @Autowired CoreService core;
  @Autowired MailOutboxService mail;
  UUID member,handler,attestor,other,club,district;
  String password;

  @BeforeEach void reset() {
    core.db.execute("TRUNCATE audit_events,idempotency_records,rate_limits,join_applications,memberships,role_grants,api_sessions,members,accounts,clubs,districts CASCADE");
    password="  "+UUID.randomUUID()+" ";String encoded=core.passwords.encode(password);
    member=account("owner@example.test",encoded);handler=account("handler@example.test",encoded);attestor=account("attestor@example.test",encoded);other=account("other@example.test",encoded);
    district=UUID.randomUUID();club=UUID.randomUUID();
    core.db.update("INSERT INTO districts VALUES(?,'SYNTHETIC','合成地區')",district);
    core.db.update("INSERT INTO clubs(id,name,type_code,district_id) VALUES(?,'合成扶青社','ROTARACT',?)",club,district);
    grant(handler,"account_support",null,"platform");grant(attestor,"club_secretary",club,"club");
    core.db.update("INSERT INTO memberships(id,member_id,club_id,type_code,status,starts_on,name_snapshot,call_name_snapshot,club_name_snapshot,district_name_snapshot,confirmed_year) VALUES(?,?,?,'ROTARACT','active',?,'合成會員','Synthetic','合成扶青社','合成地區',?)",UUID.randomUUID(),core.member(member).get("id"),club,core.today().minusDays(60),core.yearStart());
  }
  UUID account(String email,String encoded) {
    UUID id=UUID.randomUUID();String code="M"+id.toString().replace("-","").substring(0,12);
    core.db.update("INSERT INTO accounts(id,account_code,email,email_key,password_hash) VALUES(?,?,?,?,?)",id,code,email,email,encoded);
    core.db.update("INSERT INTO members(id,account_id,name,call_name) VALUES(?,?,'合成會員','Synthetic')",UUID.randomUUID(),id);return id;
  }
  void grant(UUID actor,String role,UUID clubId,String scope) {
    core.db.update("INSERT INTO role_grants(id,account_id,role,club_id,starts_at,ends_at,granted_by,reason,scope_type,scope_id) VALUES(?,?,?,?,?,?,?,'synthetic',?,?)",UUID.randomUUID(),actor,role,clubId,Timestamp.from(core.clock.instant().minusSeconds(3600)),Timestamp.from(core.clock.instant().plusSeconds(3600)),actor,scope,clubId);
  }
  class Client {
    String cookie,csrf;
    Client()throws Exception {
      var r=run(get("/api/v1/csrf-token"));cookie=r.getResponse().getHeader("Set-Cookie").split(";",2)[0].split("=",2)[1];csrf=node(r).path("csrfToken").asText();
    }
    Client(String email)throws Exception {this();var r=post("/sessions",Map.of("identifier",email,"password",password),null);expect(200,r);cookie=r.getResponse().getHeader("Set-Cookie").split(";",2)[0].split("=",2)[1];csrf=node(r).path("csrfToken").asText();}
    MvcResult run(MockHttpServletRequestBuilder b)throws Exception {
      if(cookie!=null)b.cookie(new Cookie(SessionService.COOKIE,cookie));return mvc.perform(b.secure(true).header("Origin","https://localhost:5173").header("X-CSRF-Token",csrf==null?"":csrf)).andReturn();
    }
    MvcResult post(String path,Object body,String key)throws Exception {
      var b=org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/v1"+path).contentType("application/json").content(json.writeValueAsBytes(body));if(key!=null)b.header("Idempotency-Key",key);return run(b);
    }
    MvcResult upload(String path,byte[] bytes,String type,String receipt,String purpose,String key)throws Exception {
      var b=multipart("/api/v1"+path).file(new MockMultipartFile("file","synthetic.png",type,bytes));if(purpose!=null)b.param("purpose",purpose);if(receipt!=null)b.header("X-Support-Receipt",receipt);b.header("Idempotency-Key",key);return run(b);
    }
  }
  String key(){return UUID.randomUUID().toString();}
  JsonNode node(MvcResult r)throws Exception{return json.readTree(r.getResponse().getContentAsString());}
  void expect(int status,MvcResult r) throws Exception {assertEquals(status,r.getResponse().getStatus(),r.getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8));}
  byte[] png()throws Exception {var bytes=new ByteArrayOutputStream();ImageIO.write(new BufferedImage(3,2,BufferedImage.TYPE_INT_ARGB),"png",bytes);return bytes.toByteArray();}
  JsonNode intake(Client c)throws Exception {var r=c.post("/support-recovery-cases",Map.of("identifier","owner@example.test","newEmail","new-owner@example.test","description","合成核身申請"),key());expect(202,r);return node(r);}
  String caseId(JsonNode receipt){return receipt.path("caseId").asText();}
  JsonNode attest(String id,int version)throws Exception {
    Client witness=new Client("attestor@example.test");var r=witness.post("/support-cases/"+id+"/verifications",Map.of("version",version,"kind","club_attestation","subjectAccountId",member,"clubId",club,"reason","已核對既有社籍與本人資料，合成具名佐證"),key());expect(201,r);return node(r);
  }
  MvcResult approve(Client staff,String id,int version)throws Exception {return staff.post("/support-cases/"+id+"/resolve",Map.of("version",version,"decision","approve","evidenceRefs",List.of(),"reason","獨立核實完成","verifiedSubjectAccountId",member),key());}
  String mailToken(String kind) {
    var r=core.one("SELECT id FROM mail_outbox WHERE kind=? AND status='queued' ORDER BY created_at DESC LIMIT 1",kind);return (String)mail.localMessage((UUID)r.get("id")).get("token");
  }

  @Test void ordinaryRecoveryIsUniformHashedQueuedAndSingleUse()throws Exception {
    Client c=new Client();var known=c.post("/password-recovery-requests",Map.of("email","owner@example.test"),null);var absent=c.post("/password-recovery-requests",Map.of("email","absent@example.test"),null);expect(202,known);expect(202,absent);assertEquals(node(known),node(absent));
    assertEquals(1,core.db.queryForObject("SELECT count(*) FROM mail_outbox WHERE status='queued'",Integer.class));
    String raw=mailToken("password_reset");assertNotEquals(raw,core.one("SELECT token_hash FROM recovery_tokens").get("token_hash"));
    Client signedIn=new Client("owner@example.test");String newPassword="  "+UUID.randomUUID()+"  ";
    expect(204,c.post("/password-resets",Map.of("token",raw,"newPassword",newPassword),null));
    expect(401,signedIn.run(get("/api/v1/me")));expect(400,c.post("/password-resets",Map.of("token",raw,"newPassword",newPassword),null));
    assertTrue(core.passwords.matches(newPassword,(String)core.one("SELECT password_hash FROM accounts WHERE id=?",member).get("password_hash")));
  }

  @Test void expiredResetDoesNotMutateCredentialsOrSessions()throws Exception {
    Client c=new Client();expect(202,c.post("/password-recovery-requests",Map.of("email","owner@example.test"),null));String raw=mailToken("password_reset");String hash=(String)core.one("SELECT password_hash FROM accounts WHERE id=?",member).get("password_hash");
    core.db.update("UPDATE recovery_tokens SET expires_at=?",Timestamp.from(core.clock.instant().minusSeconds(1)));
    Client current=new Client("owner@example.test");expect(400,c.post("/password-resets",Map.of("token",raw,"newPassword",UUID.randomUUID().toString()),null));assertEquals(hash,core.one("SELECT password_hash FROM accounts WHERE id=?",member).get("password_hash"));expect(200,current.run(get("/api/v1/me")));
  }

  @Test void resendRevokesEarlierTokenAndSuppressesCooldown()throws Exception {
    Client c=new Client();expect(202,c.post("/password-recovery-requests",Map.of("email","owner@example.test"),null));String first=mailToken("password_reset");
    expect(202,c.post("/password-recovery-requests",Map.of("email","owner@example.test"),null));assertEquals(1,core.db.queryForObject("SELECT count(*) FROM recovery_tokens",Integer.class));
    core.db.update("UPDATE rate_limits SET window_start=? WHERE bucket LIKE 'password-recovery-id:%'",Timestamp.from(core.clock.instant().minusSeconds(61)));
    expect(202,c.post("/password-recovery-requests",Map.of("email","owner@example.test"),null));assertEquals(2,core.db.queryForObject("SELECT count(*) FROM recovery_tokens",Integer.class));
    expect(400,c.post("/password-resets",Map.of("token",first,"newPassword",UUID.randomUUID().toString()),null));assertEquals(1,core.db.queryForObject("SELECT count(*) FROM mail_outbox WHERE status='cancelled'",Integer.class));
  }

  @Test void recoveryRequiresIndependentProofThenEmailPossessionAndAtomicReset()throws Exception {
    Client anon=new Client(),staff=new Client("handler@example.test"),oldSession=new Client("owner@example.test");var receipt=intake(anon);String id=caseId(receipt);
    expect(409,approve(staff,id,0));assertEquals("pending",core.one("SELECT status FROM support_cases WHERE id=?",UUID.fromString(id)).get("status"));
    attest(id,0);expect(200,approve(staff,id,1));assertEquals("owner@example.test",core.one("SELECT email FROM accounts WHERE id=?",member).get("email"));
    String proof=mailToken("recovery_email_proof");var confirmation=anon.post("/support-recovery-email-confirmations",Map.of("token",proof),null);expect(200,confirmation);expect(400,anon.post("/support-recovery-email-confirmations",Map.of("token",proof),null));
    String reset=node(confirmation).path("passwordResetToken").asText(),next=UUID.randomUUID().toString();expect(204,anon.post("/password-resets",Map.of("token",reset,"newPassword",next),null));
    assertEquals("new-owner@example.test",core.one("SELECT email FROM accounts WHERE id=?",member).get("email"));expect(401,oldSession.run(get("/api/v1/me")));expect(404,anon.run(get("/api/v1/support-recovery-cases/"+id).header("X-Support-Receipt",receipt.path("receiptToken").asText())));
    assertEquals("resolved",core.one("SELECT status FROM support_cases WHERE id=?",UUID.fromString(id)).get("status"));
  }

  @Test void emailConflictAtFinalResetRollsBackAndRetainsUsableToken()throws Exception {
    Client anon=new Client(),staff=new Client("handler@example.test");var r=intake(anon);String id=caseId(r);attest(id,0);expect(200,approve(staff,id,1));
    var confirmation=anon.post("/support-recovery-email-confirmations",Map.of("token",mailToken("recovery_email_proof")),null);expect(200,confirmation);String token=node(confirmation).path("passwordResetToken").asText();
    core.db.update("UPDATE accounts SET email='new-owner@example.test',email_key='new-owner@example.test' WHERE id=?",other);
    expect(409,anon.post("/password-resets",Map.of("token",token,"newPassword",UUID.randomUUID().toString()),null));
    assertEquals("owner@example.test",core.one("SELECT email FROM accounts WHERE id=?",member).get("email"));assertNull(core.one("SELECT consumed_at FROM recovery_tokens WHERE token_hash=?",SessionService.hash(token)).get("consumed_at"));
    assertEquals("awaiting_password_reset",core.one("SELECT status FROM support_cases WHERE id=?",UUID.fromString(id)).get("status"));
  }

  @Test void approvedEmailReissueRevokesOldProofAndPreviouslyIssuedReset()throws Exception {
    Client anon=new Client(),staff=new Client("handler@example.test");String id=caseId(intake(anon));attest(id,0);expect(200,approve(staff,id,1));String oldProof=mailToken("recovery_email_proof");
    var confirmed=anon.post("/support-recovery-email-confirmations",Map.of("token",oldProof),null);expect(200,confirmed);String oldReset=node(confirmed).path("passwordResetToken").asText();
    expect(200,staff.post("/support-cases/"+id+"/recovery-email-requests",Map.of("version",3,"reason","重新安排新確認連結"),key()));
    expect(400,anon.post("/password-resets",Map.of("token",oldReset,"newPassword",UUID.randomUUID().toString()),null));
    var fresh=anon.post("/support-recovery-email-confirmations",Map.of("token",mailToken("recovery_email_proof")),null);expect(200,fresh);
    expect(204,anon.post("/password-resets",Map.of("token",node(fresh).path("passwordResetToken").asText(),"newPassword",UUID.randomUUID().toString()),null));
  }

  @Test void lostMfaRecoveryClearsFactorsOnlyAtFinalProvenPasswordReset()throws Exception {
    Client anon=new Client(),staff=new Client("handler@example.test"),oldSession=new Client("owner@example.test");
    String ciphertext=core.replayCipher.encrypt("synthetic-secret","synthetic-test-only");
    core.db.update("UPDATE accounts SET totp_secret_ciphertext=?,totp_pending_ciphertext=?,totp_pending_id=?,totp_pending_expires_at=?,totp_last_step=123 WHERE id=?",ciphertext,ciphertext,UUID.randomUUID(),Timestamp.from(core.clock.instant().plusSeconds(1800)),member);
    var created=anon.post("/support-recovery-cases",Map.of("identifier","owner@example.test","newEmail","mfa-new@example.test","description","合成遺失驗證器申請","type","mfa_recovery"),key());expect(202,created);String id=caseId(node(created));attest(id,0);expect(200,approve(staff,id,1));
    assertEquals(ciphertext,core.one("SELECT totp_secret_ciphertext FROM accounts WHERE id=?",member).get("totp_secret_ciphertext"));
    var confirmed=anon.post("/support-recovery-email-confirmations",Map.of("token",mailToken("recovery_email_proof")),null);expect(200,confirmed);
    assertEquals(ciphertext,core.one("SELECT totp_secret_ciphertext FROM accounts WHERE id=?",member).get("totp_secret_ciphertext"));
    expect(204,anon.post("/password-resets",Map.of("token",node(confirmed).path("passwordResetToken").asText(),"newPassword",UUID.randomUUID().toString()),null));
    var a=core.one("SELECT * FROM accounts WHERE id=?",member);
    for(String field:List.of("totp_secret_ciphertext","totp_pending_ciphertext","totp_pending_id","totp_pending_expires_at","totp_last_step"))assertNull(a.get(field));
    expect(401,oldSession.run(get("/api/v1/me")));assertEquals("mfa-new@example.test",a.get("email"));
  }

  @Test void ordinaryPasswordRecoveryCannotRemoveExistingMfa()throws Exception {
    Client anon=new Client();String ciphertext=core.replayCipher.encrypt("synthetic-secret","synthetic-test-only");
    core.db.update("UPDATE accounts SET totp_secret_ciphertext=? WHERE id=?",ciphertext,member);
    expect(202,anon.post("/password-recovery-requests",Map.of("email","owner@example.test"),null));
    expect(204,anon.post("/password-resets",Map.of("token",mailToken("password_reset"),"newPassword",UUID.randomUUID().toString()),null));
    assertEquals(ciphertext,core.one("SELECT totp_secret_ciphertext FROM accounts WHERE id=?",member).get("totp_secret_ciphertext"));
  }

  @Test void receiptsAndEvidenceAreCaseScopedAndNonPublic()throws Exception {
    Client anon=new Client(),staff=new Client("handler@example.test"),outsider=new Client("other@example.test");var r=intake(anon);String id=caseId(r),receipt=r.path("receiptToken").asText();
    expect(404,anon.run(get("/api/v1/support-recovery-cases/"+id)));expect(404,anon.run(get("/api/v1/support-recovery-cases/"+UUID.randomUUID()).header("X-Support-Receipt",receipt)));
    var upload=anon.upload("/support-recovery-cases/"+id+"/evidence",png(),"image/png",receipt,null,key());expect(201,upload);String asset=node(upload).path("assetId").asText();assertEquals("private",node(upload).path("visibility").asText());
    expect(404,outsider.run(get("/api/v1/assets/"+asset+"/content")));expect(200,staff.run(get("/api/v1/assets/"+asset+"/content")));
    core.db.update("UPDATE role_grants SET revoked_at=? WHERE account_id=?",core.now(),handler);expect(404,staff.run(get("/api/v1/assets/"+asset+"/content")));
  }

  @Test void imageValidationIdempotencyAndOwnership()throws Exception {
    Client owner=new Client("owner@example.test"),stranger=new Client("other@example.test");
    expect(400,owner.upload("/assets","<svg/>".getBytes(),"image/png",null,"avatar",key()));expect(400,owner.upload("/assets",png(),"image/jpeg",null,"avatar",key()));expect(400,owner.upload("/assets",new byte[2097153],"image/png",null,"avatar",key()));
    String key=key();byte[] bytes=png();var first=owner.upload("/assets",bytes,"image/png",null,"avatar",key);expect(201,first);var replay=owner.upload("/assets",bytes,"image/png",null,"avatar",key);expect(201,replay);assertEquals(node(first),node(replay));
    expect(409,owner.upload("/assets",bytes,"image/png",null,"support_evidence",key));String id=node(first).path("assetId").asText();expect(404,stranger.run(get("/api/v1/assets/"+id)));assertEquals(1,core.db.queryForObject("SELECT count(*) FROM assets",Integer.class));
  }

  @Test void referencedAvatarUsesMemberVisibilityAndUnreferencedImageStaysPrivate()throws Exception {
    Client owner=new Client("owner@example.test"),reader=new Client("other@example.test"),anon=new Client();
    var uploaded=owner.upload("/assets",png(),"image/png",null,"avatar",key());expect(201,uploaded);String id=node(uploaded).path("assetId").asText();
    expect(404,reader.run(get("/api/v1/assets/"+id+"/content")));
    expect(200,owner.run(patch("/api/v1/me/profile").contentType("application/json").content(json.writeValueAsBytes(Map.of("version",0,"avatarAssetId",id)))));
    expect(200,reader.run(get("/api/v1/assets/"+id+"/content")));expect(401,anon.run(get("/api/v1/assets/"+id+"/content")));
    core.db.update("UPDATE accounts SET status='disabled' WHERE id=?",member);expect(404,reader.run(get("/api/v1/assets/"+id+"/content")));
  }

  @Test void unassignedStaffCannotEnumerateCasesAndSelfCannotApprove()throws Exception {
    Client owner=new Client("owner@example.test"),outsider=new Client("other@example.test");grant(other,"account_support",null,"platform");
    var created=owner.post("/support-cases",Map.of("type","account_recovery","description","本人合成申請","proposedEmail","new-owner@example.test"),key());expect(201,created);String id=node(created).path("id").asText();
    core.db.update("UPDATE support_case_assignments SET account_id=? WHERE case_id=?",handler,UUID.fromString(id));core.db.update("UPDATE support_cases SET handled_by=? WHERE id=?",handler,UUID.fromString(id));
    var list=outsider.run(get("/api/v1/support-cases").param("scope","assigned"));expect(200,list);assertEquals(0,node(list).path("total").asInt());expect(404,outsider.run(get("/api/v1/support-cases/"+id)));expect(404,approve(outsider,id,0));
    grant(member,"account_support",null,"platform");core.db.update("UPDATE support_case_assignments SET account_id=? WHERE case_id=?",member,UUID.fromString(id));expect(404,approve(owner,id,0));
  }

  @Test void evidenceIdsCannotBeStolenOrReassigned()throws Exception {
    Client owner=new Client("owner@example.test"),stranger=new Client("other@example.test");
    var asset=owner.upload("/assets",png(),"image/png",null,"support_evidence",key());expect(201,asset);UUID id=UUID.fromString(node(asset).path("assetId").asText());
    expect(404,stranger.post("/support-cases",Map.of("type","account_status","description","不可竊取附件","evidenceRefs",List.of(id)),key()));assertNull(core.one("SELECT case_id FROM assets WHERE id=?",id).get("case_id"));
    assertEquals(0,core.db.queryForObject("SELECT count(*) FROM support_cases",Integer.class));
  }

  @Test void anonymousLateSubjectBindingCannotTurnHandlerIntoOwnApprover()throws Exception {
    core.db.update("INSERT INTO memberships(id,member_id,club_id,type_code,status,starts_on,name_snapshot,call_name_snapshot,club_name_snapshot,district_name_snapshot,confirmed_year) VALUES(?,?,?,'ROTARACT','active',?,'合成支援會員','Support','合成扶青社','合成地區',?)",UUID.randomUUID(),core.member(handler).get("id"),club,core.today().minusDays(60),core.yearStart());
    Client anon=new Client(),staff=new Client("handler@example.test"),witness=new Client("attestor@example.test");
    var created=anon.post("/support-recovery-cases",Map.of("identifier","handler@example.test","newEmail","new-handler@example.test","description","匿名案件自核准回歸"),key());expect(202,created);String id=caseId(node(created));
    expect(201,witness.post("/support-cases/"+id+"/verifications",Map.of("version",0,"kind","club_attestation","subjectAccountId",handler,"clubId",club,"reason","獨立具名合成核實"),key()));
    expect(404,staff.post("/support-cases/"+id+"/resolve",Map.of("version",1,"decision","approve","evidenceRefs",List.of(),"reason","不可自核准","verifiedSubjectAccountId",handler),key()));
    assertNull(core.one("SELECT subject_account_id FROM support_cases WHERE id=?",UUID.fromString(id)).get("subject_account_id"));assertEquals(0,core.db.queryForObject("SELECT count(*) FROM recovery_tokens",Integer.class));
  }

  @Test void membershipEndDateIsExclusiveForRecoveryAttestationAndExistingSessionProof()throws Exception {
    Client owner=new Client("owner@example.test"),anon=new Client(),staff=new Client("handler@example.test"),witness=new Client("attestor@example.test");
    // A stale active flag must not extend the half-open membership beyond its end date.
    core.db.update("UPDATE memberships SET ends_on=? WHERE member_id=?",core.today(),core.member(member).get("id"));
    String id=caseId(intake(anon));
    expect(404,witness.post("/support-cases/"+id+"/verifications",Map.of("version",0,"kind","club_attestation","subjectAccountId",member,"clubId",club,"reason","今日已結束，不能作現有社籍佐證"),key()));
    assertEquals(0,core.db.queryForObject("SELECT count(*) FROM support_case_verifications",Integer.class));
    expect(201,owner.post("/support-cases/"+id+"/verifications",Map.of("version",0,"kind","existing_session","subjectAccountId",member,"currentPassword",password,"reason","使用申請前已持有工作階段及目前密碼核實"),key()));
    expect(200,approve(staff,id,1));
    assertEquals("awaiting_new_email_proof",core.one("SELECT status FROM support_cases WHERE id=?",UUID.fromString(id)).get("status"));
  }

  @Test void legacyClaimNeedsExactStagingAndOwnerConfirmationWithoutMergingIds()throws Exception {
    Client owner=new Client("owner@example.test"),staff=new Client("handler@example.test"),stranger=new Client("other@example.test");UUID staged=UUID.randomUUID();
    core.db.update("INSERT INTO staged_legacy_records VALUES(?,'synthetic-source-1',?,'歷史合成姓名','History',true,?)",staged,club,core.now());
    var created=owner.post("/support-cases",Map.of("type","legacy_claim","description","合成舊資料認領","stagedRecordId",staged),key());expect(201,created);String id=node(created).path("id").asText();
    expect(409,owner.post("/support-cases/"+id+"/legacy-confirmations",Map.of("version",0,"currentPassword",password),key()));attest(id,0);expect(200,approve(staff,id,1));
    var body=Map.of("version",2,"currentPassword",password);expect(404,stranger.post("/support-cases/"+id+"/legacy-confirmations",body,key()));String key=key();var done=owner.post("/support-cases/"+id+"/legacy-confirmations",body,key);expect(200,done);expect(200,owner.post("/support-cases/"+id+"/legacy-confirmations",body,key));
    assertEquals(member,core.one("SELECT account_id FROM legacy_claim_links WHERE staged_record_id=?",staged).get("account_id"));assertEquals(core.member(member).get("id"),UUID.fromString(node(done).path("memberId").asText()));assertEquals(4,core.db.queryForObject("SELECT count(*) FROM members",Integer.class));
    expect(409,owner.post("/support-cases",Map.of("type","legacy_claim","description","已認領不可再申請","stagedRecordId",staged),key()));
  }
}
