package org.xkrotaract.api;

import static org.xkrotaract.api.Input.*;

import java.util.*;
import org.springframework.stereotype.Service;

@Service
class Queries {
  final CoreService core;

  Queries(CoreService core) {
    this.core = core;
  }

  int number(Map<String, String> q, String key, int fallback, int min, int max) {
    try {
      int n = Integer.parseInt(q.getOrDefault(key, "" + fallback));
      if (n < min || n > max) throw ApiException.bad();
      return n;
    } catch (NumberFormatException e) {
      throw ApiException.bad();
    }
  }

  void validate(Map<String, String> q, Set<String> allowed) {
    for (var k : q.keySet()) if (!allowed.contains(k)) throw ApiException.bad();
    for (String k : List.of("clubId", "districtId"))
      if (q.containsKey(k)) UUID.fromString(q.get(k));
    for (String k : List.of("typeCode", "clubTypeCode"))
      if (q.containsKey(k) && !Set.of("ROTARACT", "ROTARY", "JCI", "BNI").contains(q.get(k)))
        throw ApiException.bad();
    if (q.containsKey("keyword") && (q.get("keyword").isBlank() || q.get("keyword").length() > 100))
      throw ApiException.bad();
  }

  Object page(List<?> items, Map<String, String> q) {
    int page = number(q, "page", 1, 1, Integer.MAX_VALUE),
        size = number(q, "pageSize", 20, 20, 100);
    long begin = (long) (page - 1) * size;
    return map(
        "items",
        items.subList(
            (int) Math.min(items.size(), begin), (int) Math.min(items.size(), begin + size)),
        "page",
        page,
        "pageSize",
        size,
        "total",
        items.size());
  }

  boolean keyword(Map<String, String> q, String value) {
    return !q.containsKey("keyword")
        || value.toLowerCase(Locale.ROOT).contains(q.get("keyword").toLowerCase(Locale.ROOT));
  }

  Object clubs(Map<String, String> q) {
    validate(q, Set.of("page", "pageSize", "keyword", "districtId", "clubTypeCode"));
    var rows = core.db.queryForList("SELECT * FROM clubs WHERE status='active' ORDER BY name,id");
    return page(
        rows.stream()
            .filter(r -> keyword(q, (String) r.get("name")))
            .filter(
                r ->
                    !q.containsKey("districtId")
                        || r.get("district_id").toString().equals(q.get("districtId")))
            .filter(
                r ->
                    !q.containsKey("clubTypeCode")
                        || r.get("type_code").equals(q.get("clubTypeCode")))
            .map(
                r ->
                    map(
                        "id",
                        r.get("id"),
                        "name",
                        r.get("name"),
                        "clubTypeCode",
                        r.get("type_code"),
                        "districtId",
                        r.get("district_id"),
                        "logoAssetId",
                        null,
                        "description",
                        r.get("description")))
            .toList(),
        q);
  }

  Object joins(UUID account, Map<String, String> q) {
    validate(q, Set.of("page", "pageSize", "scope", "clubId", "status"));
    String scope = q.get("scope");
    if (scope == null || !Set.of("self", "club").contains(scope)) throw ApiException.bad();
    if (q.containsKey("status")
        && !Set.of("pending", "approved", "rejected", "withdrawn", "expired", "terminated")
            .contains(q.get("status"))) throw ApiException.bad();
    List<Map<String, Object>> rows;
    if (scope.equals("self")) {
      UUID member = (UUID) core.member(account).get("id");
      core.expire(member);
      rows =
          core.db.queryForList(
              "SELECT * FROM join_applications WHERE member_id=? ORDER BY requested_at DESC,id",
              member);
    } else {
      if (!q.containsKey("clubId")) throw ApiException.bad();
      UUID club = UUID.fromString(q.get("clubId"));
      core.reviewer(account, club);
      core.db.update(
          "UPDATE join_applications SET status='expired',version=version+1 WHERE club_id=? AND"
              + " status='pending' AND expires_at<=?",
          club,
          core.now());
      rows =
          core.db.queryForList(
              "SELECT * FROM join_applications WHERE club_id=? ORDER BY requested_at DESC,id",
              club);
    }
    return page(
        rows.stream()
            .filter(
                r ->
                    !q.containsKey("clubId") || r.get("club_id").toString().equals(q.get("clubId")))
            .filter(r -> !q.containsKey("status") || r.get("status").equals(q.get("status")))
            .map(core::joinDto)
            .toList(),
        q);
  }

  List<Map<String, Object>> visibleMemberships(UUID member, boolean special) {
    return core
        .db
        .queryForList(
            "SELECT ms.*,c.name club_name,c.district_id,d.name district_name,c.status club_status"
                + " FROM memberships ms JOIN clubs c ON c.id=ms.club_id JOIN districts d ON"
                + " d.id=c.district_id WHERE member_id=? AND ms.status<>'void' ORDER BY"
                + " ms.starts_on DESC,ms.id",
            member)
        .stream()
        .filter(
            r ->
                special
                    || ("active".equals(r.get("status"))
                        && "active".equals(r.get("club_status"))
                        && !core.annual(r).equals("unconfirmed")))
        .toList();
  }

  Map<String, Object> memberDto(Map<String, Object> m, List<Map<String, Object>> memberships) {
    var clubs =
        memberships.stream()
            .map(
                r ->
                    map(
                        "id",
                        r.get("club_id"),
                        "name",
                        r.get("club_name"),
                        "clubTypeCode",
                        r.get("type_code"),
                        "districtId",
                        r.get("district_id"),
                        "districtName",
                        r.get("district_name")))
            .distinct()
            .limit(20)
            .toList();
    String status =
        memberships.stream()
            .map(core::annual)
            .min(
                Comparator.comparingInt(
                    s ->
                        switch (s) {
                          case "confirmed" -> 0;
                          case "grace" -> 1;
                          default -> 2;
                        }))
            .orElse("unconfirmed");
    return map(
        "id",
        m.get("id"),
        "name",
        m.get("name"),
        "callName",
        m.get("call_name"),
        "avatarAssetId",
        m.get("avatar_asset_id"),
        "clubs",
        clubs,
        "annualStatus",
        status);
  }

  Object members(Map<String, String> q) {
    validate(
        q,
        Set.of(
            "page",
            "pageSize",
            "keyword",
            "districtId",
            "clubId",
            "typeCode",
            "annualStatus",
            "includeNonRegular"));
    if (q.containsKey("annualStatus")
        && !Set.of("confirmed", "grace", "unconfirmed").contains(q.get("annualStatus")))
      throw ApiException.bad();
    if (q.containsKey("includeNonRegular")
        && !Set.of("true", "false").contains(q.get("includeNonRegular"))) throw ApiException.bad();
    boolean special = "true".equals(q.get("includeNonRegular"));
    List<Map<String, Object>> result = new ArrayList<>();
    for (var m :
        core.db.queryForList(
            "SELECT m.* FROM members m JOIN accounts a ON a.id=m.account_id WHERE a.status='active'"
                + " ORDER BY m.name,m.id")) {
      if (!keyword(q, m.get("name") + " " + m.get("call_name"))) continue;
      var visible =
          visibleMemberships((UUID) m.get("id"), special).stream()
              .filter(
                  r ->
                      !q.containsKey("clubId")
                          || r.get("club_id").toString().equals(q.get("clubId")))
              .filter(
                  r ->
                      !q.containsKey("districtId")
                          || r.get("district_id").toString().equals(q.get("districtId")))
              .filter(
                  r -> !q.containsKey("typeCode") || r.get("type_code").equals(q.get("typeCode")))
              .filter(
                  r ->
                      !q.containsKey("annualStatus")
                          || core.annual(r).equals(q.get("annualStatus")))
              .toList();
      if (!visible.isEmpty()) result.add(memberDto(m, visible));
    }
    return page(result, q);
  }

  Object detail(UUID actor, UUID member) {
    var m =
        core.one(
            "SELECT m.*,a.email,a.phone,a.status account_status FROM members m JOIN accounts a ON"
                + " a.id=m.account_id WHERE m.id=?",
            member);
    if (!"active".equals(m.get("account_status"))) throw ApiException.missing();
    var memberships = visibleMemberships(member, true);
    if (memberships.isEmpty() && !actor.equals(m.get("account_id"))) throw ApiException.missing();
    var dto = memberDto(m, memberships);
    if (Boolean.TRUE.equals(m.get("email_visible")) || actor.equals(m.get("account_id")))
      dto.put("email", m.get("email"));
    if ((Boolean.TRUE.equals(m.get("phone_visible")) || actor.equals(m.get("account_id")))
        && m.get("phone") != null) dto.put("phone", m.get("phone"));
    return dto;
  }
}
