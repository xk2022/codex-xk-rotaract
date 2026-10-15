export type PublicPortalRoute =
  "home" | "map" | "calendar" | "clubs" | "club" | "event";
export type PortalRoute =
  PublicPortalRoute | "login" | "register" | "admin" | "workspace" | "demo";

// Hash paths keep direct links and refresh working under the GitHub Pages subpath.
export function readPortalRoute(hash = window.location.hash): PortalRoute {
  const path = hash
    .split("?")[0]
    .replace(/^#\/?/, "")
    .replace(/\/$/, "")
    .toLowerCase();
  if (path === "bizmap") return "map";
  return [
    "map",
    "calendar",
    "clubs",
    "club",
    "event",
    "login",
    "register",
    "admin",
    "workspace",
    "demo",
  ].includes(path)
    ? (path as PortalRoute)
    : "home";
}

export function isPublicPortalRoute(
  route: PortalRoute,
): route is PublicPortalRoute {
  return ["home", "map", "calendar", "clubs", "club", "event"].includes(route);
}

export function goToPortal(route: PortalRoute) {
  window.location.hash = route === "home" ? "/" : `/${route}`;
}

export const workspacePages = [
  "overview",
  "members",
  "applications",
  "club",
  "profile",
  "transfers",
  "account",
  "roles",
  "annual",
  "membership",
  "history",
  "audit",
  "support",
  "district",
  "events",
] as const;
export function readWorkspacePage(
  hash = window.location.hash,
): (typeof workspacePages)[number] {
  const value = new URLSearchParams(hash.split("?")[1] ?? "").get("view");
  return workspacePages.includes(value as (typeof workspacePages)[number])
    ? (value as (typeof workspacePages)[number])
    : "overview";
}
export function goToWorkspacePage(page: (typeof workspacePages)[number]) {
  const root = readPortalRoute() === "demo" ? "demo" : "workspace";
  window.location.hash = `/${root}?view=${page}`;
}
