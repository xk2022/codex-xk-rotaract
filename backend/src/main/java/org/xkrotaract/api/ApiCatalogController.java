package org.xkrotaract.api;

import java.io.IOException;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
class ApiCatalogController {
  final CoreService core;
  ApiCatalogController(CoreService core) {this.core=core;}
  @GetMapping(value="/openapi",produces=MediaType.APPLICATION_JSON_VALUE)
  byte[] contract() throws IOException {try(var in=new ClassPathResource("api/openapi.json").getInputStream()){return in.readAllBytes();}}
  @GetMapping("/health")
  Object health() {core.db.queryForObject("SELECT 1",Integer.class);return java.util.Map.of("status","up");}
}
