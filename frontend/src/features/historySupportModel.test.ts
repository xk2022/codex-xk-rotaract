import { describe, it, expect } from "vitest";
import {
  decideConsent,
  reviewCase,
  requestBlocked,
  invalidateRequests,
  supportFollowup,
} from "./historySupportModel";
describe("歷史公開及人工核身", () => {
  const request = {
    id: "r",
    index: 0,
    memberId: "m1",
    version: "v1",
    expires: 100,
    status: "pending" as const,
  };
  it("本人僅能核准有效且內容未變更的請求", () => {
    expect(decideConsent(request, true, "v1", 50).status).toBe("approved");
    expect(() => decideConsent(request, true, "v2", 50)).toThrow("變更");
    expect(() => decideConsent(request, true, "v1", 100)).toThrow("七日");
  });
  it("退回或補件必須留說明，結案不可重複核准", () => {
    const item = {
      id: "s",
      memberId: "m1",
      kind: "claim" as const,
      message: "舊資料",
      status: "pending" as const,
      reply: "",
    };
    expect(() => reviewCase(item, "rejected", "")).toThrow();
    const closed = reviewCase(item, "approved", "已完成示範核身");
    expect(() => reviewCase(closed, "approved", "重複")).toThrow("結案");
  });
});

describe("公開請求冷卻與復原後續", () => {
  it("拒絕與逾期後須等七日，公開異動取消既有待辦", () => {
    const request = {
      id: "r",
      index: 0,
      memberId: "m1",
      version: "v1",
      expires: 100,
      status: "pending" as const,
    };
    expect(requestBlocked([request], 0, 50)).toBe(true);
    expect(requestBlocked([request], 0, 101)).toBe(true);
    expect(requestBlocked([request], 0, 100 + 7 * 86400000)).toBe(false);
    const rejected = decideConsent(request, false, "v1", 50);
    expect(requestBlocked([rejected], 0, 50 + 7 * 86400000 - 1)).toBe(true);
    expect(invalidateRequests([request], 0)[0].status).toBe("invalidated");
    expect(() =>
      decideConsent(invalidateRequests([request], 0)[0], true, "v1", 50),
    ).toThrow("已處理");
  });
  it("復原先核身再確認信箱；認領僅確認關聯，不合併未知資料", () => {
    const pending = {
      id: "c",
      memberId: "m1",
      kind: "recovery" as const,
      message: "",
      status: "pending" as const,
      reply: "",
    };
    expect(() => supportFollowup(pending, "emailConfirmed")).toThrow("核身");
    const approved = reviewCase(pending, "approved", "核身完成");
    expect(() => supportFollowup(approved, "resetReady")).toThrow("信箱");
    expect(
      supportFollowup(supportFollowup(approved, "emailConfirmed"), "resetReady")
        .followup,
    ).toBe("resetReady");
    const claim = { ...approved, kind: "claim" as const };
    expect(() => supportFollowup(claim, "emailConfirmed")).toThrow("關聯");
    expect(supportFollowup(claim, "associationConfirmed").followup).toBe(
      "associationConfirmed",
    );
  });
});
