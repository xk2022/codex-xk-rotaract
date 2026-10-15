import { describe, expect, it, vi } from "vitest";
import {
  ApiError,
  createApi,
  reviewerClubs,
  passwordValidation,
  createMutationKeys,
} from "./api";
import type { Me } from "./api";
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
describe("live API boundary", () => {
  it("bootstraps anonymous CSRF, sends cookie credentials and rotates token after login", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(json({ csrfToken: "anonymous-token" }))
      .mockResolvedValueOnce(json({ csrfToken: "session-token" }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const client = createApi(fetcher as typeof fetch);
    await client.login("member@example.test", "never-log-this");
    await client.logout();
    expect(fetcher.mock.calls[0][0]).toBe("/api/v1/csrf-token");
    expect(fetcher.mock.calls[1][1]).toMatchObject({
      credentials: "same-origin",
      cache: "no-store",
      headers: { "X-CSRF-Token": "anonymous-token" },
    });
    expect(fetcher.mock.calls[2][1].headers["X-CSRF-Token"]).toBe(
      "session-token",
    );
  });
  it("retains caller idempotency key and reports safe server correlation on conflict", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(json({ csrfToken: "token" }))
      .mockResolvedValueOnce(
        json({ message: "狀態已變更", requestId: "correlation" }, 409),
      );
    const client = createApi(fetcher as typeof fetch);
    await expect(
      client.request(
        "/join-applications",
        "POST",
        { clubId: "club" },
        "same-key-for-retry",
      ),
    ).rejects.toMatchObject({
      status: 409,
      message: "狀態已變更",
      requestId: "correlation",
    });
    expect(fetcher.mock.calls[1][1].headers["Idempotency-Key"]).toBe(
      "same-key-for-retry",
    );
  });
  it("clears expired CSRF context before next attempt", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(json({ csrfToken: "old" }))
      .mockResolvedValueOnce(json({ message: "Session expired" }, 401))
      .mockResolvedValueOnce(json({ csrfToken: "fresh" }))
      .mockResolvedValueOnce(json({ csrfToken: "signed-in" }));
    const client = createApi(fetcher as typeof fetch);
    await expect(client.login("x", "y")).rejects.toBeInstanceOf(ApiError);
    await client.login("x", "y");
    expect(fetcher.mock.calls[2][0]).toBe("/api/v1/csrf-token");
    expect(fetcher.mock.calls[3][1].headers["X-CSRF-Token"]).toBe("fresh");
  });
  it("does not grant review UI for district or expired club roles", () => {
    const roles = [
      {
        role: "district_manager",
        scope: { scopeType: "district", scopeId: "district" },
        startsAt: "2020-01-01",
        endsAt: "2099-01-01",
      },
      {
        role: "club_manager",
        scope: { scopeType: "club", scopeId: "expired" },
        startsAt: "2020-01-01",
        endsAt: "2021-01-01",
      },
      {
        role: "club_secretary",
        scope: { scopeType: "club", scopeId: "allowed" },
        startsAt: "2020-01-01",
        endsAt: "2099-01-01",
      },
    ];
    expect(reviewerClubs({ roles } as Me)).toEqual(["allowed"]);
  });
});

it("counts Unicode password code points without trimming or truncation", () => {
  expect(passwordValidation("🔐".repeat(12))).toBe("");
  expect(passwordValidation("🔐".repeat(128))).toBe("");
  expect(passwordValidation("🔐".repeat(129))).not.toBe("");
  expect(passwordValidation("x".repeat(11) + " ")).toBe("");
});

it("reuses an unknown-result operation key, changes it for changed input and clears on success", async () => {
  const keys = createMutationKeys();
  const key = await keys.keyFor("/accounts", {
    email: "a@example.test",
    password: "🔐secret",
  });
  expect(
    await keys.keyFor("/accounts", {
      email: "a@example.test",
      password: "🔐secret",
    }),
  ).toBe(key);
  const changed = await keys.keyFor("/accounts", {
    email: "b@example.test",
    password: "🔐secret",
  });
  expect(changed).not.toBe(key);
  keys.succeeded("/accounts", changed);
  expect(
    await keys.keyFor("/accounts", {
      email: "b@example.test",
      password: "🔐secret",
    }),
  ).not.toBe(changed);
});
it("retains mutation key across network failure and starts a fresh operation after success", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(json({ csrfToken: "token" }))
    .mockRejectedValueOnce(new TypeError("offline"))
    .mockImplementation(async () => json({ id: "result" }));
  const client = createApi(fetcher as typeof fetch);
  await expect(
    client.mutate("/join-applications", { clubId: "club" }),
  ).rejects.toMatchObject({ status: 0 });
  await client.mutate("/join-applications", { clubId: "club" });
  expect(fetcher.mock.calls[2][1].headers["Idempotency-Key"]).toBe(
    fetcher.mock.calls[1][1].headers["Idempotency-Key"],
  );
  await client.mutate("/join-applications", { clubId: "club" });
  expect(fetcher.mock.calls[3][1].headers["Idempotency-Key"]).not.toBe(
    fetcher.mock.calls[2][1].headers["Idempotency-Key"],
  );
});

it("uses member versions for PATCH and never attaches creation idempotency keys", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(json({ csrfToken: "csrf" }))
    .mockResolvedValueOnce(json({ version: 8 }))
    .mockResolvedValueOnce(json({ version: 9 }));
  const client = createApi(fetcher as typeof fetch);
  await client.updateProfile({ version: 7, name: "New", callName: "Call" });
  await client.updatePrivacy({
    version: 8,
    phoneVisible: false,
    emailVisible: true,
  });
  expect(fetcher.mock.calls[1][1].method).toBe("PATCH");
  expect(fetcher.mock.calls[1][1].headers["Idempotency-Key"]).toBeUndefined();
  expect(JSON.parse(fetcher.mock.calls[2][1].body)).toEqual({
    version: 8,
    phoneVisible: false,
    emailVisible: true,
  });
});
it("adopts rotated contact CSRF before the next mutation", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(json({ csrfToken: "before" }))
    .mockResolvedValueOnce(
      json({ csrfToken: "rotated", account: { version: 3 } }),
    )
    .mockResolvedValueOnce(new Response(null, { status: 204 }));
  const client = createApi(fetcher as typeof fetch);
  await client.changeContact({
    version: 2,
    kind: "phone",
    newValue: "+14155552671",
    currentPassword: "secret",
  });
  await client.logout();
  expect(fetcher.mock.calls[1][1].headers["Idempotency-Key"]).toBeTruthy();
  expect(fetcher.mock.calls[2][1].headers["X-CSRF-Token"]).toBe("rotated");
});
it("preserves contact unknown-result key and does not retry stale profile writes", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(json({ csrfToken: "t" }))
    .mockRejectedValueOnce(new TypeError("offline"))
    .mockResolvedValueOnce(json({ csrfToken: "new" }))
    .mockResolvedValueOnce(json({ message: "stale" }, 409));
  const client = createApi(fetcher as typeof fetch);
  const body = {
    version: 1,
    kind: "email" as const,
    newValue: "a@example.test",
    currentPassword: "secret",
  };
  await expect(client.changeContact(body)).rejects.toMatchObject({ status: 0 });
  await client.changeContact(body);
  expect(fetcher.mock.calls[1][1].headers["Idempotency-Key"]).toBe(
    fetcher.mock.calls[2][1].headers["Idempotency-Key"],
  );
  await expect(
    client.updateProfile({ version: 0, name: "N", callName: "C" }),
  ).rejects.toMatchObject({ status: 409 });
  expect(fetcher).toHaveBeenCalledTimes(4);
});
it("uses the successful code-change Me token and account-version request", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(json({ csrfToken: "old" }))
    .mockResolvedValueOnce(
      json({ csrfToken: "after-code", remainingCodeChanges: 0 }),
    )
    .mockResolvedValueOnce(new Response(null, { status: 204 }));
  const client = createApi(fetcher as typeof fetch);
  const current = await client.changeCode({
    version: 4,
    currentPassword: "secret",
    newCode: "member_new",
  });
  expect(current.remainingCodeChanges).toBe(0);
  await client.logout();
  expect(JSON.parse(fetcher.mock.calls[1][1].body).version).toBe(4);
  expect(fetcher.mock.calls[2][1].headers["X-CSRF-Token"]).toBe("after-code");
});
it("recovers authenticated CSRF through me after current-password rejection without replaying the change", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(json({ csrfToken: "old" }))
    .mockResolvedValueOnce(
      json(
        { code: "AUTHENTICATION_FAILED", message: "Password rejected" },
        401,
      ),
    )
    .mockResolvedValueOnce(json({ csrfToken: "recovered" }))
    .mockResolvedValueOnce(json({ version: 2 }));
  const client = createApi(fetcher as typeof fetch);
  await expect(
    client.changeContact({
      version: 1,
      kind: "email",
      newValue: "new@example.test",
      currentPassword: "wrong",
    }),
  ).rejects.toMatchObject({ status: 401 });
  await client.me();
  await client.updatePrivacy({
    version: 1,
    phoneVisible: false,
    emailVisible: false,
  });
  expect(fetcher.mock.calls[3][1].headers["X-CSRF-Token"]).toBe("recovered");
  expect(
    fetcher.mock.calls.filter(([url]) => url.endsWith("contact-changes")),
  ).toHaveLength(1);
});
