import { Component, lazy, Suspense, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Flower2, ArrowLeft, RefreshCw } from "lucide-react";
import { PublicHome } from "./features/PublicHome";
import {
  goToPortal,
  readPortalRoute,
  isPublicPortalRoute,
} from "./portalRoute";
import type { PublicPortalRoute } from "./portalRoute";
import "./portal.css";

// The public React entry does not import the management application eagerly.
const Workspace = lazy(() => import("./App"));
const LiveWorkspace = lazy(() => import("./live/LiveWorkspace"));
const liveMode = import.meta.env.VITE_API_MODE === "live";
const isPublic = isPublicPortalRoute;

class ScreenBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <section className="portal-recovery" role="alert">
        <Flower2 size={36} />
        <p className="portal-eyebrow">Rotaract 萬花筒</p>
        <h1>畫面尚未載入完成</h1>
        <p>請重新載入；若剛更新過網站，重新載入可取得最新畫面。</p>
        <div>
          <button
            className="button primary"
            onClick={() => window.location.reload()}
          >
            <RefreshCw size={16} />
            重新載入
          </button>
          <a
            className="button secondary"
            href={`${window.location.pathname}${window.location.search}#/`}
          >
            <ArrowLeft size={16} />
            返回公開首頁
          </a>
        </div>
      </section>
    );
  }
}
function OpeningWorkspace() {
  return (
    <section className="portal-recovery" role="status" aria-live="polite">
      <Flower2 className="portal-loading-mark" size={36} />
      <p className="portal-eyebrow">Rotaract 萬花筒</p>
      <h1>正在開啟會員服務</h1>
      <p>公開首頁隨時可返回，請稍候。</p>
      <a className="button secondary" href="#/">
        <ArrowLeft size={16} />
        返回公開首頁
      </a>
    </section>
  );
}
export default function Portal() {
  const [route, setRoute] = useState(readPortalRoute);
  const [locationHash, setLocationHash] = useState(window.location.hash);
  const [workspaceStarted, setWorkspaceStarted] = useState(
    () => !isPublic(readPortalRoute()),
  );
  useEffect(() => {
    let pending: number | undefined;
    const sync = () => {
      if (pending !== undefined) window.clearTimeout(pending);
      // Read in the next task, after every hashchange listener has finished.
      // A microtask may run between listeners and hide the editor too early.
      // The workspace can restore the URL when its draft guard is canceled.
      pending = window.setTimeout(() => {
        const next = readPortalRoute();
        if (!isPublic(next)) setWorkspaceStarted(true);
        setRoute(next);
        setLocationHash(window.location.hash);
      }, 0);
    };
    window.addEventListener("hashchange", sync);
    return () => {
      window.removeEventListener("hashchange", sync);
      if (pending !== undefined) window.clearTimeout(pending);
    };
  }, []);
  useEffect(() => {
    if (!isPublic(route)) return;
    const titles: Record<PublicPortalRoute, string> = {
      home: "玩轉你的扶青年代",
      map: "扶青產業地圖",
      calendar: "共同行事曆",
      clubs: "探索社團",
      club: "社團公開頁",
      event: "活動詳情",
    };
    document.title = `${titles[route]} · Rotaract 萬花筒`;
    document.getElementById("public-main")?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, [route, locationHash]);
  const publicPage = isPublic(route);
  return (
    <>
      {publicPage && (
        <ScreenBoundary key={`public-${route}-${locationHash}`}>
          <PublicHome
            page={route as PublicPortalRoute}
            onNavigate={(page) => {
              goToPortal(page);
              window.scrollTo(0, 0);
            }}
            onLogin={() => goToPortal("login")}
            onRegister={() => goToPortal("register")}
            onAdmin={() => goToPortal("admin")}
          />
        </ScreenBoundary>
      )}
      {workspaceStarted && (
        <div
          className="portal-workspace"
          hidden={publicPage}
          inert={publicPage}
        >
          <ScreenBoundary>
            <Suspense fallback={<OpeningWorkspace />}>
              {liveMode ? <LiveWorkspace /> : <Workspace embedded />}
            </Suspense>
          </ScreenBoundary>
        </div>
      )}
    </>
  );
}
