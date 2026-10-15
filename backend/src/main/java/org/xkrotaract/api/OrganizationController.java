package org.xkrotaract.api;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
class OrganizationController {
  final OrganizationService organizations;
  final CoreService core;
  final SessionService sessions;
  final ApiSupport support;

  OrganizationController(OrganizationService organizations, CoreService core, SessionService sessions,ApiSupport support) {
    this.organizations = organizations;
    this.core = core;
    this.sessions = sessions;
    this.support=support;
  }

  @GetMapping("/districts")
  Object districts(@RequestParam Map<String,String> q) {
    return organizations.districts(q);
  }

  @GetMapping("/organization-overview")
  Object overview(HttpServletRequest req, @RequestParam Map<String,String> q) {
    return organizations.overview(sessions.require(req).accountId(), q);
  }

  @GetMapping("/clubs/{id}")
  Object club(@PathVariable UUID id, @RequestParam(defaultValue="public") String view,
      HttpServletRequest req) {
    return organizations.club(id, view, "managed".equals(view) ? sessions.require(req).accountId() : null);
  }

  @PostMapping("/clubs")
  ResponseEntity<?> create(@RequestBody JsonNode body, HttpServletRequest req) {
    UUID actor = sessions.require(req).accountId();
    return support.mutation(req,body,201,()->organizations.requireDistrict(actor,Input.uuid(body,"districtId")),()->organizations.create(actor,body));
  }

  @PatchMapping("/clubs/{id}")
  Object patch(@PathVariable UUID id, @RequestBody JsonNode body, HttpServletRequest req) {
    var session=sessions.require(req);
    return core.tx.execute(t -> {
      core.lockAccountSession(session);
      return organizations.patch(session.accountId(),id,body);
    });
  }

  @PostMapping("/clubs/{id}/disable")
  ResponseEntity<?> disable(@PathVariable UUID id, @RequestBody JsonNode body, HttpServletRequest req) {
    return status(id,body,req,false);
  }

  @PostMapping("/clubs/{id}/restore")
  ResponseEntity<?> restore(@PathVariable UUID id, @RequestBody JsonNode body, HttpServletRequest req) {
    return status(id,body,req,true);
  }

  ResponseEntity<?> status(UUID id, JsonNode body, HttpServletRequest req, boolean active) {
    UUID actor=sessions.require(req).accountId();
    return support.mutation(req,body,200,()->organizations.requireDistrict(actor,(UUID)organizations.clubRow(id,false).get("district_id")),()->organizations.status(actor,id,body,active));
  }

  @PostMapping("/club-move-requests")
  ResponseEntity<?> move(@RequestBody JsonNode body,HttpServletRequest req) {
    UUID actor=sessions.require(req).accountId();
    return support.mutation(req,body,201,()->organizations.requireDistrict(actor,(UUID)organizations.clubRow(Input.uuid(body,"clubId"),false).get("district_id")),()->organizations.requestMove(actor,body));
  }

  @GetMapping("/club-move-requests")
  Object moves(HttpServletRequest req,@RequestParam Map<String,String> q) {
    return organizations.moves(sessions.require(req).accountId(),q);
  }

  @PostMapping("/club-move-requests/{id}/approve")
  ResponseEntity<?> approve(@PathVariable UUID id,@RequestBody JsonNode body,HttpServletRequest req) {
    UUID actor=sessions.require(req).accountId();
    return support.mutation(req,body,200,()->organizations.authorizeMove(actor,id,body,false),()->organizations.approveMove(actor,id,body));
  }

  @PostMapping("/club-move-requests/{id}/execute")
  ResponseEntity<?> execute(@PathVariable UUID id,@RequestBody JsonNode body,HttpServletRequest req) {
    UUID actor=sessions.require(req).accountId();
    var result=support.mutation(req,body,200,()->organizations.authorizeMove(actor,id,body,true),()->{
      try { return organizations.executeMove(actor,id,body); }
      catch(OrganizationService.MoveInvalidated e) {
        return Input.map("_workflowConflict",true,"code","STATE_CONFLICT","message","轉區核准或社團版本已失效；舊案件已結束，請重新提出。","fieldErrors",java.util.List.of(),"requestId",UUID.randomUUID().toString());
      }
    });
    if(result.getBody() instanceof Map<?,?> m && Boolean.TRUE.equals(m.get("_workflowConflict"))) {
      var out=new java.util.LinkedHashMap<>(m);out.remove("_workflowConflict");return ResponseEntity.status(409).body(out);
    }
    if(result.getBody() instanceof JsonNode n && n.path("_workflowConflict").asBoolean()) {
      var out=(com.fasterxml.jackson.databind.node.ObjectNode)n.deepCopy();out.remove("_workflowConflict");return ResponseEntity.status(409).body(out);
    }
    return result;
  }

  @GetMapping("/role-grants")
  Object roles(HttpServletRequest req,@RequestParam Map<String,String> q) {
    return organizations.roles(req,q);
  }

  @PostMapping("/role-grants")
  ResponseEntity<?> grant(@RequestBody JsonNode body,HttpServletRequest req) {
    sessions.require(req);
    return support.mutation(req,body,201,()->organizations.authorizeGrant(body,req),()->organizations.grant(body,req));
  }

  @PostMapping("/role-grants/{id}/revoke")
  ResponseEntity<?> revoke(@PathVariable UUID id,@RequestBody JsonNode body,HttpServletRequest req) {
    sessions.require(req);
    return support.mutation(req,body,200,()->organizations.authorizeRevoke(id,req),()->organizations.revoke(id,body,req));
  }

  ResponseEntity<?> result(CoreService.Result r) {
    return ResponseEntity.status(r.status()).body(r.body());
  }
}
