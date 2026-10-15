package org.xkrotaract.api;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.servlet.http.*;
import java.util.*;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
class ApiController {
  final CoreService core;
  final SessionService sessions;
  final Queries queries;
  final AccountService accounts;

  ApiController(
      CoreService core, SessionService sessions, Queries queries, AccountService accounts) {
    this.core = core;
    this.sessions = sessions;
    this.queries = queries;
    this.accounts = accounts;
  }

  @GetMapping("/csrf-token")
  Object csrf(HttpServletRequest req, HttpServletResponse res) {
    var s = (SessionService.Session) req.getAttribute("session");
    if (s == null) s = sessions.create(res, null);
    return Map.of("csrfToken", s.csrf());
  }

  @PostMapping("/accounts")
  ResponseEntity<?> register(@RequestBody JsonNode b, HttpServletRequest req) {
    return result(core.idempotent(req, b, 201, () -> core.register(b, req)));
  }

  @PostMapping("/sessions")
  Object login(@RequestBody JsonNode b, HttpServletRequest req, HttpServletResponse res) {
    return core.login(b, req, res);
  }

  @DeleteMapping("/sessions/current")
  ResponseEntity<?> logout(HttpServletRequest req, HttpServletResponse res) {
    var s = sessions.require(req);
    core.db.update("DELETE FROM api_sessions WHERE token_hash=?", s.hash());
    sessions.cookie(res, "");
    return ResponseEntity.noContent().build();
  }

  @GetMapping("/me")
  Object me(HttpServletRequest req) {
    return core.me(sessions.require(req));
  }

  @PatchMapping("/me/profile")
  Object profile(@RequestBody JsonNode body, HttpServletRequest req) {
    return accounts.profile(body, req, false);
  }

  @PatchMapping("/me/privacy")
  Object privacy(@RequestBody JsonNode body, HttpServletRequest req) {
    return accounts.profile(body, req, true);
  }

  @PostMapping("/me/contact-changes")
  ResponseEntity<?> contact(
      @RequestBody JsonNode body, HttpServletRequest req, HttpServletResponse res) {
    sessions.require(req);
    var result = core.idempotent(req, body, 200, () -> accounts.contact(body, req));
    String token = (String) req.getAttribute("rotatedSessionToken");
    if (token != null) sessions.cookie(res, token);
    return result(result);
  }

  @PostMapping("/me/account-code-changes")
  ResponseEntity<?> code(@RequestBody JsonNode body, HttpServletRequest req) {
    sessions.require(req);
    return result(core.idempotent(req, body, 200, () -> accounts.code(body, req)));
  }

  @GetMapping("/clubs")
  Object clubs(HttpServletRequest req, @RequestParam Map<String, String> q) {
    sessions.require(req);
    return queries.clubs(q);
  }

  @PostMapping("/join-applications")
  ResponseEntity<?> create(@RequestBody JsonNode b, HttpServletRequest req) {
    UUID account = sessions.require(req).accountId();
    return result(core.idempotent(req, b, 201, () -> core.createJoin(account, b)));
  }

  @GetMapping("/join-applications")
  Object joins(HttpServletRequest req, @RequestParam Map<String, String> q) {
    return queries.joins(sessions.require(req).accountId(), q);
  }

  @PostMapping("/join-applications/{id}/approve")
  ResponseEntity<?> approve(
      @PathVariable UUID id, @RequestBody JsonNode b, HttpServletRequest req) {
    return decide(id, b, req, "approve");
  }

  @PostMapping("/join-applications/{id}/reject")
  ResponseEntity<?> reject(@PathVariable UUID id, @RequestBody JsonNode b, HttpServletRequest req) {
    return decide(id, b, req, "reject");
  }

  @PostMapping("/join-applications/{id}/withdraw")
  ResponseEntity<?> withdraw(
      @PathVariable UUID id, @RequestBody JsonNode b, HttpServletRequest req) {
    return decide(id, b, req, "withdraw");
  }

  ResponseEntity<?> decide(UUID id, JsonNode b, HttpServletRequest req, String action) {
    UUID actor = sessions.require(req).accountId();
    var resource = core.one("SELECT * FROM join_applications WHERE id=?", id);
    if (action.equals("withdraw")) {
      if (!core.member(actor).get("id").equals(resource.get("member_id")))
        throw ApiException.missing();
    } else core.reviewer(actor, (UUID) resource.get("club_id"));
    return result(core.idempotent(req, b, 200, () -> core.decideJoin(actor, id, b, action)));
  }

  @GetMapping("/members")
  Object members(HttpServletRequest req, @RequestParam Map<String, String> q) {
    sessions.require(req);
    return queries.members(q);
  }

  @GetMapping("/members/{id}")
  Object detail(@PathVariable UUID id, HttpServletRequest req) {
    return queries.detail(sessions.require(req).accountId(), id);
  }

  ResponseEntity<?> result(CoreService.Result r) {
    return ResponseEntity.status(r.status()).body(r.body());
  }
}
