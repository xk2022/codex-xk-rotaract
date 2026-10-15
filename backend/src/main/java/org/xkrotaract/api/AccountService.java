package org.xkrotaract.api;

import static org.xkrotaract.api.Input.*;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Duration;
import java.util.*;
import org.springframework.stereotype.Service;

/** Self-only account mutations. The account row serializes identifiers and session rotation. */
@Service
class AccountService {
  final CoreService core;
  final SessionService sessions;

  AccountService(CoreService core, SessionService sessions) {
    this.core = core;
    this.sessions = sessions;
  }

  void checkVersion(JsonNode body, Map<String, Object> row) {
    if (version(body) != (Integer) row.get("version"))
      throw new ApiException(409, "VERSION_CONFLICT", "資料已更新，請重新載入後再確認。");
  }

  Object profile(JsonNode body, HttpServletRequest req, boolean privacy) {
    var session = sessions.require(req);
    if (privacy) fields(body, "version", "phoneVisible", "emailVisible");
    else fields(body, "version", "name", "callName", "avatarAssetId");
    if (body.size() < 2) throw ApiException.bad();
    return core.tx.execute(
        t -> {
          core.lockAccountSession(session);
          var member =
              core.one("SELECT * FROM members WHERE account_id=? FOR UPDATE", session.accountId());
          checkVersion(body, member);
          if (privacy) {
            for (String key : List.of("phoneVisible", "emailVisible"))
              if (body.has(key) && !body.get(key).isBoolean()) throw ApiException.bad();
            core.db.update(
                "UPDATE members SET phone_visible=?,email_visible=?,version=version+1 WHERE id=?",
                body.has("phoneVisible")
                    ? body.get("phoneVisible").booleanValue()
                    : member.get("phone_visible"),
                body.has("emailVisible")
                    ? body.get("emailVisible").booleanValue()
                    : member.get("email_visible"),
                member.get("id"));
          } else {
            Object avatar=member.get("avatar_asset_id");
            if (body.has("avatarAssetId")) {
              avatar=null;
              if (!body.get("avatarAssetId").isNull()) {
                UUID id=uuid(body,"avatarAssetId");
                var assets=core.db.queryForList("SELECT * FROM assets WHERE id=? AND owner_account_id=? AND purpose='avatar' AND case_id IS NULL",id,session.accountId());
                if (assets.isEmpty()) throw ApiException.missing();
                avatar=id;
              }
            }
            core.db.update(
                "UPDATE members SET name=?,call_name=?,avatar_asset_id=?,version=version+1 WHERE id=?",
                body.has("name") ? text(body, "name", 1, 100) : member.get("name"),
                body.has("callName") ? text(body, "callName", 1, 100) : member.get("call_name"),
                avatar,
                member.get("id"));
          }
          core.audit(
              session.accountId(),
              privacy ? "member.privacy" : "member.profile",
              (UUID) member.get("id"));
          return core.memberSelf(core.member(session.accountId()));
        });
  }

  void currentPassword(JsonNode body, Map<String, Object> account, HttpServletRequest req) {
    var value = body.get("currentPassword");
    if (value == null
        || !value.isTextual()
        || value.asText().isEmpty()
        || value.asText().codePointCount(0, value.asText().length()) > 128)
      throw ApiException.bad();
    String accountBucket = "verify-account:" + core.hmac(account.get("id").toString());
    String ipBucket = "verify-ip:" + core.hmac(req.getRemoteAddr());
    core.rate(accountBucket, 10, Duration.ofMinutes(15), false);
    core.rate(ipBucket, 10, Duration.ofMinutes(15), false);
    if (!core.passwords.matches(value.asText(), (String) account.get("password_hash"))) {
      core.rate(accountBucket, 10, Duration.ofMinutes(15), true);
      core.rate(ipBucket, 10, Duration.ofMinutes(15), true);
      throw new ApiException(401, "AUTHENTICATION_FAILED", "目前密碼不正確，請重新輸入。");
    }
  }

  Object contact(JsonNode body, HttpServletRequest req) {
    fields(body, "version", "currentPassword", "kind", "newValue");
    var session = sessions.require(req);
    var account = core.lockAccountSession(session);
    checkVersion(body, account);
    currentPassword(body, account, req);
    String kind = text(body, "kind", 1, 10);
    String value = text(body, "newValue", 3, 254);
    if (kind.equals("email")) {
      if (!value.matches("[^\\s@]+@[^\\s@]+\\.[^\\s@]+")) throw ApiException.bad();
      if (value.toLowerCase(Locale.ROOT).equals(account.get("email_key")))
        throw ApiException.conflict();
      core.db.update(
          "UPDATE accounts SET email=?,email_key=?,version=version+1 WHERE id=?",
          value,
          value.toLowerCase(Locale.ROOT),
          session.accountId());
    } else if (kind.equals("phone")) {
      var phoneInput = core.json.createObjectNode().put("phone", value);
      value = core.phone(phoneInput);
      if (value.equals(account.get("phone"))) throw ApiException.conflict();
      core.db.update(
          "UPDATE accounts SET phone=?,version=version+1 WHERE id=?", value, session.accountId());
    } else throw ApiException.bad();
    var authenticatedAt =
        (java.sql.Timestamp)
            core.one("SELECT created_at FROM api_sessions WHERE token_hash=?", session.hash())
                .get("created_at");
    core.db.update("DELETE FROM api_sessions WHERE account_id=?", session.accountId());
    var fresh = sessions.createPending(session.accountId(), authenticatedAt);
    // Publish the cookie only after the outer idempotency transaction commits successfully.
    req.setAttribute("rotatedSessionToken", fresh.token());
    core.audit(session.accountId(), "account.contact." + kind, session.accountId());
    return core.me(fresh.session());
  }

  Object code(JsonNode body, HttpServletRequest req) {
    fields(body, "version", "currentPassword", "newCode");
    var session = sessions.require(req);
    var account = core.lockAccountSession(session);
    checkVersion(body, account);
    currentPassword(body, account, req);
    String code = text(body, "newCode", 6, 20);
    if (!code.matches("[A-Za-z0-9_]{6,20}") || code.matches("[0-9]+")) throw ApiException.bad();
    if ((Integer) account.get("code_change_count") != 0
        || code.equalsIgnoreCase((String) account.get("account_code")))
      throw ApiException.conflict();
    core.db.update(
        "UPDATE accounts SET account_code=?,code_change_count=code_change_count+1,version=version+1"
            + " WHERE id=?",
        code,
        session.accountId());
    core.audit(session.accountId(), "account.code", session.accountId());
    return core.me(session);
  }
}
