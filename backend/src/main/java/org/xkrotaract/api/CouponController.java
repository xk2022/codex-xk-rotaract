package org.xkrotaract.api;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.servlet.http.HttpServletRequest;
import java.util.*;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
class CouponController {
  final CouponService coupons;
  final ApiSupport support;
  final SessionService sessions;

  CouponController(CouponService coupons, ApiSupport support, SessionService sessions) {
    this.coupons = coupons;
    this.support = support;
    this.sessions = sessions;
  }

  @GetMapping("/coupon-offers")
  Object list(HttpServletRequest req, @RequestParam Map<String,String> q) {
    return coupons.list(sessions.require(req).accountId(), q);
  }

  @GetMapping("/coupon-offers/{id}")
  Object detail(HttpServletRequest req, @PathVariable UUID id,
      @RequestParam(defaultValue="available") String scope) {
    return coupons.detail(sessions.require(req).accountId(), id, scope);
  }

  @PostMapping("/coupon-offers")
  ResponseEntity<?> create(HttpServletRequest req, @RequestBody JsonNode body) {
    UUID actor = sessions.require(req).accountId();
    return support.mutation(req, body, 201, () -> coupons.requireCreate(actor, body), () -> coupons.create(actor, body));
  }

  @PatchMapping("/coupon-offers/{id}")
  ResponseEntity<?> update(HttpServletRequest req, @PathVariable UUID id, @RequestBody JsonNode body) {
    UUID actor = sessions.require(req).accountId();
    return support.mutation(req, body, 200, () -> coupons.requireOwner(actor, id), () -> coupons.update(actor, id, body));
  }

  @PostMapping("/coupon-offers/{id}/{action:submit|approve|reject|suspend}")
  ResponseEntity<?> action(HttpServletRequest req, @PathVariable UUID id,
      @PathVariable String action, @RequestBody JsonNode body) {
    UUID actor = sessions.require(req).accountId();
    return support.mutation(req, body, 200, () -> coupons.requireAction(actor, id, action), () -> coupons.action(actor, id, action, body));
  }

  @PostMapping("/coupon-offers/{id}/claim")
  ResponseEntity<?> claim(HttpServletRequest req, @PathVariable UUID id, @RequestBody(required=false) JsonNode body) {
    UUID actor = sessions.require(req).accountId();
    JsonNode payload = body == null ? coupons.core.json.createObjectNode() : body;
    return support.mutation(req, payload, 201, () -> sessions.require(req),
        () -> coupons.claim(actor, id, req.getHeader("Idempotency-Key"), payload));
  }

  @GetMapping("/me/coupons")
  Object wallet(HttpServletRequest req, @RequestParam Map<String,String> q) {
    return coupons.wallet(sessions.require(req).accountId(), q);
  }

  @GetMapping("/me/coupons/{id}")
  Object myClaim(HttpServletRequest req, @PathVariable UUID id) {
    return coupons.myClaim(sessions.require(req).accountId(), id);
  }

  @PostMapping("/me/coupons/{id}/void")
  ResponseEntity<?> voidClaim(HttpServletRequest req, @PathVariable UUID id, @RequestBody JsonNode body) {
    UUID actor = sessions.require(req).accountId();
    return support.mutation(req, body, 200, () -> coupons.requireMyClaim(actor, id), () -> coupons.voidClaim(actor, id, body));
  }

  @PostMapping("/companies/{companyId}/coupon-redemptions/lookup")
  Object lookup(HttpServletRequest req, @PathVariable UUID companyId, @RequestBody JsonNode body) {
    return coupons.lookup(sessions.require(req).accountId(), companyId, body);
  }

  @PostMapping("/companies/{companyId}/coupon-redemptions/confirm")
  ResponseEntity<?> redeem(HttpServletRequest req, @PathVariable UUID companyId, @RequestBody JsonNode body) {
    UUID actor = sessions.require(req).accountId();
    return support.mutation(req, body, 200, () -> coupons.requireCompanyOwner(actor, companyId), () -> coupons.redeem(actor, companyId, body));
  }

}
