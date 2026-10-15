import { useEffect, useRef, useState } from "react";
import "./workspace-polish.css";
import type { FormEvent, ReactNode } from "react";
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Building2,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronRight,
  CircleHelp,
  ClipboardCheck,
  Clock3,
  EyeOff,
  FileClock,
  Flower2,
  Globe2,
  HeartHandshake,
  LayoutDashboard,
  ListFilter,
  LogIn,
  Menu,
  Plus,
  RotateCcw,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import {
  clubName,
  contactValue,
  initialState,
  isManager,
  actorClub,
  listedMembers,
  statusLabel,
  transition,
} from "./domain";
import type {
  Actor,
  Application,
  Command,
  Member,
  State,
  Transfer,
} from "./domain";
import { AuthView, AccountView } from "./features/AccountViews";
import {
  OrganizationView,
  RolesView,
  DistrictView,
  useOrganizationDemo,
} from "./features/OrganizationViews";
import {
  HistoryView,
  SupportView,
  AuditView,
  PublicSupportView,
  useCaseDemo,
} from "./features/HistorySupportViews";
import { AnnualView, MembershipView } from "./features/MemberOperations";
import { PublicHome } from "./features/PublicHome";
import {
  goToPortal,
  readPortalRoute,
  readWorkspacePage,
  goToWorkspacePage,
} from "./portalRoute";

type Page =
  | "overview"
  | "members"
  | "applications"
  | "club"
  | "profile"
  | "transfers"
  | "account"
  | "roles"
  | "annual"
  | "membership"
  | "history"
  | "audit"
  | "support"
  | "district";
type Modal = "register" | "join" | "transfer" | null;
const demoToday = "2026-10-15";
const actorLabels: Record<Actor, string> = {
  taipei: "台北星光 · 社長",
  taichung: "台中山海 · 秘書",
  member: "會員本人",
  visitor: "未登入訪客",
  district: "地區管理者（範圍可切換）",
  platform: "平台 · 帳號支援",
};
const nav: { page: Page; label: string; icon: typeof Users }[] = [
  { page: "overview", label: "管理總覽", icon: LayoutDashboard },
  { page: "members", label: "會員名冊", icon: Users },
  { page: "applications", label: "入社申請", icon: ClipboardCheck },
  { page: "transfers", label: "轉社作業", icon: ArrowDownLeft },
  { page: "membership", label: "退社與 OB", icon: FileClock },
  { page: "annual", label: "年度名冊", icon: CalendarDays },
  { page: "club", label: "社團資料", icon: Building2 },
  { page: "roles", label: "角色與交接", icon: ShieldCheck },
  { page: "profile", label: "個人資料", icon: Settings2 },
  { page: "account", label: "帳號設定", icon: Settings2 },
  { page: "history", label: "歷史與同意", icon: EyeOff },
  { page: "audit", label: "異動紀錄", icon: FileClock },
  { page: "district", label: "地區管理", icon: Building2 },
  { page: "support", label: "帳號協助", icon: CircleHelp },
];
function Avatar({
  member,
  large = false,
}: {
  member: Member;
  large?: boolean;
}) {
  return (
    <span
      className={`avatar avatar-${member.id.charCodeAt(member.id.length - 1) % 5} ${large ? "avatar-large" : ""}`}
    >
      {member.avatarUrl ? (
        <img src={member.avatarUrl} alt="" />
      ) : (
        member.callName.slice(0, 1)
      )}
    </span>
  );
}
function Badge({ status }: { status: Member["status"] }) {
  return <span className={`badge ${status}`}>{statusLabel[status]}</span>;
}
function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <Flower2 size={32} />
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
function ModalShell({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-labelledby="dialog-title"
    >
      <header>
        <div>
          <span className="eyebrow">ROTARACT KALEIDOSCOPE</span>
          <h2 id="dialog-title">{title}</h2>
        </div>
        <button className="icon-button" onClick={onClose} aria-label="關閉視窗">
          <X />
        </button>
      </header>
      {children}
    </dialog>
  );
}
export default function App({ embedded = false }: { embedded?: boolean } = {}) {
  const [portalRoute, setPortalRoute] = useState(readPortalRoute);
  const lastHash = useRef(window.location.hash);
  const lastRoot = useRef(readPortalRoute());
  const skipDraftGuard = useRef(false);
  const confirmDraftLeave = () =>
    !document.querySelector('[data-unsaved="true"]') ||
    window.confirm("你有尚未儲存的變更。離開將放棄這些內容，確定離開嗎？");
  const [state, setRawState] = useState<State>(initialState);
  const stateRef = useRef(state);
  const setState = (next: State) => {
    stateRef.current = next;
    setRawState(next);
  };
  const [actor, setActor] = useState<Actor>(() =>
    readPortalRoute() === "demo" ? "taipei" : "visitor",
  );
  const [page, setPage] = useState<Page>(readWorkspacePage);
  const [sidebar, setSidebar] = useState(false);
  useEffect(() => {
    if (!sidebar) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSidebar(false);
        document
          .querySelector<HTMLButtonElement>('[aria-label="開啟選單"]')
          ?.focus();
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [sidebar]);
  const [query, setQuery] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "forgot" | "reset">(
    "login",
  );
  const [feedbackMode, setFeedbackMode] = useState("normal");
  const [clubFilter, setClubFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [memberSort, setMemberSort] = useState("callName");
  const [listPage, setListPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [includeNonRegular, setIncludeNonRegular] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState("基本資料");
  const [modal, setModal] = useState<Modal>(() =>
    readPortalRoute() === "register" ? "register" : null,
  );
  const [historyMemberId, setHistoryMemberId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    const onRouteChange = () => {
      if (!skipDraftGuard.current && !confirmDraftLeave()) {
        window.history.replaceState(
          null,
          "",
          `${window.location.pathname}${window.location.search}${lastHash.current}`,
        );
        return;
      }
      skipDraftGuard.current = false;
      const next = readPortalRoute();
      const rootChanged = next !== lastRoot.current;
      lastRoot.current = next;
      lastHash.current = window.location.hash;
      setPortalRoute(next);
      if (next === "workspace" || next === "demo") setPage(readWorkspacePage());
      setModal(next === "register" ? "register" : null);
      setSelected(null);
      setHistoryMemberId(null);
      setSidebar(false);
      setMessage("");
      setError("");
      setFeedbackMode("normal");
      if (["login", "register", "admin"].includes(next)) {
        setActor("visitor");
        setAuthMode("login");
      }
      if (next === "demo" && rootChanged) setActor("taipei");
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onRouteChange);
    return () => window.removeEventListener("hashchange", onRouteChange);
  }, []);
  useEffect(() => {
    const titles = {
      home: "玩轉你的扶青年代",
      map: "扶青產業地圖",
      calendar: "共同行事曆",
      login: "會員登入",
      register: "會員註冊",
      admin: "管理後台登入",
      workspace: "會員與社團工作區",
      demo: "管理後台示範",
    };
    document.title = `${titles[portalRoute]} · Rotaract 萬花筒`;
  }, [portalRoute]);
  const addAudit = (message: string) => {
    const now = stateRef.current;
    const targetMember =
      message.match(/\[會員:([^\]]+)\]/)?.[1] ??
      (actor === "member" ? now.currentMemberId : "none");
    const targetClub =
      message.match(/\[社團:([^\]]+)\]/)?.[1] ??
      (isManager(actor) ? actorClub(actor) : "none");
    setState({
      ...now,
      audit: [
        `[member:${targetMember}][club:${targetClub}] ${demoToday} · ${actorLabels[actor] ?? `${organization.state.clubs.find((c) => c.id === actorClub(actor))?.name ?? "社團"} · 管理者`} · ${message}`,
        ...now.audit,
      ],
    });
  };
  const organization = useOrganizationDemo(addAudit);
  const cases = useCaseDemo();
  const visibleNav = nav.filter((n) =>
    actor === "visitor"
      ? ["overview"].includes(n.page)
      : actor === "platform"
        ? ["support", "history", "audit"].includes(n.page)
        : actor === "district"
          ? [
              "members",
              "club",
              "roles",
              "district",
              "history",
              "audit",
            ].includes(n.page)
          : actor === "member"
            ? !["club", "roles", "annual", "district"].includes(n.page)
            : !["account", "district", "support"].includes(n.page),
  );
  useEffect(() => {
    if (actor !== "visitor" && !visibleNav.some((item) => item.page === page)) {
      setPage(
        actor === "platform"
          ? "support"
          : actor === "district"
            ? "district"
            : "overview",
      );
    }
  }, [actor, page]);
  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => {
      if (document.querySelector('[data-unsaved="true"]')) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", unload);
    return () => window.removeEventListener("beforeunload", unload);
  }, []);
  useEffect(() => {
    const main = document.getElementById("main");
    if (main) {
      main.focus({ preventScroll: true });
    }
  }, [page]);
  useEffect(() => {
    const root = readPortalRoute();
    if (actor !== "visitor" && (root === "workspace" || root === "demo")) {
      const hash = `#/${root}?view=${page}`;
      if (window.location.hash !== hash)
        window.history.replaceState(
          null,
          "",
          `${window.location.pathname}${window.location.search}${hash}`,
        );
      lastHash.current = hash;
    }
  }, [page, actor, portalRoute]);
  const disabledClubs = useRef<string[]>([]);
  useEffect(() => {
    const disabled = organization.state.clubs
      .filter((c) => !c.enabled)
      .map((c) => c.id);
    if (disabled.some((id) => !disabledClubs.current.includes(id))) {
      const next = structuredClone(stateRef.current);
      next.applications
        .filter((a) => a.status === "pending" && disabled.includes(a.clubId))
        .forEach((a) => {
          a.status = "terminated";
          a.reason = "社團已停用，申請終止；恢復後請重新申請。";
        });
      next.transfers
        .filter(
          (t) =>
            ["pending", "ready"].includes(t.status) &&
            (disabled.includes(t.fromClub) || disabled.includes(t.toClub)),
        )
        .forEach((t) => {
          t.status = "terminated";
          t.reason = "社團已停用，轉社申請終止；原社籍保留。";
        });
      setState(next);
    }
    disabledClubs.current = disabled;
  }, [organization.state.clubs]);
  const current = state.members.find((m) => m.id === state.currentMemberId)!;
  const managedClub =
    actor === "district"
      ? (organization.state.clubs.find(
          (c) => c.district === organization.district,
        )?.id ?? "none")
      : isManager(actor)
        ? actorClub(actor)
        : (current.clubId ?? "taipei");
  const manager = isManager(actor);
  const scoped = state.members.filter(
    (m) => m.clubId === managedClub && m.status !== "unaffiliated",
  );
  const overviewMembers = listedMembers(
    state,
    actor,
    false,
    "",
    organization.state.clubs,
    organization.district,
  ).filter((member) => member.clubId === managedClub);
  const applications =
    actor === "visitor"
      ? []
      : state.applications.filter((a) =>
          manager ? a.clubId === actorClub(actor) : a.memberId === current.id,
        );
  const pending = applications.filter((a) => a.status === "pending");
  const transfers = state.transfers.filter((t) =>
    manager
      ? t.fromClub === actorClub(actor) || t.toClub === actorClub(actor)
      : t.memberId === current.id,
  );
  const members = listedMembers(
    state,
    actor,
    includeNonRegular,
    query,
    organization.state.clubs,
    organization.district,
  )
    .filter(
      (m) =>
        (statusFilter === "all" || m.status === statusFilter) &&
        (clubFilter === "all" || m.clubId === clubFilter) &&
        (typeFilter === "all" || typeFilter === "ROTARACT"),
    )
    .sort((a, b) =>
      memberSort === "joined-desc"
        ? b.startsOn.localeCompare(a.startsOn) ||
          a.callName.localeCompare(b.callName)
        : memberSort === "joined-asc"
          ? a.startsOn.localeCompare(b.startsOn) ||
            a.callName.localeCompare(b.callName)
          : memberSort === "name"
            ? a.name.localeCompare(b.name, "zh-Hant")
            : a.callName.localeCompare(b.callName, "zh-Hant"),
    );
  const pageCount = Math.max(1, Math.ceil(members.length / pageSize));
  const currentPage = Math.min(listPage, pageCount);
  const pagedMembers = members.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );
  useEffect(() => {
    setListPage(1);
  }, [
    query,
    includeNonRegular,
    statusFilter,
    clubFilter,
    typeFilter,
    memberSort,
    actor,
    organization.district,
  ]);
  const selectedMember = state.members.find((m) => m.id === selected);
  const canSeeSelected =
    selectedMember &&
    ((actor === "member" && selectedMember.id === current.id) ||
      listedMembers(
        state,
        actor,
        true,
        "",
        organization.state.clubs,
        organization.district,
      ).some((m) => m.id === selectedMember.id));
  const activeTransfer = state.transfers.find(
    (t) => t.memberId === current.id && ["pending", "ready"].includes(t.status),
  );
  const navigate = (next: Page) => {
    if (next !== page && !confirmDraftLeave()) return;
    skipDraftGuard.current =
      window.location.hash !==
      `/${readPortalRoute() === "demo" ? "demo" : "workspace"}?view=${next}`.replace(
        /^/,
        "#",
      );
    goToWorkspacePage(next);
    setPage(next);
    setSelected(null);
    setSidebar(false);
    setFeedbackMode("normal");
    setError("");
    setMessage("");
  };
  const switchActor = (next: Actor) => {
    if (next !== actor && !confirmDraftLeave()) return false;
    setActor(next);
    setSelected(null);
    setHistoryMemberId(null);
    setMessage("");
    setError("");
    setFeedbackMode("normal");
    if (next === "platform") setPage("support");
    else if (next === "district") setPage("district");
    else if (
      [
        "support",
        "district",
        "roles",
        "annual",
        "account",
        "history",
        "audit",
        "membership",
      ].includes(page)
    )
      setPage(next === "member" ? "profile" : "overview");
    return true;
  };
  const run = (command: Command, success: string) => {
    try {
      const targetClub =
        "clubId" in command
          ? command.clubId
          : command.type === "transfer"
            ? command.toClub
            : null;
      if (
        targetClub &&
        organization.state.clubs.some(
          (c) => c.id === targetClub && !c.enabled,
        ) &&
        ["apply", "transfer"].includes(command.type)
      )
        throw new Error("社團已停用，暫不接受申請。");
      if (
        (command.type === "approveTransfer" ||
          command.type === "executeTransfer") &&
        stateRef.current.transfers.some(
          (t) =>
            t.id === command.id &&
            organization.state.clubs.some(
              (c) => !c.enabled && [t.fromClub, t.toClub].includes(c.id),
            ),
        )
      )
        throw new Error("涉及停用社團，無法核准或執行。");
      const result = transition(
        stateRef.current,
        actor,
        command,
        demoToday,
        organization.state.clubs,
      );
      setState(result);
      setMessage(success);
      setError("");
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作未完成，請重試。");
      setMessage("");
      return false;
    }
  };
  const showMember = (m: Member) => {
    setSelected(m.id);
    setDetailTab("基本資料");
    setPage("members");
  };
  const reset = () => {
    if (!confirmDraftLeave()) return;
    setState(initialState());
    organization.reset();
    cases.reset();
    setActor("taipei");
    setSelected(null);
    setHistoryMemberId(null);
    setFeedbackMode("normal");
    setError("");
    setPage("overview");
    setQuery("");
    setIncludeNonRegular(false);
    setStatusFilter("all");
    setClubFilter("all");
    setTypeFilter("all");
    setMemberSort("callName");
    setListPage(1);
    setModal(null);
    setMessage("已重設合成資料，可以重新體驗流程。");
  };
  function register(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const password = String(data.get("password"));
    if ([...password].length < 12 || [...password].length > 128) {
      setError("示範密碼須為 12～128 字元，請勿填入真實密碼。");
      return;
    }
    const ok = run(
      {
        type: "register",
        id: crypto.randomUUID(),
        name: String(data.get("name")),
        callName: String(data.get("callName")),
        email: String(data.get("email")),
        phone: String(data.get("phone")),
      },
      "示範帳號已建立，下一步可申請加入社團。",
    );
    if (ok) {
      setActor("member");
      goToWorkspacePage("profile");
      setModal(null);
      setPage("profile");
    }
  }
  function submitJoin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    if (
      run(
        {
          type: "apply",
          clubId: String(data.get("clubId")),
          message: String(data.get("message")),
          id: crypto.randomUUID(),
        },
        "入社申請已送出，請切換該社管理者體驗審核。",
      )
    ) {
      setModal(null);
      setPage("applications");
    }
  }
  const list = (rows: Member[]) =>
    rows.length ? (
      <div className="table-scroll">
        <table className="member-table">
          <thead>
            <tr>
              <th>會員</th>
              <th>所屬社團</th>
              <th>社籍狀態</th>
              <th>入社日期</th>
              <th>
                <span className="sr-only">查看</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.id}>
                <td>
                  <button className="person" onClick={() => showMember(m)}>
                    <Avatar member={m} />
                    <span>
                      <strong>{m.callName}</strong>
                      <small>{m.name}</small>
                    </span>
                  </button>
                </td>
                <td>
                  <span className="club-cell">
                    {getClubName(m.clubId)}
                    <small>
                      扶青社 ·{" "}
                      {
                        organization.state.clubs.find((c) => c.id === m.clubId)
                          ?.district
                      }
                    </small>
                  </span>
                </td>
                <td>
                  <Badge status={m.status} />
                </td>
                <td className="date">{m.startsOn.replaceAll("-", ".")}</td>
                <td>
                  <button
                    className="icon-button"
                    aria-label={`查看 ${m.callName}`}
                    onClick={() => showMember(m)}
                  >
                    <ChevronRight size={17} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mobile-members">
          {rows.map((m) => (
            <button
              className="mobile-member"
              key={m.id}
              onClick={() => showMember(m)}
            >
              <Avatar member={m} />
              <span>
                <strong>
                  {m.callName} <small>{m.name}</small>
                </strong>
                <small>{getClubName(m.clubId)}</small>
              </span>
              <Badge status={m.status} />
              <ChevronRight size={16} />
            </button>
          ))}
        </div>
      </div>
    ) : (
      <Empty title="沒有符合條件的會員">
        試試調整搜尋或勾選非正常／待確認社籍。
      </Empty>
    );
  const visitorGate = (
    <div className="auth-layout">
      <AuthView
        mode={authMode}
        members={state.members}
        onLogin={(id) => {
          const next = { ...stateRef.current, currentMemberId: id };
          setState(next);
          switchActor("member");
          goToPortal("workspace");
          setPage("overview");
          setMessage("已以合成帳號登入，所有驗證僅為操作示範。");
        }}
        onRegister={() => {
          setError("");
          setModal("register");
        }}
        onMode={setAuthMode}
      />
      <PublicSupportView demo={cases} />
    </div>
  );
  const auditEntries = state.audit.filter((entry) =>
    actor === "platform"
      ? /支援|案件|認領|復原/.test(entry)
      : actor === "member"
        ? entry.includes(`[member:${current.id}]`)
        : actor === "district"
          ? organization.state.clubs.some(
              (c) =>
                c.district === organization.district &&
                entry.includes(`[club:${c.id}]`),
            )
          : entry.includes(`[club:${actorClub(actor)}]`),
  );
  const getClubName = (id: string | null) =>
    organization.state.clubs.find((c) => c.id === id)?.name ?? clubName(id);

  const modalView = modal && (
    <ModalShell
      title={
        modal === "register"
          ? "開啟你的扶青旅程"
          : modal === "join"
            ? "申請加入社團"
            : "申請轉社"
      }
      onClose={() => {
        setModal(null);
        setError("");
      }}
    >
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      {modal === "register" ? (
        <form className="form" onSubmit={register}>
          <ol className="workspace-journey" aria-label="註冊後的下一步">
            <li className="current">
              <b>1</b>建立帳號
            </li>
            <li>
              <b>2</b>申請入社
            </li>
            <li>
              <b>3</b>管理者核准
            </li>
          </ol>
          <p className="muted">
            僅供體驗，請使用合成資料與示範密碼。密碼不會保存，也不會建立真實帳號。
          </p>
          <div className="two-fields">
            <label>
              姓名
              <input
                name="name"
                required
                maxLength={100}
                placeholder="例如：林曉晴"
                autoComplete="off"
              />
            </label>
            <label>
              Call name
              <input
                name="callName"
                required
                maxLength={100}
                placeholder="例如：Nova"
                autoComplete="off"
              />
            </label>
          </div>
          <label>
            Email
            <input
              name="email"
              type="email"
              required
              maxLength={254}
              placeholder="nova@example.test"
              autoComplete="off"
            />
          </label>
          <label>
            電話 <span className="muted">選填</span>
            <input
              name="phone"
              type="tel"
              placeholder="+886912345678"
              autoComplete="off"
            />
          </label>
          <label>
            示範密碼
            <input
              name="password"
              aria-label="示範密碼"
              type="password"
              minLength={12}
              maxLength={128}
              required
              autoComplete="new-password"
            />
            <small>至少 12 字元，請勿填入真實密碼。</small>
          </label>
          <button className="button primary wide" type="submit">
            建立示範會員 <ArrowRight size={16} />
          </button>
        </form>
      ) : modal === "join" ? (
        <form className="form" onSubmit={submitJoin}>
          <div className="workflow-summary">
            <strong>
              申請人：{current.callName} · {current.name}
            </strong>
            <p>
              由該社管理者核准後，才建立社籍並列入名冊。送出後可在「入社申請」查看進度。
            </p>
          </div>
          <label>
            選擇社團
            <select name="clubId">
              {organization.state.clubs
                .filter(
                  (c) =>
                    organization.state.clubs.find((o) => o.id === c.id)
                      ?.enabled !== false,
                )
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {c.district}
                  </option>
                ))}
            </select>
          </label>
          <label>
            入社說明
            <textarea
              name="message"
              required
              maxLength={2000}
              rows={4}
              placeholder="簡單介紹自己，以及想參與的服務。"
            />
          </label>
          <button className="button primary wide" type="submit">
            送出入社申請 <ArrowRight size={16} />
          </button>
        </form>
      ) : (
        <form
          className="form"
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            if (
              run(
                {
                  type: "transfer",
                  id: crypto.randomUUID(),
                  toClub: String(data.get("toClub")),
                },
                "轉社申請已送出，請切換兩社管理者分別核准。",
              )
            ) {
              setModal(null);
              setPage("transfers");
            }
          }}
        >
          <p className="muted">
            目前社團：{getClubName(current.clubId)}。申請期間保留原社籍。
          </p>
          <label>
            目標社團
            <select name="toClub">
              {organization.state.clubs
                .filter(
                  (c) =>
                    c.id !== current.clubId &&
                    organization.state.clubs.find((o) => o.id === c.id)
                      ?.enabled !== false,
                )
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </label>
          <div className="info-note">
            <ShieldCheck size={18} />
            雙方核准後，仍需你本人最終確認才會生效。
          </div>
          <button className="button primary wide" type="submit">
            送出轉社申請 <ArrowRight size={16} />
          </button>
        </form>
      )}
    </ModalShell>
  );

  if (
    portalRoute === "home" ||
    portalRoute === "map" ||
    portalRoute === "calendar"
  ) {
    if (embedded) return null;
    return (
      <PublicHome
        page={portalRoute}
        onNavigate={goToPortal}
        onLogin={() => goToPortal("login")}
        onRegister={() => goToPortal("register")}
        onAdmin={() => goToPortal("admin")}
      />
    );
  }
  if (actor === "visitor" && portalRoute !== "demo") {
    return (
      <div className="public-auth-shell">
        <a
          className="skip-link"
          href="#auth-main"
          onClick={(e) => {
            e.preventDefault();
            document.getElementById("auth-main")?.focus();
            document.getElementById("auth-main")?.scrollIntoView();
          }}
        >
          跳至主要內容
        </a>
        <header className="public-auth-header">
          <a href="#/" className="public-auth-brand">
            <Flower2 size={28} />
            <span>
              <b>Rotaract 萬花筒</b>
              <small>KALEIDOSCOPE</small>
            </span>
          </a>
          <a href="#/" className="button secondary">
            <ArrowLeft size={16} />
            返回首頁
          </a>
        </header>
        <main id="auth-main" tabIndex={-1} className="public-auth-main">
          <div className="public-auth-intro">
            <span>YOUR ROTARACT JOURNEY</span>
            <h1>
              {portalRoute === "admin"
                ? "管理後台登入"
                : "讓連結，從這裡開始。"}
            </h1>
            <p>
              {portalRoute === "admin"
                ? "社團與地區管理者共用帳號登入入口。"
                : "登入或建立帳號，整理你的扶青旅程。"}
            </p>
          </div>
          {visitorGate}
          {portalRoute === "admin" && (
            <section className="public-auth-demo">
              <ShieldCheck size={24} />
              <div>
                <h2>先看看管理工作區</h2>
                <p>使用假資料體驗社團、地區與平台管理畫面。</p>
              </div>
              <a className="button secondary" href="#/demo">
                體驗管理後台（假資料）
                <ArrowRight size={16} />
              </a>
            </section>
          )}
        </main>
        <footer className="public-auth-footer">
          Rotaract 萬花筒 · 畫面預覽，請只輸入示範資料。
        </footer>
        {modalView}
      </div>
    );
  }

  return (
    <div className="app-shell">
      <a
        className="skip-link"
        href="#main"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main")?.focus();
          document.getElementById("main")?.scrollIntoView();
        }}
      >
        跳至主要內容
      </a>
      {sidebar && (
        <button
          className="sidebar-backdrop"
          aria-label="收合選單"
          onClick={() => setSidebar(false)}
        />
      )}
      <aside
        id="workspace-navigation"
        className={`sidebar ${sidebar ? "open" : ""}`}
      >
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate("overview");
          }}
        >
          <span className="brand-mark">
            <Flower2 size={29} strokeWidth={1.6} />
          </span>
          <span>
            <b>Rotaract</b>
            <small>萬花筒 KALEIDOSCOPE</small>
          </span>
        </a>
        <button
          className="icon-button workspace-mobile-close"
          aria-label="關閉導覽選單"
          onClick={() => setSidebar(false)}
        >
          <X size={20} />
        </button>
        <div className="workspace">
          <span className="workspace-mark">R</span>
          <span>
            <strong>
              {manager
                ? organization.state.clubs.find(
                    (c) => c.id === actorClub(actor),
                  )?.short
                : "我的扶青旅程"}
            </strong>
            <small>{manager ? "社團管理工作區" : "會員工作區"}</small>
          </span>
        </div>
        <nav aria-label="主要選單">
          {[
            { title: "工作起點", pages: ["overview"] },
            {
              title: "社員與社籍",
              pages: [
                "members",
                "applications",
                "transfers",
                "membership",
                "annual",
              ],
            },
            { title: "組織與授權", pages: ["club", "roles", "district"] },
            { title: "我的帳號", pages: ["profile", "account"] },
            { title: "紀錄與協助", pages: ["history", "audit", "support"] },
          ].map((group) => {
            const items = visibleNav.filter((item) =>
              group.pages.includes(item.page),
            );
            return (
              items.length > 0 && (
                <div className="workspace-nav-group" key={group.title}>
                  <p className="nav-caption">{group.title}</p>
                  {items.map(({ page: target, label, icon: Icon }) => (
                    <button
                      key={target}
                      aria-label={label}
                      aria-current={page === target ? "page" : undefined}
                      className={`nav-item ${page === target ? "active" : ""}`}
                      onClick={() => navigate(target)}
                    >
                      <Icon size={19} strokeWidth={1.7} />
                      <span>{label}</span>
                      {target === "applications" && pending.length > 0 && (
                        <span className="nav-count">{pending.length}</span>
                      )}
                      {target === page && <span className="active-dot" />}
                    </button>
                  ))}
                </div>
              )
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="community-note">
            <HeartHandshake size={25} strokeWidth={1.5} />
            <strong>讓每一份連結，都有意義。</strong>
            <p>
              從社團出發，讓服務與友誼
              <br />
              延伸到更多地方。
            </p>
            <span>2026 — 2027 扶輪年度</span>
          </div>
          <button className="reset-button" onClick={reset}>
            <RotateCcw size={15} /> 重設示範資料
          </button>
          <div className="sidebar-footer">
            <Flower2 size={16} /> ROTARACT KALEIDOSCOPE <span>v0.5</span>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="topbar-context">
            <button
              className="icon-button mobile-menu"
              aria-label="開啟選單"
              aria-expanded={sidebar}
              aria-controls="workspace-navigation"
              onClick={() => setSidebar(true)}
            >
              <Menu />
            </button>
            <span className="context-icon">
              <Building2 size={17} />
            </span>
            <span>
              {manager
                ? getClubName(actorClub(actor))
                : actor === "district"
                  ? `${organization.district} 地區工作區`
                  : actor === "platform"
                    ? "平台帳號協助"
                    : "Rotaract 萬花筒"}
            </span>
            <ChevronRight size={14} />
            <span className="muted">
              {nav.find((n) => n.page === page)?.label}
            </span>
          </div>
          <div className="topbar-actions">
            <a className="text-button" href="#/">
              公開首頁
            </a>
            <span className="year-chip">
              <CalendarDays size={14} /> 2026 — 2027
            </span>
            {(manager || actor === "member") && (
              <button
                className="icon-button notification"
                aria-label={`查看 ${pending.length} 筆待辦`}
                onClick={() => navigate("applications")}
              >
                <Bell size={19} />
                {pending.length > 0 && <i />}
              </button>
            )}
            <span className="topbar-divider" />
            {actor !== "visitor" && (
              <button
                className="text-button"
                onClick={() => {
                  if (!switchActor("visitor")) return;
                  skipDraftGuard.current = true;
                  goToPortal("login");
                  setPage("overview");
                  setAuthMode("login");
                }}
              >
                登出
              </button>
            )}
            <span className="user-avatar">
              {manager
                ? "管"
                : actor === "visitor"
                  ? "訪"
                  : current.callName[0]}
            </span>
          </div>
        </header>
        <div className="demo-bar">
          <span>
            <Sparkles size={14} /> 操作預覽 · 僅使用假資料，重新整理即重設
          </span>
          {actor === "district" && (
            <label>
              目前授權地區
              <select
                aria-label="目前授權地區"
                value={organization.district}
                onChange={(e) => {
                  if (confirmDraftLeave())
                    organization.setDistrict(e.target.value);
                }}
              >
                <option>D3481</option>
                <option>D3462</option>
              </select>
            </label>
          )}
          <label className="feedback-select">
            畫面情境{" "}
            <select
              aria-label="畫面情境"
              value={feedbackMode}
              onChange={(e) => setFeedbackMode(e.target.value)}
            >
              <option value="normal">正常操作</option>
              <option value="loading">載入中</option>
              <option value="offline">服務暫時不可用</option>
              <option value="conflict">資料版本衝突</option>
              <option value="forbidden">權限不足</option>
              <option value="expired">登入逾時</option>
            </select>
          </label>
          <label>
            體驗身分{" "}
            <select
              aria-label="體驗身分"
              value={actor}
              onChange={(e) => switchActor(e.target.value as Actor)}
            >
              {[
                ...Object.entries(actorLabels),
                ...organization.state.clubs
                  .filter((c) => !["taipei", "taichung"].includes(c.id))
                  .map((c) => [`club:${c.id}`, `${c.name} · 管理者`]),
              ].map(([key, label]) => (
                <option key={key} value={key}>
                  {key === "member" ? `${current.callName} · ${label}` : label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <main id="main" tabIndex={-1}>
          <div className="page-heading">
            <div>
              <span className="eyebrow">
                {page === "overview"
                  ? "A LITTLE CONNECTION. A BIG DIFFERENCE."
                  : "YOUR ROTARACT WORKSPACE"}
              </span>
              <h1>
                {selected && canSeeSelected
                  ? "會員詳情"
                  : nav.find((n) => n.page === page)?.label}
                <span className="heading-dot">.</span>
              </h1>
              <p>
                {page === "overview"
                  ? "把日常管理變簡單，把更多時間留給服務與連結。"
                  : page === "members"
                    ? "每一位社友，都是讓改變發生的力量。"
                    : page === "applications"
                      ? "從一份申請，開啟新的扶青旅程。"
                      : page === "transfers"
                        ? "讓社籍交接清楚，也讓每段經歷被好好保留。"
                        : ({
                            profile: "資料由你維護，聯絡方式由你決定是否顯示。",
                            account:
                              "基本資料與登入方式分開管理，變更前先確認本人。",
                            club: "維護社團介紹與聯絡方式，清楚呈現對外資訊。",
                            roles: "授權給合適的人，確認任期與交接對象。",
                            annual: "逐一核對當年度社籍，完成名冊確認。",
                            membership:
                              "確認對象、原因與日期，保留每段社籍經歷。",
                            history:
                              "每段經歷的公開範圍，都有清楚的同意與紀錄。",
                            audit: "依操作紀錄查找異動，掌握變更的來由。",
                            support: "追蹤帳號協助案件，確認補件與處理進度。",
                            district: "在授權地區內維護社團與組織狀態。",
                          }[page] ?? "讓每個操作都有清楚的下一步。")}
              </p>
            </div>
            <div className="heading-actions">
              {page === "members" && selected ? (
                <button
                  className="button secondary"
                  onClick={() => setSelected(null)}
                >
                  <ArrowLeft size={16} /> 返回名冊
                </button>
              ) : actor === "visitor" ? (
                <button
                  className="button primary"
                  onClick={() => {
                    setError("");
                    setModal("register");
                  }}
                >
                  <LogIn size={16} /> 註冊體驗
                </button>
              ) : actor === "member" && current.status === "unaffiliated" ? (
                <button
                  className="button primary"
                  onClick={() => {
                    setError("");
                    setModal("join");
                  }}
                >
                  <Plus size={16} /> 申請加入社團
                </button>
              ) : manager ? (
                <button
                  className="button primary"
                  onClick={() => navigate("applications")}
                >
                  <ClipboardCheck size={16} /> 審核入社申請{" "}
                  <span className="button-count">{pending.length}</span>
                </button>
              ) : actor === "member" ? (
                <button
                  className="button primary"
                  onClick={() =>
                    navigate(page === "account" ? "profile" : "account")
                  }
                >
                  <Settings2 size={16} />{" "}
                  {page === "account" ? "查看資料與隱私" : "編輯帳號資料"}
                </button>
              ) : (
                <span className="workspace-scope">
                  <ShieldCheck size={16} />
                  {actor === "district"
                    ? `${organization.district} 授權範圍`
                    : "帳號支援範圍"}
                </span>
              )}
            </div>
          </div>
          {(message || error) && (
            <div
              className={`notice ${error ? "error" : ""}`}
              role={error ? "alert" : "status"}
            >
              {error ? <CircleHelp size={18} /> : <CheckCheck size={18} />}
              <span>{error || message}</span>
              <button
                className="icon-button"
                aria-label="關閉訊息"
                onClick={() => {
                  setMessage("");
                  setError("");
                }}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {feedbackMode !== "normal" && (
            <section className="panel empty" role="status">
              <ShieldCheck size={30} />
              <h3>
                {
                  {
                    loading: "正在載入資料…",
                    offline: "服務暫時不可用",
                    conflict: "資料已被其他管理者更新",
                    forbidden: "目前身分沒有操作權限",
                    expired: "登入已逾時，請重新登入",
                  }[feedbackMode]
                }
              </h3>
              <p>
                {feedbackMode === "conflict"
                  ? "你的輸入會保留；請重新取得最新資料再確認，不直接覆寫。"
                  : "這是可切換的假資料情境，不會向真實服務發送請求。"}
              </p>
              <button
                className="button primary"
                onClick={() => {
                  setFeedbackMode("normal");
                  if (feedbackMode === "expired") {
                    switchActor("visitor");
                    setAuthMode("login");
                  }
                }}
              >
                {feedbackMode === "expired" ? "返回登入" : "重新取得資料"}
              </button>
            </section>
          )}
          <div
            hidden={feedbackMode !== "normal"}
            inert={feedbackMode !== "normal"}
          >
            {actor === "visitor" ? (
              visitorGate
            ) : (
              <>
                {page === "account" && (
                  <AccountView
                    key={current.id}
                    member={current}
                    members={state.members}
                    onUpdate={(patch) => {
                      const id = current.id;
                      const now = stateRef.current;
                      setState({
                        ...now,
                        members: now.members.map((m) =>
                          m.id === id ? { ...m, ...patch } : m,
                        ),
                      });
                    }}
                    onAudit={addAudit}
                  />
                )}
                {page === "roles" && (
                  <RolesView
                    actor={actor}
                    organization={organization}
                    members={state.members}
                  />
                )}
                {page === "district" && (
                  <DistrictView
                    actor={actor}
                    organization={organization}
                    members={state.members}
                  />
                )}
                {page === "annual" && (
                  <AnnualView
                    key={actor}
                    state={state}
                    actor={actor}
                    run={run}
                  />
                )}
                {page === "membership" && (
                  <MembershipView
                    key={`${actor}-${current.id}`}
                    state={state}
                    actor={actor}
                    run={run}
                  />
                )}
                {page === "history" && (
                  <HistoryView
                    key={`${actor}-${current.id}`}
                    catalog={organization.state.clubs}
                    district={organization.district}
                    state={state}
                    actor={actor}
                    onChangeState={setState}
                    onAudit={addAudit}
                    demo={cases}
                  />
                )}
                {page === "support" && (
                  <SupportView
                    state={state}
                    actor={actor}
                    onChangeState={setState}
                    onAudit={addAudit}
                    demo={cases}
                  />
                )}
                {page === "audit" && (
                  <AuditView
                    entries={auditEntries}
                    state={state}
                    actor={actor}
                  />
                )}

                {page === "overview" && (
                  <>
                    <section
                      className="panel task-center"
                      aria-labelledby="task-title"
                    >
                      <div className="panel-header">
                        <div>
                          <h2 id="task-title">現在需要你處理</h2>
                          <p>先完成眼前的事，再查看社團全貌。</p>
                        </div>
                        <span className="year-chip">依目前身分顯示</span>
                      </div>
                      <div className="task-list">
                        {manager ? (
                          <>
                            <button onClick={() => navigate("applications")}>
                              <ClipboardCheck />
                              <span>
                                <strong>
                                  {pending.length
                                    ? `${pending.length} 筆入社申請等你審核`
                                    : "入社申請已處理完畢"}
                                </strong>
                                <small>
                                  確認申請人與入社日期，再核准或回覆原因
                                </small>
                              </span>
                              <ArrowRight />
                            </button>
                            <button onClick={() => navigate("annual")}>
                              <CalendarDays />
                              <span>
                                <strong>
                                  {
                                    scoped.filter(
                                      (m) => m.status === "unconfirmed",
                                    ).length
                                  }{" "}
                                  位社員待年度確認
                                </strong>
                                <small>
                                  先核對當年度社籍，可選取多位一起確認
                                </small>
                              </span>
                              <ArrowRight />
                            </button>
                            <button onClick={() => navigate("transfers")}>
                              <ArrowDownLeft />
                              <span>
                                <strong>
                                  {
                                    transfers.filter(
                                      (t) =>
                                        t.status === "pending" &&
                                        ((t.fromClub === actorClub(actor) &&
                                          !t.fromApproved) ||
                                          (t.toClub === actorClub(actor) &&
                                            !t.toApproved)),
                                    ).length
                                  }{" "}
                                  筆轉社等本社回覆
                                </strong>
                                <small>
                                  兩社同意後，由會員本人完成最後確認
                                </small>
                              </span>
                              <ArrowRight />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() =>
                                navigate(
                                  current.clubId ? "profile" : "applications",
                                )
                              }
                            >
                              <Users />
                              <span>
                                <strong>
                                  {current.clubId
                                    ? "查看我的社籍與隱私設定"
                                    : "申請加入你的社團"}
                                </strong>
                                <small>
                                  {current.clubId
                                    ? "決定其他會員可以看見哪些聯絡資料"
                                    : "管理者核准後，才能被會員名冊查詢"}
                                </small>
                              </span>
                              <ArrowRight />
                            </button>
                            {activeTransfer && (
                              <button onClick={() => navigate("transfers")}>
                                <ArrowDownLeft />
                                <span>
                                  <strong>
                                    {activeTransfer.status === "ready"
                                      ? "轉社已獲雙方同意，請你最後確認"
                                      : "你的轉社申請正在等待兩社回覆"}
                                  </strong>
                                  <small>目前社籍在本人最後確認前仍保留</small>
                                </span>
                                <ArrowRight />
                              </button>
                            )}
                            <button onClick={() => navigate("account")}>
                              <Settings2 />
                              <span>
                                <strong>維護帳號與登入聯絡方式</strong>
                                <small>
                                  姓名、頭像、電話、Email與代號統一管理
                                </small>
                              </span>
                              <ArrowRight />
                            </button>
                          </>
                        )}
                      </div>
                    </section>
                    <div className="overview-grid">
                      <section className="welcome-card">
                        <div className="welcome-content">
                          <span className="welcome-label">
                            <span /> CONNECT · SERVE · GROW
                          </span>
                          <h2>
                            {manager ? "讓社團的每一步，" : "你的扶青旅程，"}
                            <br />
                            都走得更有力量。
                          </h2>
                          <p>
                            {manager
                              ? "掌握社員狀態、迎接新夥伴。"
                              : "從認識夥伴，到一起創造改變。"}
                            <br />
                            讓每一次相遇，成為下一次行動的起點。
                          </p>
                          <button
                            onClick={() =>
                              navigate(manager ? "members" : "profile")
                            }
                            className="welcome-link"
                          >
                            {manager ? "前往會員名冊" : "查看我的資料"}{" "}
                            <ArrowUpRight size={16} />
                          </button>
                        </div>
                        <div className="hero-art" aria-hidden="true">
                          <div className="art-ring ring-one" />
                          <div className="art-ring ring-two" />
                          <div className="art-ring ring-three" />
                          <div className="art-core">
                            <Flower2 size={66} strokeWidth={0.85} />
                          </div>
                          <span className="art-spark spark-one">✧</span>
                          <span className="art-spark spark-two">✧</span>
                          <div className="art-caption">
                            PEOPLE MAKE
                            <br />
                            <b>THE DIFFERENCE.</b>
                          </div>
                        </div>
                        <span className="welcome-number">01 /</span>
                      </section>
                      <section className="year-card">
                        <div className="card-topline">
                          <span className="eyebrow">THIS ROTARY YEAR</span>
                          <CalendarDays size={18} />
                        </div>
                        <h3>
                          2026 <span>—</span> 2027
                        </h3>
                        <p>一起，讓服務持續發生。</p>
                        <div className="year-progress">
                          <span />
                        </div>
                        <div className="year-dates">
                          <span>2026.07.01</span>
                          <span>2027.06.30</span>
                        </div>
                        <div className="year-note">
                          <ShieldCheck size={19} />
                          <span>
                            <strong>年度名冊確認</strong>
                            <small>8/1 起未確認者隱藏免費地圖曝光</small>
                          </span>
                        </div>
                      </section>
                    </div>
                    <div className="stat-grid">
                      {[
                        {
                          label: "社團社員",
                          value: scoped.length,
                          note: "含 OB、已退出與待確認社員",
                          icon: Users,
                          color: "rose",
                        },
                        {
                          label: "正常社籍",
                          value: scoped.filter((m) => m.status === "confirmed")
                            .length,
                          note: "已完成本年度確認",
                          icon: ShieldCheck,
                          color: "green",
                        },
                        {
                          label: "待審申請",
                          value: pending.length,
                          note: pending.length
                            ? "新夥伴正在等待你的回覆"
                            : "所有申請皆已處理",
                          icon: ClipboardCheck,
                          color: "amber",
                        },
                        {
                          label: "待年度確認",
                          value: scoped.filter(
                            (m) => m.status === "unconfirmed",
                          ).length,
                          note: "確認後恢復免費曝光資格",
                          icon: Clock3,
                          color: "blue",
                        },
                      ].map((s) => (
                        <section className="stat-card" key={s.label}>
                          <div className={`stat-icon ${s.color}`}>
                            <s.icon size={20} />
                          </div>
                          <span>{s.label}</span>
                          <strong>
                            {String(s.value).padStart(2, "0")}
                            <small>位</small>
                          </strong>
                          <p>{s.note}</p>
                        </section>
                      ))}
                    </div>
                    <div className="lower-grid">
                      <section className="panel">
                        <div className="panel-header">
                          <div>
                            <h2>
                              社員一覽{" "}
                              <span className="sub-count">
                                {overviewMembers.length}
                              </span>
                            </h2>
                            <p>{getClubName(managedClub)} · 僅顯示正常社籍</p>
                          </div>
                          <button
                            className="text-button"
                            onClick={() => {
                              setIncludeNonRegular(false);
                              setStatusFilter("all");
                              navigate("members");
                            }}
                          >
                            查看全部 <ArrowRight size={15} />
                          </button>
                        </div>
                        {list(overviewMembers.slice(0, 4))}
                        <div className="panel-footnote">
                          <ShieldCheck size={14} />{" "}
                          私人聯絡資料依會員隱私設定，於詳情中呈現。
                        </div>
                      </section>
                      <section className="panel workspace-guide">
                        <div className="panel-header">
                          <div>
                            <h2>操作前，先掌握範圍</h2>
                            <p>你看得到的資料，仍依角色與隱私設定呈現。</p>
                          </div>
                          <ShieldCheck size={22} />
                        </div>
                        <dl>
                          <div>
                            <dt>目前身分</dt>
                            <dd>
                              {manager
                                ? `${getClubName(actorClub(actor))} · 社團管理`
                                : `${current.callName} · 會員本人`}
                            </dd>
                          </div>
                          <div>
                            <dt>社員查詢</dt>
                            <dd>
                              名冊預設只顯示正常社籍，其他狀態需另行勾選。
                            </dd>
                          </div>
                          <div>
                            <dt>聯絡資料</dt>
                            <dd>
                              電話預設隱藏，Email 依本人選擇顯示於登入後的詳情。
                            </dd>
                          </div>
                          <div>
                            <dt>年度確認</dt>
                            <dd>
                              8/1 起未確認者暫停免費地圖曝光，不會自動轉為 OB。
                            </dd>
                          </div>
                        </dl>
                      </section>
                    </div>
                  </>
                )}
                {page === "members" &&
                  (!selected || !canSeeSelected ? (
                    <section className="panel">
                      <div className="panel-header">
                        <div>
                          <h2>
                            會員名冊{" "}
                            <span className="sub-count">{members.length}</span>
                          </h2>
                          <p>
                            {manager
                              ? `${getClubName(actorClub(actor))} · 僅顯示管理範圍`
                              : "已核准入社的會員 · 遵守個人隱私設定"}
                          </p>
                        </div>
                        <ListFilter size={19} className="muted" />
                      </div>
                      <div className="filters">
                        <label className="search">
                          <Search size={17} />
                          <input
                            aria-label="搜尋會員"
                            placeholder="搜尋姓名或 call name"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                          />
                        </label>
                        <select
                          aria-label="社籍狀態篩選"
                          value={statusFilter}
                          onChange={(e) => setStatusFilter(e.target.value)}
                        >
                          <option value="all">所有狀態</option>
                          <option value="confirmed">正常社籍</option>
                          {includeNonRegular && (
                            <>
                              <option value="unconfirmed">待年度確認</option>
                              <option value="ob">OB</option>
                              <option value="resigned">已退出</option>
                            </>
                          )}
                        </select>
                        <select
                          aria-label="社團篩選"
                          value={clubFilter}
                          onChange={(e) => setClubFilter(e.target.value)}
                        >
                          <option value="all">所有可見社團</option>
                          {organization.state.clubs
                            .filter((c) =>
                              manager
                                ? c.id === actorClub(actor)
                                : actor === "district"
                                  ? c.district === organization.district
                                  : true,
                            )
                            .map((c) => (
                              <option value={c.id} key={c.id}>
                                {c.name}
                              </option>
                            ))}
                        </select>
                        <select
                          aria-label="社團類型篩選"
                          value={typeFilter}
                          onChange={(e) => setTypeFilter(e.target.value)}
                        >
                          <option value="all">所有類型</option>
                          <option value="ROTARACT">扶青社</option>
                          <option value="ROTARY">扶輪社</option>
                        </select>
                        <label className="workspace-sort">
                          排序
                          <select
                            aria-label="會員排序"
                            value={memberSort}
                            onChange={(e) => setMemberSort(e.target.value)}
                          >
                            <option value="callName">Call name A–Z</option>
                            <option value="name">姓名</option>
                            <option value="joined-desc">
                              入社日期：新到舊
                            </option>
                            <option value="joined-asc">入社日期：舊到新</option>
                          </select>
                        </label>
                        <label className="checkbox">
                          <input
                            type="checkbox"
                            checked={includeNonRegular}
                            onChange={(e) => {
                              setIncludeNonRegular(e.target.checked);
                              setStatusFilter("all");
                            }}
                          />
                          包含非正常／待確認社籍
                        </label>
                      </div>
                      <div
                        className="workspace-results"
                        role="status"
                        aria-live="polite"
                      >
                        <span>
                          <strong>{members.length} 位符合條件</strong> ·{" "}
                          {actor === "district"
                            ? organization.district
                            : manager
                              ? getClubName(actorClub(actor))
                              : "已核准入社的會員"}{" "}
                          ·{" "}
                          {includeNonRegular
                            ? "包含非正常／待確認社籍"
                            : "正常社籍"}
                          {query && ` · 搜尋「${query}」`}
                        </span>
                        {(query ||
                          includeNonRegular ||
                          statusFilter !== "all" ||
                          clubFilter !== "all" ||
                          typeFilter !== "all") && (
                          <button
                            className="text-button"
                            onClick={() => {
                              setQuery("");
                              setIncludeNonRegular(false);
                              setStatusFilter("all");
                              setClubFilter("all");
                              setTypeFilter("all");
                            }}
                          >
                            清除篩選
                          </button>
                        )}
                      </div>
                      {list(pagedMembers)}
                      <div className="pagination">
                        <span>
                          共 {members.length} 位 · 第 {currentPage} /{" "}
                          {pageCount} 頁
                        </span>
                        <label>
                          每頁
                          <select
                            aria-label="每頁筆數"
                            value={pageSize}
                            onChange={(e) => {
                              setPageSize(Number(e.target.value));
                              setListPage(1);
                            }}
                          >
                            <option value={20}>20</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                          </select>
                        </label>
                        <button
                          className="button secondary"
                          disabled={currentPage <= 1}
                          onClick={() => setListPage(currentPage - 1)}
                        >
                          上一頁
                        </button>
                        <button
                          className="button secondary"
                          disabled={currentPage >= pageCount}
                          onClick={() => setListPage(currentPage + 1)}
                        >
                          下一頁
                        </button>
                        <button
                          className="text-button"
                          onClick={() => {
                            const now = stateRef.current;
                            const demo = Array.from({ length: 24 }, (_, i) => ({
                              ...current,
                              id: `demo-${now.members.length}-${i}`,
                              name: `合成社友${i + 1}`,
                              callName: `Friend ${String(i + 1).padStart(2, "0")}`,
                              email: `friend-${now.members.length}-${i}@example.test`,
                              phone: "",
                              code: `rot_demo${now.members.length}_${i}`,
                              clubId: manager ? actorClub(actor) : "taipei",
                              status: "confirmed" as const,
                              avatarUrl: undefined,
                            }));
                            setState({
                              ...now,
                              members: [...now.members, ...demo],
                            });
                          }}
                        >
                          載入分頁示範資料
                        </button>
                      </div>
                    </section>
                  ) : (
                    <section className="panel">
                      <div className="profile-header">
                        <Avatar member={selectedMember!} large />
                        <div>
                          <h2>
                            {selectedMember!.callName}{" "}
                            <span className="profile-name">
                              {selectedMember!.name}
                            </span>
                          </h2>
                          <p>{getClubName(selectedMember!.clubId)} · 扶青社</p>
                          <Badge status={selectedMember!.status} />
                        </div>
                        {manager &&
                          selectedMember!.status === "unconfirmed" && (
                            <button
                              className="button primary"
                              onClick={() =>
                                run(
                                  {
                                    type: "confirmYear",
                                    memberId: selectedMember!.id,
                                  },
                                  "年度確認完成，已恢復免費地圖曝光資格。",
                                )
                              }
                            >
                              <Check size={16} />
                              確認本年度社員
                            </button>
                          )}
                      </div>
                      <div
                        className="tabs"
                        role="tablist"
                        aria-label="會員詳情分頁"
                      >
                        {["基本資料", "社籍", "歷史經歷"].map((tab) => (
                          <button
                            key={tab}
                            role="tab"
                            id={`tab-${tab}`}
                            aria-controls="member-panel"
                            tabIndex={detailTab === tab ? 0 : -1}
                            onKeyDown={(e) => {
                              const tabs = ["基本資料", "社籍", "歷史經歷"];
                              const index = tabs.indexOf(tab);
                              const next =
                                e.key === "ArrowRight"
                                  ? tabs[(index + 1) % tabs.length]
                                  : e.key === "ArrowLeft"
                                    ? tabs[
                                        (index + tabs.length - 1) % tabs.length
                                      ]
                                    : e.key === "Home"
                                      ? tabs[0]
                                      : e.key === "End"
                                        ? tabs.at(-1)!
                                        : null;
                              if (next) {
                                e.preventDefault();
                                setDetailTab(next);
                                document.getElementById(`tab-${next}`)?.focus();
                              }
                            }}
                            aria-selected={detailTab === tab}
                            onClick={() => setDetailTab(tab)}
                          >
                            {tab}
                          </button>
                        ))}
                      </div>
                      <div
                        className="detail-body"
                        role="tabpanel"
                        id="member-panel"
                        aria-labelledby={`tab-${detailTab}`}
                      >
                        {detailTab === "基本資料" ? (
                          <>
                            <h3>
                              聯絡資料 <ShieldCheck size={16} />
                            </h3>
                            <p className="muted">
                              電話與信箱由會員決定可見範圍，不因管理身分自動公開。
                            </p>
                            <dl className="details">
                              <div>
                                <dt>姓名</dt>
                                <dd>{selectedMember!.name}</dd>
                              </div>
                              <div>
                                <dt>Call name</dt>
                                <dd>{selectedMember!.callName}</dd>
                              </div>
                              <div>
                                <dt>Email</dt>
                                <dd>
                                  {contactValue(
                                    selectedMember!,
                                    actor,
                                    state,
                                    "email",
                                  ) ?? (
                                    <span className="hidden-value">
                                      <EyeOff size={15} />
                                      會員已隱藏
                                    </span>
                                  )}
                                </dd>
                              </div>
                              <div>
                                <dt>電話</dt>
                                <dd>
                                  {contactValue(
                                    selectedMember!,
                                    actor,
                                    state,
                                    "phone",
                                  ) ?? (
                                    <span className="hidden-value">
                                      <EyeOff size={15} />
                                      會員已隱藏
                                    </span>
                                  )}
                                </dd>
                              </div>
                            </dl>
                          </>
                        ) : detailTab === "社籍" ? (
                          <div className="membership-card">
                            <Building2 size={25} />
                            <div>
                              <h3>{getClubName(selectedMember!.clubId)}</h3>
                              <p>扶青社 · {selectedMember!.startsOn} 起</p>
                              <Badge status={selectedMember!.status} />
                            </div>
                          </div>
                        ) : (
                          <>
                            {state.history
                              .filter(
                                (h) =>
                                  h.memberId === selectedMember!.id &&
                                  (h.visible ||
                                    (actor === "member" &&
                                      selectedMember!.id === current.id) ||
                                    (manager && h.clubId === actorClub(actor))),
                              )
                              .map((h, index) => (
                                <div className="history-card" key={index}>
                                  <FileClock size={22} />
                                  <div>
                                    <strong>{getClubName(h.clubId)}</strong>
                                    <p>
                                      {h.startsOn} — {h.endsOn}
                                    </p>
                                    <small>
                                      {h.visible
                                        ? "本人已公開"
                                        : "僅本人或原社授權備查可見"}
                                    </small>
                                  </div>
                                </div>
                              ))}
                            <p className="muted">
                              歷史只呈現本人已公開或有權備查的經歷。
                            </p>
                          </>
                        )}
                      </div>
                    </section>
                  ))}
                {page === "applications" && (
                  <section className="panel">
                    <div className="panel-header">
                      <div>
                        <h2>{manager ? "待你回覆的申請" : "我的入社申請"}</h2>
                        <p>核准前不建立有效社籍；拒絕時請填寫原因。</p>
                      </div>
                      {actor === "member" && (
                        <button
                          className="button secondary"
                          onClick={() => {
                            setError("");
                            setModal("join");
                          }}
                        >
                          <Plus size={15} />
                          新增申請
                        </button>
                      )}
                    </div>
                    {applications.length ? (
                      <div className="request-list">
                        {applications.map((a) => (
                          <ApplicationCard
                            getClubName={getClubName}
                            key={a.id}
                            application={a}
                            member={state.members.find(
                              (m) => m.id === a.memberId,
                            )!}
                            manager={manager}
                            onReview={(approve, reason, startsOn) =>
                              run(
                                {
                                  type: "review",
                                  id: a.id,
                                  approve,
                                  reason,
                                  startsOn,
                                },
                                approve
                                  ? "已核准入社，會員已加入該社名冊。"
                                  : "已拒絕申請，原因已提供給會員。",
                              )
                            }
                            onExpire={() =>
                              run(
                                { type: "expireApplication", id: a.id },
                                "已模擬入社申請逾期，可重新提出。",
                              )
                            }
                            onWithdraw={() =>
                              run(
                                { type: "withdrawApplication", id: a.id },
                                "已撤回申請。",
                              )
                            }
                          />
                        ))}
                      </div>
                    ) : (
                      <Empty title="目前沒有入社申請">
                        切換至訪客，註冊合成會員後可以體驗完整入社流程。
                      </Empty>
                    )}
                  </section>
                )}
                {page === "transfers" && (
                  <section className="panel">
                    <div className="panel-header">
                      <div>
                        <h2>每一段交接，都有清楚的確認</h2>
                        <p>原社籍保留至本人最終確認，雙方核准不會自動轉社。</p>
                      </div>
                      {actor === "member" && !activeTransfer && (
                        <button
                          className="button primary"
                          onClick={() => {
                            setError("");
                            setModal("transfer");
                          }}
                        >
                          <Plus size={15} />
                          申請轉社
                        </button>
                      )}
                    </div>
                    <div className="transfer-explainer">
                      <span>01 本人申請</span>
                      <ArrowRight size={16} />
                      <span>02 雙方管理者核准</span>
                      <ArrowRight size={16} />
                      <span>03 本人確認生效</span>
                    </div>
                    {transfers.length ? (
                      <div className="request-list">
                        {transfers.map((t) => (
                          <TransferCard
                            getClubName={getClubName}
                            key={t.id}
                            transfer={t}
                            member={state.members.find(
                              (m) => m.id === t.memberId,
                            )!}
                            actor={actor}
                            onExpire={() =>
                              run(
                                { type: "expireTransfer", id: t.id },
                                "已模擬轉社逾期，原社籍保留。",
                              )
                            }
                            onViewHistory={() => setHistoryMemberId(t.memberId)}
                            onApprove={() =>
                              run(
                                { type: "approveTransfer", id: t.id },
                                "已代表該社團核准，仍需完成其餘確認步驟。",
                              )
                            }
                            onExecute={() =>
                              run(
                                { type: "executeTransfer", id: t.id },
                                "轉社已完成，原社籍已轉為預設隱藏的歷史經歷。",
                              )
                            }
                            onWithdraw={() =>
                              run(
                                { type: "withdrawTransfer", id: t.id },
                                "已撤回轉社，原社籍保留。",
                              )
                            }
                            onReject={(reason) =>
                              run(
                                { type: "rejectTransfer", id: t.id, reason },
                                "轉社申請已拒絕，原社籍保留。",
                              )
                            }
                          />
                        ))}
                      </div>
                    ) : (
                      <Empty title="目前沒有轉社申請">
                        切換至會員本人，可申請從台北星光轉至台中山海扶青社。
                      </Empty>
                    )}
                  </section>
                )}
                {page === "club" && (
                  <OrganizationView
                    actor={actor}
                    organization={organization}
                    members={state.members}
                  />
                )}
                {page === "profile" &&
                  (actor !== "member" ? (
                    <Empty title="請切換至會員本人體驗">
                      社團管理身分不會自動取得修改他人個資的權限。
                      <br />
                      <button
                        className="button secondary"
                        onClick={() => switchActor("member")}
                      >
                        切換至 {current.callName}
                      </button>
                    </Empty>
                  ) : (
                    <div className="profile-layout">
                      <section className="panel">
                        <div className="profile-header">
                          <Avatar member={current} large />
                          <div>
                            <h2>{current.callName}</h2>
                            <p>{current.code}</p>
                            <Badge status={current.status} />
                          </div>
                        </div>
                        <div className="form detail-body">
                          <h3>個人資料與隱私</h3>
                          <p className="field-hint">
                            基本資料與登入方式統一在帳號設定修改；此頁管理你的對外可見範圍。
                          </p>
                          <dl className="details">
                            <div>
                              <dt>姓名</dt>
                              <dd>{current.name}</dd>
                            </div>
                            <div>
                              <dt>Call name</dt>
                              <dd>{current.callName}</dd>
                            </div>
                            <div>
                              <dt>Email</dt>
                              <dd>{current.email}</dd>
                            </div>
                            <div>
                              <dt>電話</dt>
                              <dd>{current.phone || "尚未填寫"}</dd>
                            </div>
                          </dl>
                          <button
                            className="button primary"
                            onClick={() => navigate("account")}
                          >
                            <Settings2 size={16} />
                            編輯帳號與基本資料
                            <ArrowRight size={16} />
                          </button>
                        </div>
                      </section>
                      <div>
                        <section className="panel privacy-panel">
                          <div className="panel-header">
                            <div>
                              <h2>
                                <ShieldCheck size={19} />
                                你的隱私，由你決定
                              </h2>
                              <p>以下設定適用於登入後的會員詳情。</p>
                            </div>
                          </div>
                          <div className="privacy-options">
                            <label>
                              <span>
                                <strong>顯示我的電話</strong>
                                <small>預設隱藏，開啟後其他登入會員可見</small>
                              </span>
                              <input
                                type="checkbox"
                                checked={current.phoneVisible}
                                onChange={(e) =>
                                  run(
                                    {
                                      type: "privacy",
                                      phoneVisible: e.target.checked,
                                      emailVisible: current.emailVisible,
                                    },
                                    "電話隱私設定已更新。",
                                  )
                                }
                              />
                            </label>
                            <label>
                              <span>
                                <strong>顯示我的 Email</strong>
                                <small>可隨時取消勾選，保留聯絡隱私</small>
                              </span>
                              <input
                                type="checkbox"
                                checked={current.emailVisible}
                                onChange={(e) =>
                                  run(
                                    {
                                      type: "privacy",
                                      phoneVisible: current.phoneVisible,
                                      emailVisible: e.target.checked,
                                    },
                                    "Email 隱私設定已更新。",
                                  )
                                }
                              />
                            </label>
                          </div>
                        </section>
                        <section className="panel journey">
                          <h3>我的社籍旅程</h3>
                          <p>{getClubName(current.clubId)}</p>
                          {current.status === "unaffiliated" ? (
                            <button
                              className="text-button"
                              onClick={() => {
                                setError("");
                                setModal("join");
                              }}
                            >
                              申請加入社團 <ArrowRight size={15} />
                            </button>
                          ) : (
                            <button
                              className="text-button"
                              onClick={() => navigate("transfers")}
                            >
                              前往轉社作業 <ArrowRight size={15} />
                            </button>
                          )}
                          {state.history.map(
                            (h, index) =>
                              h.memberId === current.id && (
                                <label className="history-toggle" key={index}>
                                  <span>
                                    {getClubName(h.clubId)}
                                    <small>
                                      {h.startsOn} — {h.endsOn}
                                    </small>
                                  </span>
                                  <input
                                    type="checkbox"
                                    aria-label={`公開 ${getClubName(h.clubId)} 歷史`}
                                    checked={h.visible}
                                    onChange={(e) =>
                                      run(
                                        {
                                          type: "historyVisibility",
                                          index,
                                          visible: e.target.checked,
                                        },
                                        "該筆歷史的公開設定已更新。",
                                      )
                                    }
                                  />{" "}
                                  公開
                                </label>
                              ),
                          )}
                        </section>
                      </div>
                    </div>
                  ))}
              </>
            )}
          </div>
          <footer className="main-footer">
            <span>© 2026 Rotaract 萬花筒</span>
            <span>
              <Globe2 size={13} /> 連結彼此，創造可能。
            </span>
            <span>互動操作雛形 · 非正式系統</span>
          </footer>
        </main>
      </div>
      {historyMemberId && manager && (
        <ModalShell
          title="本社歷史備查"
          onClose={() => setHistoryMemberId(null)}
        >
          <p className="muted">
            僅呈現本社結束社籍的快照，不包含會員現有聯絡方式或其他社團資料。
          </p>
          {state.history
            .filter(
              (h) =>
                h.memberId === historyMemberId && h.clubId === actorClub(actor),
            )
            .map((h, index) => (
              <div className="history-card" key={index}>
                <FileClock size={22} />
                <div>
                  <strong>
                    {h.callNameSnapshot} · {h.nameSnapshot}
                  </strong>
                  <p>{getClubName(h.clubId)}</p>
                  <p>
                    {h.startsOn} — {h.endsOn}
                  </p>
                  <small>轉社結束 · 本社歷史快照</small>
                </div>
              </div>
            ))}
        </ModalShell>
      )}
      {modalView}
    </div>
  );
}
function ApplicationCard({
  application: a,
  getClubName = clubName,
  member,
  manager,
  onReview,
  onWithdraw,
  onExpire,
}: {
  application: Application;
  getClubName?: (id: string | null) => string;
  member: Member;
  manager: boolean;
  onReview: (approve: boolean, reason: string, startsOn: string) => boolean;
  onWithdraw: () => void;
  onExpire: () => void;
}) {
  const [reason, setReason] = useState("");
  const [startsOn, setStartsOn] = useState(demoToday);
  const [reviewError, setReviewError] = useState("");
  const review = (approve: boolean) => {
    if (!approve && !reason.trim()) {
      setReviewError("請先填寫拒絕原因，讓申請人了解如何調整。");
      return;
    }
    if (approve && (!startsOn || startsOn > demoToday)) {
      setReviewError("請選擇有效的實際入社日，不可晚於今天。");
      return;
    }
    setReviewError("");
    onReview(approve, approve ? "" : reason, startsOn);
  };
  return (
    <article className="request-card">
      <div className="request-person">
        <Avatar member={member} />
        <div>
          <h3>
            {member.callName} <span>{member.name}</span>
          </h3>
          <p>申請加入 {getClubName(a.clubId)}</p>
        </div>
        <span
          className={`badge ${a.status === "pending" ? "unconfirmed" : a.status === "approved" ? "confirmed" : "ob"}`}
        >
          {
            {
              pending: "待審核",
              approved: "已核准",
              rejected: "已拒絕",
              withdrawn: "已撤回",
              expired: "已逾期",
              terminated: "社團停用／已終止",
            }[a.status]
          }
        </span>
      </div>
      {a.status === "pending" && (
        <div className="workspace-request-guide">
          <ClipboardCheck size={18} />
          <span>
            <strong>
              {manager
                ? "下一步：核對申請人與實際入社日"
                : "下一步：等待社團管理者回覆"}
            </strong>
            <small>
              {manager
                ? "核准後將建立社籍並列入名冊；拒絕時需填寫原因。"
                : "核准前不會出現在會員名冊；仍可撤回申請。"}
            </small>
          </span>
        </div>
      )}
      <blockquote>{a.message}</blockquote>
      <p className="request-contact">
        Email：{member.emailVisible ? member.email : "會員已隱藏"} · 電話：
        {member.phoneVisible ? member.phone || "尚未填寫" : "會員已隱藏"}
      </p>
      {a.reason && (
        <p className="rejection-reason">
          {a.status === "rejected" ? "拒絕原因" : "處理說明"}：{a.reason}
        </p>
      )}
      {reviewError && (
        <p className="workspace-inline-error" role="alert">
          {reviewError}
        </p>
      )}
      {a.status === "pending" &&
        (manager ? (
          <div className="review-actions">
            <label>
              實際入社日
              <input
                aria-label={`${member.callName} 實際入社日`}
                type="date"
                max={demoToday}
                value={startsOn}
                onChange={(e) => setStartsOn(e.target.value)}
              />
            </label>
            <label>
              拒絕原因
              <input
                aria-label={`${member.callName} 拒絕原因`}
                placeholder="拒絕時必填"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={1000}
              />
            </label>
            <button className="button secondary" onClick={() => review(false)}>
              拒絕
            </button>
            <button className="button primary" onClick={() => review(true)}>
              <Check size={16} />
              核准入社
            </button>
          </div>
        ) : (
          <button className="button secondary" onClick={onWithdraw}>
            撤回申請
          </button>
        ))}
      {a.status === "pending" && (
        <button className="text-button expiry-demo" onClick={onExpire}>
          模擬30日後申請逾期
        </button>
      )}
    </article>
  );
}
function TransferCard({
  transfer: t,
  getClubName = clubName,
  member,
  actor,
  onApprove,
  onExecute,
  onWithdraw,
  onReject,
  onViewHistory,
  onExpire,
}: {
  transfer: Transfer;
  getClubName?: (id: string | null) => string;
  member: Member;
  actor: Actor;
  onApprove: () => void;
  onExecute: () => void;
  onWithdraw: () => void;
  onReject: (reason: string) => void;
  onViewHistory: () => void;
  onExpire: () => void;
}) {
  const [reason, setReason] = useState("");
  const canApprove =
    t.status === "pending" &&
    ((actorClub(actor) === t.fromClub && !t.fromApproved) ||
      (actorClub(actor) === t.toClub && !t.toApproved));
  const ongoing = ["pending", "ready"].includes(t.status);
  return (
    <article className="request-card">
      <div className="request-person">
        <Avatar member={{ ...member, callName: t.callNameSnapshot }} />
        <div>
          <h3>
            {t.callNameSnapshot} <span>{t.nameSnapshot}</span>
          </h3>
          <p>
            {getClubName(t.fromClub)} → {getClubName(t.toClub)}
          </p>
        </div>
        <span
          className={`badge ${t.status === "completed" ? "confirmed" : "unconfirmed"}`}
        >
          {
            {
              pending: "待雙方核准",
              ready: "待本人最終確認",
              completed: "轉社完成",
              withdrawn: "已撤回",
              rejected: "已拒絕",
              expired: "已逾期",
              terminated: "社團停用／已終止",
            }[t.status]
          }
        </span>
      </div>
      <div className="approval-steps">
        <span className={t.fromApproved ? "done" : ""}>
          {t.fromApproved ? <Check size={16} /> : <Clock3 size={16} />}
          原社團核准
        </span>
        <span className={t.toApproved ? "done" : ""}>
          {t.toApproved ? <Check size={16} /> : <Clock3 size={16} />}
          目標社團核准
        </span>
        <span className={t.status === "completed" ? "done" : ""}>
          {t.status === "completed" ? (
            <Check size={16} />
          ) : (
            <Clock3 size={16} />
          )}
          本人最終確認
        </span>
      </div>
      {ongoing && (
        <div className="workflow-summary">
          <strong>
            下一步：
            {t.status === "ready"
              ? "會員本人最終確認"
              : !t.fromApproved && !t.toApproved
                ? "等待原社與目標社回覆"
                : !t.fromApproved
                  ? "等待原社回覆"
                  : "等待目標社回覆"}
          </strong>
          <p>
            {t.status === "ready"
              ? `完成後，原社籍將結束並轉至${getClubName(t.toClub)}；原社歷史預設隱藏。`
              : "申請期間保留原社籍，不會提前轉出。"}
          </p>
        </div>
      )}
      {t.reason && (
        <p className="rejection-reason">
          {t.status === "rejected" ? "拒絕原因" : "處理說明"}：{t.reason}
        </p>
      )}
      <div className="transfer-actions">
        {actorClub(actor) === t.fromClub && t.status === "completed" && (
          <button className="button secondary" onClick={onViewHistory}>
            <FileClock size={16} />
            查看本社歷史
          </button>
        )}
        {canApprove && (
          <button className="button primary" onClick={onApprove}>
            <Check size={16} />
            代表本社核准
          </button>
        )}
        {isManager(actor) && ongoing && (
          <>
            <input
              aria-label="轉社拒絕原因"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="拒絕原因（必填）"
              maxLength={1000}
            />
            <button
              className="button secondary"
              onClick={() => onReject(reason)}
            >
              拒絕轉社
            </button>
          </>
        )}
        {actor === "member" && t.status === "ready" && (
          <button className="button primary" onClick={onExecute}>
            <ShieldCheck size={16} />
            本人確認，執行轉社
          </button>
        )}
        {actor === "member" && ongoing && (
          <button className="button secondary" onClick={onWithdraw}>
            撤回轉社
          </button>
        )}
        {ongoing && (
          <button className="text-button expiry-demo" onClick={onExpire}>
            模擬申請逾期
          </button>
        )}
      </div>
    </article>
  );
}
