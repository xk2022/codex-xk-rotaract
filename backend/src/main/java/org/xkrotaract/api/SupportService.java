package org.xkrotaract.api;

import static org.xkrotaract.api.Input.*;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.servlet.http.HttpServletRequest;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import org.springframework.stereotype.Service;

@Service
class SupportService {
  static final Set<String> TYPES=Set.of("account_recovery","legacy_claim","account_status","club_status","membership_correction","club_type_correction","mfa_recovery");
  static final Set<String> OPEN=Set.of("pending","awaiting_evidence");
  static final String ACCEPTED="若資料符合復原條件，系統將安排後續處理。接受申請不代表信件已送達。";
  final CoreService core;
  final ApiSupport api;
  final MailOutboxService mail;
  final AssetService assets;
  SupportService(CoreService core,ApiSupport api,MailOutboxService mail,AssetService assets) {
    this.core=core;this.api=api;this.mail=mail;this.assets=assets;
  }

  String email(JsonNode b,String field) {
    String e=text(b,field,3,254);
    if(!e.matches("[^\\s@]+@[^\\s@]+\\.[^\\s@]+")) throw ApiException.bad();
    return e;
  }
  String token(JsonNode b,String field,int min) {
    if(!b.has(field)||!b.get(field).isTextual()) throw ApiException.bad();
    String t=b.get(field).asText();
    if(t.length()<min||t.length()>512||!t.matches("[A-Za-z0-9_-]+")) throw ApiException.bad();
    return t;
  }
  Timestamp later(Duration d) { return Timestamp.from(core.clock.instant().plus(d)); }
  Instant instant(Object t) { return ((Timestamp)t).toInstant(); }
  void lock(String purpose,String value) { core.db.queryForObject("SELECT pg_advisory_xact_lock(hashtextextended(?,0)) IS NULL",Boolean.class,purpose+value); }
  void ip(HttpServletRequest req,String purpose,int limit) { core.rate(purpose+":"+core.hmac(req.getRemoteAddr()),limit,Duration.ofHours(1),true); }

  Object recover(JsonNode b,HttpServletRequest req) {
    fields(b,"email");String e=email(b,"email"),key=e.toLowerCase(Locale.ROOT);
    ip(req,"password-recovery-ip",30);
    return core.tx.execute(t->{
      lock("password-recovery:",core.hmac(key));
      // Apply identical per-identifier suppression even when no account matches.
      String bucket="password-recovery-id:"+core.hmac(key);
      var prior=core.db.queryForList("SELECT * FROM rate_limits WHERE bucket=? FOR UPDATE",bucket);
      if(!prior.isEmpty() && instant(prior.getFirst().get("window_start")).plusSeconds(60).isAfter(core.clock.instant())) return map("message",ACCEPTED);
      core.db.update("INSERT INTO rate_limits VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET window_start=excluded.window_start,failures=1",bucket,core.now());
      var rows=core.db.queryForList("SELECT * FROM accounts WHERE email_key=? FOR UPDATE",key);
      if(!rows.isEmpty() && "active".equals(rows.getFirst().get("status"))) {
        var a=rows.getFirst();UUID account=(UUID)a.get("id");
        if(core.db.queryForObject("SELECT count(*) FROM recovery_tokens WHERE account_id=? AND kind='password_reset' AND created_at>?",Integer.class,account,Timestamp.from(core.clock.instant().minus(Duration.ofHours(1))))>=5) return map("message",ACCEPTED);
        core.db.update("UPDATE recovery_tokens SET revoked_at=? WHERE account_id=? AND kind='password_reset' AND consumed_at IS NULL AND revoked_at IS NULL",core.now(),account);
        mail.cancel(account);
        String raw=issue(account,null,"password_reset",key);
        mail.enqueue(account,null,(String)a.get("email"),"password_reset",raw);
      }
      return map("message",ACCEPTED);
    });
  }

  String issue(UUID account,UUID caseId,String kind,String emailKey) {
    String raw=SessionService.random();
    core.db.update("INSERT INTO recovery_tokens(token_hash,account_id,case_id,kind,email_key,created_at,expires_at) VALUES(?,?,?,?,?,?,?)",SessionService.hash(raw),account,caseId,kind,emailKey,core.now(),later(Duration.ofMinutes(30)));
    return raw;
  }

  void reset(JsonNode b,HttpServletRequest req) {
    fields(b,"token","newPassword");String raw=token(b,"token",32);
    var pw=core.json.createObjectNode();pw.set("password",b.get("newPassword"));String password=core.password(pw);
    ip(req,"password-reset-ip",30);
    core.tx.executeWithoutResult(t->{
      var rows=core.db.queryForList("SELECT * FROM recovery_tokens WHERE token_hash=?",SessionService.hash(raw));
      if(rows.isEmpty()) throw ApiException.bad();
      var initial=rows.getFirst();UUID account=(UUID)initial.get("account_id");
      var a=core.one("SELECT * FROM accounts WHERE id=? FOR UPDATE",account);
      Map<String,Object> c=initial.get("case_id")==null?null:core.one("SELECT * FROM support_cases WHERE id=? FOR UPDATE",initial.get("case_id"));
      var r=core.one("SELECT * FROM recovery_tokens WHERE token_hash=? FOR UPDATE",SessionService.hash(raw));
      if(!valid(r)||!Set.of("password_reset","case_password_reset").contains(r.get("kind"))||!"active".equals(a.get("status"))) throw ApiException.bad();
      if(c==null) {
        if(!r.get("email_key").equals(a.get("email_key"))) throw ApiException.bad();
        core.db.update("UPDATE accounts SET password_hash=?,version=version+1 WHERE id=?",core.passwords.encode(password),account);
      } else {
        if(!"case_password_reset".equals(r.get("kind"))||!"awaiting_password_reset".equals(c.get("status"))||!account.equals(c.get("subject_account_id"))||!r.get("email_key").equals(((String)c.get("proposed_email")).toLowerCase(Locale.ROOT))||
            core.db.queryForObject("SELECT count(*) FROM recovery_tokens WHERE case_id=? AND account_id=? AND kind='email_proof' AND consumed_at IS NOT NULL AND revoked_at IS NULL",Integer.class,c.get("id"),account)!=1) throw ApiException.bad();
        if(core.db.queryForObject("SELECT count(*) FROM accounts WHERE email_key=? AND id<>?",Integer.class,r.get("email_key"),account)>0) throw new ApiException(409,"IDENTIFIER_UNAVAILABLE","此識別值無法使用。");
        core.db.update("UPDATE accounts SET email=?,email_key=?,password_hash=?,version=version+1 WHERE id=?",c.get("proposed_email"),r.get("email_key"),core.passwords.encode(password),account);
        if("mfa_recovery".equals(c.get("type")))core.db.update("UPDATE accounts SET totp_secret_ciphertext=NULL,totp_pending_ciphertext=NULL,totp_pending_id=NULL,totp_pending_expires_at=NULL,totp_last_step=NULL WHERE id=?",account);
        close((UUID)c.get("id"),"resolved");
      }
      core.db.update("UPDATE recovery_tokens SET consumed_at=? WHERE token_hash=?",core.now(),r.get("token_hash"));
      core.db.update("UPDATE recovery_tokens SET revoked_at=? WHERE account_id=? AND consumed_at IS NULL AND revoked_at IS NULL",core.now(),account);
      core.db.update("DELETE FROM api_sessions WHERE account_id=?",account);
      mail.cancel(account);core.audit(account,"password.reset",account);
    });
  }
  boolean valid(Map<String,Object> r) { return r.get("consumed_at")==null&&r.get("revoked_at")==null&&instant(r.get("expires_at")).isAfter(core.clock.instant()); }
  boolean passwordProof(JsonNode b,Map<String,Object> account) {
    if(!b.has("currentPassword")||!b.get("currentPassword").isTextual())throw ApiException.bad();
    String p=b.get("currentPassword").asText();int length=p.codePointCount(0,p.length());
    if(length<1||length>128)throw ApiException.bad();
    return core.passwords.matches(p,(String)account.get("password_hash"));
  }

  Map<String,Object> row(UUID id) { return core.one("SELECT * FROM support_cases WHERE id=?",id); }
  boolean assigned(UUID actor,UUID id) { return api.platformRole(actor,"account_support") && core.db.queryForObject("SELECT count(*) FROM support_case_assignments WHERE case_id=? AND account_id=?",Integer.class,id,actor)>0; }
  void requireAssigned(UUID actor,UUID id) { if(!assigned(actor,id)) throw ApiException.missing(); }
  void requireOwner(UUID actor,UUID id) { if(!actor.equals(row(id).get("requester_account_id"))) throw ApiException.missing(); }
  void requireRead(UUID actor,UUID id) { var c=row(id);if(!actor.equals(c.get("requester_account_id"))&&!assigned(actor,id))throw ApiException.missing(); }
  void open(Map<String,Object> c) { if(!OPEN.contains(c.get("status"))) throw ApiException.conflict(); }
  void versioned(JsonNode b,Map<String,Object> c) { if(!Integer.valueOf(version(b)).equals(c.get("version"))) throw new ApiException(409,"VERSION_CONFLICT","資料已更新，請重新載入。"); }

  List<UUID> refs(JsonNode b,String field) {
    var arr=b.get(field);if(arr==null)return List.of();
    if(!arr.isArray()||arr.size()>10) throw ApiException.bad();
    var ids=new ArrayList<UUID>();
    for(var n:arr) { if(!n.isTextual())throw ApiException.bad();UUID id=UUID.fromString(n.asText());if(ids.contains(id))throw ApiException.bad();ids.add(id); }
    return ids;
  }
  void checkRefs(UUID actor,UUID caseId,List<UUID> refs,boolean attaching) {
    for(UUID id:refs) {
      var a=core.one("SELECT * FROM assets WHERE id=? FOR UPDATE",id);
      if(!"support_evidence".equals(a.get("purpose"))||!(attaching?actor.equals(a.get("owner_account_id"))&&(a.get("case_id")==null||caseId.equals(a.get("case_id"))):caseId.equals(a.get("case_id")))) throw ApiException.missing();
      if(attaching)core.db.update("UPDATE assets SET case_id=? WHERE id=?",caseId,id);
    }
    if(core.db.queryForObject("SELECT count(*) FROM assets WHERE case_id=?",Integer.class,caseId)>10) throw ApiException.conflict();
  }

  void autoAssign(UUID id) {
    var handlers=core.db.queryForList("SELECT DISTINCT r.account_id FROM role_grants r JOIN accounts a ON a.id=r.account_id JOIN support_cases c ON c.id=? WHERE r.role='account_support' AND r.scope_type='platform' AND r.revoked_at IS NULL AND r.starts_at<=? AND r.ends_at>? AND a.status='active' AND r.account_id IS DISTINCT FROM c.requester_account_id AND r.account_id IS DISTINCT FROM c.subject_account_id ORDER BY r.account_id",id,core.now(),core.now());
    if(!handlers.isEmpty()) assign(id,(UUID)handlers.getFirst().get("account_id"),null);
  }
  void assign(UUID id,UUID handler,UUID by) {
    if(!api.platformRole(handler,"account_support"))throw ApiException.bad();
    core.db.update("INSERT INTO support_case_assignments VALUES(?,?,?,?) ON CONFLICT(case_id) DO UPDATE SET account_id=excluded.account_id,assigned_by=excluded.assigned_by,assigned_at=excluded.assigned_at",id,handler,by,core.now());
    core.db.update("UPDATE support_cases SET handled_by=? WHERE id=?",handler,id);
  }

  Object create(UUID actor,JsonNode b) {
    fields(b,"type","subjectAccountId","description","proposedEmail","evidenceRefs","stagedRecordId");
    String type=text(b,"type",1,40);if(!TYPES.contains(type)) throw ApiException.bad();
    UUID subject=b.has("subjectAccountId")?uuid(b,"subjectAccountId"):actor;
    if(!actor.equals(subject)) throw ApiException.missing();
    String e=b.has("proposedEmail")?email(b,"proposedEmail"):null;
    if(Set.of("account_recovery","mfa_recovery").contains(type)&&e==null)e=(String)core.one("SELECT email FROM accounts WHERE id=?",actor).get("email");
    UUID staged=b.has("stagedRecordId")?uuid(b,"stagedRecordId"):null;
    if(type.equals("legacy_claim")) {
      if(staged==null)throw ApiException.bad();
      core.one("SELECT id FROM staged_legacy_records WHERE id=? AND reviewed_for_claim FOR SHARE",staged);
      if(core.db.queryForObject("SELECT count(*) FROM legacy_claim_links WHERE staged_record_id=?",Integer.class,staged)>0)throw ApiException.conflict();
    } else if(staged!=null)throw ApiException.bad();
    UUID id=UUID.randomUUID();
    core.db.update("INSERT INTO support_cases(id,requester_account_id,subject_account_id,type,description,proposed_email,staged_record_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)",id,actor,subject,type,text(b,"description",1,5000),e,staged,core.now(),core.now());
    checkRefs(actor,id,refs(b,"evidenceRefs"),true);autoAssign(id);core.audit(actor,"support.create",id);
    return dto(row(id),false);
  }

  Object anonymous(JsonNode b,HttpServletRequest req) {
    fields(b,"identifier","newEmail","description","type");String identifier=text(b,"identifier",1,254).toLowerCase(Locale.ROOT),e=email(b,"newEmail");
    String type=b.has("type")?text(b,"type",1,40):"account_recovery";
    if(!Set.of("account_recovery","mfa_recovery").contains(type))throw ApiException.bad();
    ip(req,"support-recovery-ip",10);core.rate("support-recovery-identifier:"+core.hmac(identifier),5,Duration.ofHours(1),true);
    UUID id=UUID.randomUUID();String receipt=SessionService.random();Timestamp expires=later(Duration.ofDays(30));
    core.db.update("INSERT INTO support_cases(id,type,description,proposed_email,identifier_hash,receipt_hash,receipt_expires_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)",id,type,text(b,"description",1,5000),e,core.hmac(identifier),SessionService.hash(receipt),expires,core.now(),core.now());
    autoAssign(id);
    return map("caseId",id,"receiptToken",receipt,"expiresAt",expires.toInstant().toString(),"message",ACCEPTED);
  }

  Map<String,Object> receipt(UUID id,HttpServletRequest req,boolean locked) {
    String token=req.getHeader("X-Support-Receipt");if(token==null||!token.matches("[A-Za-z0-9_-]{43,512}"))throw ApiException.missing();
    var rows=core.db.queryForList("SELECT * FROM support_cases WHERE id=? AND receipt_hash=?"+(locked?" FOR UPDATE":""),id,SessionService.hash(token));
    if(rows.isEmpty())throw ApiException.missing();var c=rows.getFirst();
    if(c.get("receipt_revoked_at")!=null||!instant(c.get("receipt_expires_at")).isAfter(core.clock.instant()))throw ApiException.missing();
    return c;
  }
  Object status(UUID id,HttpServletRequest req) {
    var c=receipt(id,req,false);
    String message=switch((String)c.get("status")) {
      case "awaiting_evidence" -> "請補充既有帳號相關佐證，附件僅供授權人員核實。";
      case "awaiting_new_email_proof" -> "已安排聯絡信箱確認；接受申請不代表信件已送達。";
      case "awaiting_password_reset" -> "請使用已取得的一次性連結設定新密碼。";
      default -> "案件處理中，請保留收據以查詢進度。";
    };
    return map("caseId",id,"status",c.get("status"),"message",message,"expiresAt",instant(c.get("receipt_expires_at")).toString());
  }

  Map<String,Object> dto(Map<String,Object> c,boolean assigned) {
    var d=map("id",c.get("id"),"subjectAccountId",c.get("subject_account_id"),"type",c.get("type"),"status",c.get("status"),"description",c.get("description"),"decisionReason",c.get("decision_reason"),"createdAt",instant(c.get("created_at")).toString(),"updatedAt",instant(c.get("updated_at")).toString(),"version",c.get("version"));
    if(assigned) { d.put("evidenceRefs",core.db.queryForList("SELECT id FROM assets WHERE case_id=? ORDER BY created_at,id",UUID.class,c.get("id")));d.put("handledBy",c.get("handled_by")); }
    return d;
  }
  Object list(UUID actor,Map<String,String> q) {
    for(String k:q.keySet())if(!Set.of("page","pageSize","scope","status").contains(k))throw ApiException.bad();
    String scope=q.get("scope");if(!Set.of("self","assigned").contains(scope==null?"":scope))throw ApiException.bad();
    if(q.containsKey("status")&&!Set.of("pending","awaiting_evidence","awaiting_new_email_proof","awaiting_password_reset","approved","rejected","resolved").contains(q.get("status")))throw ApiException.bad();
    if(scope.equals("assigned"))api.requirePlatform(actor,"account_support");
    ApiSupport.integer(q.getOrDefault("pageSize","20"),20,100);
    var rows=scope.equals("self")?core.db.queryForList("SELECT * FROM support_cases WHERE requester_account_id=? ORDER BY created_at DESC,id",actor):core.db.queryForList("SELECT c.* FROM support_cases c JOIN support_case_assignments a ON a.case_id=c.id WHERE a.account_id=? ORDER BY c.created_at DESC,c.id",actor);
    var items=rows.stream().filter(c->!q.containsKey("status")||q.get("status").equals(c.get("status"))).map(c->map("projection",scope,"data",dto(c,scope.equals("assigned")))).toList();
    return ApiSupport.page(items,q);
  }
  Object detail(UUID actor,UUID id) { requireRead(actor,id);return dto(row(id),assigned(actor,id)); }

  Object resolve(UUID actor,UUID id,JsonNode b) {
    fields(b,"version","decision","evidenceRefs","reason","verifiedSubjectAccountId");requireAssigned(actor,id);
    var c=core.one("SELECT * FROM support_cases WHERE id=? FOR UPDATE",id);versioned(b,c);open(c);
    if(actor.equals(c.get("requester_account_id"))||actor.equals(c.get("subject_account_id")))throw ApiException.missing();
    String decision=text(b,"decision",1,30),reason=text(b,"reason",1,1000);
    if(!Set.of("approve","reject","request_evidence").contains(decision)||!b.has("evidenceRefs"))throw ApiException.bad();
    checkRefs(actor,id,refs(b,"evidenceRefs"),false);
    UUID verified=b.has("verifiedSubjectAccountId")?uuid(b,"verifiedSubjectAccountId"):null;
    if(c.get("subject_account_id")!=null&&verified!=null&&!verified.equals(c.get("subject_account_id")))throw ApiException.bad();
    if(decision.equals("request_evidence")) {
      core.db.update("UPDATE support_cases SET status='awaiting_evidence',decision_reason=?,version=version+1,updated_at=? WHERE id=?",reason,core.now(),id);
    } else if(decision.equals("reject")) {
      core.db.update("UPDATE support_cases SET decision_reason=? WHERE id=?",reason,id);close(id,"rejected");
    } else {
      UUID subject=c.get("subject_account_id")==null?verified:(UUID)c.get("subject_account_id");
      if(subject==null)throw ApiException.bad();
      if(actor.equals(subject))throw ApiException.missing();
      var account=core.one("SELECT * FROM accounts WHERE id=?",subject);
      boolean recovery=Set.of("account_recovery","mfa_recovery","legacy_claim").contains(c.get("type"));
      if(recovery) independent(actor,id,subject);
      else throw new ApiException(409,"INVALID_STATE","此類案件須由對應社團、地區或帳號狀態流程執行，帳號支援不得代為核准。");
      if(Set.of("account_recovery","mfa_recovery").contains(c.get("type"))) {
        if(c.get("proposed_email")==null||!"active".equals(account.get("status")))throw ApiException.conflict();
        String email=(String)c.get("proposed_email");
        if(core.db.queryForObject("SELECT count(*) FROM accounts WHERE email_key=? AND id<>?",Integer.class,email.toLowerCase(Locale.ROOT),subject)>0)throw new ApiException(409,"IDENTIFIER_UNAVAILABLE","此識別值無法使用。");
        core.db.update("UPDATE support_cases SET subject_account_id=?,status='awaiting_new_email_proof',decision_reason=?,version=version+1,updated_at=? WHERE id=?",subject,reason,core.now(),id);
        String proof=issue(subject,id,"email_proof",email.toLowerCase(Locale.ROOT));mail.enqueue(subject,id,email,"recovery_email_proof",proof);
      } else {
        if("legacy_claim".equals(c.get("type"))) {
          var legacy=core.one("SELECT * FROM staged_legacy_records WHERE id=? AND reviewed_for_claim FOR UPDATE",c.get("staged_record_id"));
          if(core.db.queryForObject("SELECT count(*) FROM legacy_claim_links WHERE staged_record_id=?",Integer.class,legacy.get("id"))>0)throw ApiException.conflict();
          if(legacy.get("club_id")==null||core.db.queryForObject("SELECT count(*) FROM support_case_verifications WHERE case_id=? AND subject_account_id=? AND kind='club_attestation' AND club_id=? AND verified_by<>?",Integer.class,id,subject,legacy.get("club_id"),actor)==0)throw ApiException.conflict();
        }
        // Legacy approval never merges identities before the claimant confirms.
        core.db.update("UPDATE support_cases SET subject_account_id=?,status='approved',decision_reason=?,version=version+1,updated_at=? WHERE id=?",subject,reason,core.now(),id);
      }
    }
    core.audit(actor,"support."+decision,id);return dto(row(id),true);
  }

  void independent(UUID handler,UUID id,UUID subject) {
    var proofs=core.db.queryForList("SELECT * FROM support_case_verifications WHERE case_id=? AND subject_account_id=? AND verified_by<>?",id,subject,handler);
    var c=row(id);
    boolean member=core.db.queryForObject("SELECT count(*) FROM memberships ms JOIN members m ON m.id=ms.member_id JOIN clubs c ON c.id=ms.club_id WHERE m.account_id=? AND ms.status='active' AND c.status='active' AND ms.starts_on<=? AND (ms.ends_on IS NULL OR ms.ends_on>?)",Integer.class,subject,core.today(),core.today())>0;
    boolean valid=proofs.stream().anyMatch(p->{
      if("legacy_claim".equals(c.get("type"))&&"club_attestation".equals(p.get("kind")))return attestor((UUID)p.get("verified_by"),subject,(UUID)p.get("club_id"),c);
      if(member && "club_attestation".equals(p.get("kind")))return currentAttestor((UUID)p.get("verified_by"),subject,(UUID)p.get("club_id"));
      if(!member && "existing_session".equals(p.get("kind")))return subject.equals(p.get("verified_by"));
      return false;
    });
    if(!valid)throw new ApiException(409,"INVALID_STATE","尚缺可獨立核實的既有帳號證據或具名社團佐證，請要求補件。");
  }
  boolean currentAttestor(UUID actor,UUID subject,UUID club) {
    return club!=null && !actor.equals(subject) && api.clubRole(actor,club,"club_president","club_secretary","club_manager") && core.db.queryForObject("SELECT count(*) FROM memberships ms JOIN members m ON m.id=ms.member_id JOIN clubs c ON c.id=ms.club_id WHERE m.account_id=? AND ms.club_id=? AND ms.status='active' AND c.status='active' AND ms.starts_on<=? AND (ms.ends_on IS NULL OR ms.ends_on>?)",Integer.class,subject,club,core.today(),core.today())>0;
  }
  boolean attestor(UUID actor,UUID subject,UUID club,Map<String,Object> c) {
    if(!"legacy_claim".equals(c.get("type")))return currentAttestor(actor,subject,club);
    if(club==null||actor.equals(subject)||!api.clubRole(actor,club,"club_president","club_secretary","club_manager"))return false;
    var rows=core.db.queryForList("SELECT club_id FROM staged_legacy_records WHERE id=? AND reviewed_for_claim",c.get("staged_record_id"));
    return !rows.isEmpty()&&club.equals(rows.getFirst().get("club_id"));
  }

  Object verify(UUID actor,UUID id,JsonNode b,HttpServletRequest req) {
    fields(b,"version","kind","subjectAccountId","clubId","reason","currentPassword");
    var c=core.one("SELECT * FROM support_cases WHERE id=? FOR UPDATE",id);versioned(b,c);open(c);
    UUID subject=uuid(b,"subjectAccountId");String kind=text(b,"kind",1,30),reason=text(b,"reason",1,1000);UUID club=b.has("clubId")?uuid(b,"clubId"):null;
    if(c.get("subject_account_id")!=null&&!subject.equals(c.get("subject_account_id")))throw ApiException.missing();
    UUID sessionId=null;
    if(kind.equals("club_attestation")) {
      if(!attestor(actor,subject,club,c)||actor.equals(c.get("handled_by"))||actor.equals(c.get("requester_account_id")))throw ApiException.missing();
    } else if(kind.equals("existing_session")) {
      if(!actor.equals(subject)||club!=null)throw ApiException.missing();
      ip(req,"support-session-proof-ip",30);
      core.rate("support-session-proof-account:"+actor,10,Duration.ofMinutes(15),true);
      var session=core.sessions.require(req);var a=core.lockAccountSession(session);
      var s=core.one("SELECT created_at FROM api_sessions WHERE id=?",session.id());
      if(!instant(s.get("created_at")).isBefore(instant(c.get("created_at"))))throw ApiException.missing();
      if(!passwordProof(b,a))throw ApiException.auth();
      sessionId=session.id();
    } else throw ApiException.bad();
    UUID verification=UUID.randomUUID();
    core.db.update("INSERT INTO support_case_verifications VALUES(?,?,?,?,?,?,?,?,?)",verification,id,subject,actor,kind,club,sessionId,reason,core.now());
    core.db.update("UPDATE support_cases SET version=version+1,updated_at=? WHERE id=?",core.now(),id);core.audit(actor,"support.verify",id);
    return map("id",verification,"caseId",id,"kind",kind,"recordedAt",core.clock.instant().toString());
  }

  Object confirm(JsonNode b,HttpServletRequest req) {
    fields(b,"token");String raw=token(b,"token",43);ip(req,"support-email-confirm-ip",30);
    return core.tx.execute(t->{
      var rows=core.db.queryForList("SELECT * FROM recovery_tokens WHERE token_hash=?",SessionService.hash(raw));if(rows.isEmpty())throw ApiException.bad();var initial=rows.getFirst();
      if(initial.get("case_id")==null||!"email_proof".equals(initial.get("kind")))throw ApiException.bad();
      core.one("SELECT id FROM accounts WHERE id=? FOR UPDATE",initial.get("account_id"));
      var c=core.one("SELECT * FROM support_cases WHERE id=? FOR UPDATE",initial.get("case_id"));
      var r=core.one("SELECT * FROM recovery_tokens WHERE token_hash=? FOR UPDATE",SessionService.hash(raw));
      if(!valid(r)||!"awaiting_new_email_proof".equals(c.get("status"))||!r.get("account_id").equals(c.get("subject_account_id"))||!r.get("email_key").equals(((String)c.get("proposed_email")).toLowerCase(Locale.ROOT)))throw ApiException.bad();
      core.db.update("UPDATE recovery_tokens SET consumed_at=? WHERE token_hash=?",core.now(),r.get("token_hash"));
      core.db.update("UPDATE support_cases SET status='awaiting_password_reset',version=version+1,updated_at=? WHERE id=?",core.now(),c.get("id"));
      String reset=issue((UUID)r.get("account_id"),(UUID)c.get("id"),"case_password_reset",(String)r.get("email_key"));mail.cancel((UUID)r.get("account_id"));
      return map("passwordResetToken",reset,"expiresAt",later(Duration.ofMinutes(30)).toInstant().toString());
    });
  }

  Object reissueEmail(UUID actor,UUID id,JsonNode b) {
    fields(b,"version","reason");requireAssigned(actor,id);
    var c=core.one("SELECT * FROM support_cases WHERE id=? FOR UPDATE",id);versioned(b,c);
    UUID subject=(UUID)c.get("subject_account_id");
    if(!Set.of("account_recovery","mfa_recovery").contains(c.get("type"))||!Set.of("awaiting_new_email_proof","awaiting_password_reset").contains(c.get("status"))||subject==null||actor.equals(subject)||actor.equals(c.get("requester_account_id")))throw ApiException.conflict();
    text(b,"reason",1,1000);independent(actor,id,subject);
    core.rate("support-email-reissue:"+id,5,Duration.ofHours(1),true);
    core.db.update("UPDATE recovery_tokens SET revoked_at=? WHERE case_id=? AND revoked_at IS NULL",core.now(),id);mail.cancel(subject);
    String email=(String)c.get("proposed_email");String proof=issue(subject,id,"email_proof",email.toLowerCase(Locale.ROOT));mail.enqueue(subject,id,email,"recovery_email_proof",proof);
    core.db.update("UPDATE support_cases SET status='awaiting_new_email_proof',version=version+1,updated_at=? WHERE id=?",core.now(),id);core.audit(actor,"support.email_proof.reissue",id);
    return dto(row(id),true);
  }

  void close(UUID id,String status) {
    core.db.update("UPDATE support_cases SET status=?,version=version+1,updated_at=?,closed_at=?,receipt_revoked_at=? WHERE id=?",status,core.now(),core.now(),core.now(),id);
    core.db.update("UPDATE recovery_tokens SET revoked_at=? WHERE case_id=? AND consumed_at IS NULL AND revoked_at IS NULL",core.now(),id);
    core.db.update("UPDATE mail_outbox SET status='cancelled' WHERE case_id=? AND status='queued'",id);
  }

  Object supplement(UUID actor,UUID id,JsonNode b,HttpServletRequest req,boolean anonymous) {
    if(anonymous)fields(b,"description");else fields(b,"version","description","evidenceRefs");
    var c=anonymous?receipt(id,req,true):core.one("SELECT * FROM support_cases WHERE id=? FOR UPDATE",id);
    if(!anonymous){requireOwner(actor,id);versioned(b,c);}open(c);
    if(anonymous&&!refs(b,"evidenceRefs").isEmpty())throw ApiException.bad();
    if(!anonymous)checkRefs(actor,id,refs(b,"evidenceRefs"),true);
    core.db.update("INSERT INTO support_case_supplements VALUES(?,?,?,?,?)",UUID.randomUUID(),id,actor,text(b,"description",1,5000),core.now());
    core.db.update("UPDATE support_cases SET status='pending',version=version+1,updated_at=? WHERE id=?",core.now(),id);
    if(actor!=null)core.audit(actor,"support.supplement",id);
    return anonymous?status(id,req):dto(row(id),false);
  }

  Object confirmLegacy(UUID actor,UUID id,JsonNode b,HttpServletRequest req) {
    fields(b,"version","currentPassword");requireOwner(actor,id);
    var c=core.one("SELECT * FROM support_cases WHERE id=? FOR UPDATE",id);versioned(b,c);
    if(!"legacy_claim".equals(c.get("type"))||!"approved".equals(c.get("status"))||!actor.equals(c.get("subject_account_id")))throw ApiException.conflict();
    core.rate("legacy-confirm-account:"+actor,10,Duration.ofMinutes(15),true);ip(req,"legacy-confirm-ip",30);
    var a=core.lockAccountSession(core.sessions.require(req));
    if(!passwordProof(b,a))throw ApiException.auth();
    var staged=core.one("SELECT * FROM staged_legacy_records WHERE id=? AND reviewed_for_claim FOR UPDATE",c.get("staged_record_id"));
    if(core.db.queryForObject("SELECT count(*) FROM legacy_claim_links WHERE staged_record_id=?",Integer.class,staged.get("id"))>0)throw ApiException.conflict();
    UUID member=api.memberId(actor);
    core.db.update("INSERT INTO legacy_claim_links VALUES(?,?,?,?,?)",staged.get("id"),actor,member,id,core.now());
    close(id,"resolved");core.audit(actor,"support.legacy_claim.confirm",id);
    return map("caseId",id,"stagedRecordId",staged.get("id"),"accountId",actor,"memberId",member,"confirmedAt",core.clock.instant().toString());
  }
}
