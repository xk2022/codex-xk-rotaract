import { describe, expect, it } from "vitest";
import {
  contactValue,
  initialState,
  listedMembers,
  transition,
} from "./domain";
import type { State } from "./domain";
const createTransfer = () =>
  transition(initialState(), "member", {
    type: "transfer",
    id: "t1",
    toClub: "taichung",
  });
const bothApproved = () =>
  transition(
    transition(createTransfer(), "taipei", {
      type: "approveTransfer",
      id: "t1",
    }),
    "taichung",
    { type: "approveTransfer", id: "t1" },
  );
describe("合成入社與權限流程", () => {
  it("訪客不能查會員，管理者只看自己社團且預設不列 OB／待確認", () => {
    const s = initialState();
    expect(listedMembers(s, "visitor", true)).toEqual([]);
    expect(listedMembers(s, "taipei", false).map((m) => m.id)).toEqual([
      "m1",
      "m2",
      "m6",
    ]);
    expect(listedMembers(s, "taipei", true).map((m) => m.id)).toEqual([
      "m1",
      "m2",
      "m3",
      "m4",
      "m6",
    ]);
  });
  it("社長也不能查隱藏聯絡資料，只有本人例外", () => {
    const s = initialState();
    const m = s.members[0];
    expect(contactValue(m, "taipei", s, "phone")).toBeNull();
    expect(contactValue(m, "member", s, "phone")).toBe(m.phone);
    expect(contactValue(m, "visitor", s, "email")).toBeNull();
  });
  it("自己的隱私變更會反映到其他登入者的詳情", () => {
    const s = transition(initialState(), "member", {
      type: "privacy",
      emailVisible: false,
      phoneVisible: false,
    });
    expect(contactValue(s.members[0], "taipei", s, "email")).toBeNull();
  });
  it("不能越社審核，未核准者不列名冊，核准後才列入", () => {
    const s = initialState();
    expect(listedMembers(s, "taipei", true).some((m) => m.id === "m7")).toBe(
      false,
    );
    expect(() =>
      transition(s, "taichung", {
        type: "review",
        id: "a1",
        approve: true,
        reason: "",
        startsOn: "2026-10-15",
      }),
    ).toThrow("只能管理自己社團");
    const approved = transition(s, "taipei", {
      type: "review",
      id: "a1",
      approve: true,
      reason: "",
      startsOn: "2026-10-15",
    });
    expect(
      listedMembers(approved, "taipei", false).some((m) => m.id === "m7"),
    ).toBe(true);
    expect(s.members.find((m) => m.id === "m7")?.clubId).toBeNull();
  });
  it("重複核准與不合法回溯日期不建立社籍", () => {
    const cmd = {
      type: "review" as const,
      id: "a1",
      approve: true,
      reason: "",
      startsOn: "2026-10-15",
    };
    const approved = transition(initialState(), "taipei", cmd);
    expect(() => transition(approved, "taipei", cmd)).toThrow("已處理");
    for (const date of ["2027-01-01", "2026-02-30", ""])
      expect(() =>
        transition(initialState(), "taipei", { ...cmd, startsOn: date }),
      ).toThrow("日期");
  });
  it("拒絕需原因，撤回後不能再核准", () => {
    expect(() =>
      transition(initialState(), "taipei", {
        type: "review",
        id: "a1",
        approve: false,
        reason: "",
        startsOn: "",
      }),
    ).toThrow("原因");
    const s = initialState();
    s.currentMemberId = "m7";
    const withdrawn = transition(s, "member", {
      type: "withdrawApplication",
      id: "a1",
    });
    expect(() =>
      transition(withdrawn, "taipei", {
        type: "review",
        id: "a1",
        approve: true,
        reason: "",
        startsOn: "2026-10-15",
      }),
    ).toThrow("已處理");
  });
  it("同類型待審上限與已存在有效社籍限制", () => {
    const s = initialState();
    s.currentMemberId = "m7";
    expect(() =>
      transition(s, "member", {
        type: "apply",
        id: "a2",
        clubId: "taichung",
        message: "加入",
      }),
    ).toThrow("待審申請");
    expect(() =>
      transition(initialState(), "member", {
        type: "apply",
        id: "a2",
        clubId: "taichung",
        message: "加入",
      }),
    ).toThrow("轉社");
  });
  it("註冊識別不分大小寫且電話格式／唯一性檢查", () => {
    const cmd = {
      type: "register" as const,
      id: "new-id",
      name: "合成姓名",
      callName: "Nova",
      email: "new@example.test",
      phone: "",
    };
    expect(() =>
      transition(initialState(), "visitor", {
        ...cmd,
        email: " CORA@EXAMPLE.TEST ",
      }),
    ).toThrow("識別不可使用");
    expect(() =>
      transition(initialState(), "visitor", { ...cmd, phone: "0912345678" }),
    ).toThrow("含國碼");
    expect(() =>
      transition(initialState(), "visitor", { ...cmd, phone: "+886912000101" }),
    ).toThrow("識別不可使用");
    const s = transition(initialState(), "visitor", cmd);
    expect(s.currentMemberId).toBe("new-id");
    expect(s.members.at(-1)?.status).toBe("unaffiliated");
    expect(
      listedMembers(s, "taipei", true).some((m) => m.id === "new-id"),
    ).toBe(false);
  });
  it("年度補確認只能對自己的待確認社員", () => {
    expect(() =>
      transition(initialState(), "taichung", {
        type: "confirmYear",
        memberId: "m3",
      }),
    ).toThrow("自己社團");
    expect(() =>
      transition(initialState(), "taipei", {
        type: "confirmYear",
        memberId: "m4",
      }),
    ).toThrow("待確認");
    expect(
      transition(initialState(), "taipei", {
        type: "confirmYear",
        memberId: "m3",
      }).members.find((m) => m.id === "m3")?.status,
    ).toBe("confirmed");
  });
});
describe("三段式轉社與歷史", () => {
  it("只有本人可申請，不能轉到原社或重複申請", () => {
    expect(() =>
      transition(initialState(), "taipei", {
        type: "transfer",
        id: "t1",
        toClub: "taichung",
      }),
    ).toThrow("會員本人");
    expect(() =>
      transition(initialState(), "member", {
        type: "transfer",
        id: "t1",
        toClub: "taipei",
      }),
    ).toThrow("其他社團");
    expect(() =>
      transition(createTransfer(), "member", {
        type: "transfer",
        id: "t2",
        toClub: "taichung",
      }),
    ).toThrow("進行中");
  });
  it("雙方核准只變 ready，原社籍仍然保留，需本人 execute", () => {
    const ready = bothApproved();
    expect(ready.transfers[0].status).toBe("ready");
    expect(ready.members[0].clubId).toBe("taipei");
    expect(() =>
      transition(ready, "taipei", { type: "executeTransfer", id: "t1" }),
    ).toThrow("會員本人");
    const completed = transition(ready, "member", {
      type: "executeTransfer",
      id: "t1",
    });
    expect(completed.members[0].clubId).toBe("taichung");
    expect(completed.history[0]).toMatchObject({
      clubId: "taipei",
      endsOn: "2026-10-15",
      visible: false,
    });
    expect(completed.history[0].nameSnapshot).toBe("林予安");
    expect(completed.history[0].callNameSnapshot).toBe("Cora");
    expect(ready.members[0].clubId).toBe("taipei");
    expect(() =>
      transition(completed, "member", { type: "executeTransfer", id: "t1" }),
    ).toThrow("最終執行");
  });
  it("未滿雙方核准不可執行", () => {
    const half = transition(createTransfer(), "taipei", {
      type: "approveTransfer",
      id: "t1",
    });
    expect(() =>
      transition(half, "member", { type: "executeTransfer", id: "t1" }),
    ).toThrow("雙方核准");
    expect(half.members[0].clubId).toBe("taipei");
  });
  it("撤回／拒絕後不可執行且不變更社籍", () => {
    const withdrawn = transition(bothApproved(), "member", {
      type: "withdrawTransfer",
      id: "t1",
    });
    const rejected = transition(bothApproved(), "taipei", {
      type: "rejectTransfer",
      id: "t1",
      reason: "合成拒絕原因",
    });
    expect(rejected.transfers[0].reason).toBe("合成拒絕原因");
    for (const s of [withdrawn, rejected]) {
      expect(s.members[0].clubId).toBe("taipei");
      expect(() =>
        transition(s, "member", { type: "executeTransfer", id: "t1" }),
      ).toThrow();
    }
  });
  it("社籍若已變更，過期核准不可套用；不能公開他人的歷史", () => {
    const stale = bothApproved();
    stale.members[0].clubId = "taichung";
    expect(() =>
      transition(stale, "member", { type: "executeTransfer", id: "t1" }),
    ).toThrow();
    const completed: State = transition(bothApproved(), "member", {
      type: "executeTransfer",
      id: "t1",
    });
    expect(() =>
      transition(completed, "taipei", {
        type: "historyVisibility",
        index: 0,
        visible: true,
      }),
    ).toThrow("會員本人");
    completed.currentMemberId = "m2";
    expect(() =>
      transition(completed, "member", {
        type: "historyVisibility",
        index: 0,
        visible: true,
      }),
    ).toThrow("僅本人");
  });
});

describe("退社／OB與年度UI狀態", () => {
  const endCommand = {
    type: "requestEnd" as const,
    id: "end1",
    memberId: "m1",
    reason: "ob" as const,
    explanation: "合成畢業辦理",
    endsOn: "2026-10-15",
    direct: false,
  };
  it("本人申請不直接結束；管理者核准才OB並保留歷史", () => {
    const requested = transition(initialState(), "member", endCommand);
    expect(requested.members[0].status).toBe("confirmed");
    expect(() =>
      transition(requested, "taichung", {
        type: "reviewEnd",
        id: "end1",
        approve: true,
        reason: "",
      }),
    ).toThrow("自己社團");
    const ended = transition(requested, "taipei", {
      type: "reviewEnd",
      id: "end1",
      approve: true,
      reason: "",
    });
    expect(ended.members[0].status).toBe("ob");
    expect(ended.history[0]).toMatchObject({
      memberId: "m1",
      visible: false,
      endsOn: "2026-10-15",
    });
    expect(
      listedMembers(ended, "member", false).some((m) => m.id === "m1"),
    ).toBe(false);
    expect(
      listedMembers(ended, "member", true).some((m) => m.id === "m1"),
    ).toBe(true);
  });
  it("直接辦理需要社團權限及原因，撤回後不可核准", () => {
    expect(() =>
      transition(initialState(), "member", { ...endCommand, direct: true }),
    ).toThrow();
    expect(() =>
      transition(initialState(), "taipei", {
        ...endCommand,
        direct: true,
        explanation: "",
      }),
    ).toThrow("原因");
    const requested = transition(initialState(), "member", endCommand);
    const withdrawn = transition(requested, "member", {
      type: "withdrawEnd",
      id: "end1",
    });
    expect(() =>
      transition(withdrawn, "taipei", {
        type: "reviewEnd",
        id: "end1",
        approve: true,
        reason: "",
      }),
    ).toThrow("已處理");
  });
  it("社籍結束使未完成轉社失效，逾期轉社亦不切社籍", () => {
    const ended = transition(createTransfer(), "taipei", {
      ...endCommand,
      direct: true,
    });
    expect(ended.transfers[0].status).toBe("withdrawn");
    expect(() =>
      transition(ended, "member", { type: "executeTransfer", id: "t1" }),
    ).toThrow();
    const expired = transition(bothApproved(), "member", {
      type: "expireTransfer",
      id: "t1",
    });
    expect(expired.transfers[0].status).toBe("expired");
    expect(expired.members[0].clubId).toBe("taipei");
  });
  it("年度情境不復活OB，補確認標記到指定年度", () => {
    const pending = transition(initialState(), "taipei", {
      type: "annualBoundary",
      year: 2027,
    });
    expect(pending.members[0].status).toBe("unconfirmed");
    expect(pending.members[3].status).toBe("ob");
    const confirmed = transition(pending, "taipei", {
      type: "confirmYear",
      memberId: "m1",
      year: 2027,
    });
    expect(confirmed.members[0].annualConfirmedYear).toBe(2027);
    expect(
      transition(confirmed, "taipei", { type: "annualBoundary", year: 2027 })
        .members[0].status,
    ).toBe("confirmed");
  });
  it("申請逾期後可重送但已處理案件不可反覆逾期", () => {
    const pending = initialState();
    pending.currentMemberId = "m7";
    const expired = transition(pending, "member", {
      type: "expireApplication",
      id: "a1",
    });
    expect(expired.applications[0].status).toBe("expired");
    expect(() =>
      transition(expired, "member", { type: "expireApplication", id: "a1" }),
    ).toThrow();
    expect(
      transition(expired, "member", {
        type: "apply",
        id: "a2",
        clubId: "taipei",
        message: "重新申請",
      }).applications[1].status,
    ).toBe("pending");
  });
});

describe('可變社團目錄與跨頁狀態', () => {
  const catalog=[{id:'taipei',name:'台北星光扶青社',district:'D3462'},{id:'taichung',name:'台中山海扶青社',district:'D3462'},{id:'new-club',name:'合成新社',district:'D3481'}]
  it('新增社團可申請且只有其管理身分能核准', () => {
    const s=initialState();s.currentMemberId='m7';s.applications=[]
    const applied=transition(s,'member',{type:'apply',id:'new-app',clubId:'new-club',message:'新社申請'},'2026-10-15',catalog)
    expect(()=>transition(applied,'taipei',{type:'review',id:'new-app',approve:true,startsOn:'2026-10-15',reason:''},'2026-10-15',catalog)).toThrow()
    const accepted=transition(applied,'club:new-club',{type:'review',id:'new-app',approve:true,startsOn:'2026-10-15',reason:''},'2026-10-15',catalog)
    expect(listedMembers(accepted,'club:new-club',false,'',catalog)).toHaveLength(1)
    expect(accepted.members.find(m=>m.id==='m7')?.clubId).toBe('new-club')
  })
  it('跨區後舊地區不能再讀名冊，新地區按現目錄可見', () => {
    expect(listedMembers(initialState(),'district',true,'',catalog,'D3481')).toHaveLength(0)
    expect(listedMembers(initialState(),'district',true,'',catalog,'D3462').some(m=>m.clubId==='taipei')).toBe(true)
  })
  it('年度補確認以共享模擬年度為準，不因離頁而回到舊年', () => {
    const nextYear=transition(initialState(),'taipei',{type:'annualBoundary',year:2027})
    const confirmed=transition(nextYear,'taipei',{type:'confirmYear',memberId:'m1'})
    expect(confirmed.demoYear).toBe(2027)
    expect(confirmed.members[0].annualConfirmedYear).toBe(2027)
  })
})
