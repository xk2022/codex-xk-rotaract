package org.xkrotaract.api;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.servlet.http.HttpServletRequest;
import java.util.*;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
class EventController {
  final EventService events;
  final CoreService core;
  final SessionService sessions;
  final ApiSupport support;
  EventController(EventService events, CoreService core, SessionService sessions, ApiSupport support) {
    this.events=events; this.core=core; this.sessions=sessions; this.support=support;
  }
  @GetMapping("/public/events") Object publicEvents(@RequestParam Map<String,String> q) { return events.list(null,q,true); }
  @GetMapping("/public/calendar") Object calendar(@RequestParam Map<String,String> q) { return events.calendar(q); }
  @GetMapping("/public/events/{id}") Object publicEvent(@PathVariable UUID id) { return events.detail(null,id,true); }
  @GetMapping("/public/clubs") Object clubs(@RequestParam Map<String,String> q) { return events.clubs(q); }
  @GetMapping("/public/clubs/{id}") Object club(@PathVariable UUID id) { return events.club(id); }
  @GetMapping("/events") Object list(HttpServletRequest req,@RequestParam Map<String,String> q) { return events.list(sessions.require(req).accountId(),q,false); }
  @GetMapping("/events/{id}") Object detail(HttpServletRequest req,@PathVariable UUID id) { return events.detail(sessions.require(req).accountId(),id,false); }
  @PostMapping("/events") ResponseEntity<?> create(HttpServletRequest req,@RequestBody JsonNode body) {
    UUID actor=sessions.require(req).accountId();
    return support.mutation(req,body,201,()->events.authorizeCreate(actor,body),()->events.create(actor,body));
  }
  @PatchMapping("/events/{id}") ResponseEntity<?> update(HttpServletRequest req,@PathVariable UUID id,@RequestBody JsonNode body) {
    UUID actor=sessions.require(req).accountId(); events.requireEdit(actor,id);
    return support.mutation(req,body,200,()->events.requireEdit(actor,id),()->events.update(actor,id,body));
  }
  @PostMapping("/events/{id}/{action:publish|cancel|archive|copy}") ResponseEntity<?> action(HttpServletRequest req,@PathVariable UUID id,@PathVariable String action,@RequestBody JsonNode body) {
    UUID actor=sessions.require(req).accountId(); events.requireManage(actor,id,!action.equals("copy"));
    return support.mutation(req,body,action.equals("copy")?201:200,()->events.requireManage(actor,id,!action.equals("copy")),()->events.action(actor,id,action,body));
  }
  ResponseEntity<?> result(CoreService.Result r) { return ResponseEntity.status(r.status()).body(r.body()); }
}
