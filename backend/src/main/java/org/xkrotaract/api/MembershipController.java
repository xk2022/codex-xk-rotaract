package org.xkrotaract.api;

import static org.xkrotaract.api.Input.*;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.servlet.http.HttpServletRequest;
import java.util.*;
import java.util.function.Supplier;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
class MembershipController {
  final MembershipService service; final ApiSupport access;
  MembershipController(MembershipService service,ApiSupport access){this.service=service;this.access=access;}
  UUID actor(HttpServletRequest req){return access.actor(req);}
  ResponseEntity<?> mutate(HttpServletRequest req,JsonNode body,int status,String kind,UUID id,Supplier<Object> action){
    var result=access.mutation(req,body,status,()->authorize(req,kind,id,body),()->{
      try{return action.get();}catch(MembershipService.ReapprovalRequired e){return map("_workflowConflict",true,"code","STATE_CONFLICT","message","核准或原社籍已變更，請重新核准。","fieldErrors",List.of(),"requestId",UUID.randomUUID().toString());}
    });
    if(result.getBody() instanceof Map<?,?> m && Boolean.TRUE.equals(m.get("_workflowConflict"))){var out=new LinkedHashMap<>(m);out.remove("_workflowConflict");return ResponseEntity.status(409).body(out);}
    if(result.getBody() instanceof JsonNode n && n.path("_workflowConflict").asBoolean()){var out=n.deepCopy();((com.fasterxml.jackson.databind.node.ObjectNode)out).remove("_workflowConflict");return ResponseEntity.status(409).body(out);}
    return result;
  }
  void authorize(HttpServletRequest req,String kind,UUID id,JsonNode b){
    UUID actor=actor(req);var core=service.core;
    core.db.queryForList("SELECT id FROM role_grants WHERE account_id=? ORDER BY id FOR SHARE",actor);
    switch(kind){
      case "createTransfer" -> service.owner(actor,service.membership(uuid(b,"fromMembershipId")).get("member_id"));
      case "createEnd" -> service.owner(actor,service.membership(uuid(b,"membershipId")).get("member_id"));
      case "approveEnd" -> core.reviewer(actor,service.id(core.one("SELECT * FROM membership_end_requests WHERE id=?",id),"club_id"));
      case "annual" -> access.requireClub(actor,id);
      case "directEnd" -> core.reviewer(actor,service.id(service.membership(id),"club_id"));
      case "approveTransfer","rejectTransfer","withdrawTransfer","executeTransfer" -> {
        var t=core.one("SELECT * FROM membership_transfers WHERE id=?",id);
        if(kind.equals("withdrawTransfer")||kind.equals("executeTransfer"))service.owner(actor,t.get("member_id"));
        else if(kind.equals("approveTransfer"))core.reviewer(actor,service.id(t,service.choice(b,"side","from","to")+"_club_id"));
        else if(!service.canReview(actor,service.id(t,"from_club_id"))&&!service.canReview(actor,service.id(t,"to_club_id")))throw ApiException.missing();
      }
      case "visibility" -> {var m=service.membership(id);if(!Objects.equals(service.self(actor),m.get("member_id"))){service.moderate(actor,service.id(m,"club_id"));if(!"hidden".equals(b.path("visibility").asText()))throw new ApiException(403,"FORBIDDEN","公開須會員本人同意。");}}
      case "publication" -> service.moderate(actor,service.id(service.membership(id),"club_id"));
      case "decision" -> service.owner(actor,core.one("SELECT * FROM publication_requests WHERE id=?",id).get("subject_member_id"));
      case "override" -> {
        if(!access.permission(actor,"history:override",service.id(service.membership(id),"club_id")))throw ApiException.missing();access.requireMfa(req);
        var a=core.one("SELECT * FROM accounts WHERE id=?",actor);
        if(!b.path("currentPassword").isTextual()||b.get("currentPassword").asText().isEmpty()||b.get("currentPassword").asText().codePointCount(0,b.get("currentPassword").asText().length())>128)throw ApiException.bad();
        core.rate("history-override:"+actor,10,java.time.Duration.ofMinutes(15),false);
        if(!core.passwords.matches(b.get("currentPassword").asText(),(String)a.get("password_hash"))){core.rate("history-override:"+actor,10,java.time.Duration.ofMinutes(15),true);throw ApiException.auth();}
      }
      default -> throw new IllegalArgumentException(kind);
    }
  }
  @GetMapping("/members/{id}/memberships") Object memberships(@PathVariable UUID id,@RequestParam Map<String,String> q,HttpServletRequest req){return service.memberships(actor(req),id,q);}
  @GetMapping("/membership-transfers") Object transfers(@RequestParam Map<String,String> q,HttpServletRequest req){return service.transfers(actor(req),q);}
  @PostMapping("/membership-transfers") ResponseEntity<?> createTransfer(@RequestBody JsonNode b,HttpServletRequest req){return mutate(req,b,201,"createTransfer",null,()->service.createTransfer(actor(req),b,req));}
  @PostMapping("/membership-transfers/{id}/approve") ResponseEntity<?> approveTransfer(@PathVariable UUID id,@RequestBody JsonNode b,HttpServletRequest req){return transfer(id,b,"approve",req);}
  @PostMapping("/membership-transfers/{id}/reject") ResponseEntity<?> rejectTransfer(@PathVariable UUID id,@RequestBody JsonNode b,HttpServletRequest req){return transfer(id,b,"reject",req);}
  @PostMapping("/membership-transfers/{id}/withdraw") ResponseEntity<?> withdrawTransfer(@PathVariable UUID id,@RequestBody JsonNode b,HttpServletRequest req){return transfer(id,b,"withdraw",req);}
  @PostMapping("/membership-transfers/{id}/execute") ResponseEntity<?> executeTransfer(@PathVariable UUID id,@RequestBody JsonNode b,HttpServletRequest req){return transfer(id,b,"execute",req);}
  ResponseEntity<?> transfer(UUID id,JsonNode b,String action,HttpServletRequest req){String kind=action+"Transfer";return mutate(req,b,200,kind,id,()->service.decideTransfer(actor(req),id,b,action,req));}
  @GetMapping("/membership-end-requests") Object ends(@RequestParam Map<String,String> q,HttpServletRequest req){return service.ends(actor(req),q);}
  @PostMapping("/membership-end-requests") ResponseEntity<?> createEnd(@RequestBody JsonNode b,HttpServletRequest req){return mutate(req,b,201,"createEnd",null,()->service.createEnd(actor(req),b,req));}
  @PostMapping("/membership-end-requests/{id}/approve") ResponseEntity<?> approveEnd(@PathVariable UUID id,@RequestBody JsonNode b,HttpServletRequest req){return mutate(req,b,200,"approveEnd",id,()->service.approveEnd(actor(req),id,b,req));}
  @PostMapping("/memberships/{id}/end") ResponseEntity<?> end(@PathVariable UUID id,@RequestBody JsonNode b,HttpServletRequest req){return mutate(req,b,200,"directEnd",id,()->service.directEnd(actor(req),id,b,req));}
  @GetMapping("/clubs/{id}/annual-confirmations") Object years(@PathVariable UUID id,@RequestParam Map<String,String> q,HttpServletRequest req){return service.years(actor(req),id,q);}
  @PostMapping("/clubs/{id}/annual-confirmations") ResponseEntity<?> year(@PathVariable UUID id,@RequestBody JsonNode b,HttpServletRequest req){return mutate(req,b,200,"annual",id,()->service.confirmYear(actor(req),id,b,req));}
  @PatchMapping("/memberships/{id}/experience-visibility") ResponseEntity<?> visibility(@PathVariable UUID id,@RequestBody JsonNode b,HttpServletRequest req){return mutate(req,b,200,"visibility",id,()->service.visibility(actor(req),id,b,false,req));}
  @PostMapping("/memberships/{id}/publication-requests") ResponseEntity<?> publication(@PathVariable UUID id,@RequestBody JsonNode b,HttpServletRequest req){return mutate(req,b,201,"publication",id,()->service.requestPublication(actor(req),id,b,req));}
  @GetMapping("/me/publication-requests") Object publications(@RequestParam Map<String,String> q,HttpServletRequest req){return service.publications(actor(req),q);}
  @PostMapping("/publication-requests/{id}/decision") ResponseEntity<?> decision(@PathVariable UUID id,@RequestBody JsonNode b,HttpServletRequest req){return mutate(req,b,200,"decision",id,()->service.decidePublication(actor(req),id,b,req));}
  @PostMapping("/admin/memberships/{id}/visibility-overrides") ResponseEntity<?> override(@PathVariable UUID id,@RequestBody JsonNode b,HttpServletRequest req){return mutate(req,b,200,"override",id,()->service.visibility(actor(req),id,b,true,req));}
  @GetMapping("/me/audit-events") Object myAudits(@RequestParam Map<String,String> q,HttpServletRequest req){return service.audits(actor(req),true,q);}
  @GetMapping("/audit-events") Object audits(@RequestParam Map<String,String> q,HttpServletRequest req){return service.audits(actor(req),false,q);}
}
