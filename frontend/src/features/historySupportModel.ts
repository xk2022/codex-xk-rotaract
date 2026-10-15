export type Consent = {
  id: string;
  index: number;
  memberId: string;
  requestedBy?: string;
  version: string;
  expires: number;
  decidedAt?: number;
  status: "pending" | "approved" | "rejected" | "expired" | "invalidated";
};
export type SupportCase = {
  id: string;
  memberId: string;
  kind: "recovery" | "claim";
  message: string;
  status: "pending" | "supplement" | "approved" | "rejected";
  reply: string;
  followup?: "emailConfirmed" | "resetReady" | "associationConfirmed";
};
export function decideConsent(
  request: Consent,
  approved: boolean,
  version: string,
  now = Date.now(),
): Consent {
  if (request.status !== "pending") throw new Error("此公開請求已處理。");
  if (request.expires <= now)
    throw new Error("公開請求已超過七日，請重新提出。");
  if (request.version !== version)
    throw new Error("歷史內容已有變更，請重新取得同意。");
  return {
    ...request,
    decidedAt: now,
    status: approved ? "approved" : "rejected",
  };
}
export function reviewCase(
  item: SupportCase,
  status: SupportCase["status"],
  reply: string,
): SupportCase {
  if (!["pending", "supplement"].includes(item.status))
    throw new Error("案件已結案。");
  if (!reply.trim()) throw new Error("請填寫核身結果、補件需求或退回原因。");
  return { ...item, status, reply: reply.trim() };
}
export const consentLabel = {
  pending: "待本人同意",
  approved: "本人已同意",
  rejected: "本人已拒絕",
  expired: "已逾期",
  invalidated: "內容或公開設定已變更，請求失效",
};
export const caseLabel = {
  pending: "待人工核身",
  supplement: "待補件",
  approved: "核身核准",
  rejected: "已退回",
};

export function requestBlocked(
  requests: Consent[],
  index: number,
  now = Date.now(),
) {
  return requests.some(
    (r) =>
      r.index === index &&
      ((r.status === "pending" && r.expires > now) ||
        ((r.status === "rejected" ||
          r.status === "expired" ||
          (r.status === "pending" && r.expires <= now)) &&
          (r.decidedAt ?? r.expires) + 7 * 86400000 > now)),
  );
}
export function invalidateRequests(
  requests: Consent[],
  index: number,
): Consent[] {
  return requests.map((r) =>
    r.index === index && r.status === "pending"
      ? { ...r, status: "invalidated" }
      : r,
  );
}
export function supportFollowup(
  item: SupportCase,
  action: NonNullable<SupportCase["followup"]>,
): SupportCase {
  if (item.status !== "approved") throw new Error("需先完成平台核身。");
  if (item.kind === "claim" && action !== "associationConfirmed")
    throw new Error("認領案件僅可確認關聯。");
  if (
    item.kind === "recovery" &&
    (action === "associationConfirmed" ||
      (action === "resetReady" && item.followup !== "emailConfirmed"))
  )
    throw new Error("請先確認新的聯絡信箱。");
  return { ...item, followup: action };
}
