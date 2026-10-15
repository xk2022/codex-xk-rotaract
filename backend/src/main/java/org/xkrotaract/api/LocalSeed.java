package org.xkrotaract.api;

import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

@Component
@Profile("local")
class LocalSeed implements ApplicationRunner {
  final CoreService core;
  final String password;

  LocalSeed(CoreService core, @Value("${LOCAL_REVIEWER_PASSWORD}") String password) {
    this.core = core;
    this.password = password;
  }

  public void run(ApplicationArguments args) {
    if (password.codePointCount(0, password.length()) < 12
        || password.codePointCount(0, password.length()) > 128)
      throw new IllegalArgumentException("LOCAL_REVIEWER_PASSWORD must be 12-128 code points");
    core.tx.executeWithoutResult(
        t -> {
          UUID district = UUID.fromString("10000000-0000-4000-8000-000000000001"),
              club = UUID.fromString("20000000-0000-4000-8000-000000000001"),
              account = UUID.fromString("30000000-0000-4000-8000-000000000001");
          core.db.update(
              "INSERT INTO districts VALUES(?,'LOCAL','本地示範地區') ON CONFLICT DO NOTHING", district);
          core.db.update(
              "INSERT INTO clubs(id,name,type_code,district_id) VALUES(?,'本地示範扶青社','ROTARACT',?) ON"
                  + " CONFLICT DO NOTHING",
              club,
              district);
          core.db.update(
              "INSERT INTO accounts(id,account_code,email,email_key,password_hash)"
                  + " VALUES(?,'LocalReviewer','reviewer@example.test','reviewer@example.test',?)"
                  + " ON CONFLICT DO NOTHING",
              account,
              core.passwords.encode(password));
          core.db.update(
              "INSERT INTO members(id,account_id,name,call_name) VALUES(? ,?,'本地審核者','Reviewer') ON"
                  + " CONFLICT DO NOTHING",
              UUID.fromString("40000000-0000-4000-8000-000000000001"),
              account);
          core.db.update(
              "INSERT INTO role_grants VALUES(?,?, 'club_president',?,?,?,?,'local profile"
                  + " bootstrap',0) ON CONFLICT DO NOTHING",
              UUID.fromString("50000000-0000-4000-8000-000000000001"),
              account,
              club,
              java.sql.Timestamp.from(
                  java.time.LocalDate.of(core.yearStart(), 7, 1)
                      .atStartOfDay(java.time.ZoneId.of("Asia/Taipei"))
                      .toInstant()),
              java.sql.Timestamp.from(
                  java.time.LocalDate.of(core.yearStart() + 1, 7, 1)
                      .atStartOfDay(java.time.ZoneId.of("Asia/Taipei"))
                      .toInstant()),
              account);
        });
  }
}
