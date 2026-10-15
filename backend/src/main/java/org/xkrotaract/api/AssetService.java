package org.xkrotaract.api;

import static org.xkrotaract.api.Input.*;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.*;
import java.sql.Timestamp;
import java.time.Duration;
import java.util.*;
import javax.imageio.*;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
class AssetService {
  final CoreService core;
  final ApiSupport api;
  final Queries queries;
  AssetService(CoreService core, ApiSupport api,Queries queries) { this.core=core; this.api=api;this.queries=queries; }

  record Image(byte[] bytes,int width,int height) {}

  Image inspect(MultipartFile file, boolean avatar) {
    if(file==null || file.isEmpty() || file.getSize()>2097152 ||
        !Set.of("image/png","image/jpeg","image/webp").contains(file.getContentType())) throw ApiException.bad();
    try(var stream=ImageIO.createImageInputStream(new ByteArrayInputStream(file.getBytes()))) {
      var readers=ImageIO.getImageReaders(stream);
      if(!readers.hasNext()) throw ApiException.bad();
      var reader=readers.next();
      try {
        String format=reader.getFormatName().toLowerCase(Locale.ROOT);
        String actual=switch(format) { case "png" -> "image/png"; case "jpeg","jpg" -> "image/jpeg"; case "webp" -> "image/webp"; default -> ""; };
        if(!actual.equals(file.getContentType())) throw ApiException.bad();
        reader.setInput(stream,true,true);
        int w=reader.getWidth(0),h=reader.getHeight(0);
        if(w<1||h<1||w>4096||h>4096) throw ApiException.bad();
        BufferedImage source=reader.read(0);
        double scale=avatar?Math.min(1,512.0/Math.max(w,h)):1;
        int width=Math.max(1,(int)Math.round(w*scale)),height=Math.max(1,(int)Math.round(h*scale));
        BufferedImage clean=new BufferedImage(width,height,BufferedImage.TYPE_INT_ARGB);
        Graphics2D g=clean.createGraphics();
        try { g.setRenderingHint(RenderingHints.KEY_INTERPOLATION,RenderingHints.VALUE_INTERPOLATION_BILINEAR);g.drawImage(source,0,0,width,height,null); }
        finally { g.dispose(); source.flush(); }
        ByteArrayOutputStream bytes=new ByteArrayOutputStream();
        if(!ImageIO.write(clean,"png",bytes)) throw ApiException.bad();
        clean.flush();
        if(bytes.size()>2097152) throw ApiException.bad();
        return new Image(bytes.toByteArray(),width,height);
      } finally { reader.dispose(); }
    } catch(IOException|IllegalArgumentException e) { throw ApiException.bad(); }
  }

  void clubLogo(UUID actor,UUID club) {
    if(club==null) throw ApiException.bad();
    var row=core.one("SELECT * FROM clubs WHERE id=?",club);
    if(!"active".equals(row.get("status")) || !(api.clubRole(actor,club,"club_president","club_secretary","club_backup") || api.districtRole(actor,(UUID)row.get("district_id")))) throw ApiException.missing();
  }

  Map<String,Object> store(UUID actor,UUID caseId,UUID club,String purpose,Image image) {
    UUID id=UUID.randomUUID();
    core.db.update("INSERT INTO assets(id,owner_account_id,purpose,club_id,case_id,size_bytes,width,height,content,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)",
        id,actor,purpose,club,caseId,image.bytes().length,image.width(),image.height(),image.bytes(),core.now());
    return dto(core.one("SELECT * FROM assets WHERE id=?",id));
  }

  Map<String,Object> dto(Map<String,Object> a) {
    return map("assetId",a.get("id"),"mediaType",a.get("media_type"),"sizeBytes",a.get("size_bytes"),"width",a.get("width"),"height",a.get("height"),"visibility",a.get("visibility"));
  }

  Map<String,Object> require(UUID actor,UUID id) {
    var a=core.one("SELECT * FROM assets WHERE id=?",id);
    if(a.get("case_id")!=null) {
      var c=core.one("SELECT * FROM support_cases WHERE id=?",a.get("case_id"));
      boolean assigned=api.platformRole(actor,"account_support") && core.db.queryForObject("SELECT count(*) FROM support_case_assignments WHERE case_id=? AND account_id=?",Integer.class,c.get("id"),actor)>0;
      // Anonymous evidence can be inspected only by its assigned support handler.
      if(!assigned && !(actor.equals(c.get("requester_account_id")) && actor.equals(a.get("owner_account_id")))) throw ApiException.missing();
      if(c.get("closed_at")!=null && !Boolean.TRUE.equals(c.get("legal_hold")) && !((Timestamp)c.get("closed_at")).toInstant().plus(Duration.ofDays(30)).isAfter(core.clock.instant())) throw ApiException.missing();
    } else if(!actor.equals(a.get("owner_account_id"))) {
      if("club_logo".equals(a.get("purpose"))) clubLogo(actor,(UUID)a.get("club_id"));
      else if("avatar".equals(a.get("purpose"))) {
        boolean visible=false;
        for(var member:core.db.queryForList("SELECT id FROM members WHERE avatar_asset_id=?",id)) {
          try { queries.detail(actor,(UUID)member.get("id"));visible=true;break; }
          catch(ApiException e) { if(e.status!=404)throw e; }
        }
        if(!visible)throw ApiException.missing();
      }
      else throw ApiException.missing();
    }
    return a;
  }

  @Scheduled(initialDelay=60000,fixedDelay=3600000)
  public void purgeEvidence() {
    core.db.update("DELETE FROM assets a USING support_cases c WHERE a.case_id=c.id AND c.closed_at<=? AND NOT c.legal_hold",Timestamp.from(core.clock.instant().minus(Duration.ofDays(30))));
  }
}
