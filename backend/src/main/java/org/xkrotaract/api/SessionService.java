package org.xkrotaract.api;

import jakarta.servlet.http.*;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.time.*;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
class SessionService {
  static final String COOKIE = "__Host-session";
  final JdbcTemplate db;
  final Clock clock;
  final String origin;

  SessionService(JdbcTemplate db, Clock clock, @Value("${app.allowed-origin}") String origin) {
    this.db = db;
    this.clock = clock;
    this.origin = origin;
  }

  static String random() {
    byte[] b = new byte[32];
    new SecureRandom().nextBytes(b);
    return Base64.getUrlEncoder().withoutPadding().encodeToString(b);
  }

  static String hash(String v) {
    try {
      return HexFormat.of()
          .formatHex(
              MessageDigest.getInstance("SHA-256").digest(v.getBytes(StandardCharsets.UTF_8)));
    } catch (Exception e) {
      throw new IllegalStateException(e);
    }
  }

  record Session(String hash, UUID id, UUID accountId, String csrf) {}

  Session lookup(HttpServletRequest req) {
    String token = null;
    if (req.getCookies() != null)
      for (Cookie c : req.getCookies()) if (COOKIE.equals(c.getName())) token = c.getValue();
    if (token == null || token.length() != 43) return null;
    var rows =
        db.queryForList(
            "SELECT s.*,a.status account_status FROM api_sessions s LEFT JOIN accounts a ON"
                + " a.id=s.account_id WHERE token_hash=?",
            hash(token));
    if (rows.isEmpty()) return null;
    var row = rows.getFirst();
    Instant now = clock.instant();
    if (((java.sql.Timestamp) row.get("created_at"))
                .toInstant()
                .plus(Duration.ofHours(12))
                .isAfter(now)
            == false
        || ((java.sql.Timestamp) row.get("last_seen"))
                .toInstant()
                .plus(Duration.ofMinutes(30))
                .isAfter(now)
            == false
        || (row.get("account_id") != null && !"active".equals(row.get("account_status")))) {
      db.update("DELETE FROM api_sessions WHERE token_hash=?", hash(token));
      return null;
    }
    db.update(
        "UPDATE api_sessions SET last_seen=? WHERE token_hash=?",
        java.sql.Timestamp.from(now),
        hash(token));
    return new Session(
        hash(token),
        (UUID) row.get("id"),
        (UUID) row.get("account_id"),
        (String) row.get("csrf_token"));
  }

  Session create(HttpServletResponse res, UUID accountId) {
    String token = random(), csrf = random();
    UUID id = UUID.randomUUID();
    var now = java.sql.Timestamp.from(clock.instant());
    db.update(
        "INSERT INTO api_sessions VALUES(?,?,?,?,?,?)", hash(token), id, accountId, csrf, now, now);
    cookie(res, token);
    return new Session(hash(token), id, accountId, csrf);
  }

  void cookie(HttpServletResponse res, String token) {
    res.addHeader(
        "Set-Cookie",
        COOKIE
            + "="
            + token
            + "; Path=/; Secure; HttpOnly; SameSite=Lax"
            + (token.isEmpty() ? "; Max-Age=0" : ""));
  }

  Session require(HttpServletRequest r) {
    Session s = (Session) r.getAttribute("session");
    if (s == null || s.accountId() == null) throw ApiException.auth();
    return s;
  }

  void csrf(HttpServletRequest req, Session session) {
    String supplied = req.getHeader("X-CSRF-Token");
    if (!origin.equals(req.getHeader("Origin"))
        || session == null
        || supplied == null
        || !MessageDigest.isEqual(
            session.csrf().getBytes(StandardCharsets.UTF_8),
            supplied.getBytes(StandardCharsets.UTF_8)))
      throw new ApiException(403, "FORBIDDEN", "請重新取得驗證資訊後再試。");
  }
}
