package org.xkrotaract.api;

import static org.xkrotaract.api.Input.*;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.servlet.http.HttpServletRequest;
import java.net.URLEncoder;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.time.*;
import java.util.*;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
class MfaController {
  final CoreService core;
  final ApiSupport access;
  MfaController(CoreService core,ApiSupport access) { this.core=core;this.access=access; }

  @GetMapping("/me/mfa")
  Object status(HttpServletRequest req) {
    return core.mfaStatus(core.sessions.require(req));
  }

  @PostMapping("/me/mfa/enrollments")
  ResponseEntity<?> enroll(@RequestBody JsonNode body,HttpServletRequest req) {
    UUID actor=access.actor(req);
    return access.mutation(req,body,201,()-> {
      var a=core.one("SELECT * FROM accounts WHERE id=?",actor);
      if(a.get("totp_secret_ciphertext")!=null) throw ApiException.conflict();
    },()-> {
      fields(body,"currentPassword");
      verifyPassword(actor,body);
      byte[] bytes=new byte[20];new SecureRandom().nextBytes(bytes);
      String secret=base32(bytes);UUID id=UUID.randomUUID();
      Instant expires=core.clock.instant().plus(Duration.ofMinutes(10));
      core.db.update("UPDATE accounts SET totp_pending_id=?,totp_pending_ciphertext=?,totp_pending_expires_at=? WHERE id=?",id,core.replayCipher.encrypt(secret,"totp/pending/"+actor+"/"+id),java.sql.Timestamp.from(expires),actor);
      String code=(String)core.one("SELECT account_code FROM accounts WHERE id=?",actor).get("account_code");
      core.audit(actor,"mfa.enrollment_created",actor);
      return map("enrollmentId",id,"secret",secret,"otpauthUri","otpauth://totp/"+URLEncoder.encode("XkRotaract:"+code,StandardCharsets.UTF_8)+"?secret="+secret+"&issuer=XkRotaract&algorithm=SHA1&digits=6&period=30","expiresAt",expires.toString());
    });
  }

  @PostMapping("/me/mfa/enrollments/confirm")
  ResponseEntity<?> confirm(@RequestBody JsonNode body,HttpServletRequest req) {
    UUID actor=access.actor(req);
    return access.mutation(req,body,200,()->{},()-> {
      fields(body,"enrollmentId","code");
      var a=core.one("SELECT * FROM accounts WHERE id=? FOR UPDATE",actor);
      UUID id=uuid(body,"enrollmentId");
      if(a.get("totp_secret_ciphertext")!=null || !id.equals(a.get("totp_pending_id")) || a.get("totp_pending_expires_at")==null || !((java.sql.Timestamp)a.get("totp_pending_expires_at")).toInstant().isAfter(core.clock.instant())) throw ApiException.conflict();
      core.rate("mfa:"+actor,10,Duration.ofMinutes(15),true);
      String secret=core.replayCipher.decrypt((String)a.get("totp_pending_ciphertext"),"totp/pending/"+actor+"/"+id);
      long step=verifyCode(secret,text(body,"code",6,6),null);
      core.db.update("UPDATE accounts SET totp_secret_ciphertext=?,totp_pending_id=NULL,totp_pending_ciphertext=NULL,totp_pending_expires_at=NULL,totp_last_step=? WHERE id=?",core.replayCipher.encrypt(secret,"totp/active/"+actor),step,actor);
      core.db.update("UPDATE api_sessions SET mfa_verified_at=? WHERE token_hash=?",core.now(),core.sessions.require(req).hash());
      core.audit(actor,"mfa.enabled",actor);
      return status(req);
    });
  }

  @PostMapping("/sessions/current/mfa-verifications")
  ResponseEntity<?> verify(@RequestBody JsonNode body,HttpServletRequest req) {
    UUID actor=access.actor(req);
    return access.mutation(req,body,200,()->{},()-> {
      fields(body,"code");
      var a=core.one("SELECT * FROM accounts WHERE id=? FOR UPDATE",actor);
      if(a.get("totp_secret_ciphertext")==null) throw ApiException.conflict();
      core.rate("mfa:"+actor,10,Duration.ofMinutes(15),true);
      String secret=core.replayCipher.decrypt((String)a.get("totp_secret_ciphertext"),"totp/active/"+actor);
      Long last=(Long)a.get("totp_last_step");
      long step=verifyCode(secret,text(body,"code",6,6),last);
      core.db.update("UPDATE accounts SET totp_last_step=? WHERE id=?",step,actor);
      core.db.update("UPDATE api_sessions SET mfa_verified_at=? WHERE token_hash=?",core.now(),core.sessions.require(req).hash());
      core.audit(actor,"mfa.verified",actor);
      return status(req);
    });
  }

  void verifyPassword(UUID actor,JsonNode body) {
    var p=body.get("currentPassword");
    if(p==null || !p.isTextual() || p.asText().isEmpty() || p.asText().codePointCount(0,p.asText().length())>128) throw ApiException.bad();
    core.rate("mfa-password:"+actor,10,Duration.ofMinutes(15),true);
    var a=core.one("SELECT password_hash FROM accounts WHERE id=?",actor);
    if(!core.passwords.matches(p.asText(),(String)a.get("password_hash"))) throw ApiException.auth();
  }
  long verifyCode(String secret,String code,Long last) {
    if(!code.matches("[0-9]{6}")) throw ApiException.bad();
    long now=core.clock.instant().getEpochSecond()/30;
    for(long step=now-1;step<=now+1;step++) {
      if(last!=null && step<=last) continue;
      if(MessageDigest.isEqual(code.getBytes(StandardCharsets.US_ASCII),otp(secret,step).getBytes(StandardCharsets.US_ASCII))) return step;
    }
    throw new ApiException(401,"MFA_INVALID","驗證碼不正確、已使用或已到期。");
  }
  static String base32(byte[] bytes) {
    String alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";StringBuilder out=new StringBuilder();int buffer=0,bits=0;
    for(byte b:bytes) {buffer=(buffer<<8)|(b&255);bits+=8;while(bits>=5){bits-=5;out.append(alphabet.charAt((buffer>>bits)&31));}}
    if(bits>0) out.append(alphabet.charAt((buffer<<(5-bits))&31));return out.toString();
  }
  static byte[] decode32(String text) {
    var out=new java.io.ByteArrayOutputStream();int buffer=0,bits=0;
    for(char c:text.toCharArray()){int v="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567".indexOf(c);if(v<0)throw new IllegalArgumentException();buffer=(buffer<<5)|v;bits+=5;if(bits>=8){bits-=8;out.write((buffer>>bits)&255);}}
    return out.toByteArray();
  }
  static String otp(String secret,long step) {
    try {
      Mac m=Mac.getInstance("HmacSHA1");m.init(new SecretKeySpec(decode32(secret),"HmacSHA1"));byte[] hash=m.doFinal(ByteBuffer.allocate(8).putLong(step).array());int off=hash[hash.length-1]&15;
      int value=((hash[off]&127)<<24)|((hash[off+1]&255)<<16)|((hash[off+2]&255)<<8)|(hash[off+3]&255);
      return String.format(Locale.ROOT,"%06d",value%1000000);
    } catch(GeneralSecurityException e) {throw new IllegalStateException(e);}
  }
}
