package org.xkrotaract.api;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;

import com.fasterxml.jackson.databind.*;
import jakarta.servlet.http.Cookie;
import java.sql.Timestamp;
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
class CouponIntegrationTest {
  static {
    String url = System.getenv("DATABASE_URL");
    String profiles = System.getenv("SPRING_PROFILES_ACTIVE");
    if (!"true".equals(System.getenv("CORE_TEST_ALLOW_RESET")) || url == null
        || !url.matches("jdbc:postgresql://[^/]+/[^?]*_test(?:\\?.*)?")
        || profiles != null && Arrays.asList(profiles.split(",")).contains("local"))
      throw new IllegalStateException("Coupon tests require CORE_TEST_ALLOW_RESET=true, a dedicated _test database and no local profile; no data was reset.");
  }

  @Autowired CoreService core;
  @Autowired CouponService coupons;
  @Autowired ObjectMapper json;
  @Autowired MockMvc mvc;
  UUID district, club, company;
  Client owner, member, other, reviewer;

  @BeforeEach
  void reset() {
    core.db.execute("TRUNCATE audit_events,idempotency_records,rate_limits,join_applications,memberships,role_grants,api_sessions,members,accounts,clubs,districts CASCADE");
    district = UUID.randomUUID(); club = UUID.randomUUID();
    core.db.update("INSERT INTO districts(id,code,name) VALUES(?,'COUPON_TEST','合成地區')", district);
    core.db.update("INSERT INTO clubs(id,name,type_code,district_id) VALUES(?,'合成扶青社','ROTARACT',?)", club, district);
    owner = new Client("owner"); member = new Client("member"); other = new Client("other"); reviewer = new Client("reviewer");
    core.db.update("INSERT INTO role_grants(id,account_id,role,starts_at,ends_at,granted_by,reason,scope_type) VALUES(?,?,'content_manager',?,?,?,'synthetic','platform')",
        UUID.randomUUID(), reviewer.account, Timestamp.from(core.clock.instant().minusSeconds(60)),
        Timestamp.from(core.clock.instant().plusSeconds(3600)), owner.account);
    active(member, core.yearStart()); active(other, core.yearStart());
    company = company(owner);
  }

  class Client {
    final UUID account = UUID.randomUUID(), memberId = UUID.randomUUID();
    final String token = SessionService.random(), csrf = SessionService.random();
    Client(String label) {
      String email = label + "@coupon.example.test";
      core.db.update("INSERT INTO accounts(id,account_code,email,email_key,password_hash) VALUES(?,?,?,?,?)",
          account, label + "Coupon", email, email, "unused-synthetic-hash");
      core.db.update("INSERT INTO members(id,account_id,name,call_name) VALUES(?,?,?,?)", memberId, account, "合成" + label, label);
      core.db.update("INSERT INTO api_sessions(token_hash,id,account_id,csrf_token,created_at,last_seen) VALUES(?,?,?,?,?,?)",
          SessionService.hash(token), UUID.randomUUID(), account, csrf, core.now(), core.now());
    }
    MvcResult run(MockHttpServletRequestBuilder b) throws Exception {
      return mvc.perform(b.secure(true).cookie(new Cookie(SessionService.COOKIE, token))
          .header("Origin", "https://localhost:5173").header("X-CSRF-Token", csrf)).andReturn();
    }
    MvcResult post(String path, Object body) throws Exception { return postKey(path, body, UUID.randomUUID().toString()); }
    MvcResult postKey(String path, Object body, String key) throws Exception {
      return run(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/v1" + path)
          .contentType("application/json").content(json.writeValueAsBytes(body)).header("Idempotency-Key", key));
    }
    MvcResult patchOffer(UUID id, Object body) throws Exception {
      return run(patch("/api/v1/coupon-offers/" + id).contentType("application/json")
          .content(json.writeValueAsBytes(body)).header("Idempotency-Key", UUID.randomUUID().toString()));
    }
  }

  UUID company(Client c) {
    UUID id = UUID.randomUUID();
    core.db.update("INSERT INTO business_companies(id,owner_member_id,name,city,phone,phone_public,status,first_published_at,created_at,updated_at)"
            + " VALUES(?,?,'合成咖啡商家','台北','02-12345678',true,'approved',?,?,?)",
        id, c.memberId, core.now(), core.now(), core.now());
    core.db.update("INSERT INTO business_company_industries(company_id,industry_id) VALUES(?,'food')", id);
    return id;
  }

  void active(Client c, int year) {
    core.db.update("INSERT INTO memberships(id,member_id,club_id,type_code,status,starts_on,name_snapshot,call_name_snapshot,club_name_snapshot,district_name_snapshot,confirmed_year)"
            + " VALUES(?,?,?,'ROTARACT','active',?,'合成會員','Synthetic','合成扶青社','合成地區',?)",
        UUID.randomUUID(), c.memberId, club, core.today().minusDays(1), year);
  }

  Map<String,Object> input(int quota, int limit) {
    return Input.map("companyId", company, "title", "合成社友優惠", "description", "領取時內容", "terms", "每碼限用一次",
        "startsAt", core.clock.instant().minusSeconds(3600).truncatedTo(java.time.temporal.ChronoUnit.SECONDS).toString(),
        "endsAt", core.clock.instant().plusSeconds(86400).truncatedTo(java.time.temporal.ChronoUnit.SECONDS).toString(),
        "totalQuota", quota, "perMemberLimit", limit);
  }

  JsonNode node(MvcResult r) throws Exception { return json.readTree(r.getResponse().getContentAsString()); }
  JsonNode ok(MvcResult r, int status) throws Exception {
    assertEquals(status, r.getResponse().getStatus(), r.getResponse().getContentAsString());
    return node(r);
  }
  UUID id(JsonNode n) { return UUID.fromString(n.path("id").asText()); }

  JsonNode approved(int quota, int limit) throws Exception {
    var draft = ok(owner.post("/coupon-offers", input(quota, limit)), 201);
    UUID id = id(draft);
    var pending = ok(owner.post("/coupon-offers/" + id + "/submit", Map.of("version", 1)), 200);
    return ok(reviewer.post("/coupon-offers/" + id + "/approve", Map.of("version", pending.path("version").asInt(), "reason", "符合規格")), 200);
  }

  JsonNode claim(Client c, UUID offer) throws Exception {
    return ok(c.post("/coupon-offers/" + offer + "/claim", Map.of()), 201);
  }

  Map<String,Object> redemption(JsonNode claim, int offerVersion) {
    return Map.of("code", claim.path("code").asText(), "claimVersion", claim.path("version").asInt(), "offerVersion", offerVersion);
  }

  @Test
  void completeLifecyclePrivateCodeAndMinimalMerchantProjection() throws Exception {
    var offer = approved(5, 1); UUID offerId = id(offer);
    var available = ok(member.run(get("/api/v1/coupon-offers")), 200);
    assertEquals(1, available.path("total").asInt());
    assertTrue(available.path("items").get(0).path("eligible").asBoolean());
    var claim = claim(member, offerId); UUID claimId = id(claim);
    String code = claim.path("code").asText();
    assertTrue(code.matches("XK-[A-Za-z0-9_-]{43}"));
    String stored = core.db.queryForObject("SELECT code_encrypted FROM coupon_claims WHERE id=?", String.class, claimId);
    assertNotEquals(code, stored);
    assertEquals(SessionService.hash(code), core.db.queryForObject("SELECT code_hash FROM coupon_claims WHERE id=?", String.class, claimId));
    assertEquals(404, other.run(get("/api/v1/me/coupons/" + claimId)).getResponse().getStatus());
    assertEquals(404, reviewer.run(get("/api/v1/me/coupons/" + claimId)).getResponse().getStatus());
    assertEquals(404, reviewer.post("/companies/" + company + "/coupon-redemptions/lookup", Map.of("code", code)).getResponse().getStatus());
    assertEquals(0, ok(reviewer.run(get("/api/v1/me/coupons")), 200).path("total").asInt());
    var checked = ok(owner.post("/companies/" + company + "/coupon-redemptions/lookup", Map.of("code", code)), 200);
    assertFalse(checked.has("code")); assertFalse(checked.has("memberId"));
    assertFalse(checked.has("claimedAt")); assertFalse(checked.has("voidReason"));
    assertEquals("領取時內容", checked.path("description").asText());
    var used = ok(owner.post("/companies/" + company + "/coupon-redemptions/confirm", redemption(claim, 3)), 200);
    assertEquals("used", used.path("status").asText()); assertTrue(used.has("usedAt")); assertFalse(used.has("code"));
    assertEquals(409, owner.post("/companies/" + company + "/coupon-redemptions/confirm", redemption(claim, 3)).getResponse().getStatus());
    var management = ok(reviewer.run(get("/api/v1/coupon-offers").param("scope", "manage")), 200);
    assertEquals(1, management.path("statusCounts").path("approved").asInt());
    assertEquals(1, management.path("items").get(0).path("issuedCount").asInt());
    assertEquals(1, management.path("items").get(0).path("redeemedCount").asInt());
    assertFalse(management.toString().contains(code));
    var wallet = ok(member.run(get("/api/v1/me/coupons").param("status", "used")), 200);
    assertEquals(1, wallet.path("total").asInt()); assertEquals(0, wallet.path("availableCount").asInt());
  }

  @Test
  void snapshotsSurviveEditingAndExposureExpiryButSuspendStopsRedemption() throws Exception {
    var offer = approved(6, 2); UUID offerId = id(offer);
    var first = claim(member, offerId);
    var second = claim(member, offerId);
    String originalEnd = first.path("expiresAt").asText();
    var changed = input(6, 2); changed.put("version", 3); changed.put("description", "新內容");
    changed.put("endsAt", core.clock.instant().plusSeconds(172800).truncatedTo(java.time.temporal.ChronoUnit.SECONDS).toString());
    ok(owner.patchOffer(offerId, changed), 200);
    core.db.update("UPDATE business_companies SET first_published_at=? WHERE id=?", Timestamp.from(core.clock.instant().minus(Duration.ofDays(5))), company);
    var saved = ok(member.run(get("/api/v1/me/coupons/" + id(first))), 200);
    assertEquals("領取時內容", saved.path("description").asText()); assertEquals(originalEnd, saved.path("expiresAt").asText());
    assertEquals(0, ok(member.run(get("/api/v1/coupon-offers")), 200).path("total").asInt());
    assertEquals(409, owner.post("/companies/" + company + "/coupon-redemptions/confirm", redemption(first, 3)).getResponse().getStatus());
    ok(owner.post("/companies/" + company + "/coupon-redemptions/confirm", redemption(first, 4)), 200);
    var suspended = ok(reviewer.post("/coupon-offers/" + offerId + "/suspend", Map.of("version", 4, "reason", "停止使用")), 200);
    assertEquals(5, suspended.path("version").asInt());
    assertEquals(409, owner.post("/companies/" + company + "/coupon-redemptions/confirm", redemption(second, 5)).getResponse().getStatus());
    assertTrue(ok(member.run(get("/api/v1/me/coupons/" + id(second))), 200).path("paused").asBoolean());
  }

  @Test
  void companySuspensionAndExpiredOrCrossCompanyCodesFailClosed() throws Exception {
    var offer = approved(5, 2); UUID offerId = id(offer);
    var first = claim(member, offerId);
    var second = claim(member, offerId);
    UUID unrelated = company(other);
    assertEquals(404, other.post("/companies/" + unrelated + "/coupon-redemptions/lookup", Map.of("code", first.path("code").asText())).getResponse().getStatus());
    assertEquals(404, other.post("/companies/" + company + "/coupon-redemptions/confirm", redemption(first, 3)).getResponse().getStatus());
    core.db.update("UPDATE business_companies SET status='suspended' WHERE id=?", company);
    assertEquals(409, owner.post("/companies/" + company + "/coupon-redemptions/confirm", redemption(first, 3)).getResponse().getStatus());
    core.db.update("UPDATE business_companies SET status='approved' WHERE id=?", company);
    core.db.update("UPDATE coupon_claims SET expires_at=? WHERE id=?", Timestamp.from(core.clock.instant().minusSeconds(1)), id(second));
    assertEquals(409, owner.post("/companies/" + company + "/coupon-redemptions/confirm", redemption(second, 3)).getResponse().getStatus());
    assertEquals(1, ok(member.run(get("/api/v1/me/coupons").param("status", "expired")), 200).path("total").asInt());
    assertEquals(409, member.post("/me/coupons/" + id(second) + "/void", Map.of("version", 1, "reason", "過期" )).getResponse().getStatus());
  }

  @Test
  void claimReplayAccountWideKeyAndVoidNeverReleaseQuota() throws Exception {
    UUID firstOffer = id(approved(2, 1)), secondOffer = id(approved(2, 1));
    String key = UUID.randomUUID().toString(), path = "/coupon-offers/" + firstOffer + "/claim";
    var first = ok(member.postKey(path, Map.of(), key), 201);
    assertEquals(first.path("id"), ok(member.postKey(path, Map.of(), key), 201).path("id"));
    assertEquals(409, member.postKey("/coupon-offers/" + secondOffer + "/claim", Map.of(), key).getResponse().getStatus());
    ok(member.post("/me/coupons/" + id(first) + "/void", Map.of("version", 1, "reason", "自行放棄")), 200);
    assertEquals(409, member.post(path, Map.of()).getResponse().getStatus());
    assertEquals(1L, core.db.queryForObject("SELECT count(*) FROM coupon_claims WHERE offer_id=?", Long.class, firstOffer));
    var counts = ok(owner.run(get("/api/v1/coupon-offers/" + firstOffer).param("scope", "manage")), 200);
    assertEquals(1, counts.path("remaining").asInt()); assertEquals(1, counts.path("issuedCount").asInt());
    assertEquals(409, owner.post("/companies/" + company + "/coupon-redemptions/confirm", redemption(first, 3)).getResponse().getStatus());
  }

  @Test
  void strictEligibilityAuthorizationWhitelistAndInvalidTransitions() throws Exception {
    var offer = approved(5, 1); UUID offerId = id(offer);
    assertEquals(403, owner.post("/coupon-offers/" + offerId + "/claim", Map.of()).getResponse().getStatus());
    core.db.update("UPDATE memberships SET confirmed_year=? WHERE member_id=?", core.yearStart()-1, member.memberId);
    assertEquals(403, member.post("/coupon-offers/" + offerId + "/claim", Map.of()).getResponse().getStatus());
    core.db.update("UPDATE memberships SET confirmed_year=?,annual_unconfirmed_year=? WHERE member_id=?", core.yearStart(), core.yearStart(), member.memberId);
    assertEquals(403, member.post("/coupon-offers/" + offerId + "/claim", Map.of()).getResponse().getStatus());
    core.db.update("UPDATE memberships SET annual_unconfirmed_year=NULL WHERE member_id=?", member.memberId);
    core.db.update("UPDATE clubs SET status='disabled' WHERE id=?", club);
    assertEquals(403, member.post("/coupon-offers/" + offerId + "/claim", Map.of()).getResponse().getStatus());
    assertEquals(404, member.post("/coupon-offers", input(2, 1)).getResponse().getStatus());
    assertEquals(404, member.post("/coupon-offers/" + offerId + "/suspend", Map.of("version", 3, "reason", "unauthorized")).getResponse().getStatus());
    assertEquals(409, owner.post("/coupon-offers/" + offerId + "/submit", Map.of("version", 3)).getResponse().getStatus());
    assertEquals(400, other.post("/coupon-offers/" + offerId + "/claim", Map.of("memberId", member.memberId)).getResponse().getStatus());
    assertEquals(401, mvc.perform(get("/api/v1/coupon-offers").secure(true)).andReturn().getResponse().getStatus());
    assertEquals(400, member.run(get("/api/v1/me/coupons").param("status", "pending")).getResponse().getStatus());
  }

  @Test
  void lastQuotaAndOneTimeRedemptionAreAtomicUnderConcurrency() throws Exception {
    UUID offerId = id(approved(1, 1));
    var pool = Executors.newFixedThreadPool(2);
    try {
      var gate = new CountDownLatch(1);
      Future<Object> a = pool.submit(() -> raceClaim(member, offerId, gate));
      Future<Object> b = pool.submit(() -> raceClaim(other, offerId, gate));
      gate.countDown(); Object x = a.get(15, TimeUnit.SECONDS), y = b.get(15, TimeUnit.SECONDS);
      assertEquals(1, (x instanceof ApiException ? 0 : 1) + (y instanceof ApiException ? 0 : 1));
      ApiException rejected = (ApiException) (x instanceof ApiException ? x : y);
      assertEquals(409, rejected.status);
      JsonNode claim = json.valueToTree(x instanceof ApiException ? y : x);
      var firstBody = json.valueToTree(redemption(claim, 3));
      var redeemGate = new CountDownLatch(1);
      Future<Object> r1 = pool.submit(() -> raceRedeem(firstBody, redeemGate));
      Future<Object> r2 = pool.submit(() -> raceRedeem(firstBody, redeemGate));
      redeemGate.countDown(); Object first = r1.get(15, TimeUnit.SECONDS), second = r2.get(15, TimeUnit.SECONDS);
      assertEquals(1, (first instanceof ApiException ? 0 : 1) + (second instanceof ApiException ? 0 : 1));
      assertEquals(1L, core.db.queryForObject("SELECT count(*) FROM coupon_claims WHERE status='used'", Long.class));
    } finally { pool.shutdownNow(); }
  }

  Object raceClaim(Client c, UUID offer, CountDownLatch gate) throws InterruptedException {
    gate.await();
    try { return coupons.claim(c.account, offer, UUID.randomUUID().toString(), json.createObjectNode()); }
    catch (ApiException e) { return e; }
  }

  Object raceRedeem(JsonNode body, CountDownLatch gate) throws InterruptedException {
    gate.await();
    try { return coupons.redeem(owner.account, company, body); }
    catch (ApiException e) { return e; }
  }

  @Test
  void perAccountLimitIsAtomicEvenWithSpareTotalQuota() throws Exception {
    UUID offerId = id(approved(10, 1));
    var pool = Executors.newFixedThreadPool(2);
    try {
      var gate = new CountDownLatch(1);
      Future<Object> a = pool.submit(() -> raceClaim(member, offerId, gate));
      Future<Object> b = pool.submit(() -> raceClaim(member, offerId, gate));
      gate.countDown();
      Object first = a.get(15, TimeUnit.SECONDS), second = b.get(15, TimeUnit.SECONDS);
      assertEquals(1, (first instanceof ApiException ? 0 : 1) + (second instanceof ApiException ? 0 : 1));
      assertEquals(1L, core.db.queryForObject("SELECT count(*) FROM coupon_claims WHERE offer_id=? AND member_id=?", Long.class, offerId, member.memberId));
    } finally { pool.shutdownNow(); }
  }

  @Test
  void reviewerRevocationPreventsSuccessfulMutationReplay() throws Exception {
    var draft = ok(owner.post("/coupon-offers", input(2, 1)), 201); UUID id = id(draft);
    ok(owner.post("/coupon-offers/" + id + "/submit", Map.of("version", 1)), 200);
    String key = UUID.randomUUID().toString(), path = "/coupon-offers/" + id + "/approve";
    var body = Map.of("version", 2, "reason", "合成審核");
    ok(reviewer.postKey(path, body, key), 200);
    core.db.update("UPDATE role_grants SET revoked_at=? WHERE account_id=?", core.now(), reviewer.account);
    assertEquals(404, reviewer.postKey(path, body, key).getResponse().getStatus());
  }

  @Test
  void rejectReasonAndQuotaEditsAreValidated() throws Exception {
    var draft = ok(owner.post("/coupon-offers", input(2, 2)), 201); UUID id = id(draft);
    ok(owner.post("/coupon-offers/" + id + "/submit", Map.of("version", 1)), 200);
    assertEquals(400, reviewer.post("/coupon-offers/" + id + "/reject", Map.of("version", 2, "reason", " ")).getResponse().getStatus());
    ok(reviewer.post("/coupon-offers/" + id + "/reject", Map.of("version", 2, "reason", "補齊條件")), 200);
    ok(owner.post("/coupon-offers/" + id + "/submit", Map.of("version", 3)), 200);
    ok(reviewer.post("/coupon-offers/" + id + "/approve", Map.of("version", 4, "reason", "可核准")), 200);
    claim(member, id); claim(member, id);
    var edit = input(1, 1); edit.put("version", 5);
    assertEquals(409, owner.patchOffer(id, edit).getResponse().getStatus());
    edit = input(2, 1); edit.put("version", 5);
    assertEquals(409, owner.patchOffer(id, edit).getResponse().getStatus());
    edit = input(2, 2); edit.put("version", 4);
    assertEquals(409, owner.patchOffer(id, edit).getResponse().getStatus());
    var invalid = input(2, 3);
    assertEquals(400, owner.post("/coupon-offers", invalid).getResponse().getStatus());
  }
}
