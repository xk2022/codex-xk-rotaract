package org.xkrotaract.api;

import static org.xkrotaract.api.Input.*;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Duration;
import java.util.*;
import java.util.function.Supplier;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

/** Common authorization and mutation boundary; all decisions use current database grants. */
@Service
class ApiSupport {
  final CoreService core;
  ApiSupport(CoreService core) { this.core = core; }

  UUID actor(HttpServletRequest request) { return core.sessions.require(request).accountId(); }
  UUID memberId(UUID account) { return (UUID) core.member(account).get("id"); }

  List<Map<String,Object>> grants(UUID actor) {
    return core.db.queryForList("SELECT r.*,COALESCE(r.scope_id,r.club_id) effective_scope_id FROM role_grants r JOIN accounts a ON a.id=r.account_id LEFT JOIN clubs c ON c.id=r.club_id WHERE r.account_id=? AND a.status='active' AND r.revoked_at IS NULL AND r.starts_at<=? AND r.ends_at>? AND (r.scope_type<>'club' OR c.status='active')",actor,core.now(),core.now());
  }
  boolean clubRole(UUID actor, UUID club, String... roles) {
    if(club==null) return false;
    Set<String> allowed=Set.of(roles);
    return grants(actor).stream().anyMatch(g->"club".equals(g.get("scope_type")) && club.equals(g.get("effective_scope_id")) && allowed.contains(g.get("role")));
  }
  boolean districtRole(UUID actor, UUID district) {
    return district!=null && grants(actor).stream().anyMatch(g->"district_manager".equals(g.get("role")) && "district".equals(g.get("scope_type")) && district.equals(g.get("effective_scope_id")));
  }
  boolean platformRole(UUID actor,String... roles) {
    Set<String> allowed=Set.of(roles);
    return grants(actor).stream().anyMatch(g->allowed.contains(g.get("role")) && ("platform".equals(g.get("scope_type")) || ("content".equals(g.get("scope_type")) && g.get("effective_scope_id")==null && "content_manager".equals(g.get("role")))));
  }
  boolean managesClub(UUID actor,UUID club) {
    if(clubRole(actor,club,"club_president","club_secretary","club_manager","club_backup")) return true;
    var rows=core.db.queryForList("SELECT district_id FROM clubs WHERE id=?",club);
    return !rows.isEmpty() && districtRole(actor,(UUID)rows.getFirst().get("district_id"));
  }
  boolean permission(UUID actor,String permission,UUID club) {
    UUID district=null;
    if(club!=null) {
      var rows=core.db.queryForList("SELECT district_id FROM clubs WHERE id=?",club);
      if(rows.isEmpty()) return false;
      district=(UUID)rows.getFirst().get("district_id");
    }
    for(var g:grants(actor)) {
      try {
        var raw=(java.sql.Array)g.get("permissions");
        if(raw==null || !Arrays.asList((String[])raw.getArray()).contains(permission)) continue;
      } catch(java.sql.SQLException e) { throw new IllegalStateException(e); }
      String scope=(String)g.get("scope_type"), role=(String)g.get("role");
      if("history:override".equals(permission)) {
        if("history_admin".equals(role) && "platform".equals(scope)) return true;
        continue;
      }
      if("history:moderate".equals(permission) && !Set.of("club_president","club_secretary","district_manager","content_manager").contains(role)) continue;
      if("club".equals(scope) && club!=null && club.equals(g.get("effective_scope_id"))) return true;
      if("district".equals(scope) && district!=null && district.equals(g.get("effective_scope_id"))) return true;
      if("content".equals(scope) && "content_manager".equals(role) && club!=null && club.equals(g.get("effective_scope_id"))) return true;
      if("platform".equals(scope) && !"history:moderate".equals(permission)) return true;
    }
    return false;
  }
  void requireClub(UUID actor,UUID club) { if(!managesClub(actor,club)) throw ApiException.missing(); }
  void requirePlatform(UUID actor,String... roles) { if(!platformRole(actor,roles)) throw ApiException.missing(); }
  void requireMfa(HttpServletRequest request) {
    var session=core.sessions.require(request);
    var rows=core.db.queryForList("SELECT s.mfa_verified_at,a.totp_secret_ciphertext FROM api_sessions s JOIN accounts a ON a.id=s.account_id WHERE s.token_hash=? AND a.status='active'",session.hash());
    if(rows.isEmpty() || rows.getFirst().get("totp_secret_ciphertext")==null || rows.getFirst().get("mfa_verified_at")==null || !((java.sql.Timestamp)rows.getFirst().get("mfa_verified_at")).toInstant().plus(Duration.ofMinutes(15)).isAfter(core.clock.instant()))
      throw new ApiException(403,"MFA_REQUIRED","此操作需要本人完成多因素驗證。");
  }
  ResponseEntity<?> mutation(HttpServletRequest request,JsonNode body,int status,Runnable authorize,Supplier<Object> action) {
    authorize.run();
    if ("PATCH".equals(request.getMethod()) && request.getHeader("Idempotency-Key")==null) {
      Object result=core.tx.execute(t -> { core.lockAccountSession(core.sessions.require(request)); authorize.run(); return action.get(); });
      return ResponseEntity.status(status).body(result);
    }
    request.setAttribute("apiAuthorization",authorize);
    var result=core.idempotent(request,body,status,action);
    return ResponseEntity.status(result.status()).body(result.body());
  }
  static Object page(List<?> rows,Map<String,String> q) {
    int page=integer(q.getOrDefault("page","1"),1,Integer.MAX_VALUE),size=integer(q.getOrDefault("pageSize","20"),20,100);
    long from=(long)(page-1)*size;
    var items=from>=rows.size()?List.of():rows.subList((int)from,(int)Math.min(from+size,rows.size()));
    return map("items",items,"page",page,"pageSize",size,"total",rows.size());
  }
  static int integer(String input,int min,int max) {
    try { int n=Integer.parseInt(input);if(n<min||n>max) throw ApiException.bad();return n; }
    catch(NumberFormatException e) { throw ApiException.bad(); }
  }
}
