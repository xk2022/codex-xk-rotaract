import { describe, expect, it } from "vitest";
import {
  readPortalRoute,
  readWorkspacePage,
  isPublicPortalRoute,
} from "./portalRoute";
describe("safe workspace deep links", () => {
  it("keeps base routes and legacy aliases independent of the view query", () => {
    expect(readPortalRoute("#/demo?view=annual")).toBe("demo");
    expect(readPortalRoute("#/workspace?view=account")).toBe("workspace");
    expect(readPortalRoute("#/BizMap")).toBe("map");
  });
  it("uses safe fallbacks for unsupported paths and view values", () => {
    expect(readPortalRoute("#/unknown")).toBe("home");
    expect(readWorkspacePage("#/demo?view=not-a-page")).toBe("overview");
    expect(readWorkspacePage("#/workspace?view=%3Cscript%3E")).toBe("overview");
  });
  it("accepts only named workspace pages without member identifiers", () => {
    expect(readWorkspacePage("#/demo?view=roles")).toBe("roles");
    expect(readWorkspacePage("#/workspace?view=history")).toBe("history");
    expect(readWorkspacePage("#/workspace?member=m1")).toBe("overview");
  });
  it("keeps public community detail links separate from the activity workspace", () => {
    for (const route of ["calendar", "clubs", "club", "event", "business"]) {
      const parsed = readPortalRoute(`#/${route}?id=city-walk`);
      expect(parsed).toBe(route);
      expect(isPublicPortalRoute(parsed)).toBe(true);
    }
    expect(readWorkspacePage("#/demo?view=events")).toBe("events");
    expect(readWorkspacePage("#/demo?view=coupons")).toBe("coupons");
    expect(isPublicPortalRoute(readPortalRoute("#/demo?view=events"))).toBe(
      false,
    );
  });
});
