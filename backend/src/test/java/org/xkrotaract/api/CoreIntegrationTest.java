package org.xkrotaract.api;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;

import com.fasterxml.jackson.databind.*;
import jakarta.servlet.http.Cookie;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.*;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

@SpringBootTest
@AutoConfigureMockMvc
@org.springframework.test.context.ActiveProfiles("test")
class CoreIntegrationTest {
  static {
    String url = System.getenv("DATABASE_URL");
    String profiles = System.getenv("SPRING_PROFILES_ACTIVE");
    if (!"true".equals(System.getenv("CORE_TEST_ALLOW_RESET"))
        || url == null
        || !url.matches("jdbc:postgresql://[^/]+/[^?]*_test(?:\\?.*)?")
        || (profiles != null && Arrays.asList(profiles.split(",")).contains("local"))) {
      throw new IllegalStateException(
          "Tests require CORE_TEST_ALLOW_RESET=true, dedicated DATABASE_URL ending in _test and no"
              + " local profile; no data was reset.");
    }
  }

  @Autowired MockMvc mvc;
  @Autowired ObjectMapper json;
  @Autowired CoreService core;
  static final String ORIGIN = "https://localhost:5173";
  String password;
  UUID district, club, otherClub, reviewer;

  @BeforeEach
  void reset() {
    core.db.execute(
        "TRUNCATE"
            + " audit_events,idempotency_records,rate_limits,join_applications,memberships,role_grants,api_sessions,members,accounts,clubs,districts"
            + " CASCADE");
    password = "  " + UUID.randomUUID() + " ";
    district = UUID.randomUUID();
    club = UUID.randomUUID();
    otherClub = UUID.randomUUID();
    reviewer = UUID.randomUUID();
    core.db.update("INSERT INTO districts VALUES(?,'TEST','合成測試地區')", district);
    core.db.update(
        "INSERT INTO clubs(id,name,type_code,district_id)"
            + " VALUES(?,'目標扶青社','ROTARACT',?),(?,'其他扶青社','ROTARACT',?)",
        club,
        district,
        otherClub,
        district);
    core.db.update(
        "INSERT INTO accounts(id,account_code,email,email_key,password_hash)"
            + " VALUES(?,'ReviewerCode','reviewer@example.test','reviewer@example.test',?)",
        reviewer,
        core.passwords.encode(password));
    core.db.update(
        "INSERT INTO members(id,account_id,name,call_name) VALUES(?,?,'審核者','Reviewer')",
        UUID.randomUUID(),
        reviewer);
    core.db.update(
        "INSERT INTO role_grants VALUES(?,?,'club_manager',?,?,?,?, 'test',0)",
        UUID.randomUUID(),
        reviewer,
        club,
        java.sql.Timestamp.from(core.clock.instant().minusSeconds(60)),
        java.sql.Timestamp.from(core.clock.instant().plusSeconds(3600)),
        reviewer);
  }

  class Client {
    String cookie, csrf;

    Client() throws Exception {
      var r = run(get("/api/v1/csrf-token"));
      assertEquals(200, r.getResponse().getStatus());
      cookie = r.getResponse().getHeader("Set-Cookie").split(";", 2)[0].split("=", 2)[1];
      csrf = node(r).path("csrfToken").asText();
    }

    MvcResult run(MockHttpServletRequestBuilder b) throws Exception {
      if (cookie != null) b.cookie(new Cookie(SessionService.COOKIE, cookie));
      return mvc.perform(
              b.secure(true)
                  .header("Origin", ORIGIN)
                  .header("X-CSRF-Token", csrf == null ? "" : csrf))
          .andReturn();
    }

    MvcResult post(String path, Object body, String key) throws Exception {
      var b =
          org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/v1" + path)
              .contentType("application/json")
              .content(json.writeValueAsBytes(body));
      if (key != null) b.header("Idempotency-Key", key);
      return run(b);
    }

    JsonNode login(String identifier) throws Exception {
      var r = post("/sessions", Map.of("identifier", identifier, "password", password), null);
      assertEquals(200, r.getResponse().getStatus(), r.getResponse().getContentAsString());
      cookie = r.getResponse().getHeader("Set-Cookie").split(";", 2)[0].split("=", 2)[1];
      csrf = node(r).path("csrfToken").asText();
      return node(r);
    }
  }

  String key() {
    return UUID.randomUUID().toString();
  }

  JsonNode node(MvcResult r) throws Exception {
    return json.readTree(r.getResponse().getContentAsString());
  }

  JsonNode signup(Client c, String email) throws Exception {
    var r =
        c.post(
            "/accounts",
            Map.of("name", "合成新會員", "callName", "NewFriend", "email", email, "password", password),
            key());
    assertEquals(201, r.getResponse().getStatus(), r.getResponse().getContentAsString());
    return node(r);
  }

  JsonNode join(Client c) throws Exception {
    var r = c.post("/join-applications", Map.of("clubId", club), key());
    assertEquals(201, r.getResponse().getStatus(), r.getResponse().getContentAsString());
    return node(r);
  }

  @Test
  void fullFlowAndPrivateProjection() throws Exception {
    Client member = new Client();
    var created = signup(member, "new@example.test");
    assertEquals(401, member.run(get("/api/v1/me")).getResponse().getStatus());
    var me = member.login(created.path("accountCode").asText());
    String memberId = me.path("member").path("id").asText();
    assertEquals(
        0,
        node(member.run(get("/api/v1/members").param("includeNonRegular", "true")))
            .path("total")
            .asInt());
    JsonNode application = join(member);
    Client admin = new Client();
    admin.login("reviewer@example.test");
    var approved =
        admin.post(
            "/join-applications/" + application.path("id").asText() + "/approve",
            Map.of("version", 0, "startsOn", core.today().toString()),
            key());
    assertEquals(
        200, approved.getResponse().getStatus(), approved.getResponse().getContentAsString());
    var list = node(member.run(get("/api/v1/members")));
    assertEquals(1, list.path("total").asInt());
    assertFalse(list.path("items").get(0).has("email"));
    var detail = node(admin.run(get("/api/v1/members/" + memberId)));
    assertEquals("new@example.test", detail.path("email").asText());
    assertFalse(detail.has("phone"));
    core.db.update("UPDATE members SET email_visible=false WHERE id=?", UUID.fromString(memberId));
    assertFalse(node(admin.run(get("/api/v1/members/" + memberId))).has("email"));
    assertEquals(
        0,
        node(member.run(get("/api/v1/members").param("keyword", "new@example.test")))
            .path("total")
            .asInt());
    assertEquals(
        30,
        Duration.between(
                Instant.parse(application.path("requestedAt").asText()),
                Instant.parse(application.path("expiresAt").asText()))
            .toDays());
  }

  @Test
  void csrfOriginAndCookieInvariants() throws Exception {
    Client c = new Client();
    var r = mvc.perform(get("/api/v1/csrf-token").secure(true)).andReturn();
    String header = r.getResponse().getHeader("Set-Cookie");
    assertTrue(header.contains("Secure; HttpOnly; SameSite=Lax"));
    assertTrue(header.startsWith("__Host-session="));
    assertFalse(header.contains("Domain"));
    assertEquals(
        403,
        mvc.perform(post("/api/v1/accounts").contentType("application/json").content("{}"))
            .andReturn()
            .getResponse()
            .getStatus());
    assertEquals(
        403,
        mvc.perform(
                post("/api/v1/accounts")
                    .cookie(new Cookie(SessionService.COOKIE, c.cookie))
                    .header("X-CSRF-Token", c.csrf)
                    .header("Origin", "https://evil.test")
                    .contentType("application/json")
                    .content("{}"))
            .andReturn()
            .getResponse()
            .getStatus());
  }

  @Test
  void idempotencyReplayAndBodyConflict() throws Exception {
    Client c = new Client();
    String k = key();
    var body =
        Map.of(
            "name", "新會員", "callName", "Call", "email", "idem@example.test", "password", password);
    var first = c.post("/accounts", body, k);
    var second = c.post("/accounts", body, k);
    assertEquals(201, second.getResponse().getStatus());
    assertEquals(node(first), node(second));
    var changed = new HashMap<String, Object>(body);
    changed.put("name", "別的姓名");
    assertEquals(409, c.post("/accounts", changed, k).getResponse().getStatus());
    assertEquals(
        1,
        core.db.queryForObject(
            "SELECT count(*) FROM accounts WHERE email_key='idem@example.test'", Integer.class));
    assertFalse(
        core.db
            .queryForObject("SELECT response FROM idempotency_records LIMIT 1", String.class)
            .contains(password));
  }

  @Test
  void scopeVersionAndRoleRevocation() throws Exception {
    Client m = new Client();
    signup(m, "scope@example.test");
    m.login("scope@example.test");
    var a = join(m);
    Client admin = new Client();
    admin.login("reviewer@example.test");
    String path = "/join-applications/" + a.path("id").asText() + "/approve";
    assertEquals(
        404,
        m.post(path, Map.of("version", 0, "startsOn", core.today().toString()), key())
            .getResponse()
            .getStatus());
    assertEquals(
        409,
        admin
            .post(path, Map.of("version", 1, "startsOn", core.today().toString()), key())
            .getResponse()
            .getStatus());
    assertEquals(
        400,
        admin
            .post(
                path, Map.of("version", 0, "startsOn", core.today().plusDays(1).toString()), key())
            .getResponse()
            .getStatus());
    core.db.update(
        "UPDATE role_grants SET ends_at=?",
        java.sql.Timestamp.from(core.clock.instant().minusSeconds(1)));
    assertEquals(
        404,
        admin
            .post(path, Map.of("version", 0, "startsOn", core.today().toString()), key())
            .getResponse()
            .getStatus());
    assertEquals(
        404,
        admin
            .run(
                get("/api/v1/join-applications")
                    .param("scope", "club")
                    .param("clubId", otherClub.toString()))
            .getResponse()
            .getStatus());
  }

  @Test
  void uniquenessPasswordAndWhitelist() throws Exception {
    Client c = new Client();
    signup(c, "Case+tag@example.test");
    assertEquals(
        409,
        c.post(
                "/accounts",
                Map.of(
                    "name",
                    "N",
                    "callName",
                    "C",
                    "email",
                    "CASE+TAG@EXAMPLE.TEST",
                    "password",
                    password),
                key())
            .getResponse()
            .getStatus());
    assertEquals(
        400,
        c.post(
                "/accounts",
                Map.of(
                    "name",
                    "N",
                    "callName",
                    "C",
                    "email",
                    "weak@example.test",
                    "password",
                    "password1234"),
                key())
            .getResponse()
            .getStatus());
    assertEquals(
        400,
        c.post(
                "/accounts",
                Map.of(
                    "name",
                    "N",
                    "callName",
                    "C",
                    "email",
                    "extra@example.test",
                    "password",
                    password,
                    "role",
                    "club_president"),
                key())
            .getResponse()
            .getStatus());
    assertTrue(
        core.db
            .queryForObject(
                "SELECT password_hash FROM accounts WHERE email_key='case+tag@example.test'",
                String.class)
            .startsWith("$argon2id$"));
    c.login("case+tag@example.test");
  }

  @Test
  void pendingCapAndWithdrawal() throws Exception {
    Client c = new Client();
    signup(c, "pending@example.test");
    c.login("pending@example.test");
    var a = join(c);
    assertEquals(
        409,
        c.post("/join-applications", Map.of("clubId", otherClub), key()).getResponse().getStatus());
    assertEquals(
        200,
        c.post(
                "/join-applications/" + a.path("id").asText() + "/withdraw",
                Map.of("version", 0),
                key())
            .getResponse()
            .getStatus());
    assertEquals(
        201,
        c.post("/join-applications", Map.of("clubId", otherClub), key()).getResponse().getStatus());
  }

  @Test
  void rejectionCooldownUsesDecisionTime() throws Exception {
    Client c = new Client();
    signup(c, "reject@example.test");
    c.login("reject@example.test");
    var a = join(c);
    core.db.update(
        "UPDATE join_applications SET requested_at=? WHERE id=?",
        java.sql.Timestamp.from(core.clock.instant().minus(Duration.ofDays(20))),
        UUID.fromString(a.path("id").asText()));
    Client admin = new Client();
    admin.login("reviewer@example.test");
    assertEquals(
        200,
        admin
            .post(
                "/join-applications/" + a.path("id").asText() + "/reject",
                Map.of("version", 0, "reason", "請補充資料"),
                key())
            .getResponse()
            .getStatus());
    assertEquals(
        409, c.post("/join-applications", Map.of("clubId", club), key()).getResponse().getStatus());
  }

  @Test
  void sessionRotationDisableAndLogout() throws Exception {
    Client c = new Client();
    signup(c, "session@example.test");
    String oldCookie = c.cookie, oldCsrf = c.csrf;
    var me = c.login("session@example.test");
    assertNotEquals(oldCookie, c.cookie);
    assertNotEquals(oldCsrf, c.csrf);
    assertEquals(
        401,
        mvc.perform(get("/api/v1/me").cookie(new Cookie(SessionService.COOKIE, oldCookie)))
            .andReturn()
            .getResponse()
            .getStatus());
    core.db.update(
        "UPDATE accounts SET status='disabled' WHERE id=?",
        UUID.fromString(me.path("account").path("id").asText()));
    assertEquals(401, c.run(get("/api/v1/me")).getResponse().getStatus());
  }

  @Test
  void rateLimitUniformFailureAcrossAliases() throws Exception {
    Client c = new Client();
    var a = signup(c, "limit@example.test");
    for (int i = 0; i < 10; i++) {
      String identifier = i % 2 == 0 ? "limit@example.test" : a.path("accountCode").asText();
      assertEquals(
          401,
          c.post(
                  "/sessions",
                  Map.of("identifier", identifier, "password", "incorrect password"),
                  null)
              .getResponse()
              .getStatus());
    }
    assertEquals(
        429,
        c.post("/sessions", Map.of("identifier", "limit@example.test", "password", password), null)
            .getResponse()
            .getStatus());
  }

  @Test
  void concurrentApprovalsHaveSingleWinner() throws Exception {
    Client c = new Client();
    signup(c, "race@example.test");
    c.login("race@example.test");
    var a = join(c);
    Client admin = new Client();
    admin.login("reviewer@example.test");
    try (var executor = Executors.newFixedThreadPool(2)) {
      List<Future<Integer>> results = new ArrayList<>();
      for (int i = 0; i < 2; i++)
        results.add(
            executor.submit(
                () ->
                    admin
                        .post(
                            "/join-applications/" + a.path("id").asText() + "/approve",
                            Map.of("version", 0, "startsOn", core.today().toString()),
                            key())
                        .getResponse()
                        .getStatus()));
      var codes = new ArrayList<Integer>();
      for (var f : results) codes.add(f.get());
      Collections.sort(codes);
      assertEquals(List.of(200, 409), codes);
    }
    assertEquals(1, core.db.queryForObject("SELECT count(*) FROM memberships", Integer.class));
  }

  @Test
  void sessionExactTimeoutBoundaries() throws Exception {
    Instant at = Instant.parse("2026-10-15T04:00:00Z");
    var fixed = new SessionService(core.db, Clock.fixed(at, ZoneOffset.UTC), ORIGIN);
    var response = new org.springframework.mock.web.MockHttpServletResponse();
    var session = fixed.create(response, null);
    String token = response.getHeader("Set-Cookie").split(";", 2)[0].split("=", 2)[1];
    var request = new org.springframework.mock.web.MockHttpServletRequest();
    request.setCookies(new Cookie(SessionService.COOKIE, token));
    core.db.update(
        "UPDATE api_sessions SET last_seen=? WHERE token_hash=?",
        java.sql.Timestamp.from(at.minus(Duration.ofMinutes(30))),
        session.hash());
    assertNull(fixed.lookup(request));
    response = new org.springframework.mock.web.MockHttpServletResponse();
    session = fixed.create(response, null);
    token = response.getHeader("Set-Cookie").split(";", 2)[0].split("=", 2)[1];
    request.setCookies(new Cookie(SessionService.COOKIE, token));
    core.db.update(
        "UPDATE api_sessions SET created_at=? WHERE token_hash=?",
        java.sql.Timestamp.from(at.minus(Duration.ofHours(12))),
        session.hash());
    assertNull(fixed.lookup(request));
  }

  @Test
  void cachedApprovalRechecksCurrentRoleAndPrivacy() throws Exception {
    Client c = new Client();
    signup(c, "cached@example.test");
    var me = c.login("cached@example.test");
    var a = join(c);
    Client admin = new Client();
    admin.login("reviewer@example.test");
    String k = key(), path = "/join-applications/" + a.path("id").asText() + "/approve";
    var body = Map.of("version", 0, "startsOn", core.today().toString());
    assertEquals(200, admin.post(path, body, k).getResponse().getStatus());
    core.db.update(
        "UPDATE members SET email_visible=false WHERE id=?",
        UUID.fromString(me.path("member").path("id").asText()));
    var replay = admin.post(path, body, k);
    assertEquals(200, replay.getResponse().getStatus());
    assertFalse(node(replay).path("application").path("applicant").has("email"));
    core.db.update("DELETE FROM role_grants WHERE account_id=?", reviewer);
    assertEquals(404, admin.post(path, body, k).getResponse().getStatus());
  }

  @Test
  void failedRegistrationStillConsumesRateLimit() throws Exception {
    Client c = new Client();
    signup(c, "duplicate@example.test");
    for (int i = 0; i < 9; i++)
      assertEquals(
          409,
          c.post(
                  "/accounts",
                  Map.of(
                      "name",
                      "N",
                      "callName",
                      "C",
                      "email",
                      "duplicate@example.test",
                      "password",
                      password),
                  key())
              .getResponse()
              .getStatus());
    assertEquals(
        429,
        c.post(
                "/accounts",
                Map.of(
                    "name",
                    "N",
                    "callName",
                    "C",
                    "email",
                    "duplicate@example.test",
                    "password",
                    password),
                key())
            .getResponse()
            .getStatus());
  }

  @Test
  void rejectsMalformedOptionalLoginFields() throws Exception {
    Client c = new Client();
    assertEquals(
        400,
        c.post("/sessions", Map.of("identifier", "no@example.test", "password", ""), null)
            .getResponse()
            .getStatus());
    assertEquals(
        400,
        c.post(
                "/sessions",
                Map.of("identifier", "no@example.test", "password", password, "totp", List.of()),
                null)
            .getResponse()
            .getStatus());
  }

  @Test
  void annualReadQualificationUsesTaipeiBoundaries() {
    var row = new HashMap<String, Object>();
    row.put("status", "active");
    row.put("confirmed_year", 2025);
    var fixed =
        new CoreService(
            core.db,
            Clock.fixed(Instant.parse("2026-06-30T16:00:00Z"), ZoneOffset.UTC),
            core.json,
            core.tx.getTransactionManager(),
            core.sessions,
            core.idemSecret);
    assertEquals("grace", fixed.annual(row));
    fixed =
        new CoreService(
            core.db,
            Clock.fixed(Instant.parse("2026-07-31T16:00:00Z"), ZoneOffset.UTC),
            core.json,
            core.tx.getTransactionManager(),
            core.sessions,
            core.idemSecret);
    assertEquals("unconfirmed", fixed.annual(row));
    row.put("confirmed_year", 2026);
    assertEquals("confirmed", fixed.annual(row));
    row.put("status", "ended");
    assertEquals("unconfirmed", fixed.annual(row));
  }

  @Test
  void replayResponsesAreEncryptedAndTamperingFailsClosed() throws Exception {
    Client c = new Client();
    signup(c, "encrypted@example.test");
    c.login("encrypted@example.test");
    String k = key();
    var body = Map.of("clubId", club);
    var result = c.post("/join-applications", body, k);
    assertEquals(201, result.getResponse().getStatus());
    String encrypted =
        core.db.queryForObject(
            "SELECT response FROM idempotency_records WHERE key=?", String.class, k);
    assertTrue(encrypted.startsWith("v1."));
    assertFalse(encrypted.contains("encrypted@example.test"));
    assertFalse(encrypted.contains("合成新會員"));
    assertFalse(encrypted.contains(password));
    assertEquals(node(result), node(c.post("/join-applications", body, k)));
    byte[] bytes = Base64.getDecoder().decode(encrypted.substring(3));
    bytes[bytes.length - 1] ^= 1;
    core.db.update(
        "UPDATE idempotency_records SET response=? WHERE key=?",
        "v1." + Base64.getEncoder().encodeToString(bytes),
        k);
    var rejected = c.post("/join-applications", body, k);
    assertEquals(503, rejected.getResponse().getStatus());
    assertEquals("SERVICE_UNAVAILABLE", node(rejected).path("code").asText());
    assertFalse(rejected.getResponse().getContentAsString().contains("encrypted@example.test"));
    assertThrows(
        IllegalStateException.class, () -> core.replayCipher.decrypt("{plaintext}", "scope"));
    String protectedValue = core.replayCipher.encrypt("private value", "actor-one/path/key/201");
    assertEquals(
        "private value", core.replayCipher.decrypt(protectedValue, "actor-one/path/key/201"));
    assertThrows(
        IllegalStateException.class,
        () -> core.replayCipher.decrypt(protectedValue, "actor-two/path/key/201"));
    assertNotEquals(
        protectedValue, core.replayCipher.encrypt("private value", "actor-one/path/key/201"));
  }

  @Test
  void cleanupPurgesExpiredResponsesWithoutTraffic() throws Exception {
    Client c = new Client();
    signup(c, "cleanup@example.test");
    Instant later = core.clock.instant().plus(Duration.ofHours(25));
    var cleanup = new ReplayRetention(core.db, Clock.fixed(later, ZoneOffset.UTC));
    assertEquals(1, cleanup.purgeExpired());
    assertEquals(
        0, core.db.queryForObject("SELECT count(*) FROM idempotency_records", Integer.class));
    assertEquals(0, cleanup.purgeExpired());
  }

  @Test
  void expiredAndDisabledApplicationsCannotBeApproved() throws Exception {
    Client c = new Client();
    signup(c, "expired@example.test");
    c.login("expired@example.test");
    var app = join(c);
    UUID id = UUID.fromString(app.path("id").asText());
    Client admin = new Client();
    admin.login("reviewer@example.test");
    String path = "/join-applications/" + id + "/approve";
    var body = Map.of("version", 0, "startsOn", core.today().toString());
    core.db.update(
        "UPDATE join_applications SET expires_at=? WHERE id=?",
        java.sql.Timestamp.from(core.clock.instant().minusSeconds(1)),
        id);
    assertEquals(409, admin.post(path, body, key()).getResponse().getStatus());
    assertEquals(0, core.db.queryForObject("SELECT count(*) FROM memberships", Integer.class));
    core.db.update(
        "UPDATE join_applications SET expires_at=? WHERE id=?",
        java.sql.Timestamp.from(core.clock.instant().plusSeconds(60)),
        id);
    core.db.update("UPDATE clubs SET status='disabled' WHERE id=?", club);
    assertEquals(404, admin.post(path, body, key()).getResponse().getStatus());
    assertEquals(0, core.db.queryForObject("SELECT count(*) FROM memberships", Integer.class));
  }

  @Test
  void malformedApprovalDateIsValidationErrorWithoutMutation() throws Exception {
    Client c = new Client();
    signup(c, "date@example.test");
    c.login("date@example.test");
    var app = join(c);
    String id = app.path("id").asText();
    Client admin = new Client();
    admin.login("reviewer@example.test");
    for (String date : List.of("2026-02-30", "abcdefghij")) {
      var result =
          admin.post(
              "/join-applications/" + id + "/approve",
              Map.of("version", 0, "startsOn", date),
              key());
      assertEquals(400, result.getResponse().getStatus());
      assertEquals("VALIDATION_ERROR", node(result).path("code").asText());
    }
    assertEquals(
        "pending",
        core.db.queryForObject(
            "SELECT status FROM join_applications WHERE id=?", String.class, UUID.fromString(id)));
    assertEquals(0, core.db.queryForObject("SELECT count(*) FROM memberships", Integer.class));
  }
}
