import { clubs, actorClub } from "../domain";
export type OrganizationActor = import("../domain").Actor;
export type Office = "president" | "secretary" | "manager" | "backup";
export type OrgClub = (typeof clubs)[number] & {
  enabled: boolean;
  type: string;
  description: string;
  email: string;
  website: string;
  social: string;
  publicEmail: boolean;
  publicWebsite: boolean;
  publicSocial: boolean;
  emblem: string;
};
export type OrgRole = {
  id: string;
  clubId: string;
  memberId: string;
  office: Exclude<Office, "backup">;
  startsOn: string;
  endsOn: string;
};
export type Proposal = {
  id: string;
  clubId: string;
  from: string;
  to: string;
  sourceApproved: boolean;
  targetApproved: boolean;
  status: "pending" | "completed";
  reason: string;
};
export type OrgState = {
  clubs: OrgClub[];
  roles: OrgRole[];
  proposals: Proposal[];
};
export type OrgContext = {
  actor: OrganizationActor;
  office: Office;
  district: string;
};
export type OrgCommand =
  | {
      type: "edit";
      clubId: string;
      patch: Partial<
        Pick<
          OrgClub,
          | "name"
          | "description"
          | "email"
          | "website"
          | "social"
          | "publicEmail"
          | "publicWebsite"
          | "publicSocial"
          | "emblem"
        >
      >;
    }
  | { type: "status"; clubId: string; enabled: boolean; reason: string }
  | { type: "add"; id: string; name: string; clubType: string }
  | {
      type: "role";
      id: string;
      clubId: string;
      memberId: string;
      office: Exclude<Office, "backup">;
      startsOn: string;
      endsOn: string;
    }
  | { type: "removeRole"; id: string }
  | { type: "move"; id: string; clubId: string; to: string; reason: string }
  | { type: "approveMove"; id: string };
export const initialOrganizations = (): OrgState => ({
  clubs: clubs.map((c) => ({
    ...c,
    enabled: true,
    type: "扶青社",
    description: "以服務連結彼此，讓行動在社區發生。",
    email: "club@example.test",
    website: "https://example.test",
    social: "",
    publicEmail: false,
    publicWebsite: false,
    publicSocial: false,
    emblem: "",
  })),
  roles: [
    {
      id: "r1",
      clubId: "taipei",
      memberId: "m1",
      office: "president",
      startsOn: "2026-07-01",
      endsOn: "2027-06-30",
    },
    {
      id: "r2",
      clubId: "taichung",
      memberId: "m5",
      office: "secretary",
      startsOn: "2026-07-01",
      endsOn: "2027-06-30",
    },
  ],
  proposals: [],
});
const dateValid = (v: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  !Number.isNaN(Date.parse(v)) &&
  new Date(v).toISOString().slice(0, 10) === v;
export function organizationTransition(
  state: OrgState,
  ctx: OrgContext,
  cmd: OrgCommand,
): OrgState {
  const next = structuredClone(state);
  const fail = (s: string): never => {
    throw Error(s);
  };
  const district = () => {
    if (ctx.actor !== "district" || !["D3481", "D3462"].includes(ctx.district))
      fail("需切換至轄內地區管理者。");
  };
  const club = (id: string) =>
    next.clubs.find((c) => c.id === id) ?? fail("找不到社團。");
  const manage = (c: OrgClub, roles = false) => {
    if (ctx.actor === "district") {
      district();
      if (c.district !== ctx.district) fail("不可操作其他地區社團。");
    } else if (actorClub(ctx.actor) !== c.id || (roles && ctx.office === "manager"))
      fail("沒有此社團的操作權限。");
  };
  if (cmd.type === "add") {
    district();
    if (
      !cmd.name.trim() ||
      cmd.name.trim().length > 100 ||
      !["扶青社", "扶輪社"].includes(cmd.clubType) ||
      next.clubs.some((c) => c.id === cmd.id)
    )
      fail("請填寫有效名稱與類型。");
    next.clubs.push({
      ...initialOrganizations().clubs[0],
      id: cmd.id,
      name: cmd.name.trim(),
      short: cmd.name.trim(),
      initials: cmd.name.trim()[0],
      district: ctx.district,
      type: cmd.clubType,
      emblem: "",
      description: "",
      email: "",
      website: "",
      social: "",
    });
    return next;
  }
  if (cmd.type === "removeRole") {
    const r = next.roles.find((r) => r.id === cmd.id) ?? fail("授權已不存在。");
    manage(club(r.clubId), true);
    next.roles = next.roles.filter((x) => x.id !== r.id);
    return next;
  }
  if (cmd.type === "approveMove") {
    district();
    const p =
      next.proposals.find((p) => p.id === cmd.id) ?? fail("找不到提案。");
    if (p.status !== "pending") fail("提案已結束。");
    const c = club(p.clubId);
    if (c.district !== p.from) fail("社團地區已異動。");
    if (ctx.district === p.from) {
      if (p.sourceApproved) fail("來源地區已核准。");
      p.sourceApproved = true;
    } else if (ctx.district === p.to) {
      if (p.targetApproved) fail("目標地區已核准。");
      p.targetApproved = true;
    } else fail("不在提案授權範圍。");
    if (p.sourceApproved && p.targetApproved) {
      c.district = p.to;
      p.status = "completed";
    }
    return next;
  }
  const c = club(cmd.clubId);
  manage(c, cmd.type === "role");
  if (cmd.type === "edit") {
    const p = cmd.patch;
    if (
      ctx.office === "manager" &&
      ctx.actor !== "district" &&
      ((p.name !== undefined && p.name !== c.name) ||
        (p.emblem !== undefined && p.emblem !== c.emblem))
    )
      fail("一般管理者不可修改名稱與社徽。");
    if (p.name !== undefined && (!p.name.trim() || p.name.length > 100))
      fail("名稱須為 1～100 字。");
    if ((p.description ?? "").length > 5000) fail("簡介最多 5000 字。");
    if (p.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email))
      fail("請填有效 Email。");
    for (const url of [p.website, p.social])
      if (url) {
        try {
          if (!["http:", "https:"].includes(new URL(url).protocol))
            fail("連結僅支援 HTTP(S)。");
        } catch {
          fail("請填寫有效 HTTP(S) 連結。");
        }
      }
    Object.assign(c, p);
    c.short = c.name.replace(/扶青社|扶輪社/g, "");
    c.initials = c.name[0];
  }
  if (cmd.type === "status") {
    district();
    if (c.enabled === cmd.enabled) fail("狀態已變更，請重新確認。");
    if (!cmd.reason.trim() || cmd.reason.length > 1000)
      fail("請填寫 1～1000 字原因。");
    c.enabled = cmd.enabled;
  }
  if (cmd.type === "role") {
    if (!c.enabled) fail("停用社團不可新增授權。");
    if (
      !cmd.memberId ||
      !dateValid(cmd.startsOn) ||
      !dateValid(cmd.endsOn) ||
      cmd.startsOn < "2026-10-15" ||
      cmd.startsOn > cmd.endsOn
    )
      fail("請選擇社員，任期起日不可早於示範日。");
    const year =
      Number(cmd.startsOn.slice(0, 4)) +
      (cmd.startsOn.slice(5) >= "07-01" ? 1 : 0);
    if (cmd.endsOn > `${year}-06-30`) fail("任期最晚至該扶輪年度 6/30。");
    if (
      next.roles.some(
        (r) =>
          r.clubId === c.id &&
          ((r.memberId === cmd.memberId && r.office === cmd.office) ||
            (cmd.office !== "manager" && r.office === cmd.office)) &&
          r.startsOn <= cmd.endsOn &&
          r.endsOn >= cmd.startsOn,
      )
    )
      fail("相同職務或同人授權任期重疊。");
    next.roles.push({
      id: cmd.id,
      clubId: c.id,
      memberId: cmd.memberId,
      office: cmd.office,
      startsOn: cmd.startsOn,
      endsOn: cmd.endsOn,
    });
  }
  if (cmd.type === "move") {
    district();
    if (
      !["D3481", "D3462"].includes(cmd.to) ||
      cmd.to === c.district ||
      !cmd.reason.trim()
    )
      fail("請選擇不同目標地區並填原因。");
    if (next.proposals.some((p) => p.clubId === c.id && p.status === "pending"))
      fail("已有待審跨區提案。");
    next.proposals.push({
      id: cmd.id,
      clubId: c.id,
      from: c.district,
      to: cmd.to,
      sourceApproved: false,
      targetApproved: false,
      status: "pending",
      reason: cmd.reason.trim(),
    });
  }
  return next;
}
