package org.xkrotaract.api;

import java.sql.Timestamp;
import java.time.Clock;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
class ReplayRetention {
  private final JdbcTemplate db;
  private final Clock clock;

  ReplayRetention(JdbcTemplate db, Clock clock) {
    this.db = db;
    this.clock = clock;
  }

  /** Runs without request traffic. Expired responses remain inaccessible while awaiting cleanup. */
  @Scheduled(initialDelay = 60000, fixedDelay = 60000)
  public int purgeExpired() {
    return db.update(
        "DELETE FROM idempotency_records WHERE expires_at<=?", Timestamp.from(clock.instant()));
  }
}
