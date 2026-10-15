package org.xkrotaract.api;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.LocalDate;
import java.util.*;

final class Input {
  static void fields(JsonNode n, String... allowed) {
    if (n == null || !n.isObject()) throw ApiException.bad();
    var set = Set.of(allowed);
    n.fieldNames()
        .forEachRemaining(
            k -> {
              if (!set.contains(k)) throw ApiException.bad();
            });
  }

  static String text(JsonNode n, String key, int min, int max) {
    var v = n.get(key);
    if (v == null || !v.isTextual()) throw ApiException.bad();
    String s = v.asText().strip();
    if (s.codePointCount(0, s.length()) < min || s.codePointCount(0, s.length()) > max)
      throw ApiException.bad();
    return s;
  }

  static String optional(JsonNode n, String key, int max) {
    if (!n.has(key) || n.get(key).isNull()) return null;
    String s = text(n, key, 0, max);
    return s.isEmpty() ? null : s;
  }

  static UUID uuid(JsonNode n, String key) {
    return UUID.fromString(text(n, key, 36, 36));
  }

  static int version(JsonNode n) {
    if (!n.has("version")
        || !n.get("version").isIntegralNumber()
        || !n.get("version").canConvertToInt()
        || n.get("version").intValue() < 0) throw ApiException.bad();
    return n.get("version").intValue();
  }

  static LocalDate date(JsonNode n, String key) {
    return LocalDate.parse(text(n, key, 10, 10));
  }

  static Map<String, Object> map(Object... pairs) {
    Map<String, Object> m = new LinkedHashMap<>();
    for (int i = 0; i < pairs.length; i += 2) m.put((String) pairs[i], pairs[i + 1]);
    return m;
  }
}
