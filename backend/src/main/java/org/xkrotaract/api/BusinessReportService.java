package org.xkrotaract.api;

import static org.xkrotaract.api.Input.*;
import com.fasterxml.jackson.databind.JsonNode;
import java.sql.Timestamp;
import java.util.*;
import org.springframework.stereotype.Service;

@Service
class BusinessReportService {
  final CoreService core;
  final ApiSupport access;
  final BusinessService businesses;

  BusinessReportService(CoreService core,ApiSupport access,BusinessService businesses) {
    this.core=core;
    this.access=access;
    this.businesses=businesses;
  }

  void requireContent(UUID actor) {
    core.db.queryForList("SELECT id FROM role_grants WHERE account_id=? ORDER BY id FOR SHARE",actor);
    businesses.requireContent(actor);
  }

  boolean reporter(UUID actor,Map<String,Object> row) {
    return core.db.queryForObject("SELECT count(*) FROM members WHERE id=? AND account_id=?",Integer.class,row.get("reporter_member_id"),actor)==1;
  }

  Map<String,Object> report(UUID id,boolean lock) {
    return core.one("SELECT * FROM business_reports WHERE id=?"+(lock?" FOR UPDATE":""),id);
  }

  Map<String,Object> dto(Map<String,Object> row) {
    var result=map("id",row.get("id"),"companyId",row.get("company_id"),"companyName",row.get("company_name_snapshot"),
        "reporterId",row.get("reporter_member_id"),"reason",row.get("reason"),"description",row.get("description"),
        "status",row.get("status"),"version",row.get("version"),"createdAt",((Timestamp)row.get("created_at")).toInstant().toString(),
        "updatedAt",((Timestamp)row.get("updated_at")).toInstant().toString());
    if(row.get("assigned_account_id")!=null) result.put("assignedTo",row.get("assigned_account_id"));
    if(row.get("resolution")!=null) result.put("resolution",row.get("resolution"));
    return result;
  }

  Object create(UUID actor,JsonNode b) {
    fields(b,"companyId","reason","description");
    UUID member=access.memberId(actor),company=uuid(b,"companyId");
    String reason=text(b,"reason",1,30),description=text(b,"description",1,2000);
    if(!Set.of("missing","address","impersonation","other").contains(reason)) throw ApiException.bad();
    // Company publication and creation serialize, while reports never change the company row.
    var current=businesses.locked(company);
    if(businesses.publicProjection(current)==null) throw ApiException.missing();
    if(core.db.queryForObject("SELECT count(*) FROM business_reports WHERE reporter_member_id=? AND company_id=? AND status IN ('open','processing')",Integer.class,member,company)>0)
      throw ApiException.conflict();
    UUID id=UUID.randomUUID();
    core.db.update("INSERT INTO business_reports(id,company_id,company_name_snapshot,reporter_member_id,reason,description,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)",
        id,company,current.get("name"),member,reason,description,core.now(),core.now());
    audit(actor,"business.report.create",id,description);
    return dto(report(id,false));
  }

  Object detail(UUID actor,UUID id) {
    var current=report(id,false);
    if(!reporter(actor,current)&&!access.platformRole(actor,"content_manager")) throw ApiException.missing();
    return dto(current);
  }

  Object list(UUID actor,Map<String,String> q) {
    for(var key:q.keySet()) if(!Set.of("scope","companyId","status","page","pageSize").contains(key)) throw ApiException.bad();
    String scope=q.getOrDefault("scope","self");
    if(!Set.of("self","managed").contains(scope)) throw ApiException.bad();
    if(q.containsKey("status")&&!Set.of("open","processing","closed").contains(q.get("status"))) throw ApiException.bad();
    if(q.containsKey("companyId")) UUID.fromString(q.get("companyId"));
    List<Map<String,Object>> rows;
    if(scope.equals("managed")) {
      requireContent(actor);
      rows=core.db.queryForList("SELECT * FROM business_reports ORDER BY updated_at DESC,id");
    } else {
      UUID member=access.memberId(actor);
      rows=core.db.queryForList("SELECT * FROM business_reports WHERE reporter_member_id=? ORDER BY updated_at DESC,id",member);
    }
    return ApiSupport.page(rows.stream()
        .filter(r->!q.containsKey("companyId")||q.get("companyId").equals(r.get("company_id").toString()))
        .filter(r->!q.containsKey("status")||q.get("status").equals(r.get("status")))
        .map(this::dto).toList(),q);
  }

  Object decide(UUID actor,UUID id,JsonNode b,boolean close) {
    fields(b,"version","resolution");
    requireContent(actor);
    var current=report(id,true);
    if(version(b)!=(Integer)current.get("version")) throw new ApiException(409,"VERSION_CONFLICT","案件已更新，請重新載入確認。");
    if(!(close?"processing":"open").equals(current.get("status"))) throw ApiException.conflict();
    String resolution=text(b,"resolution",1,2000);
    core.db.update("UPDATE business_reports SET status=?,assigned_account_id=?,resolution=?,updated_at=?,version=version+1 WHERE id=?",
        close?"closed":"processing",actor,resolution,core.now(),id);
    audit(actor,close?"business.report.close":"business.report.accept",id,resolution);
    return dto(report(id,false));
  }

  void audit(UUID actor,String action,UUID id,String explanation) {
    UUID event=UUID.randomUUID();
    core.db.update("INSERT INTO audit_events VALUES(?,?,?,?,?)",event,actor,action,id,core.now());
    core.db.update("INSERT INTO business_report_audit_details(event_id,report_id,explanation) VALUES(?,?,?)",event,id,explanation);
  }
}
