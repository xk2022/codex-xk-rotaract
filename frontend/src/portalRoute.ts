export type PortalRoute =
  | "home"
  | "map"
  | "calendar"
  | "login"
  | "register"
  | "admin"
  | "workspace"
  | "demo";

// Hash paths keep direct links and refresh working under the GitHub Pages subpath.
export function readPortalRoute(hash = window.location.hash): PortalRoute {
  const path = hash.replace(/^#\/?/, "").replace(/\/$/, "").toLowerCase();
  if (path === "bizmap") return "map";
  return [
    "map",
    "calendar",
    "login",
    "register",
    "admin",
    "workspace",
    "demo",
  ].includes(path)
    ? (path as PortalRoute)
    : "home";
}

export function goToPortal(route: PortalRoute) {
  window.location.hash = route === "home" ? "/" : `/${route}`;
}
