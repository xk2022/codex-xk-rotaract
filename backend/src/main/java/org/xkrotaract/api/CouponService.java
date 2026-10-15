package org.xkrotaract.api;

import static org.xkrotaract.api.Input.*;

import com.fasterxml.jackson.databind.JsonNode;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import org.springframework.stereotype.Service;

/** Coupon issuance and redemption use company -> offer -> claim locks in that order. */
@Service
class CouponService {
  final CoreService core;
  final Queries queries;
  final BusinessService businesses;
  final ApiSupport support;
  static final Set<String> OFFER_STATUSES = Set.of("draft", "pending", "approved", "rejected", "suspended");

  CouponService(CoreService core, Queries queries, BusinessService businesses, ApiSupport support) {
    this.core = core;
    this.queries = queries;
    this.businesses = businesses;
    this.support = support;
  }

  Map<String,Object> offer(UUID id) {
    return core.one("SELECT * FROM coupon_offers WHERE id=?", id);
  }

  UUID memberId(UUID actor) { return (UUID) core.member(actor).get("id"); }
  Instant time(Object value) { return ((Timestamp) value).toInstant(); }
  String stamp(Object value) { return time(value).toString(); }
  boolean reviewer(UUID actor) { return support.platformRole(actor, "content_manager"); }

  void requireCompanyOwner(UUID actor, UUID company) {
    if (!businesses.owner(actor, company)) throw ApiException.missing();
  }

  void requireCreate(UUID actor, JsonNode body) {
    requireCompanyOwner(actor, uuid(body, "companyId"));
  }

  Map<String,Object> requireOwner(UUID actor, UUID id) {
    var o = offer(id);
    requireCompanyOwner(actor, (UUID) o.get("company_id"));
    return o;
  }

  void requireAction(UUID actor, UUID id, String action) {
    if (action.equals("submit")) requireOwner(actor, id);
    else {
      if (!reviewer(actor)) throw ApiException.missing();
      offer(id);
    }
  }

  Map<String,Object> requireMyClaim(UUID actor, UUID id) {
    return core.one("SELECT * FROM coupon_claims WHERE id=? AND member_id=?", id, memberId(actor));
  }

  void lockCompany(UUID id) {
    core.one("SELECT id FROM business_companies WHERE id=? FOR UPDATE", id);
  }

  Map<String,Object> lockOffer(UUID id) {
    var initial = offer(id);
    lockCompany((UUID) initial.get("company_id"));
    return core.one("SELECT * FROM coupon_offers WHERE id=? FOR UPDATE", id);
  }

  boolean eligible(UUID actor) {
    LocalDate today = core.today();
    int year = today.getYear() - (today.getMonthValue() < 7 ? 1 : 0);
    return core.db.queryForObject(
        "SELECT count(*) FROM memberships ms JOIN members m ON m.id=ms.member_id"
            + " JOIN clubs c ON c.id=ms.club_id WHERE m.account_id=? AND ms.status='active'"
            + " AND c.status='active' AND ms.starts_on<=? AND (ms.ends_on IS NULL OR ms.ends_on>?)"
            + " AND ms.confirmed_year=? AND (ms.annual_unconfirmed_year IS NULL OR ms.annual_unconfirmed_year<>?)",
        Integer.class, actor, today, today, year, year) > 0;
  }

  boolean available(Map<String,Object> o) {
    Instant now = core.clock.instant();
    return "approved".equals(o.get("status")) && !now.isBefore(time(o.get("starts_at")))
        && now.isBefore(time(o.get("ends_at"))) && businesses.isPublic((UUID) o.get("company_id"));
  }

  long count(UUID offer) {
    return core.db.queryForObject("SELECT count(*) FROM coupon_claims WHERE offer_id=?", Long.class, offer);
  }

  Map<String,Object> offerDto(Map<String,Object> o, UUID actor, boolean manage) {
    UUID id = (UUID) o.get("id");
    UUID company = (UUID) o.get("company_id");
    long issued = count(id);
    var d = map("id", id, "companyId", company,
        "companyName", businesses.company(company).get("name"),
        "title", o.get("title"), "description", o.get("description"), "terms", o.get("terms"),
        "startsAt", stamp(o.get("starts_at")), "endsAt", stamp(o.get("ends_at")),
        "totalQuota", o.get("total_quota"), "perMemberLimit", o.get("per_member_limit"),
        "status", o.get("status"), "version", o.get("version"),
        "remaining", Math.max(0L, ((Number) o.get("total_quota")).longValue() - issued));
    if (manage) {
      d.put("issuedCount", issued);
      d.put("redeemedCount", core.db.queryForObject(
          "SELECT count(*) FROM coupon_claims WHERE offer_id=? AND status='used'", Long.class, id));
      if (o.get("review_reason") != null) d.put("reviewReason", o.get("review_reason"));
    } else {
      long mine = core.db.queryForObject("SELECT count(*) FROM coupon_claims WHERE offer_id=? AND member_id=?",
          Long.class, id, memberId(actor));
      d.put("myClaimCount", mine);
      d.put("eligible", eligible(actor));
    }
    return d;
  }

  Object list(UUID actor, Map<String,String> q) {
    queries.validate(q, Set.of("page", "pageSize", "keyword", "companyId", "scope", "status"));
    String scope = q.getOrDefault("scope", "available");
    if (!Set.of("available", "manage").contains(scope)) throw ApiException.bad();
    if (q.containsKey("status") && !(OFFER_STATUSES.contains(q.get("status")) || q.get("status").equals("all")))
      throw ApiException.bad();
    if (scope.equals("available") && q.containsKey("status")) throw ApiException.bad();
    UUID company = q.containsKey("companyId") ? UUID.fromString(q.get("companyId")) : null;
    boolean manage = scope.equals("manage");
    var rows = new ArrayList<Map<String,Object>>();
    var totals = new LinkedHashMap<String,Long>();
    for (String status : List.of("draft", "pending", "approved", "rejected", "suspended")) totals.put(status, 0L);
    for (var o : core.db.queryForList("SELECT * FROM coupon_offers ORDER BY created_at DESC,id")) {
      if (company != null && !company.equals(o.get("company_id"))) continue;
      if (manage ? !(reviewer(actor) || businesses.owner(actor, (UUID) o.get("company_id"))) : !available(o)) continue;
      String companyName = Objects.toString(businesses.company((UUID) o.get("company_id")).get("name"), "");
      if (!queries.keyword(q, o.get("title") + " " + companyName)) continue;
      String status = (String) o.get("status");
      totals.put(status, totals.get(status) + 1);
      if (q.containsKey("status") && !q.get("status").equals("all") && !q.get("status").equals(status)) continue;
      rows.add(offerDto(o, actor, manage));
    }
    @SuppressWarnings("unchecked")
    var result = (Map<String,Object>) queries.page(rows, q);
    if (manage) result.put("statusCounts", totals);
    return result;
  }

  Object detail(UUID actor, UUID id, String scope) {
    if (!Set.of("available", "manage").contains(scope)) throw ApiException.bad();
    var o = offer(id);
    boolean manage = scope.equals("manage");
    if (manage ? !(reviewer(actor) || businesses.owner(actor, (UUID) o.get("company_id"))) : !available(o))
      throw ApiException.missing();
    return offerDto(o, actor, manage);
  }

  record OfferInput(UUID companyId, String title, String description, String terms,
                    Instant startsAt, Instant endsAt, int quota, int limit) {}

  Instant inputInstant(JsonNode body, String key) {
    String value = text(body, key, 20, 30);
    if (!value.matches("\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d{1,3})?Z")) throw ApiException.bad();
    try { return Instant.parse(value); } catch (DateTimeException e) { throw ApiException.bad(); }
  }

  int positive(JsonNode body, String key) {
    var value = body.get(key);
    if (value == null || !value.isIntegralNumber() || !value.canConvertToInt() || value.intValue() <= 0)
      throw ApiException.bad();
    return value.intValue();
  }

  OfferInput input(JsonNode body, boolean update) {
    if (update) fields(body, "version", "companyId", "title", "description", "terms", "startsAt", "endsAt", "totalQuota", "perMemberLimit");
    else fields(body, "companyId", "title", "description", "terms", "startsAt", "endsAt", "totalQuota", "perMemberLimit");
    var i = new OfferInput(uuid(body, "companyId"), text(body, "title", 1, 120),
        text(body, "description", 1, 2000), text(body, "terms", 1, 2000),
        inputInstant(body, "startsAt"), inputInstant(body, "endsAt"),
        positive(body, "totalQuota"), positive(body, "perMemberLimit"));
    if (!i.endsAt.isAfter(i.startsAt) || i.limit > i.quota) throw ApiException.bad();
    return i;
  }

  void checkVersion(Map<String,Object> o, int version) {
    if (((Number) o.get("version")).intValue() != version) throw ApiException.conflict();
  }

  void audit(UUID actor, String action, UUID id, String reason) {
    UUID event = UUID.randomUUID();
    core.db.update("INSERT INTO audit_events VALUES(?,?,?,?,?)", event, actor, "coupon." + action, id, core.now());
    core.db.update("INSERT INTO coupon_audit_details(event_id,reason) VALUES(?,?)", event, reason);
  }

  Object create(UUID actor, JsonNode body) {
    return core.tx.execute(tx -> {
      var i = input(body, false);
      lockCompany(i.companyId);
      requireCompanyOwner(actor, i.companyId);
      UUID id = UUID.randomUUID();
      core.db.update("INSERT INTO coupon_offers(id,company_id,title,description,terms,starts_at,ends_at,total_quota,per_member_limit,status,created_at)"
          + " VALUES(?,?,?,?,?,?,?,?,?,'draft',?)", id, i.companyId, i.title, i.description, i.terms,
          Timestamp.from(i.startsAt), Timestamp.from(i.endsAt), i.quota, i.limit, core.now());
      audit(actor, "create", id, null);
      return offerDto(offer(id), actor, true);
    });
  }

  Object update(UUID actor, UUID id, JsonNode body) {
    return core.tx.execute(tx -> {
      var i = input(body, true);
      var o = lockOffer(id);
      requireCompanyOwner(actor, (UUID) o.get("company_id"));
      checkVersion(o, version(body));
      if ("suspended".equals(o.get("status"))) throw ApiException.conflict();
      if (!i.companyId.equals(o.get("company_id"))) throw ApiException.bad();
      if (i.quota < count(id) || core.db.queryForObject(
          "SELECT count(*) FROM (SELECT member_id FROM coupon_claims WHERE offer_id=? GROUP BY member_id HAVING count(*)>?) x",
          Long.class, id, i.limit) > 0) throw ApiException.conflict();
      core.db.update("UPDATE coupon_offers SET title=?,description=?,terms=?,starts_at=?,ends_at=?,total_quota=?,per_member_limit=?,status='draft',review_reason=NULL,version=version+1 WHERE id=?",
          i.title, i.description, i.terms, Timestamp.from(i.startsAt), Timestamp.from(i.endsAt), i.quota, i.limit, id);
      audit(actor, "update", id, null);
      return offerDto(offer(id), actor, true);
    });
  }

  Object action(UUID actor, UUID id, String action, JsonNode body) {
    return core.tx.execute(tx -> {
      fields(body, "version", "reason");
      var o = lockOffer(id);
      requireAction(actor, id, action);
      checkVersion(o, version(body));
      String status = (String) o.get("status");
      String reason = action.equals("submit") ? optional(body, "reason", 500) : text(body, "reason", 1, 500);
      String next;
      switch (action) {
        case "submit" -> {
          if (!Set.of("draft", "rejected").contains(status) || !core.clock.instant().isBefore(time(o.get("ends_at"))))
            throw ApiException.conflict();
          next = "pending";
        }
        case "approve", "reject" -> {
          if (!status.equals("pending") || action.equals("approve") && !core.clock.instant().isBefore(time(o.get("ends_at"))))
            throw ApiException.conflict();
          next = action.equals("approve") ? "approved" : "rejected";
        }
        case "suspend" -> {
          if (status.equals("suspended") || !status.equals("approved") && count(id) == 0) throw ApiException.conflict();
          next = "suspended";
        }
        default -> throw ApiException.bad();
      }
      core.db.update("UPDATE coupon_offers SET status=?,review_reason=?,version=version+1 WHERE id=?", next,
          action.equals("submit") ? null : reason, id);
      audit(actor, action, id, reason);
      return offerDto(offer(id), actor, true);
    });
  }

  Object claim(UUID actor, UUID id, String key, JsonNode body) {
    fields(body);
    return core.tx.execute(tx -> {
      UUID member = memberId(actor);
      // Claim keys are account-wide so the same request cannot claim another offer.
      core.db.queryForObject("SELECT pg_advisory_xact_lock(hashtextextended(?,0)) IS NULL", Boolean.class,
          "coupon-claim:" + actor + ":" + key);
      var existing = core.db.queryForList("SELECT * FROM coupon_claim_requests WHERE actor_id=? AND request_key=?", actor, key);
      if (!existing.isEmpty()) {
        var request = existing.getFirst();
        if (!id.equals(request.get("offer_id"))) throw new ApiException(409, "IDEMPOTENCY_CONFLICT", "請求代號已用於其他優惠。");
        return myClaim(actor, (UUID) request.get("claim_id"));
      }
      var o = lockOffer(id);
      // Membership row locks keep concurrent end/annual updates from changing checked eligibility.
      core.db.queryForList("SELECT id FROM memberships WHERE member_id=? ORDER BY id FOR SHARE", member);
      core.db.queryForList("SELECT id FROM clubs WHERE id IN (SELECT club_id FROM memberships WHERE member_id=?) ORDER BY id FOR SHARE", member);
      if (!eligible(actor)) throw new ApiException(403, "COUPON_INELIGIBLE", "僅當年度已確認正常社員可領取優惠。");
      if (!available(o)) throw ApiException.conflict();
      long issued = count(id);
      long mine = core.db.queryForObject("SELECT count(*) FROM coupon_claims WHERE offer_id=? AND member_id=?", Long.class, id, member);
      if (issued >= ((Number) o.get("total_quota")).longValue() || mine >= ((Number) o.get("per_member_limit")).longValue())
        throw new ApiException(409, "COUPON_LIMIT_REACHED", "已達優惠總名額或每帳號領取上限。");
      UUID claim = UUID.randomUUID();
      String code = "XK-" + SessionService.random();
      core.db.update("INSERT INTO coupon_claims(id,offer_id,company_id,member_id,code_hash,code_encrypted,title,description,terms,claimed_at,starts_at,expires_at,status)"
              + " VALUES(?,?,?,?,?,?,?,?,?,?,?,?,'available')",
          claim, id, o.get("company_id"), member, SessionService.hash(code),
          core.replayCipher.encrypt(code, codeAad(claim, member)), o.get("title"), o.get("description"), o.get("terms"), core.now(), o.get("starts_at"), o.get("ends_at"));
      core.db.update("INSERT INTO coupon_claim_requests VALUES(?,?,?,?)", actor, key, id, claim);
      audit(actor, "claim", claim, null);
      return myClaim(actor, claim);
    });
  }

  String codeAad(UUID id, UUID member) { return "coupon-code\n" + id + "\n" + member; }

  String effectiveStatus(Map<String,Object> c) {
    return c.get("status").equals("available") && !core.clock.instant().isBefore(time(c.get("expires_at")))
        ? "expired" : (String) c.get("status");
  }

  Map<String,Object> claimDto(Map<String,Object> c, boolean self) {
    var o = offer((UUID) c.get("offer_id"));
    UUID company = (UUID) c.get("company_id");
    var d = map("id", c.get("id"), "offerId", c.get("offer_id"), "companyId", company,
        "companyName", businesses.company(company).get("name"),
        "title", c.get("title"), "description", c.get("description"), "terms", c.get("terms"),
        "status", c.get("status"), "effectiveStatus", effectiveStatus(c), "version", c.get("version"),
        "claimVersion", c.get("version"), "offerVersion", o.get("version"),
        "startsAt", stamp(c.get("starts_at")), "expiresAt", stamp(c.get("expires_at")),
        "paused", o.get("status").equals("suspended") || businesses.suspended(company));
    if (c.get("used_at") != null) d.put("usedAt", stamp(c.get("used_at")));
    if (self) {
      d.put("claimedAt", stamp(c.get("claimed_at")));
      d.put("code", core.replayCipher.decrypt((String) c.get("code_encrypted"),
          codeAad((UUID) c.get("id"), (UUID) c.get("member_id"))));
      if (c.get("void_reason") != null) d.put("voidReason", c.get("void_reason"));
    }
    return d;
  }

  Object wallet(UUID actor, Map<String,String> q) {
    queries.validate(q, Set.of("page", "pageSize", "status", "companyId"));
    String filter = q.getOrDefault("status", "all");
    if (!Set.of("all", "available", "used", "expired", "void").contains(filter)) throw ApiException.bad();
    UUID company = q.containsKey("companyId") ? UUID.fromString(q.get("companyId")) : null;
    var rows = new ArrayList<Map<String,Object>>();
    long availableCount = 0;
    for (var c : core.db.queryForList("SELECT * FROM coupon_claims WHERE member_id=? ORDER BY claimed_at DESC,id", memberId(actor))) {
      if (company != null && !company.equals(c.get("company_id"))) continue;
      String status = effectiveStatus(c);
      if (status.equals("available")) availableCount++;
      if (filter.equals("all") || filter.equals(status)) rows.add(claimDto(c, true));
    }
    @SuppressWarnings("unchecked")
    var result = (Map<String,Object>) queries.page(rows, q);
    result.put("availableCount", availableCount);
    return result;
  }

  Object myClaim(UUID actor, UUID id) { return claimDto(requireMyClaim(actor, id), true); }

  Object voidClaim(UUID actor, UUID id, JsonNode body) {
    fields(body, "version", "reason");
    String reason = text(body, "reason", 1, 500);
    return core.tx.execute(tx -> {
      var initial = requireMyClaim(actor, id);
      lockOffer((UUID) initial.get("offer_id"));
      var c = core.one("SELECT * FROM coupon_claims WHERE id=? AND member_id=? FOR UPDATE", id, memberId(actor));
      checkVersion(c, version(body));
      if (!effectiveStatus(c).equals("available")) throw ApiException.conflict();
      core.db.update("UPDATE coupon_claims SET status='void',void_reason=?,version=version+1 WHERE id=?", reason, id);
      audit(actor, "void", id, reason);
      return myClaim(actor, id);
    });
  }

  Map<String,Object> byCode(UUID company, JsonNode body) {
    String code = text(body, "code", 1, 128);
    return core.one("SELECT * FROM coupon_claims WHERE company_id=? AND code_hash=?", company, SessionService.hash(code));
  }

  Object lookup(UUID actor, UUID company, JsonNode body) {
    fields(body, "code");
    requireCompanyOwner(actor, company);
    return claimDto(byCode(company, body), false);
  }

  Object redeem(UUID actor, UUID company, JsonNode body) {
    fields(body, "code", "claimVersion", "offerVersion");
    int claimVersion = namedVersion(body, "claimVersion"), offerVersion = namedVersion(body, "offerVersion");
    return core.tx.execute(tx -> {
      lockCompany(company);
      requireCompanyOwner(actor, company);
      var initial = byCode(company, body);
      var o = core.one("SELECT * FROM coupon_offers WHERE id=? FOR UPDATE", initial.get("offer_id"));
      var c = core.one("SELECT * FROM coupon_claims WHERE id=? FOR UPDATE", initial.get("id"));
      checkVersion(c, claimVersion);
      checkVersion(o, offerVersion);
      Instant now = core.clock.instant();
      if (!effectiveStatus(c).equals("available") || now.isBefore(time(c.get("claimed_at")))
          || now.isBefore(time(c.get("starts_at"))) || o.get("status").equals("suspended") || businesses.suspended(company))
        throw ApiException.conflict();
      UUID id = (UUID) c.get("id");
      core.db.update("UPDATE coupon_claims SET status='used',used_at=?,version=version+1 WHERE id=?", core.now(), id);
      audit(actor, "redeem", id, null);
      return claimDto(core.one("SELECT * FROM coupon_claims WHERE id=?", id), false);
    });
  }

  int namedVersion(JsonNode body, String key) {
    var n = body.get(key);
    if (n == null || !n.isIntegralNumber() || !n.canConvertToInt() || n.intValue() < 1) throw ApiException.bad();
    return n.intValue();
  }
}
