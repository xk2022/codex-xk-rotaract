package org.xkrotaract.api;

import static org.xkrotaract.api.Input.*;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.servlet.http.HttpServletRequest;
import java.io.IOException;
import java.security.MessageDigest;
import java.util.*;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1")
class SupportController {
  final CoreService core;
  final ApiSupport api;
  final SupportService service;
  final AssetService assets;
  SupportController(CoreService core,ApiSupport api,SupportService service,AssetService assets) {
    this.core=core;this.api=api;this.service=service;this.assets=assets;
  }

  @PostMapping("/password-recovery-requests")
  ResponseEntity<?> recovery(@RequestBody JsonNode b,HttpServletRequest req) {
    return ResponseEntity.accepted().body(service.recover(b,req));
  }
  @PostMapping("/password-resets")
  ResponseEntity<?> reset(@RequestBody JsonNode b,HttpServletRequest req) {
    service.reset(b,req);return ResponseEntity.noContent().build();
  }
  @PostMapping("/support-recovery-email-confirmations")
  Object confirm(@RequestBody JsonNode b,HttpServletRequest req) { return service.confirm(b,req); }

  @PostMapping("/support-cases")
  ResponseEntity<?> create(@RequestBody JsonNode b,HttpServletRequest req) {
    UUID actor=api.actor(req);
    return api.mutation(req,b,201,()->{if(b.has("subjectAccountId")&&!actor.equals(uuid(b,"subjectAccountId")))throw ApiException.missing();},()->service.create(actor,b));
  }
  @GetMapping("/support-cases")
  Object list(@RequestParam Map<String,String> q,HttpServletRequest req) { return service.list(api.actor(req),q); }
  @GetMapping("/support-cases/{id}")
  Object detail(@PathVariable UUID id,HttpServletRequest req) { return service.detail(api.actor(req),id); }
  @PostMapping("/support-cases/{id}/resolve")
  ResponseEntity<?> resolve(@PathVariable UUID id,@RequestBody JsonNode b,HttpServletRequest req) {
    UUID actor=api.actor(req);
    return api.mutation(req,b,200,()->service.requireAssigned(actor,id),()->service.resolve(actor,id,b));
  }
  @PostMapping("/support-cases/{id}/recovery-email-requests")
  ResponseEntity<?> reissueEmail(@PathVariable UUID id,@RequestBody JsonNode b,HttpServletRequest req) {
    UUID actor=api.actor(req);
    return api.mutation(req,b,200,()->service.requireAssigned(actor,id),()->service.reissueEmail(actor,id,b));
  }
  @PostMapping("/support-cases/{id}/verifications")
  ResponseEntity<?> verify(@PathVariable UUID id,@RequestBody JsonNode b,HttpServletRequest req) {
    UUID actor=api.actor(req);
    // Re-run authorization on replay without repeating the verification/version transition.
    return api.mutation(req,b,201,()->{
      UUID subject=uuid(b,"subjectAccountId");String kind=text(b,"kind",1,30);
      if(kind.equals("club_attestation")) { if(!service.attestor(actor,subject,uuid(b,"clubId"),service.row(id)))throw ApiException.missing(); }
      else if(!kind.equals("existing_session")||!actor.equals(subject))throw ApiException.missing();
    },()->service.verify(actor,id,b,req));
  }
  @PostMapping("/support-cases/{id}/assignments")
  ResponseEntity<?> assignment(@PathVariable UUID id,@RequestBody JsonNode b,HttpServletRequest req) {
    UUID actor=api.actor(req);
    return api.mutation(req,b,200,()->{api.requirePlatform(actor,"permission_admin");api.requireMfa(req);},()->{
      fields(b,"version","accountId","reason");
      var c=core.one("SELECT * FROM support_cases WHERE id=? FOR UPDATE",id);service.versioned(b,c);service.open(c);
      UUID handler=uuid(b,"accountId");if(handler.equals(c.get("requester_account_id"))||handler.equals(c.get("subject_account_id")))throw ApiException.bad();
      text(b,"reason",1,1000);service.assign(id,handler,actor);
      core.db.update("UPDATE support_cases SET version=version+1,updated_at=? WHERE id=?",core.now(),id);core.audit(actor,"support.assign",id);
      return map("caseId",id,"accountId",handler,"version",(Integer)c.get("version")+1);
    });
  }
  @PostMapping("/support-cases/{id}/supplements")
  ResponseEntity<?> supplement(@PathVariable UUID id,@RequestBody JsonNode b,HttpServletRequest req) {
    UUID actor=api.actor(req);return api.mutation(req,b,200,()->service.requireOwner(actor,id),()->service.supplement(actor,id,b,req,false));
  }
  @PostMapping("/support-cases/{id}/legacy-confirmations")
  ResponseEntity<?> legacyConfirmation(@PathVariable UUID id,@RequestBody JsonNode b,HttpServletRequest req) {
    UUID actor=api.actor(req);
    return api.mutation(req,b,200,()->service.requireOwner(actor,id),()->service.confirmLegacy(actor,id,b,req));
  }
  @GetMapping("/support-cases/{id}/supplements")
  Object supplements(@PathVariable UUID id,HttpServletRequest req,@RequestParam Map<String,String> q) {
    service.requireRead(api.actor(req),id);
    for(String k:q.keySet())if(!Set.of("page","pageSize").contains(k))throw ApiException.bad();
    return ApiSupport.page(core.db.queryForList("SELECT id,description,created_at FROM support_case_supplements WHERE case_id=? ORDER BY created_at,id",id).stream().map(r->map("id",r.get("id"),"description",r.get("description"),"createdAt",service.instant(r.get("created_at")).toString())).toList(),q);
  }

  @PostMapping("/support-recovery-cases")
  ResponseEntity<?> anonymous(@RequestBody JsonNode b,HttpServletRequest req) {
    return api.mutation(req,b,202,()->{},()->service.anonymous(b,req));
  }
  @GetMapping("/support-recovery-cases/{id}")
  Object status(@PathVariable UUID id,HttpServletRequest req) { return service.status(id,req); }
  @PostMapping("/support-recovery-cases/{id}/supplements")
  ResponseEntity<?> anonymousSupplement(@PathVariable UUID id,@RequestBody JsonNode b,HttpServletRequest req) {
    return api.mutation(req,b,200,()->service.receipt(id,req,false),()->service.supplement(null,id,b,req,true));
  }

  JsonNode uploadBody(MultipartFile file,String purpose,UUID club,UUID caseId) {
    if(file==null||file.getSize()>2097152||file.isEmpty())throw ApiException.bad();
    try {
      var b=core.json.createObjectNode();b.put("purpose",purpose);if(club!=null)b.put("clubId",club.toString());if(caseId!=null)b.put("caseId",caseId.toString());
      b.put("mediaType",file.getContentType());b.put("sha256",HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(file.getBytes())));return b;
    } catch(IOException|java.security.NoSuchAlgorithmException e) { throw ApiException.bad(); }
  }
  void multipartFields(HttpServletRequest req,Set<String> allowed) {
    for(String key:req.getParameterMap().keySet())if(!allowed.contains(key))throw ApiException.bad();
    if(req instanceof org.springframework.web.multipart.MultipartHttpServletRequest multi)
      for(String key:multi.getFileMap().keySet())if(!key.equals("file")||multi.getFiles(key).size()!=1)throw ApiException.bad();
  }
  @PostMapping(value="/assets",consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
  ResponseEntity<?> upload(@RequestParam MultipartFile file,@RequestParam String purpose,@RequestParam(required=false) UUID clubId,HttpServletRequest req) {
    UUID actor=api.actor(req);multipartFields(req,Set.of("purpose","clubId"));
    if(!Set.of("avatar","club_logo","support_evidence").contains(purpose)||!purpose.equals("club_logo")&&clubId!=null)throw ApiException.bad();
    JsonNode b=uploadBody(file,purpose,clubId,null);
    return api.mutation(req,b,201,()->{if(purpose.equals("club_logo"))assets.clubLogo(actor,clubId);},()->{
      service.ip(req,"asset-upload-ip",60);return assets.store(actor,null,clubId,purpose,assets.inspect(file,purpose.equals("avatar")));
    });
  }
  @PostMapping(value="/support-recovery-cases/{id}/evidence",consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
  ResponseEntity<?> anonymousEvidence(@PathVariable UUID id,@RequestParam MultipartFile file,HttpServletRequest req) {
    multipartFields(req,Set.of());var b=uploadBody(file,"support_evidence",null,id);
    return api.mutation(req,b,201,()->service.receipt(id,req,false),()->{
      var c=service.receipt(id,req,true);service.open(c);service.ip(req,"support-evidence-ip",30);evidenceCapacity(id);
      return assets.store(null,id,null,"support_evidence",assets.inspect(file,false));
    });
  }
  @PostMapping(value="/support-cases/{id}/evidence",consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
  ResponseEntity<?> evidence(@PathVariable UUID id,@RequestParam MultipartFile file,HttpServletRequest req) {
    UUID actor=api.actor(req);multipartFields(req,Set.of());var b=uploadBody(file,"support_evidence",null,id);
    return api.mutation(req,b,201,()->service.requireRead(actor,id),()->{
      var c=core.one("SELECT * FROM support_cases WHERE id=? FOR UPDATE",id);service.open(c);evidenceCapacity(id);service.ip(req,"support-evidence-ip",30);
      return assets.store(actor,id,null,"support_evidence",assets.inspect(file,false));
    });
  }
  void evidenceCapacity(UUID id) { if(core.db.queryForObject("SELECT count(*) FROM assets WHERE case_id=?",Integer.class,id)>=10)throw ApiException.conflict(); }
  @GetMapping("/assets/{id}")
  Object asset(@PathVariable UUID id,HttpServletRequest req) { return assets.dto(assets.require(api.actor(req),id)); }
  @GetMapping("/assets/{id}/content")
  ResponseEntity<byte[]> content(@PathVariable UUID id,HttpServletRequest req) {
    var a=assets.require(api.actor(req),id);
    return ResponseEntity.ok().contentType(MediaType.IMAGE_PNG).header("X-Content-Type-Options","nosniff").header("Content-Disposition","attachment; filename=\"asset.png\"").body((byte[])a.get("content"));
  }
}
