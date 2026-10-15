export type Status =
  "confirmed" | "unconfirmed" | "ob" | "resigned" | "unaffiliated";
export type Member = {
  id: string;
  name: string;
  callName: string;
  email: string;
  phone: string;
  clubId: string | null;
  status: Status;
  phoneVisible: boolean;
  emailVisible: boolean;
  startsOn: string;
  code: string;
  avatarUrl?: string;
  codeChanges?: number;
  retiredCodes?: string[];
  annualConfirmedYear?: number;
  endsOn?: string;
};
export type Actor =
  "taipei" | "taichung" | "member" | "visitor" | "district" | "platform" | `club:${string}`;
export type Application = {
  id: string;
  memberId: string;
  clubId: string;
  message: string;
  status:
    | "pending"
    | "approved"
    | "rejected"
    | "withdrawn"
    | "expired"
    | "terminated";
  reason?: string;
};
export type Transfer = {
  id: string;
  memberId: string;
  fromClub: string;
  toClub: string;
  fromApproved: boolean;
  toApproved: boolean;
  status:
    | "pending"
    | "ready"
    | "completed"
    | "withdrawn"
    | "rejected"
    | "expired"
    | "terminated";
  reason?: string;
  nameSnapshot: string;
  callNameSnapshot: string;
};
export type History = {
  memberId: string;
  clubId: string;
  startsOn: string;
  endsOn: string;
  visible: boolean;
  nameSnapshot: string;
  callNameSnapshot: string;
  version?: number;
};
export type EndRequest = {
  id: string;
  memberId: string;
  clubId: string;
  reason: "resigned" | "ob";
  explanation: string;
  endsOn: string;
  status: "pending" | "approved" | "rejected" | "withdrawn";
  decisionReason?: string;
};
export type State = {
  members: Member[];
  applications: Application[];
  transfers: Transfer[];
  history: History[];
  audit: string[];
  currentMemberId: string;
  endRequests: EndRequest[];
  demoYear?: number;
};
export const clubs = [
  {
    id: "taipei",
    name: "台北星光扶青社",
    short: "台北星光",
    district: "D3481",
    initials: "星",
  },
  {
    id: "taichung",
    name: "台中山海扶青社",
    short: "台中山海",
    district: "D3462",
    initials: "山",
  },
];
export const clubName = (id: string | null) =>
  clubs.find((c) => c.id === id)?.name ?? "尚未加入社團";
export const statusLabel: Record<Status, string> = {
  confirmed: "正常社籍",
  unconfirmed: "待年度確認",
  ob: "OB",
  resigned: "已退出",
  unaffiliated: "尚無社籍",
};
export const initialState = (): State => ({
  currentMemberId: "m1",
  members: [
    {
      id: "m1",
      name: "林予安",
      callName: "Cora",
      email: "cora@example.test",
      phone: "+886912000101",
      clubId: "taipei",
      status: "confirmed",
      phoneVisible: false,
      emailVisible: true,
      startsOn: "2024-07-01",
      code: "rot_cora27",
    },
    {
      id: "m2",
      name: "陳以辰",
      callName: "Ethan",
      email: "ethan@example.test",
      phone: "+886912000102",
      clubId: "taipei",
      status: "confirmed",
      phoneVisible: false,
      emailVisible: true,
      startsOn: "2025-07-01",
      code: "rot_ethan",
    },
    {
      id: "m3",
      name: "許沐晴",
      callName: "Mia",
      email: "mia@example.test",
      phone: "+886912000103",
      clubId: "taipei",
      status: "unconfirmed",
      phoneVisible: false,
      emailVisible: false,
      startsOn: "2023-07-01",
      code: "rot_mia26",
    },
    {
      id: "m4",
      name: "黃子謙",
      callName: "Leo",
      email: "leo@example.test",
      phone: "+886912000104",
      clubId: "taipei",
      status: "ob",
      phoneVisible: false,
      emailVisible: true,
      startsOn: "2019-07-01",
      code: "rot_leo25",
      endsOn: "2025-06-30",
    },
    {
      id: "m5",
      name: "王品希",
      callName: "Iris",
      email: "iris@example.test",
      phone: "+886912000105",
      clubId: "taichung",
      status: "confirmed",
      phoneVisible: false,
      emailVisible: true,
      startsOn: "2025-07-01",
      code: "rot_iris26",
    },
    {
      id: "m6",
      name: "周宇澄",
      callName: "Sean",
      email: "sean@example.test",
      phone: "+886912000106",
      clubId: "taipei",
      status: "confirmed",
      phoneVisible: false,
      emailVisible: true,
      startsOn: "2026-07-01",
      code: "rot_sean26",
    },
    {
      id: "m7",
      name: "吳芷寧",
      callName: "Nina",
      email: "nina@example.test",
      phone: "",
      clubId: null,
      status: "unaffiliated",
      phoneVisible: false,
      emailVisible: true,
      startsOn: "",
      code: "rot_nina27",
    },
  ],
  applications: [
    {
      id: "a1",
      memberId: "m7",
      clubId: "taipei",
      message: "期待參與社區服務，認識一起行動的夥伴。",
      status: "pending",
    },
  ],
  transfers: [],
  history: [],
  audit: [],
  endRequests: [],
});
export type Command =
  | {
      type: "register";
      id: string;
      name: string;
      callName: string;
      email: string;
      phone: string;
    }
  | { type: "apply"; clubId: string; message: string; id: string }
  | {
      type: "review";
      id: string;
      approve: boolean;
      reason: string;
      startsOn: string;
    }
  | { type: "withdrawApplication"; id: string }
  | { type: "confirmYear"; memberId: string; year?: number }
  | { type: "privacy"; phoneVisible: boolean; emailVisible: boolean }
  | { type: "profile"; name: string; callName: string }
  | { type: "transfer"; toClub: string; id: string }
  | { type: "approveTransfer"; id: string }
  | { type: "executeTransfer"; id: string }
  | { type: "withdrawTransfer"; id: string }
  | { type: "rejectTransfer"; id: string; reason: string }
  | { type: "historyVisibility"; index: number; visible: boolean }
  | {
      type: "requestEnd";
      id: string;
      memberId: string;
      reason: "resigned" | "ob";
      explanation: string;
      endsOn: string;
      direct: boolean;
    }
  | { type: "reviewEnd"; id: string; approve: boolean; reason: string }
  | { type: "withdrawEnd"; id: string }
  | { type: "annualBoundary"; year: number }
  | { type: "expireApplication"; id: string }
  | { type: "expireTransfer"; id: string };

export const actorClub = (actor: Actor) => actor.startsWith("club:") ? actor.slice(5) : actor;
export const isManager = (actor: Actor) => actor === "taipei" || actor === "taichung" || actor.startsWith("club:");
export type ClubReference = { id:string; name:string; district:string; type?:string; enabled?:boolean };
export function listedMembers(
  state: State,
  actor: Actor,
  includeNonRegular: boolean,
  query = "",
  catalog: readonly ClubReference[] = clubs,
  district = "D3481",
) {
  if (actor === "visitor" || actor === "platform") return [];
  return state.members.filter(
    (m) =>
      m.status !== "unaffiliated" &&
      (!isManager(actor) || m.clubId === actorClub(actor)) &&
      (actor !== "district" || catalog.find(c => c.id === m.clubId)?.district === district) &&
      (includeNonRegular || m.status === "confirmed") &&
      `${m.name} ${m.callName}`
        .toLocaleLowerCase()
        .includes(query.trim().toLocaleLowerCase()),
  );
}
export function contactValue(
  member: Member,
  actor: Actor,
  state: State,
  kind: "email" | "phone",
) {
  if (actor === "visitor" || actor === "platform") return null;
  if (actor === "member" && member.id === state.currentMemberId)
    return member[kind] || "尚未填寫";
  return member[kind === "email" ? "emailVisible" : "phoneVisible"]
    ? member[kind] || "尚未填寫"
    : null;
}
export function transition(
  state: State,
  actor: Actor,
  command: Command,
  today = "2026-10-15",
  catalog: readonly ClubReference[] = clubs,
): State {
  const next = structuredClone(state);
  const current = next.members.find((m) => m.id === next.currentMemberId)!;
  const fail = (message: string): never => {
    throw new Error(message);
  };
  const self = () => {
    if (actor !== "member") fail("請切換至會員本人操作。");
  };
  const manager = (clubId: string | null) => {
    if (!isManager(actor) || actorClub(actor) !== clubId) fail("只能管理自己社團的資料。");
  };
  function endMember(m: Member, endsOn: string, reason: "resigned" | "ob") {
    next.history.push({
      memberId: m.id,
      clubId: m.clubId!,
      startsOn: m.startsOn,
      endsOn,
      visible: false,
      nameSnapshot: m.name,
      callNameSnapshot: m.callName,
    });
    m.status = reason;
    m.endsOn = endsOn;
    next.transfers
      .filter(
        (t) => t.memberId === m.id && ["pending", "ready"].includes(t.status),
      )
      .forEach((t) => {
        t.status = "withdrawn";
        t.reason = "原社籍已結束，轉社申請失效。";
      });
  }
  switch (command.type) {
    case "register": {
      if (actor !== "visitor") fail("請先切換至訪客註冊。");
      const email = command.email.trim().toLowerCase();
      if (
        !command.name.trim() ||
        !command.callName.trim() ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      )
        fail("請填寫姓名、call name 與有效 Email。");
      if (
        command.name.trim().length > 100 ||
        command.callName.trim().length > 100 ||
        email.length > 254
      )
        fail("欄位超過長度限制。");
      if (command.phone && !/^\+[1-9]\d{6,14}$/.test(command.phone))
        fail("電話請使用含國碼的格式，例如 +886912345678。");
      if (
        next.members.some(
          (m) =>
            m.email.toLowerCase() === email ||
            (!!command.phone && m.phone === command.phone),
        )
      )
        fail("登入識別不可使用，請登入或找回帳號。");
      next.members.push({
        id: command.id,
        name: command.name.trim(),
        callName: command.callName.trim(),
        email,
        phone: command.phone,
        clubId: null,
        status: "unaffiliated",
        phoneVisible: false,
        emailVisible: true,
        startsOn: "",
        code: `rot_${command.id.replaceAll("-", "").slice(0, 12)}`,
      });
      next.currentMemberId = command.id;
      break;
    }
    case "apply":
      self();
      if (!catalog.some((c) => c.id === command.clubId)) fail("請選擇有效社團。");
      if (current.status === "confirmed" || current.status === "unconfirmed")
        fail("已有扶青社籍，請使用轉社流程。");
      if (
        next.applications.some(
          (a) => a.memberId === current.id && a.status === "pending",
        )
      )
        fail("同類型已有待審申請。");
      if (!command.message.trim() || command.message.length > 2000)
        fail("請填入 1～2000 字入社說明。");
      next.applications.push({
        id: command.id,
        memberId: current.id,
        clubId: command.clubId,
        message: command.message.trim(),
        status: "pending",
      });
      break;
    case "review": {
      const a =
        next.applications.find((a) => a.id === command.id) ??
        fail("找不到申請。");
      manager(a.clubId);
      if (a.status !== "pending") fail("申請已處理，請重新整理。");
      const m = next.members.find((m) => m.id === a.memberId)!;
      if (command.approve) {
        if (
          !/^\d{4}-\d{2}-\d{2}$/.test(command.startsOn) ||
          command.startsOn > today ||
          Number.isNaN(Date.parse(command.startsOn)) ||
          new Date(command.startsOn).toISOString().slice(0, 10) !==
            command.startsOn
        )
          fail("入社日期必須為有效的今日或過去日期。");
        if (m.status === "confirmed" || m.status === "unconfirmed")
          fail("已有有效社籍，無法重複加入。");
        if (["ob", "resigned"].includes(m.status) && m.endsOn) {
          if (command.startsOn < m.endsOn)
            fail("新社籍期間不得與既有歷史重疊。");
          if (
            !next.history.some(
              (h) =>
                h.memberId === m.id &&
                h.startsOn === m.startsOn &&
                h.endsOn === m.endsOn,
            )
          )
            next.history.push({
              memberId: m.id,
              clubId: m.clubId!,
              startsOn: m.startsOn,
              endsOn: m.endsOn,
              visible: false,
              nameSnapshot: m.name,
              callNameSnapshot: m.callName,
            });
        }
        m.endsOn = undefined;
        m.clubId = a.clubId;
        m.status = "confirmed";
        m.startsOn = command.startsOn;
        a.status = "approved";
      } else {
        if (!command.reason.trim() || command.reason.length > 1000)
          fail("拒絕時須填寫 1～1000 字原因。");
        a.status = "rejected";
        a.reason = command.reason.trim();
      }
      break;
    }
    case "withdrawApplication": {
      self();
      const a =
        next.applications.find((a) => a.id === command.id) ??
        fail("找不到申請。");
      if (a.memberId !== current.id || a.status !== "pending")
        fail("無法撤回此申請。");
      a.status = "withdrawn";
      break;
    }
    case "confirmYear": {
      const m =
        next.members.find((m) => m.id === command.memberId) ??
        fail("找不到會員。");
      manager(m.clubId);
      if (m.status !== "unconfirmed") fail("僅可補確認待確認社員。");
      m.status = "confirmed";
      m.annualConfirmedYear = command.year ?? next.demoYear ?? Number(today.slice(0, 4));
      break;
    }
    case "privacy":
      self();
      current.phoneVisible = command.phoneVisible;
      current.emailVisible = command.emailVisible;
      break;
    case "profile":
      self();
      if (
        !command.name.trim() ||
        !command.callName.trim() ||
        command.name.length > 100 ||
        command.callName.length > 100
      )
        fail("姓名及 call name 須為 1～100 字。");
      current.name = command.name.trim();
      current.callName = command.callName.trim();
      break;
    case "transfer":
      self();
      if (
        !current.clubId ||
        !["confirmed", "unconfirmed"].includes(current.status)
      )
        fail("目前沒有可轉出的有效社籍。");
      if (
        current.clubId === command.toClub ||
        !catalog.some((c) => c.id === command.toClub)
      )
        fail("請選擇其他社團。");
      if (
        next.transfers.some(
          (t) =>
            t.memberId === current.id &&
            ["pending", "ready"].includes(t.status),
        )
      )
        fail("已有進行中的轉社申請。");
      next.transfers.push({
        id: command.id,
        memberId: current.id,
        fromClub: current.clubId!,
        toClub: command.toClub,
        fromApproved: false,
        toApproved: false,
        status: "pending",
        nameSnapshot: current.name,
        callNameSnapshot: current.callName,
      });
      break;
    case "approveTransfer": {
      const t =
        next.transfers.find((t) => t.id === command.id) ??
        fail("找不到轉社申請。");
      if (t.status !== "pending") fail("此申請已審核或結束。");
      if (actorClub(actor) === t.fromClub) t.fromApproved = true;
      else if (actorClub(actor) === t.toClub) t.toApproved = true;
      else fail("沒有此社團的審核權限。");
      if (t.fromApproved && t.toApproved) t.status = "ready";
      break;
    }
    case "executeTransfer": {
      self();
      const t =
        next.transfers.find((t) => t.id === command.id) ??
        fail("找不到轉社申請。");
      if (
        t.memberId !== current.id ||
        t.status !== "ready" ||
        !t.fromApproved ||
        !t.toApproved ||
        current.clubId !== t.fromClub
      )
        fail("需雙方核准，且僅本人可最終執行。");
      next.history.push({
        memberId: current.id,
        clubId: current.clubId!,
        startsOn: current.startsOn,
        endsOn: today,
        visible: false,
        nameSnapshot: current.name,
        callNameSnapshot: current.callName,
      });
      current.clubId = t.toClub;
      current.startsOn = today;
      current.status = "confirmed";
      t.status = "completed";
      break;
    }
    case "withdrawTransfer": {
      self();
      const t =
        next.transfers.find((t) => t.id === command.id) ??
        fail("找不到轉社申請。");
      if (t.memberId !== current.id || !["pending", "ready"].includes(t.status))
        fail("此申請無法撤回。");
      t.status = "withdrawn";
      break;
    }
    case "rejectTransfer": {
      const t =
        next.transfers.find((t) => t.id === command.id) ??
        fail("找不到轉社申請。");
      if (
        !isManager(actor) ||
        ![t.fromClub, t.toClub].includes(actorClub(actor)) ||
        !["pending", "ready"].includes(t.status)
      )
        fail("沒有審核權限或申請已結束。");
      if (!command.reason.trim() || command.reason.length > 1000)
        fail("請填寫 1～1000 字拒絕原因。");
      t.status = "rejected";
      t.reason = command.reason.trim();
      break;
    }
    case "requestEnd": {
      const m =
        next.members.find((m) => m.id === command.memberId) ??
        fail("找不到會員。");
      if (command.direct) manager(m.clubId);
      else {
        self();
        if (m.id !== current.id) fail("只能申請結束本人的社籍。");
      }
      if (!m.clubId || !["confirmed", "unconfirmed"].includes(m.status))
        fail("目前沒有可結束的有效社籍。");
      if (!command.explanation.trim() || command.explanation.length > 1000)
        fail("請填寫 1～1000 字辦理原因。");
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(command.endsOn) ||
        Number.isNaN(Date.parse(command.endsOn)) ||
        new Date(command.endsOn).toISOString().slice(0, 10) !==
          command.endsOn ||
        command.endsOn > today ||
        command.endsOn < m.startsOn
      )
        fail("結束日須為有效日期，且介於入社日與今日之間。");
      if (
        next.endRequests.some(
          (r) => r.memberId === m.id && r.status === "pending",
        )
      )
        fail("已有待審退社／OB申請。");
      const req: EndRequest = {
        id: command.id,
        memberId: m.id,
        clubId: m.clubId!,
        reason: command.reason,
        explanation: command.explanation.trim(),
        endsOn: command.endsOn,
        status: command.direct ? "approved" : "pending",
      };
      next.endRequests.push(req);
      if (command.direct) endMember(m, req.endsOn, req.reason);
      break;
    }
    case "reviewEnd": {
      const req =
        next.endRequests.find((r) => r.id === command.id) ??
        fail("找不到申請。");
      manager(req.clubId);
      if (req.status !== "pending") fail("申請已處理。");
      const m = next.members.find((m) => m.id === req.memberId)!;
      if (
        m.clubId !== req.clubId ||
        !["confirmed", "unconfirmed"].includes(m.status)
      )
        fail("會員社籍已變更，請重新確認。");
      if (command.approve) {
        req.status = "approved";
        endMember(m, req.endsOn, req.reason);
      } else {
        if (!command.reason.trim()) fail("拒絕需填寫原因。");
        req.status = "rejected";
        req.decisionReason = command.reason.trim();
      }
      break;
    }
    case "withdrawEnd": {
      self();
      const req =
        next.endRequests.find((r) => r.id === command.id) ??
        fail("找不到申請。");
      if (req.memberId !== current.id || req.status !== "pending")
        fail("此申請不能撤回。");
      req.status = "withdrawn";
      break;
    }
    case "annualBoundary":
      next.demoYear = command.year;
      if (!isManager(actor)) fail("請切換社團管理者。");
      next.members
        .filter(
          (m) =>
            m.clubId === actorClub(actor) &&
            ["confirmed", "unconfirmed"].includes(m.status) &&
            (m.annualConfirmedYear ??
              (m.status === "confirmed" ? 2026 : 2025)) < command.year,
        )
        .forEach((m) => {
          m.status = "unconfirmed";
        });
      break;
    case "expireApplication": {
      const a =
        next.applications.find((a) => a.id === command.id) ??
        fail("找不到申請。");
      if (actor === "member") {
        if (a.memberId !== current.id) fail("只能操作自己的申請。");
      } else manager(a.clubId);
      if (a.status !== "pending") fail("只有待審申請可模擬逾期。");
      a.status = "expired";
      a.reason = "模擬超過30日無結果，申請已逾期，可重新提出。";
      break;
    }
    case "expireTransfer": {
      const t =
        next.transfers.find((t) => t.id === command.id) ?? fail("找不到申請。");
      if (actor === "member") {
        if (t.memberId !== current.id) fail("只能操作自己的轉社。");
      } else if (!isManager(actor) || ![t.fromClub, t.toClub].includes(actorClub(actor)))
        fail("無此轉社管理權。");
      if (!["pending", "ready"].includes(t.status))
        fail("只有未完成轉社可模擬逾期。");
      t.status = "expired";
      t.reason = "模擬待審30日或待本人確認7日逾期，原社籍保留。";
      break;
    }
    case "historyVisibility": {
      self();
      const h = next.history[command.index] ?? fail("找不到歷史經歷。");
      if (h.memberId !== current.id) fail("僅本人可設定歷史公開。");
      h.visible = command.visible;
      h.version = (h.version ?? 0) + 1;
      break;
    }
  }
  const subjectId =
    command.type === "register"
      ? command.id
      : "memberId" in command
        ? command.memberId
        : [
              "privacy",
              "profile",
              "historyVisibility",
              "transfer",
              "apply",
            ].includes(command.type)
          ? current.id
          : "id" in command
            ? (next.applications.find((a) => a.id === command.id)?.memberId ??
              next.transfers.find((t) => t.id === command.id)?.memberId ??
              next.endRequests.find((r) => r.id === command.id)?.memberId ??
              current.id)
            : current.id;
  const subject = next.members.find((m) => m.id === subjectId);
  next.audit.unshift(
    `[member:${subjectId}][club:${command.type === "annualBoundary" ? actor : (subject?.clubId ?? "none")}] ${today} · ${actor === "member" ? current.callName : actor === "visitor" ? "訪客註冊" : clubName(actor)} · ${command.type}`,
  );
  return next;
}
