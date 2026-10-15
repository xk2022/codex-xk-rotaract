package org.xkrotaract.api;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import com.fasterxml.jackson.databind.*;
import jakarta.servlet.http.Cookie;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.time.*;
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
class ApiInfrastructureIntegrationTest {
  static {
    String url=System.getenv("DATABASE_URL");
    if(!"true".equals(System.getenv("CORE_TEST_ALLOW_RESET")) || url==null || !url.matches("jdbc:postgresql://[^/]+/[^?]*_test(?:\\?.*)?") || Arrays.asList(System.getenv().getOrDefault("SPRING_PROFILES_ACTIVE","").split(",")).contains("local")) throw new IllegalStateException("Dedicated *_test database and reset consent required");
  }
  @Autowired MockMvc mvc;
  @Autowired CoreService core;
  @Autowired ObjectMapper json;
  UUID account,member,club;
  String password;
  @BeforeEach void setup() {
    core.db.execute("TRUNCATE accounts,members,clubs,districts,api_sessions,role_grants,rate_limits,idempotency_records,audit_events CASCADE");
    account=UUID.randomUUID();member=UUID.randomUUID();club=UUID.randomUUID();UUID district=UUID.randomUUID();password="  "+UUID.randomUUID()+"  ";
    core.db.update("INSERT INTO accounts(id,account_code,email,email_key,password_hash) VALUES(?,'InfraOwner','owner@example.test','owner@example.test',?)",account,core.passwords.encode(password));
    core.db.update("INSERT INTO members(id,account_id,name,call_name) VALUES(?,?,'合成測試者','Infra')",member,account);
    core.db.update("INSERT INTO districts VALUES(?,'INFRA','合成地區')",district);
    core.db.update("INSERT INTO clubs(id,name,type_code,district_id) VALUES(?,'合成社團','ROTARACT',?)",club,district);
    core.db.update("INSERT INTO role_grants(id,account_id,role,club_id,starts_at,ends_at,granted_by,reason) VALUES(?,?,'club_president',?,?,?,?, 'test')",UUID.randomUUID(),account,club,java.sql.Timestamp.from(core.clock.instant().minusSeconds(60)),java.sql.Timestamp.from(core.clock.instant().plusSeconds(3600)),account);
  }
  class Client {
    String cookie,csrf;
    Client() throws Exception {
      var r=send(get("/api/v1/csrf-token"));cookie=r.getResponse().getHeader("Set-Cookie").split(";",2)[0].split("=",2)[1];csrf=node(r).path("csrfToken").asText();
      r=post("/sessions",Map.of("identifier","owner@example.test","password",password));assertEquals(200,r.getResponse().getStatus(),r.getResponse().getContentAsString());cookie=r.getResponse().getHeader("Set-Cookie").split(";",2)[0].split("=",2)[1];csrf=node(r).path("csrfToken").asText();
    }
    MvcResult send(MockHttpServletRequestBuilder b) throws Exception {
      if(cookie!=null)b.cookie(new Cookie(SessionService.COOKIE,cookie));
      return mvc.perform(b.secure(true).header("Origin","https://localhost:5173").header("X-CSRF-Token",csrf==null?"":csrf)).andReturn();
    }
    MvcResult post(String path,Object body)throws Exception {return send(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/v1"+path).contentType("application/json").header("Idempotency-Key",UUID.randomUUID()).content(json.writeValueAsBytes(body)));}
    MvcResult patchProfile(Object body)throws Exception{return send(patch("/api/v1/me/profile").contentType("application/json").content(json.writeValueAsBytes(body)));}
  }
  JsonNode node(MvcResult r)throws Exception{return json.readTree(r.getResponse().getContentAsString());}
  String validCode(String secret){return MfaController.otp(secret,core.clock.instant().getEpochSecond()/30);}
  JsonNode enroll(Client c)throws Exception {
    var r=c.post("/me/mfa/enrollments",Map.of("currentPassword",password));assertEquals(201,r.getResponse().getStatus(),r.getResponse().getContentAsString());return node(r);
  }
  @Test void enrollmentVerificationExpiryAndCodeReplay()throws Exception {
    Client c=new Client();var wrong=c.post("/me/mfa/enrollments",Map.of("currentPassword","wrong"));assertEquals(401,wrong.getResponse().getStatus());
    var e=enroll(c);String secret=e.path("secret").asText();assertEquals(32,secret.length());
    String saved=(String)core.one("SELECT * FROM accounts WHERE id=?",account).get("totp_pending_ciphertext");assertFalse(saved.contains(secret));
    var r=c.post("/me/mfa/enrollments/confirm",Map.of("enrollmentId",e.path("enrollmentId").asText(),"code",validCode(secret)));assertEquals(200,r.getResponse().getStatus(),r.getResponse().getContentAsString());assertTrue(node(r).path("enabled").asBoolean());assertTrue(node(r).path("authenticated").asBoolean());
    assertEquals(409,c.post("/me/mfa/enrollments",Map.of("currentPassword",password)).getResponse().getStatus());
    assertEquals(401,c.post("/sessions/current/mfa-verifications",Map.of("code",validCode(secret))).getResponse().getStatus());
    Client second=new Client();assertFalse(node(second.send(get("/api/v1/me/mfa"))).path("authenticated").asBoolean());
    String next=MfaController.otp(secret,core.clock.instant().getEpochSecond()/30+1);
    String verifyKey=UUID.randomUUID().toString();
    var verified=second.send(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/v1/sessions/current/mfa-verifications").contentType("application/json").header("Idempotency-Key",verifyKey).content(json.writeValueAsBytes(Map.of("code",next))));
    assertEquals(200,verified.getResponse().getStatus());
    assertEquals(401,second.post("/sessions/current/mfa-verifications",Map.of("code",next)).getResponse().getStatus());
    core.db.update("UPDATE api_sessions SET mfa_verified_at=?",java.sql.Timestamp.from(core.clock.instant().minusSeconds(901)));
    assertFalse(node(second.send(get("/api/v1/me/mfa"))).path("authenticated").asBoolean());
    var replayed=second.send(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/v1/sessions/current/mfa-verifications").contentType("application/json").header("Idempotency-Key",verifyKey).content(json.writeValueAsBytes(Map.of("code",next))));
    assertEquals(200,replayed.getResponse().getStatus());assertFalse(node(replayed).path("authenticated").asBoolean(),"A replay cannot reauthenticate expired MFA or return stale success");
  }
  @Test void pendingExpiryAndMfaRateLimitDoNotEnableAccount()throws Exception {
    Client c=new Client();var e=enroll(c);
    core.db.update("UPDATE accounts SET totp_pending_expires_at=? WHERE id=?",java.sql.Timestamp.from(core.clock.instant().minusSeconds(1)),account);
    assertEquals(409,c.post("/me/mfa/enrollments/confirm",Map.of("enrollmentId",e.path("enrollmentId").asText(),"code",validCode(e.path("secret").asText()))).getResponse().getStatus());
    e=enroll(c);String secret=e.path("secret").asText(),wrong="000000";
    while(List.of(MfaController.otp(secret,core.clock.instant().getEpochSecond()/30-1),validCode(secret),MfaController.otp(secret,core.clock.instant().getEpochSecond()/30+1)).contains(wrong))wrong="999999";
    for(int i=0;i<10;i++)assertEquals(401,c.post("/me/mfa/enrollments/confirm",Map.of("enrollmentId",e.path("enrollmentId").asText(),"code",wrong)).getResponse().getStatus());
    assertEquals(429,c.post("/me/mfa/enrollments/confirm",Map.of("enrollmentId",e.path("enrollmentId").asText(),"code",validCode(secret))).getResponse().getStatus());
    assertFalse(node(c.send(get("/api/v1/me/mfa"))).path("enabled").asBoolean());
  }
  byte[] image()throws Exception{var b=new ByteArrayOutputStream();ImageIO.write(new BufferedImage(3,3,BufferedImage.TYPE_INT_RGB),"png",b);return b.toByteArray();}
  @Test void verifiedAvatarReferencesAndPublicLogoPolicy()throws Exception {
    Client c=new Client();
    var uploaded=c.send(multipart("/api/v1/assets").file(new MockMultipartFile("file","test.png","image/png",image())).param("purpose","avatar").header("Idempotency-Key",UUID.randomUUID()));
    assertEquals(201,uploaded.getResponse().getStatus(),uploaded.getResponse().getContentAsString());UUID avatar=UUID.fromString(node(uploaded).path("assetId").asText());
    var patched=c.patchProfile(Map.of("version",0,"avatarAssetId",avatar));assertEquals(200,patched.getResponse().getStatus());assertEquals(avatar.toString(),node(patched).path("avatarAssetId").asText());
    assertEquals(404,c.send(get("/api/v1/public/assets/"+avatar+"/content")).getResponse().getStatus());
    UUID other=UUID.randomUUID();core.db.update("INSERT INTO accounts(id,account_code,email,email_key,password_hash) VALUES(?,'OtherAsset','asset@example.test','asset@example.test',?)",other,core.passwords.encode(password));
    core.db.update("UPDATE assets SET owner_account_id=? WHERE id=?",other,avatar);
    assertEquals(404,c.patchProfile(Map.of("version",1,"avatarAssetId",avatar)).getResponse().getStatus());
    var logo=c.send(multipart("/api/v1/assets").file(new MockMultipartFile("file","logo.png","image/png",image())).param("purpose","club_logo").param("clubId",club.toString()).header("Idempotency-Key",UUID.randomUUID()));
    assertEquals(201,logo.getResponse().getStatus());UUID logoId=UUID.fromString(node(logo).path("assetId").asText());
    var bind=c.send(patch("/api/v1/clubs/"+club).contentType("application/json").content(json.writeValueAsBytes(Map.of("version",0,"logoAssetId",logoId))));assertEquals(200,bind.getResponse().getStatus(),bind.getResponse().getContentAsString());
    assertEquals(200,c.send(get("/api/v1/public/assets/"+logoId+"/content")).getResponse().getStatus());
    core.db.update("UPDATE clubs SET status='disabled' WHERE id=?",club);
    assertEquals(404,c.send(get("/api/v1/public/assets/"+logoId+"/content")).getResponse().getStatus());
    assertEquals(200,c.patchProfile(Input.map("version",1,"avatarAssetId",null)).getResponse().getStatus());
  }
}
