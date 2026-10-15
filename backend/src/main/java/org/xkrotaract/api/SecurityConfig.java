package org.xkrotaract.api;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.IOException;
import java.util.*;
import org.springframework.context.annotation.*;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.*;
import org.springframework.security.web.authentication.AnonymousAuthenticationFilter;
import org.springframework.web.filter.OncePerRequestFilter;

@Configuration
class SecurityConfig {
  @Bean
  SecurityFilterChain security(HttpSecurity http, SessionService sessions, ObjectMapper json)
      throws Exception {
    return http.csrf(c -> c.disable())
        .formLogin(c -> c.disable())
        .httpBasic(c -> c.disable())
        .logout(c -> c.disable())
        .requestCache(c -> c.disable())
        .sessionManagement(
            c ->
                c.sessionCreationPolicy(
                    org.springframework.security.config.http.SessionCreationPolicy.STATELESS))
        .authorizeHttpRequests(c -> c.anyRequest().permitAll())
        .addFilterBefore(
            new OncePerRequestFilter() {
              protected void doFilterInternal(
                  HttpServletRequest req, HttpServletResponse res, FilterChain chain)
                  throws ServletException, IOException {
                String requestId = UUID.randomUUID().toString();
                req.setAttribute("requestId", requestId);
                res.setHeader("X-Request-Id", requestId);
                res.setHeader("Cache-Control", "no-store");
                try {
                  if (req.getRequestURI().startsWith("/api/")) {
                    var session = sessions.lookup(req);
                    req.setAttribute("session", session);
                    if (!Set.of("GET", "HEAD", "OPTIONS").contains(req.getMethod()))
                      sessions.csrf(req, session);
                  }
                  chain.doFilter(req, res);
                } catch (ApiException e) {
                  res.setStatus(e.status);
                  res.setContentType("application/json");
                  json.writeValue(
                      res.getOutputStream(),
                      Map.of(
                          "code",
                          e.code,
                          "message",
                          e.getMessage(),
                          "fieldErrors",
                          List.of(),
                          "requestId",
                          requestId));
                } catch (org.springframework.dao.DataAccessException e) {
                  if (res.isCommitted()) throw e;
                  res.setStatus(503);
                  res.setContentType("application/json");
                  json.writeValue(
                      res.getOutputStream(),
                      Map.of(
                          "code",
                          "SERVICE_UNAVAILABLE",
                          "message",
                          "服務暫時無法完成操作。",
                          "fieldErrors",
                          List.of(),
                          "requestId",
                          requestId));
                }
              }
            },
            AnonymousAuthenticationFilter.class)
        .build();
  }
}
