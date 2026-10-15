import { describe, it, expect } from "vitest";
import {
  initialOrganizations,
  organizationTransition,
} from "./organizationModel";
import type { OrgContext } from "./organizationModel";
const president: OrgContext = {
  actor: "taipei",
  office: "president",
  district: "D3481",
};
const district: OrgContext = {
  actor: "district",
  office: "president",
  district: "D3481",
};
describe("organization permissions and lifecycle", () => {
  it("defaults contact publication off and prevents ordinary managers changing brand", () => {
    const state = initialOrganizations();
    expect(state.clubs[0].publicEmail).toBe(false);
    expect(() =>
      organizationTransition(
        state,
        { ...president, office: "manager" },
        { type: "edit", clubId: "taipei", patch: { name: "改名" } },
      ),
    ).toThrow("一般管理者");
    expect(
      organizationTransition(
        state,
        { ...president, office: "manager" },
        { type: "edit", clubId: "taipei", patch: { description: "更新" } },
      ).clubs[0].description,
    ).toBe("更新");
  });
  it("rejects script URLs and cross-club writes", () => {
    expect(() =>
      organizationTransition(initialOrganizations(), president, {
        type: "edit",
        clubId: "taipei",
        patch: { website: "javascript:alert(1)" },
      }),
    ).toThrow();
    expect(() =>
      organizationTransition(initialOrganizations(), president, {
        type: "edit",
        clubId: "taichung",
        patch: { description: "非法" },
      }),
    ).toThrow();
  });
  it("requires district scope and reason for stopping and restoring", () => {
    const state = initialOrganizations();
    expect(() =>
      organizationTransition(state, district, {
        type: "status",
        clubId: "taichung",
        enabled: false,
        reason: "測試",
      }),
    ).toThrow();
    expect(() =>
      organizationTransition(state, district, {
        type: "status",
        clubId: "taipei",
        enabled: false,
        reason: "",
      }),
    ).toThrow();
    const stopped = organizationTransition(state, district, {
      type: "status",
      clubId: "taipei",
      enabled: false,
      reason: "暫停",
    });
    expect(stopped.clubs[0].enabled).toBe(false);
    expect(state.clubs[0].enabled).toBe(true);
  });
  it("requires both districts and rejects replay for moves", () => {
    let state = organizationTransition(initialOrganizations(), district, {
      type: "move",
      id: "p",
      clubId: "taipei",
      to: "D3462",
      reason: "重劃",
    });
    state = organizationTransition(state, district, {
      type: "approveMove",
      id: "p",
    });
    expect(state.clubs[0].district).toBe("D3481");
    expect(() =>
      organizationTransition(state, district, { type: "approveMove", id: "p" }),
    ).toThrow();
    state = organizationTransition(
      state,
      { ...district, district: "D3462" },
      { type: "approveMove", id: "p" },
    );
    expect(state.clubs[0].district).toBe("D3462");
    expect(() =>
      organizationTransition(state, district, {
        type: "edit",
        clubId: "taipei",
        patch: { description: "舊轄區" },
      }),
    ).toThrow();
  });
  it("limits terms to the rotary year and detects overlapping officers", () => {
    const cmd = {
      type: "role" as const,
      id: "r3",
      clubId: "taipei",
      memberId: "m2",
      office: "president" as const,
      startsOn: "2027-07-01",
      endsOn: "2028-07-01",
    };
    expect(() =>
      organizationTransition(initialOrganizations(), president, cmd),
    ).toThrow("6/30");
    const state = organizationTransition(initialOrganizations(), president, {
      ...cmd,
      endsOn: "2028-06-30",
    });
    expect(state.roles).toHaveLength(3);
    expect(() =>
      organizationTransition(state, president, {
        ...cmd,
        id: "r4",
        memberId: "m3",
        endsOn: "2028-06-30",
      }),
    ).toThrow("重疊");
    expect(() =>
      organizationTransition(
        initialOrganizations(),
        { ...president, office: "manager" },
        { ...cmd, endsOn: "2028-06-30" },
      ),
    ).toThrow();
  });
});
