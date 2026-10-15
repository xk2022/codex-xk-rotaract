package org.xkrotaract.api;

import static org.xkrotaract.api.Input.*;

import com.fasterxml.jackson.databind.*;
import com.google.i18n.phonenumbers.PhoneNumberUtil;
import jakarta.servlet.http.*;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;
import java.util.function.Supplier;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.argon2.Argon2PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

@Service
class CoreService {
  final JdbcTemplate db;
  final Clock clock;
  final ObjectMapper json;
  final TransactionTemplate tx;
  final SessionService sessions;
  final String idemSecret;
  final ReplayCipher replayCipher;
  final Argon2PasswordEncoder passwords = Argon2PasswordEncoder.defaultsForSpringSecurity_v5_8();
  final String dummyHash;
  final Set<String> commonPasswords;

  CoreService(
      JdbcTemplate db,
      Clock clock,
      ObjectMapper json,
      PlatformTransactionManager tm,
      SessionService sessions,
      @Value("${app.idempotency-secret}") String secret) {
    this.db = db;
    this.clock = clock;
    this.json = json;
    this.tx = new TransactionTemplate(tm);
    this.sessions = sessions;
    if (secret.length() < 32)
      throw new IllegalArgumentException("IDEMPOTENCY_SECRET needs at least 32 characters");
    this.idemSecret = secret;
    this.replayCipher = new ReplayCipher(secret);
    dummyHash = passwords.encode(SessionService.random());
    try (var stream = getClass().getResourceAsStream("/common-passwords.txt")) {
      commonPasswords =
          new HashSet<>(
              new String(stream.readAllBytes(), StandardCharsets.UTF_8)
                  .lines()
                  .map(v -> v.toLowerCase(Locale.ROOT))
                  .toList());
      commonPasswords.addAll(
          Set.of(
              "password1234",
              "password12345",
              "123456789012",
              "qwertyuiop12",
              "111111111111",
              "correct horse battery staple",
              "abcdefgh1234",
              "password123!"));
    } catch (java.io.IOException e) {
      throw new IllegalStateException(e);
    }
  }

  java.sql.Timestamp now() {
    return java.sql.Timestamp.from(clock.instant());
  }

  LocalDate today() {
    return LocalDate.now(clock.withZone(ZoneId.of("Asia/Taipei")));
  }

  Map<String, Object> one(String sql, Object... args) {
    var rows = db.queryForList(sql, args);
    if (rows.isEmpty()) throw ApiException.missing();
    return rows.getFirst();
  }

  record Result(int status, Object body) {}

  Result idempotent(HttpServletRequest req, JsonNode body, int status, Supplier<Object> action) {
    var s = (SessionService.Session) req.getAttribute("session");
    String key = req.getHeader("Idempotency-Key");
    if (key == null || !key.matches("[A-Za-z0-9_-]{16,128}")) throw ApiException.bad();
    UUID actor = s.accountId() == null ? s.id() : s.accountId();
    String path = req.getRequestURI(), digest = hmac(canonical(body).toString());
    String aad = actor + "\n" + path + "\n" + key + "\n" + status + "\n" + digest;
    return tx.execute(
        t -> {
          if (s.accountId() != null) lockAccountSession(s);
          if (req.getAttribute("apiAuthorization") instanceof Runnable authorization) authorization.run();
          db.queryForObject(
              "SELECT pg_advisory_xact_lock(hashtextextended(?,0)) IS NULL",
              Boolean.class,
              actor + path + key);
          var rows =
              db.queryForList(
                  "SELECT * FROM idempotency_records WHERE actor=? AND path=? AND key=? AND"
                      + " expires_at>?",
                  actor,
                  path,
                  key,
                  now());
          if (!rows.isEmpty()) {
            var row = rows.getFirst();
            if (!Integer.valueOf(status).equals(row.get("status")))
              throw new IllegalStateException("Replay status authentication failed");
            if (!digest.equals(row.get("body_hash")))
              throw new ApiException(409, "IDEMPOTENCY_CONFLICT", "相同請求代號不能搭配不同內容。");
            try {
              return new Result(
                  (Integer) row.get("status"),
                  selfReplay(
                      req,
                      redactReplay(
                          json.readTree(replayCipher.decrypt((String) row.get("response"), aad))),
                      s));
            } catch (Exception e) {
              throw new IllegalStateException(e);
            }
          }
          Object result = action.get();
          try {
            db.update(
                "INSERT INTO idempotency_records VALUES(?,?,?,?,?,?,?) ON CONFLICT(actor,path,key)"
                    + " DO UPDATE SET"
                    + " body_hash=excluded.body_hash,status=excluded.status,response=excluded.response,expires_at=excluded.expires_at",
                actor,
                path,
                key,
                digest,
                status,
                replayCipher.encrypt(json.writeValueAsString(result), aad),
                java.sql.Timestamp.from(clock.instant().plus(Duration.ofHours(24))));
          } catch (com.fasterxml.jackson.core.JsonProcessingException e) {
            throw new IllegalStateException(e);
          }
          return new Result(status, result);
        });
  }

  Object selfReplay(HttpServletRequest req, JsonNode original, SessionService.Session session) {
    if (Set.of("/api/v1/me/contact-changes", "/api/v1/me/account-code-changes")
        .contains(req.getRequestURI())) return me(session);
    if (Set.of("/api/v1/me/mfa/enrollments/confirm", "/api/v1/sessions/current/mfa-verifications").contains(req.getRequestURI())) return mfaStatus(session);
    return original;
  }

  Map<String,Object> mfaStatus(SessionService.Session session) {
    var a=one("SELECT totp_secret_ciphertext,totp_pending_expires_at FROM accounts WHERE id=?",session.accountId());
    boolean enabled=a.get("totp_secret_ciphertext")!=null;
    boolean authenticated=enabled && db.queryForObject("SELECT count(*) FROM api_sessions WHERE token_hash=? AND mfa_verified_at>?",Integer.class,session.hash(),java.sql.Timestamp.from(clock.instant().minus(Duration.ofMinutes(15))))==1;
    return map("enabled",enabled,"authenticated",authenticated,"pendingExpiresAt",a.get("totp_pending_expires_at")==null?null:((java.sql.Timestamp)a.get("totp_pending_expires_at")).toInstant().toString());
  }

  Map<String, Object> lockAccountSession(SessionService.Session session) {
    var account = one("SELECT * FROM accounts WHERE id=? FOR UPDATE", session.accountId());
    if (!"active".equals(account.get("status"))
        || db.queryForObject(
                "SELECT count(*) FROM api_sessions WHERE token_hash=? AND account_id=? AND"
                    + " created_at>? AND last_seen>?",
                Integer.class,
                session.hash(),
                session.accountId(),
                java.sql.Timestamp.from(clock.instant().minus(Duration.ofHours(12))),
                java.sql.Timestamp.from(clock.instant().minus(Duration.ofMinutes(30))))
            != 1) throw ApiException.auth();
    return account;
  }

  JsonNode canonical(JsonNode node) {
    if (node.isObject()) {
      var result = json.createObjectNode();
      var keys = new ArrayList<String>();
      node.fieldNames().forEachRemaining(keys::add);
      Collections.sort(keys);
      for (var key : keys) result.set(key, canonical(node.get(key)));
      return result;
    }
    if (node.isArray()) {
      var result = json.createArrayNode();
      node.forEach(item -> result.add(canonical(item)));
      return result;
    }
    return node;
  }

  JsonNode redactReplay(JsonNode body) {
    if (body.has("applicant") && body.path("applicant").isObject()) {
      var applicant = (com.fasterxml.jackson.databind.node.ObjectNode) body.path("applicant");
      var rows =
          db.queryForList(
              "SELECT phone_visible,email_visible FROM members WHERE id=?",
              UUID.fromString(applicant.path("id").asText()));
      if (rows.isEmpty() || !Boolean.TRUE.equals(rows.getFirst().get("phone_visible")))
        applicant.remove("phone");
      if (rows.isEmpty() || !Boolean.TRUE.equals(rows.getFirst().get("email_visible")))
        applicant.remove("email");
    }
    if (body.has("application")) redactReplay(body.path("application"));
    return body;
  }

  String hmac(String text) {
    try {
      Mac mac = Mac.getInstance("HmacSHA256");
      mac.init(new SecretKeySpec(idemSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
      return HexFormat.of().formatHex(mac.doFinal(text.getBytes(StandardCharsets.UTF_8)));
    } catch (Exception e) {
      throw new IllegalStateException(e);
    }
  }

  String password(JsonNode b) {
    if (!b.has("password") || !b.get("password").isTextual()) throw ApiException.bad();
    String p = b.get("password").asText();
    int length = p.codePointCount(0, p.length());
    if (length < 12 || length > 128) throw ApiException.bad();
    if (commonPasswords.contains(p.toLowerCase(Locale.ROOT))) throw ApiException.bad();
    return p;
  }

  String phone(JsonNode b) {
    if (!b.has("phone") || b.get("phone").isNull()) return null;
    String raw = text(b, "phone", 8, 16);
    if (!raw.matches("\\+[1-9][0-9]{6,14}")) throw ApiException.bad();
    try {
      var util = PhoneNumberUtil.getInstance();
      var parsed = util.parse(raw, "ZZ");
      if (!util.isValidNumber(parsed)) throw ApiException.bad();
      return util.format(parsed, PhoneNumberUtil.PhoneNumberFormat.E164);
    } catch (com.google.i18n.phonenumbers.NumberParseException e) {
      throw ApiException.bad();
    }
  }

  void rate(String bucket, int max, Duration window, boolean increment) {
    var rateTx = new TransactionTemplate(tx.getTransactionManager());
    rateTx.setPropagationBehavior(
        org.springframework.transaction.TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    rateTx.executeWithoutResult(
        t -> {
          db.update("INSERT INTO rate_limits VALUES(?,0,?) ON CONFLICT DO NOTHING", bucket, now());
          var row = one("SELECT * FROM rate_limits WHERE bucket=? FOR UPDATE", bucket);
          boolean expired =
              !((java.sql.Timestamp) row.get("window_start"))
                  .toInstant()
                  .plus(window)
                  .isAfter(clock.instant());
          if (expired) {
            db.update(
                "UPDATE rate_limits SET failures=0,window_start=? WHERE bucket=?", now(), bucket);
          } else if ((Integer) row.get("failures") >= max)
            throw new ApiException(429, "RATE_LIMITED", "嘗試過於頻繁，請稍後再試。");
          if (increment)
            db.update("UPDATE rate_limits SET failures=failures+1 WHERE bucket=?", bucket);
        });
  }

  Object register(JsonNode b, HttpServletRequest req) {
    fields(b, "name", "callName", "email", "password", "phone");
    var s = (SessionService.Session) req.getAttribute("session");
    if (s.accountId() != null) throw new ApiException(403, "FORBIDDEN", "請先登出。");
    String name = text(b, "name", 1, 100),
        call = text(b, "callName", 1, 100),
        email = text(b, "email", 3, 254),
        p = password(b),
        phone = phone(b);
    if (!email.matches("[^\\s@]+@[^\\s@]+\\.[^\\s@]+")) throw ApiException.bad();
    rate("register:" + hmac(req.getRemoteAddr()), 10, Duration.ofMinutes(15), true);
    if (db.queryForObject(
            "SELECT count(*) FROM accounts WHERE email_key=? OR phone=?",
            Integer.class,
            email.toLowerCase(Locale.ROOT),
            phone)
        > 0) throw new ApiException(409, "IDENTIFIER_UNAVAILABLE", "此識別值無法使用。");
    UUID id = UUID.randomUUID();
    String code;
    do {
      code = "M" + UUID.randomUUID().toString().replace("-", "").substring(0, 15);
    } while (db.queryForObject(
            "SELECT count(*) FROM account_code_reservations WHERE code_key=?",
            Integer.class,
            code.toLowerCase(Locale.ROOT))
        > 0);
    db.update(
        "INSERT INTO accounts(id,account_code,email,email_key,phone,password_hash)"
            + " VALUES(?,?,?,?,?,?)",
        id,
        code,
        email,
        email.toLowerCase(Locale.ROOT),
        phone,
        passwords.encode(p));
    db.update(
        "INSERT INTO members(id,account_id,name,call_name) VALUES(?,?,?,?)",
        UUID.randomUUID(),
        id,
        name,
        call);
    audit(id, "account.register", id);
    return map("accountId", id, "accountCode", code);
  }

  Object login(JsonNode b, HttpServletRequest req, HttpServletResponse res) {
    fields(b, "identifier", "password", "totp");
    var old = (SessionService.Session) req.getAttribute("session");
    if (old.accountId() != null) throw new ApiException(403, "FORBIDDEN", "請先登出。");
    String identifier = text(b, "identifier", 1, 254).toLowerCase(Locale.ROOT);
    if (!b.has("password")
        || !b.get("password").isTextual()
        || b.get("password").asText().isEmpty()
        || b.get("password").asText().codePointCount(0, b.get("password").asText().length()) > 128)
      throw ApiException.bad();
    if (b.has("totp")
        && (!b.get("totp").isTextual() || !b.get("totp").asText().matches("[0-9]{6}")))
      throw ApiException.bad();
    String ipBucket = "login-ip:" + hmac(req.getRemoteAddr());
    rate(ipBucket, 10, Duration.ofMinutes(15), false);
    List<Map<String, Object>> rows;
    if (identifier.contains("@"))
      rows = db.queryForList("SELECT * FROM accounts WHERE email_key=?", identifier);
    else if (identifier.startsWith("+"))
      rows = db.queryForList("SELECT * FROM accounts WHERE phone=?", identifier);
    else rows = db.queryForList("SELECT * FROM accounts WHERE lower(account_code)=?", identifier);
    String accountBucket =
        "login-id:" + hmac(rows.isEmpty() ? identifier : rows.getFirst().get("id").toString());
    rate(accountBucket, 10, Duration.ofMinutes(15), false);
    String encoded = rows.isEmpty() ? dummyHash : (String) rows.getFirst().get("password_hash");
    boolean ok = passwords.matches(b.get("password").asText(), encoded);
    if (!ok || rows.isEmpty() || !"active".equals(rows.getFirst().get("status"))) {
      rate(accountBucket, 10, Duration.ofMinutes(15), true);
      rate(ipBucket, 10, Duration.ofMinutes(15), true);
      throw ApiException.auth();
    }
    UUID id = (UUID) rows.getFirst().get("id");
    return tx.execute(
        t -> {
          var current = one("SELECT * FROM accounts WHERE id=? FOR UPDATE", id);
          boolean matches =
              identifier.contains("@")
                  ? identifier.equals(current.get("email_key"))
                  : identifier.startsWith("+")
                      ? identifier.equals(current.get("phone"))
                      : identifier.equals(
                          ((String) current.get("account_code")).toLowerCase(Locale.ROOT));
          if (!matches
              || !"active".equals(current.get("status"))
              || !encoded.equals(current.get("password_hash"))) throw ApiException.auth();
          if (db.update(
                  "DELETE FROM api_sessions WHERE token_hash=? AND account_id IS NULL", old.hash())
              != 1) throw ApiException.auth();
          var fresh = sessions.create(res, id);
          return me(fresh);
        });
  }

  void audit(UUID actor, String action, UUID target) {
    db.update(
        "INSERT INTO audit_events VALUES(?,?,?,?,?)",
        UUID.randomUUID(),
        actor,
        action,
        target,
        now());
  }

  Map<String, Object> member(UUID account) {
    return one("SELECT * FROM members WHERE account_id=?", account);
  }

  List<Map<String, Object>> roles(UUID account) {
    return db.queryForList("SELECT r.*,COALESCE(r.scope_id,r.club_id) effective_scope_id FROM role_grants r LEFT JOIN clubs c ON c.id=r.club_id WHERE account_id=? AND revoked_at IS NULL AND starts_at<=? AND ends_at>? AND (scope_type<>'club' OR c.status='active')", account, now(), now()).stream().map(r -> {
      try {
        var permissions=(java.sql.Array)r.get("permissions");
        return map("id",r.get("id"),"accountId",account,"role",r.get("role"),"scope",map("scopeType",r.get("scope_type"),"scopeId",r.get("effective_scope_id")),"permissions",permissions==null?List.of():Arrays.asList((String[])permissions.getArray()),"startsAt",((java.sql.Timestamp)r.get("starts_at")).toInstant().toString(),"endsAt",((java.sql.Timestamp)r.get("ends_at")).toInstant().toString(),"grantedBy",r.get("granted_by"),"reason",r.get("reason"),"version",r.get("version"));
      } catch(java.sql.SQLException e) {throw new IllegalStateException(e);}
    }).toList();
  }

  Object me(SessionService.Session session) {
    var a = one("SELECT * FROM accounts WHERE id=?", session.accountId());
    var m = member(session.accountId());
    var roles = roles(session.accountId());
    return map(
        "account",
        map(
            "id",
            a.get("id"),
            "accountCode",
            a.get("account_code"),
            "codeChangeCount",
            a.get("code_change_count"),
            "email",
            a.get("email"),
            "phone",
            a.get("phone"),
            "status",
            a.get("status"),
            "version",
            a.get("version")),
        "member",
        memberSelf(m),
        "roles",
        roles,
        "availableScopes",
        roles.stream().map(r -> r.get("scope")).distinct().toList(),
        "remainingCodeChanges",
        1 - (Integer) a.get("code_change_count"),
        "csrfToken",
        session.csrf(),
        "mfaAuthenticated",
        mfaStatus(session).get("authenticated"));
  }

  Object memberSelf(Map<String, Object> m) {
    return map(
        "id",
        m.get("id"),
        "accountId",
        m.get("account_id"),
        "name",
        m.get("name"),
        "callName",
        m.get("call_name"),
        "avatarAssetId",
        m.get("avatar_asset_id"),
        "phoneVisible",
        m.get("phone_visible"),
        "emailVisible",
        m.get("email_visible"),
        "version",
        m.get("version"));
  }

  void reviewer(UUID account, UUID club) {
    int count =
        db.queryForObject(
            "SELECT count(*) FROM role_grants r JOIN clubs c ON c.id=r.club_id WHERE account_id=?"
                + " AND club_id=? AND role IN"
                + " ('club_president','club_secretary','club_manager','club_backup') AND"
                + " starts_at<=? AND ends_at>? AND revoked_at IS NULL AND scope_type='club' AND c.status='active'",
            Integer.class,
            account,
            club,
            now(),
            now());
    if (count == 0) throw ApiException.missing();
  }

  Map<String, Object> applicant(Map<String, Object> row) {
    var r =
        one(
            "SELECT m.*,a.email,a.phone FROM members m JOIN accounts a ON a.id=m.account_id WHERE"
                + " m.id=?",
            row.get("member_id"));
    var out = map("id", r.get("id"), "name", r.get("name"), "callName", r.get("call_name"));
    if (Boolean.TRUE.equals(r.get("email_visible"))) out.put("email", r.get("email"));
    if (Boolean.TRUE.equals(r.get("phone_visible")) && r.get("phone") != null)
      out.put("phone", r.get("phone"));
    return out;
  }

  Map<String, Object> joinDto(Map<String, Object> r) {
    return map(
        "id",
        r.get("id"),
        "applicant",
        applicant(r),
        "clubId",
        r.get("club_id"),
        "typeCode",
        r.get("type_code"),
        "message",
        r.get("message"),
        "status",
        r.get("status"),
        "reason",
        r.get("reason"),
        "requestedAt",
        ((java.sql.Timestamp) r.get("requested_at")).toInstant().toString(),
        "expiresAt",
        ((java.sql.Timestamp) r.get("expires_at")).toInstant().toString(),
        "version",
        r.get("version"));
  }

  void expire(UUID member) {
    db.update(
        "UPDATE join_applications SET status='expired',version=version+1 WHERE member_id=? AND"
            + " status='pending' AND expires_at<=?",
        member,
        now());
  }

  Object createJoin(UUID account, JsonNode b) {
    fields(b, "clubId", "message");
    if (b.has("message") && b.get("message").isNull()) throw ApiException.bad();
    UUID club = uuid(b, "clubId");
    String message = optional(b, "message", 2000);
    var m = member(account);
    UUID member = (UUID) m.get("id");
    one("SELECT id FROM members WHERE id=? FOR UPDATE", member);
    expire(member);
    var c = one("SELECT * FROM clubs WHERE id=? AND status='active' FOR SHARE", club);
    String type = (String) c.get("type_code");
    if (!Set.of("ROTARACT", "ROTARY").contains(type)) throw ApiException.bad();
    if (db.queryForObject(
                "SELECT count(*) FROM memberships WHERE member_id=? AND type_code=? AND"
                    + " status='active'",
                Integer.class,
                member,
                type)
            > 0
        || db.queryForObject(
                "SELECT count(*) FROM join_applications WHERE member_id=? AND type_code=? AND"
                    + " status='pending'",
                Integer.class,
                member,
                type)
            > 0) throw ApiException.conflict();
    if (db.queryForObject(
            "SELECT count(*) FROM join_applications WHERE member_id=? AND club_id=? AND"
                + " status='rejected' AND decided_at>?",
            Integer.class,
            member,
            club,
            java.sql.Timestamp.from(clock.instant().minus(Duration.ofHours(24))))
        > 0) throw ApiException.conflict();
    Instant day = today().atStartOfDay(ZoneId.of("Asia/Taipei")).toInstant();
    if (db.queryForObject(
            "SELECT count(*) FROM join_applications WHERE member_id=? AND requested_at>=?",
            Integer.class,
            member,
            java.sql.Timestamp.from(day))
        >= 5) throw new ApiException(429, "RATE_LIMITED", "今日申請次數已達上限。");
    UUID id = UUID.randomUUID();
    db.update(
        "INSERT INTO"
            + " join_applications(id,member_id,club_id,type_code,message,status,requested_at,expires_at)"
            + " VALUES(?,?,?,?,?,'pending',?,?)",
        id,
        member,
        club,
        type,
        message,
        now(),
        java.sql.Timestamp.from(clock.instant().plus(Duration.ofDays(30))));
    audit(account, "join.create", id);
    return joinDto(one("SELECT * FROM join_applications WHERE id=?", id));
  }

  Object decideJoin(UUID account, UUID id, JsonNode b, String action) {
    if (action.equals("approve")) fields(b, "version", "startsOn");
    else if (action.equals("reject")) fields(b, "version", "reason");
    else fields(b, "version");
    int version = version(b);
    var initial = one("SELECT * FROM join_applications WHERE id=?", id);
    if (action.equals("withdraw")) {
      if (!member(account).get("id").equals(initial.get("member_id"))) throw ApiException.missing();
    } else reviewer(account, (UUID) initial.get("club_id"));
    one("SELECT id FROM members WHERE id=? FOR UPDATE", initial.get("member_id"));
    var r = one("SELECT * FROM join_applications WHERE id=? FOR UPDATE", id);
    if ((Integer) r.get("version") != version)
      throw new ApiException(409, "VERSION_CONFLICT", "資料已更新，請重新載入。");
    if (!"pending".equals(r.get("status"))
        || !((java.sql.Timestamp) r.get("expires_at")).toInstant().isAfter(clock.instant()))
      throw ApiException.conflict();
    var c =
        one(
            "SELECT c.*,d.name district_name FROM clubs c JOIN districts d ON d.id=c.district_id"
                + " WHERE c.id=? AND c.status='active' FOR SHARE OF c",
            r.get("club_id"));
    UUID membership = null;
    String reason = null;
    if (action.equals("approve")) {
      LocalDate starts = date(b, "startsOn");
      if (starts.isAfter(today())) throw ApiException.bad();
      if (db.queryForObject(
              "SELECT count(*) FROM memberships WHERE member_id=? AND type_code=? AND"
                  + " status<>'void' AND (ends_on IS NULL OR ends_on>?)",
              Integer.class,
              r.get("member_id"),
              r.get("type_code"),
              starts)
          > 0) throw ApiException.conflict();
      var m = one("SELECT * FROM members WHERE id=?", r.get("member_id"));
      membership = UUID.randomUUID();
      db.update(
          "INSERT INTO"
              + " memberships(id,member_id,club_id,type_code,status,starts_on,name_snapshot,call_name_snapshot,club_name_snapshot,district_name_snapshot,confirmed_year)"
              + " VALUES(?,?,?,?,'active',?,?,?,?,?,?)",
          membership,
          m.get("id"),
          c.get("id"),
          c.get("type_code"),
          starts,
          m.get("name"),
          m.get("call_name"),
          c.get("name"),
          c.get("district_name"),
          yearStart());
    } else if (action.equals("reject")) reason = text(b, "reason", 1, 1000);
    String state =
        switch (action) {
          case "approve" -> "approved";
          case "reject" -> "rejected";
          default -> "withdrawn";
        };
    db.update(
        "UPDATE join_applications SET status=?,reason=?,decided_at=?,version=version+1 WHERE id=?",
        state,
        reason,
        now(),
        id);
    audit(account, "join." + action, id);
    Object application = joinDto(one("SELECT * FROM join_applications WHERE id=?", id));
    return membership == null
        ? application
        : map(
            "application",
            application,
            "membership",
            membershipDto(one("SELECT * FROM memberships WHERE id=?", membership)));
  }

  int yearStart() {
    LocalDate d = today();
    return d.getMonthValue() >= 7 ? d.getYear() : d.getYear() - 1;
  }

  String annual(Map<String, Object> r) {
    if (!"active".equals(r.get("status"))) return "unconfirmed";
    if (Integer.valueOf(yearStart()).equals(r.get("annual_unconfirmed_year"))) return "unconfirmed";
    int y = (Integer) r.get("confirmed_year");
    return y == yearStart()
        ? "confirmed"
        : y == yearStart() - 1 && today().getMonthValue() == 7 ? "grace" : "unconfirmed";
  }

  Object membershipDto(Map<String, Object> r) {
    return map(
        "id",
        r.get("id"),
        "memberId",
        r.get("member_id"),
        "clubId",
        r.get("club_id"),
        "typeCode",
        r.get("type_code"),
        "status",
        r.get("status"),
        "startsOn",
        r.get("starts_on").toString(),
        "endsOn",
        r.get("ends_on") == null ? null : r.get("ends_on").toString(),
        "datePrecision",
        r.getOrDefault("date_precision", "day"),
        "endReason",
        r.get("end_reason"),
        "nameSnapshot",
        r.get("name_snapshot"),
        "callNameSnapshot",
        r.get("call_name_snapshot"),
        "clubNameSnapshot",
        r.get("club_name_snapshot"),
        "districtNameSnapshot",
        r.get("district_name_snapshot"),
        "annualStatus",
        annual(r),
        "visibility",
        r.getOrDefault("visibility", "hidden"),
        "contentVersion",
        r.getOrDefault("content_version", 0),
        "visibilityVersion",
        r.getOrDefault("visibility_version", 0),
        "version",
        r.get("version"));
  }
}
