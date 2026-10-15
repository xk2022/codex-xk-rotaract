package org.xkrotaract.api;

import java.util.*;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

/** Public assets are derived from currently public resources, never from an upload flag. */
@RestController
@RequestMapping("/api/v1/public/assets")
class PublicAssetController {
  final CoreService core;
  PublicAssetController(CoreService core) {this.core=core;}
  @GetMapping("/{id}/content")
  ResponseEntity<byte[]> content(@PathVariable UUID id) {
    var a=core.one("SELECT a.* FROM assets a WHERE a.id=? AND a.purpose='club_logo' AND a.case_id IS NULL AND EXISTS(SELECT 1 FROM clubs c WHERE c.logo_asset_id=a.id AND c.id=a.club_id AND c.status='active' AND c.is_public=true)",id);
    return ResponseEntity.ok().contentType(MediaType.IMAGE_PNG).header("X-Content-Type-Options","nosniff").header("Content-Disposition","inline; filename=\"club-logo.png\"").body((byte[])a.get("content"));
  }
}
