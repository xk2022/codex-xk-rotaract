package org.xkrotaract.api;

import static org.junit.jupiter.api.Assertions.*;
import com.fasterxml.jackson.databind.*;
import java.util.*;
import java.util.regex.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.*;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.io.ClassPathResource;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;

/** The published contract must cover real Spring mappings in both directions. */
@SpringBootTest
@org.springframework.test.context.ActiveProfiles("test")
class ApiRouteCoverageIntegrationTest {
  @Autowired @Qualifier("requestMappingHandlerMapping") RequestMappingHandlerMapping mappings;
  @Autowired ObjectMapper json;
  @Test void contractAndRegisteredResourceOperationsHaveExactCoverage()throws Exception {
    var expected=new TreeSet<String>();
    JsonNode document;
    try(var in=new ClassPathResource("api/openapi.json").getInputStream()){document=json.readTree(in);}
    document.path("paths").properties().forEach(e -> e.getValue().properties().forEach(m -> {
      if(Set.of("get","post","put","patch","delete").contains(m.getKey()))expected.add(m.getKey().toUpperCase(Locale.ROOT)+" "+normalize(e.getKey()));
    }));
    var actual=new TreeSet<String>();
    mappings.getHandlerMethods().forEach((mapping,handler)->{
      for(String path:mapping.getPatternValues()) {
        if(!path.startsWith("/api/v1/") || path.equals("/api/v1/openapi"))continue;
        for(String expanded:expand(path.substring("/api/v1".length())))for(var method:mapping.getMethodsCondition().getMethods())actual.add(method.name()+" "+normalize(expanded));
      }
    });
    assertEquals(expected,actual,"Missing contract or missing real backend route");
  }
  static String normalize(String path){return path.replaceAll("\\{[^}]+}","{}");}
  static List<String> expand(String path){
    Matcher m=Pattern.compile("\\{[^}:]+:([^}]+)}").matcher(path);
    if(!m.find())return List.of(path);
    var paths=new ArrayList<String>();for(String value:m.group(1).split("\\|"))paths.addAll(expand(path.substring(0,m.start())+value+path.substring(m.end())));return paths;
  }
}
