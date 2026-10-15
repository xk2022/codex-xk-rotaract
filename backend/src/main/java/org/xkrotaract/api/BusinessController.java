package org.xkrotaract.api;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.servlet.http.HttpServletRequest;
import java.util.*;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
class BusinessController {
  final BusinessService businesses;
  final ApiSupport access;
  final SessionService sessions;

  BusinessController(BusinessService businesses, ApiSupport access, SessionService sessions) {
    this.businesses = businesses;
    this.access = access;
    this.sessions = sessions;
  }

  @GetMapping({"/industries", "/public/industries"})
  Object industries() { return businesses.industries(); }

  @GetMapping({"/public/companies", "/public/businesses"})
  Object publicList(@RequestParam Map<String,String> q) { return businesses.publicList(q, false); }

  @GetMapping({"/public/map/companies", "/public/business-map"})
  Object map(@RequestParam Map<String,String> q) { return businesses.publicList(q, true); }

  @GetMapping({"/public/companies/{id}", "/public/businesses/{id}"})
  Object publicDetail(@PathVariable UUID id) { return businesses.publicDetail(id); }

  @GetMapping("/companies")
  Object list(HttpServletRequest req, @RequestParam Map<String,String> q) {
    return businesses.list(sessions.require(req).accountId(), q, false);
  }

  @GetMapping("/companies/{id}")
  Object detail(HttpServletRequest req, @PathVariable UUID id) {
    return businesses.detail(sessions.require(req).accountId(), id, false);
  }

  @PostMapping("/companies")
  ResponseEntity<?> create(HttpServletRequest req, @RequestBody JsonNode body) {
    UUID actor = sessions.require(req).accountId();
    return access.mutation(req, body, 201, () -> businesses.memberId(actor), () -> businesses.create(actor,body));
  }

  @PatchMapping("/companies/{id}")
  ResponseEntity<?> update(HttpServletRequest req, @PathVariable UUID id, @RequestBody JsonNode body) {
    UUID actor = sessions.require(req).accountId();
    return access.mutation(req,body,200,() -> businesses.requireMaintain(actor,id),() -> businesses.update(actor,id,body));
  }

  @PostMapping("/companies/{id}/publish")
  ResponseEntity<?> publish(HttpServletRequest req, @PathVariable UUID id, @RequestBody JsonNode body) {
    UUID actor = sessions.require(req).accountId();
    return access.mutation(req,body,200,() -> businesses.requireMaintain(actor,id),() -> businesses.publish(actor,id,body));
  }

  @GetMapping("/business-review/companies")
  Object reviewList(HttpServletRequest req, @RequestParam Map<String,String> q) {
    return businesses.list(sessions.require(req).accountId(),q,true);
  }

  @GetMapping("/business-review/companies/{id}")
  Object reviewDetail(HttpServletRequest req, @PathVariable UUID id) {
    return businesses.detail(sessions.require(req).accountId(),id,true);
  }

  @PostMapping("/business-review/companies/{id}/{action:reject|suspend}")
  ResponseEntity<?> moderate(HttpServletRequest req, @PathVariable UUID id, @PathVariable String action, @RequestBody JsonNode body) {
    UUID actor = sessions.require(req).accountId();
    return access.mutation(req,body,200,() -> businesses.requireContent(actor),() -> businesses.moderate(actor,id,action,body));
  }

  @GetMapping("/companies/{id}/links")
  Object links(HttpServletRequest req,@PathVariable UUID id) {
    return businesses.links(sessions.require(req).accountId(),id);
  }

  @PostMapping("/companies/{id}/links")
  ResponseEntity<?> invite(HttpServletRequest req,@PathVariable UUID id,@RequestBody JsonNode body) {
    UUID actor = sessions.require(req).accountId();
    return access.mutation(req,body,201,() -> businesses.requireOwner(actor,id),() -> businesses.invite(actor,id,body));
  }

  @GetMapping("/me/company-invitations")
  Object invitations(HttpServletRequest req) { return businesses.invitations(sessions.require(req).accountId()); }

  @PostMapping("/company-invitations/{id}/{action:accept|reject|cancel|revoke}")
  ResponseEntity<?> decide(HttpServletRequest req,@PathVariable UUID id,@PathVariable String action,@RequestBody JsonNode body) {
    UUID actor = sessions.require(req).accountId();
    return access.mutation(req,body,200,() -> businesses.requireInvitationAction(actor,id,action),() -> businesses.decideInvitation(actor,id,action,body));
  }

  @PostMapping("/companies/{id}/links/{linkId}/remove")
  ResponseEntity<?> remove(HttpServletRequest req,@PathVariable UUID id,@PathVariable UUID linkId,@RequestBody JsonNode body) {
    UUID actor = sessions.require(req).accountId();
    return access.mutation(req,body,200,() -> businesses.requireRemove(actor,id,linkId),() -> businesses.removeLink(actor,id,linkId,body));
  }

  @GetMapping("/companies/{id}/exposure-grants")
  Object grants(HttpServletRequest req,@PathVariable UUID id) {
    businesses.requireMaintain(sessions.require(req).accountId(),id);
    return businesses.grants(id);
  }

  @GetMapping("/business-review/companies/{id}/exposure-grants")
  Object reviewGrants(HttpServletRequest req,@PathVariable UUID id) {
    businesses.requireContent(sessions.require(req).accountId());
    businesses.company(id);
    return businesses.grants(id);
  }

  @GetMapping("/me/business-confirmations")
  Object confirmations(HttpServletRequest req) { return businesses.myConfirmations(sessions.require(req).accountId()); }

  @PostMapping("/companies/{id}/confirmations")
  ResponseEntity<?> confirm(HttpServletRequest req,@PathVariable UUID id,@RequestBody JsonNode body) {
    UUID actor = sessions.require(req).accountId();
    return access.mutation(req,body,200,() -> businesses.requireConfirm(actor,id),() -> businesses.confirm(actor,id,body,false));
  }

  @PostMapping("/companies/{id}/confirmations/withdraw")
  ResponseEntity<?> withdraw(HttpServletRequest req,@PathVariable UUID id,@RequestBody JsonNode body) {
    UUID actor = sessions.require(req).accountId();
    return access.mutation(req,body,200,() -> businesses.memberId(actor),() -> businesses.confirm(actor,id,body,true));
  }

}
