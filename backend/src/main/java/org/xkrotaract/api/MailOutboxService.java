package org.xkrotaract.api;

import java.util.*;
import org.springframework.stereotype.Service;

/** Durable encrypted mail queue. Queuing is acceptance, never a claim of SMTP delivery. */
@Service
class MailOutboxService {
  final CoreService core;
  MailOutboxService(CoreService core) { this.core = core; }

  void enqueue(UUID account, UUID caseId, String email, String kind, String token) {
    UUID id = UUID.randomUUID();
    String aad = "mail-outbox:" + id;
    core.db.update("INSERT INTO mail_outbox(id,account_id,case_id,token_hash,recipient_ciphertext,payload_ciphertext,kind,created_at,next_attempt_at) VALUES(?,?,?,?,?,?,?,?,?)",
        id, account, caseId, SessionService.hash(token),
        core.replayCipher.encrypt(email, aad + ":recipient"),
        core.replayCipher.encrypt(token, aad + ":payload"), kind, core.now(), core.now());
  }

  void cancel(UUID account) {
    core.db.update("UPDATE mail_outbox SET status='cancelled' WHERE account_id=? AND status='queued' AND token_hash IN (SELECT token_hash FROM recovery_tokens WHERE revoked_at IS NOT NULL OR consumed_at IS NOT NULL)", account);
  }

  /** A local test adapter can consume exactly the same queue without emitting secrets to logs. */
  Map<String,Object> localMessage(UUID id) {
    var row = core.one("SELECT * FROM mail_outbox WHERE id=?", id);
    String aad = "mail-outbox:" + id;
    return Input.map("recipient", core.replayCipher.decrypt((String)row.get("recipient_ciphertext"),aad+":recipient"),
        "token",core.replayCipher.decrypt((String)row.get("payload_ciphertext"),aad+":payload"),"kind",row.get("kind"));
  }
}
