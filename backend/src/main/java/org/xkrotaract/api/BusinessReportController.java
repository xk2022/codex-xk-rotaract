package org.xkrotaract.api;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.servlet.http.HttpServletRequest;
import java.util.*;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/business-reports")
class BusinessReportController {
  final BusinessReportService reports;
  final ApiSupport access;

  BusinessReportController(BusinessReportService reports,ApiSupport access) {
    this.reports=reports;
    this.access=access;
  }

  @PostMapping
  ResponseEntity<?> create(@RequestBody JsonNode b,HttpServletRequest req) {
    UUID actor=access.actor(req);
    return access.mutation(req,b,201,()->access.memberId(actor),()->reports.create(actor,b));
  }

  @GetMapping
  Object list(@RequestParam Map<String,String> q,HttpServletRequest req) {
    return reports.list(access.actor(req),q);
  }

  @GetMapping("/{id}")
  Object detail(@PathVariable UUID id,HttpServletRequest req) {
    return reports.detail(access.actor(req),id);
  }

  @PostMapping("/{id}/accept")
  ResponseEntity<?> accept(@PathVariable UUID id,@RequestBody JsonNode b,HttpServletRequest req) {
    return decide(id,b,req,false);
  }

  @PostMapping("/{id}/close")
  ResponseEntity<?> close(@PathVariable UUID id,@RequestBody JsonNode b,HttpServletRequest req) {
    return decide(id,b,req,true);
  }

  ResponseEntity<?> decide(UUID id,JsonNode b,HttpServletRequest req,boolean close) {
    UUID actor=access.actor(req);
    return access.mutation(req,b,200,()->reports.requireContent(actor),()->reports.decide(actor,id,b,close));
  }
}
