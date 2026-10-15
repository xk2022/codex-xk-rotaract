export type Page<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
};
export type Club = {
  id: string;
  name: string;
  clubTypeCode: string;
  districtId: string;
};
export type Join = {
  id: string;
  applicant: { id: string; name: string; callName: string };
  clubId: string;
  status: string;
  requestedAt: string;
  expiresAt: string;
  version: number;
};
export type Member = {
  id: string;
  name: string;
  callName: string;
  clubs: (Club & { districtName: string })[];
  annualStatus: string;
};
export type MemberSelf = {
  id: string;
  accountId: string;
  name: string;
  callName: string;
  avatarAssetId: string | null;
  phoneVisible: boolean;
  emailVisible: boolean;
  version: number;
};
export type Me = {
  account: {
    id: string;
    accountCode: string;
    email: string;
    phone: string | null;
    codeChangeCount: number;
    version: number;
  };
  member: MemberSelf | null;
  remainingCodeChanges: number;
  roles: {
    role: string;
    scope: { scopeType: string; scopeId: string | null };
    startsAt: string;
    endsAt: string;
  }[];
  csrfToken: string;
};
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public requestId?: string,
    public fields: { field: string; message: string }[] = [],
  ) {
    super(message);
  }
}
// Only SHA-256 fingerprints and opaque keys survive an attempt; never retain
// credentials or request bodies. The cache lives for this API client only.
export function createMutationKeys() {
  const pending = new Map<string, { fingerprint: string; key: string }>();
  return {
    async keyFor(path: string, body: unknown) {
      const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(JSON.stringify(body)),
      );
      const fingerprint = Array.from(new Uint8Array(digest), (byte) =>
        byte.toString(16).padStart(2, "0"),
      ).join("");
      const previous = pending.get(path);
      if (previous?.fingerprint === fingerprint) return previous.key;
      if (pending.size >= 100) pending.delete(pending.keys().next().value!);
      const key = crypto.randomUUID();
      pending.set(path, { fingerprint, key });
      return key;
    },
    succeeded(path: string, key: string) {
      if (pending.get(path)?.key === key) pending.delete(path);
    },
    clear() {
      pending.clear();
    },
  };
}
export function createApi(fetcher: typeof fetch = fetch) {
  let token: string | undefined;
  const mutations = createMutationKeys();
  async function request<T>(
    path: string,
    method = "GET",
    body?: unknown,
    idempotencyKey?: string,
  ): Promise<T> {
    if (method !== "GET" && !token) await csrf();
    const headers: Record<string, string> = { Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (method !== "GET") headers["X-CSRF-Token"] = token!;
    if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
    let response: Response;
    try {
      response = await fetcher(`/api/v1${path}`, {
        method,
        headers,
        credentials: "same-origin",
        cache: "no-store",
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
    } catch {
      throw new ApiError(0, "無法連線至服務，請確認後端已啟動後再試。");
    }
    if (!response.ok) {
      const problem = await response.json().catch(() => ({}));
      if (response.status === 401 || response.status === 403) token = undefined;
      throw new ApiError(
        response.status,
        problem.message || `操作失敗（${response.status}），請稍後再試。`,
        problem.requestId,
        Array.isArray(problem.fieldErrors) ? problem.fieldErrors : [],
      );
    }
    if (response.status === 204) return undefined as T;
    return response.json();
  }
  async function csrf() {
    token = (await request<{ csrfToken: string }>("/csrf-token")).csrfToken;
  }
  return {
    request,
    forgetSession() {
      token = undefined;
      mutations.clear();
    },
    async mutate<T>(path: string, body: unknown): Promise<T> {
      const key = await mutations.keyFor(path, body);
      const result = await request<T>(path, "POST", body, key);
      mutations.succeeded(path, key);
      return result;
    },
    async updateProfile(body: {
      version: number;
      name: string;
      callName: string;
    }) {
      return request<MemberSelf>("/me/profile", "PATCH", body);
    },
    async updatePrivacy(body: {
      version: number;
      phoneVisible: boolean;
      emailVisible: boolean;
    }) {
      return request<MemberSelf>("/me/privacy", "PATCH", body);
    },
    async changeContact(body: {
      version: number;
      currentPassword: string;
      kind: "email" | "phone";
      newValue: string;
    }) {
      const path = "/me/contact-changes";
      const key = await mutations.keyFor(path, body);
      const result = await request<Me>(path, "POST", body, key);
      token = result.csrfToken;
      mutations.succeeded(path, key);
      return result;
    },
    async changeCode(body: {
      version: number;
      currentPassword: string;
      newCode: string;
    }) {
      const path = "/me/account-code-changes";
      const key = await mutations.keyFor(path, body);
      const result = await request<Me>(path, "POST", body, key);
      token = result.csrfToken;
      mutations.succeeded(path, key);
      return result;
    },
    csrf,
    async me() {
      const me = await request<Me>("/me");
      token = me.csrfToken;
      return me;
    },
    async login(identifier: string, password: string) {
      const me = await request<Me>("/sessions", "POST", {
        identifier,
        password,
      });
      token = me.csrfToken;
      return me;
    },
    async logout() {
      await request<void>("/sessions/current", "DELETE");
      token = undefined;
      mutations.clear();
    },
  };
}
export const api = createApi();
export const taipeiToday = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export function reviewerClubs(me: Me) {
  const now = Date.now();
  return [
    ...new Set(
      me.roles
        .filter(
          (r) =>
            [
              "club_president",
              "club_secretary",
              "club_manager",
              "club_backup",
            ].includes(r.role) &&
            r.scope.scopeType === "club" &&
            r.scope.scopeId &&
            Date.parse(r.startsAt) <= now &&
            now < Date.parse(r.endsAt),
        )
        .map((r) => r.scope.scopeId!),
    ),
  ];
}

export function passwordValidation(value: string, registering = true) {
  const length = Array.from(value).length;
  return length < (registering ? 12 : 1) || length > 128
    ? `密碼需為 ${registering ? 12 : 1}–128 個字元。`
    : "";
}
