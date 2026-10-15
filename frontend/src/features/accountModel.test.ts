import { describe, expect, it } from "vitest";
import { initialState } from "../domain";
import {
  codePatch,
  contactPatch,
  consumeReset,
  demoLogin,
  DEMO_PASSWORD,
  profilePatch,
  resetUsable,
} from "./accountModel";
describe("合成帳號操作", () => {
  it("敏感代號修改需要目前密碼", () => {
    const members = initialState().members;
    expect(() => codePatch(members[0], members, "newcode123", "wrong")).toThrow(
      "示範密碼",
    );
  });
  it("基本資料不能以繞過表單的方式傳入過長名稱", () => {
    expect(() => profilePatch("x".repeat(101), "Cora")).toThrow();
    expect(() => profilePatch("Cora", " ")).toThrow();
    expect(profilePatch(" 林予安 ", " Cora ")).toEqual({
      name: "林予安",
      callName: "Cora",
    });
  });
  it("重送後舊連結失效，過期與已用連結也不能開啟", () => {
    const old = { memberId: "m1", issuedAt: 100, used: false };
    const active = { ...old, issuedAt: 200 };
    expect(resetUsable(old, active, 201)).toBe(false);
    expect(resetUsable(active, active, 201)).toBe(true);
    expect(resetUsable(active, active, 1800200)).toBe(false);
    expect(resetUsable({ ...active, used: true }, active, 201)).toBe(false);
  });
  it("三種目前識別可登入，錯誤密碼與舊代號不能登入", () => {
    const members = initialState().members;
    const m = members[0];
    for (const identity of [m.code.toUpperCase(), m.phone, m.email])
      expect(demoLogin(members, identity, DEMO_PASSWORD)).toBe(m.id);
    expect(demoLogin(members, m.code, "wrong")).toBeUndefined();
    const updated = {
      ...m,
      ...codePatch(m, members, "updated_123", DEMO_PASSWORD),
    };
    expect(demoLogin([updated], m.code, DEMO_PASSWORD)).toBeUndefined();
  });
  it("聯絡資料單項修改需本人驗證及唯一識別", () => {
    const members = initialState().members;
    const m = members[0];
    expect(() =>
      contactPatch(m, members, "email", "new@example.test", "wrong"),
    ).toThrow();
    expect(() =>
      contactPatch(
        m,
        members,
        "email",
        members[1].email.toUpperCase(),
        DEMO_PASSWORD,
      ),
    ).toThrow();
    expect(() =>
      contactPatch(m, members, "phone", "0912345678", DEMO_PASSWORD),
    ).toThrow();
    expect(
      contactPatch(m, members, "phone", "+14155550123", DEMO_PASSWORD),
    ).toEqual({ phone: "+14155550123" });
  });
  it("代號限改一次且歷史代號無法重新分配", () => {
    const members = initialState().members;
    const m = members[0];
    const updated = {
      ...m,
      ...codePatch(m, members, "updated_123", DEMO_PASSWORD),
    };
    expect(() =>
      codePatch(updated, [updated], "another_123", DEMO_PASSWORD),
    ).toThrow();
    expect(() =>
      codePatch(members[1], [updated, members[1]], m.code, DEMO_PASSWORD),
    ).toThrow();
    expect(updated.id).toBe(m.id);
  });
  it("重設連結逾期、使用後與弱密碼均拒絕", () => {
    const ticket = { memberId: "m1", issuedAt: 100, used: false };
    expect(() =>
      consumeReset(ticket, 1800100, DEMO_PASSWORD, DEMO_PASSWORD),
    ).toThrow();
    expect(() =>
      consumeReset(ticket, 101, "123456789012", "123456789012"),
    ).toThrow();
    expect(() =>
      consumeReset(ticket, 101, DEMO_PASSWORD, "different"),
    ).toThrow();
    const used = consumeReset(ticket, 101, DEMO_PASSWORD, DEMO_PASSWORD);
    expect(() =>
      consumeReset(used, 102, DEMO_PASSWORD, DEMO_PASSWORD),
    ).toThrow();
  });
});
