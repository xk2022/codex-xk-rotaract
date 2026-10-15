import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  api,
  ApiError,
  reviewerClubs,
  taipeiToday,
  passwordValidation,
} from "./api";
import type { Club, Join, Me, Member, Page } from "./api";
import { goToPortal, readPortalRoute } from "../portalRoute";
import "./live.css";
export default function LiveWorkspace() {
  const [route, setRoute] = useState(readPortalRoute),
    [me, setMe] = useState<Me | null>(null),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [tab, setTab] = useState("join");
  const [detail, setDetail] = useState<
    (Member & { email?: string; phone?: string }) | null
  >(null);
  const [clubs, setClubs] = useState<Club[]>([]),
    [joins, setJoins] = useState<Join[]>([]),
    [members, setMembers] = useState<Member[]>([]),
    [page, setPage] = useState(1),
    [total, setTotal] = useState(0),
    [reviewClub, setReviewClub] = useState(""),
    [keyword, setKeyword] = useState(""),
    [search, setSearch] = useState(""),
    [revision, setRevision] = useState(0);
  const scopes = me ? reviewerClubs(me) : [];
  useEffect(() => {
    if (me && tab === "review" && !scopes.length) {
      setTab("join");
      setReviewClub("");
      setPage(1);
    }
    if (reviewClub && !scopes.includes(reviewClub)) {
      setReviewClub(scopes[0] || "");
      setPage(1);
    }
  }, [me, tab, reviewClub]);
  function fail(e: unknown) {
    setError(
      e instanceof ApiError
        ? `${e.message}${e.requestId ? `（查詢代碼：${e.requestId}）` : ""}`
        : "操作未完成，請重試。",
    );
    if (e instanceof ApiError && e.status === 401) {
      setMe(null);
      setDetail(null);
      setJoins([]);
      setMembers([]);
      goToPortal("login");
    }
  }
  useEffect(() => {
    const sync = () => setRoute(readPortalRoute());
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  useEffect(() => {
    let alive = true;
    api
      .me()
      .then((v) => {
        if (alive) setMe(v);
      })
      .catch((e) => {
        if (alive && !(e instanceof ApiError && e.status === 401)) fail(e);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    if (!me) return;
    let alive = true;
    setLoading(true);
    setError("");
    const path =
      tab === "members"
        ? `/members?page=${page}${search ? `&keyword=${encodeURIComponent(search)}` : ""}`
        : `/join-applications?scope=${tab === "review" ? "club" : "self"}&page=${page}${tab === "review" ? `&clubId=${encodeURIComponent(reviewClub || scopes[0] || "")}` : ""}`;
    Promise.all([loadClubs(), api.request<Page<Member> | Page<Join>>(path)])
      .then(([c, data]) => {
        if (!alive) return;
        setClubs(c);
        setTotal(data.total);
        if (tab === "members") setMembers((data as Page<Member>).items);
        else setJoins((data as Page<Join>).items);
      })
      .catch((e) => {
        if (alive) fail(e);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [me, tab, page, search, reviewClub, revision]);
  async function act(task: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await task();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }
  function submit(task: (f: FormData, el: HTMLFormElement) => Promise<void>) {
    return (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const el = e.currentTarget;
      const f = new FormData(el);
      void act(() => task(f, el));
    };
  }
  async function loadClubs() {
    const first = await api.request<Page<Club>>("/clubs?pageSize=100");
    const all = [...first.items];
    for (let p = 2; all.length < first.total; p++) {
      const next = await api.request<Page<Club>>(
        `/clubs?pageSize=100&page=${p}`,
      );
      if (!next.items.length) break;
      all.push(...next.items);
    }
    return all;
  }
  async function refresh() {
    setMe(await api.me());
    setRevision((v) => v + 1);
  }
  if (["home", "map", "calendar"].includes(route)) return null;
  return (
    <main className="live-main">
      <header className="live-header">
        <a href="#/">Rotaract 萬花筒</a>
        <span>本地 API 串接</span>
        <a href="#/">返回公開首頁</a>
      </header>
      <section className="live-intro">
        <p>CONNECT · BELONG · GROW</p>
        <h1>
          {me
            ? `你好，${me.member?.callName || me.account.accountCode}`
            : route === "register"
              ? "開始你的扶青旅程"
              : "歡迎回來"}
        </h1>
        <p>
          {me
            ? `會員代號 ${me.account.accountCode}`
            : "完成入社審核後，你的資料才會出現在會員名冊。"}
        </p>
      </section>
      {error && (
        <div role="alert" className="live-alert">
          {error}
          <button
            onClick={() =>
              void act(async () => {
                const value = await api.me();
                setMe(value);
                setRevision((v) => v + 1);
              })
            }
          >
            重新讀取
          </button>
        </div>
      )}
      {notice && (
        <p role="status" className="live-notice">
          {notice}
        </p>
      )}
      {loading && <p role="status">正在讀取資料…</p>}
      {!me && !loading && (
        <section className="live-card live-auth">
          <nav className="live-tabs">
            <a href="#/login">登入</a>
            <a href="#/register">建立帳號</a>
          </nav>
          {route === "register" ? (
            <form
              key="register"
              onSubmit={submit(async (f, el) => {
                const result = await api.mutate<{ accountCode: string }>(
                  "/accounts",
                  {
                    name: f.get("name"),
                    callName: f.get("callName"),
                    email: f.get("email"),
                    password: f.get("password"),
                    ...(f.get("phone") ? { phone: f.get("phone") } : {}),
                  },
                );
                el.reset();
                setNotice(
                  `帳號建立成功，會員代號 ${result.accountCode}。請使用信箱及密碼登入。`,
                );
                goToPortal("login");
              })}
            >
              <label>
                姓名
                <input
                  name="name"
                  autoComplete="name"
                  maxLength={100}
                  required
                />
              </label>
              <label>
                扶輪 call name
                <input name="callName" maxLength={100} required />
              </label>
              <label>
                Email
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  maxLength={254}
                  required
                />
              </label>
              <label>
                電話（選填，含國碼）
                <input
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  placeholder="+886912345678"
                  pattern="\+[1-9][0-9]{6,14}"
                />
              </label>
              <label>
                密碼
                <input
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  onChange={(e) =>
                    e.currentTarget.setCustomValidity(
                      passwordValidation(e.currentTarget.value),
                    )
                  }
                  required
                  aria-describedby="password-help"
                />
              </label>
              <small id="password-help">
                12–128 個字元，支援貼上與密碼管理器。
              </small>
              <button className="button primary" disabled={busy}>
                建立帳號
              </button>
            </form>
          ) : (
            <form
              key="login"
              onSubmit={submit(async (f, el) => {
                const v = await api.login(
                  String(f.get("identifier")),
                  String(f.get("password")),
                );
                el.reset();
                setMe(v);
                goToPortal("workspace");
              })}
            >
              <label>
                Email、電話或會員代號
                <input
                  name="identifier"
                  autoComplete="username"
                  required
                  maxLength={254}
                />
              </label>
              <label>
                密碼
                <input
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  onChange={(e) =>
                    e.currentTarget.setCustomValidity(
                      passwordValidation(e.currentTarget.value, false),
                    )
                  }
                  required
                />
              </label>
              <button className="button primary" disabled={busy}>
                {busy ? "登入中…" : "登入"}
              </button>
              <p>本階段串接帳號、入社與名冊；其他功能仍在展示模式。</p>
            </form>
          )}
        </section>
      )}
      {me && (
        <>
          <nav className="live-tabs" aria-label="會員服務">
            {[
              ["join", "我的入社申請"],
              ["members", "會員名冊"],
              ...(scopes.length ? [["review", "社團入社審核"]] : []),
            ].map(([key, label]) => (
              <button
                key={key}
                aria-current={tab === key ? "page" : undefined}
                onClick={() => {
                  setTab(key);
                  setDetail(null);
                  setPage(1);
                }}
              >
                {label}
              </button>
            ))}
            <button
              disabled={busy}
              onClick={() =>
                void act(async () => {
                  await api.logout();
                  setMe(null);
                  setJoins([]);
                  setMembers([]);
                  setDetail(null);
                  setReviewClub("");
                  setPage(1);
                  setTab("join");
                  goToPortal("login");
                })
              }
            >
              登出
            </button>
          </nav>
          {tab === "join" && (
            <section className="live-card">
              <h2>申請加入社團</h2>
              <p>審核完成前，註冊資料不會出現在會員查詢中。</p>
              <form
                onSubmit={submit(async (f, el) => {
                  await api.mutate("/join-applications", {
                    clubId: f.get("clubId"),
                    message: f.get("message"),
                  });
                  el.reset();
                  setNotice("入社申請已送出，等待社團管理者審核。");
                  await refresh();
                })}
              >
                <label>
                  選擇社團
                  <select name="clubId" required defaultValue="">
                    <option value="" disabled>
                      請選擇社團
                    </option>
                    {clubs
                      .filter((c) =>
                        ["ROTARACT", "ROTARY"].includes(c.clubTypeCode),
                      )
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}（{c.clubTypeCode}）
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  申請說明
                  <textarea name="message" maxLength={2000} rows={3} />
                </label>
                <button
                  className="button primary"
                  disabled={busy || loading || !clubs.length}
                >
                  送出入社申請
                </button>
              </form>
            </section>
          )}
          {tab === "review" && (
            <section className="live-card">
              <h2>社團入社審核</h2>
              <label>
                管理社團
                <select
                  value={reviewClub || scopes[0]}
                  onChange={(e) => {
                    setReviewClub(e.target.value);
                    setPage(1);
                  }}
                >
                  {scopes.map((id) => (
                    <option key={id} value={id}>
                      {clubs.find((c) => c.id === id)?.name || id}
                    </option>
                  ))}
                </select>
              </label>
              <p>僅能審核目前獲授權社團的申請，日期不得晚於台北時間今日。</p>
            </section>
          )}
          <section className="live-card">
            <h2>
              {tab === "members"
                ? "會員名冊"
                : tab === "review"
                  ? "審核列表"
                  : "申請進度"}
            </h2>
            {tab === "members" && (
              <>
                <form
                  className="live-search"
                  onSubmit={(e) => {
                    e.preventDefault();
                    setPage(1);
                    setSearch(keyword.trim());
                  }}
                >
                  <label>
                    搜尋姓名或 call name
                    <input
                      value={keyword}
                      onChange={(e) => setKeyword(e.target.value)}
                      maxLength={100}
                    />
                  </label>
                  <button className="button primary" disabled={busy || loading}>
                    搜尋
                  </button>
                </form>
                <p>
                  僅顯示已核准且符合資格的會員；列表不提供私人電話及 Email。
                </p>
              </>
            )}
            {!loading && total === 0 && <p>目前沒有符合條件的資料。</p>}
            {!loading &&
              (tab === "members"
                ? members.map((m) => (
                    <article className="live-row" key={m.id}>
                      <div>
                        <h3>
                          {m.callName} <small>{m.name}</small>
                        </h3>
                        <p>{m.clubs.map((c) => c.name).join("、")}</p>
                      </div>
                      <button
                        disabled={busy}
                        onClick={() =>
                          void act(async () =>
                            setDetail(await api.request(`/members/${m.id}`)),
                          )
                        }
                      >
                        查看詳情
                      </button>
                      <span>
                        {m.annualStatus === "confirmed"
                          ? "本年度已確認"
                          : m.annualStatus === "grace"
                            ? "年度確認寬限"
                            : "待確認"}
                      </span>
                    </article>
                  ))
                : joins.map((j) => (
                    <article className="live-row" key={j.id}>
                      <div>
                        <h3>
                          {j.applicant.callName} ·{" "}
                          {clubs.find((c) => c.id === j.clubId)?.name ||
                            j.clubId}
                        </h3>
                        <p>
                          {j.applicant.name} ·{" "}
                          {(
                            {
                              pending: "待審核",
                              approved: "已核准",
                              rejected: "未通過",
                              withdrawn: "已撤回",
                              expired: "已到期",
                              terminated: "已終止",
                            } as Record<string, string>
                          )[j.status] || j.status}
                        </p>
                        <small>
                          到期{" "}
                          {new Date(j.expiresAt).toLocaleDateString("zh-TW")}
                        </small>
                      </div>
                      {tab === "review" && j.status === "pending" && (
                        <form
                          onSubmit={submit(async (f) => {
                            await api.mutate(
                              `/join-applications/${j.id}/approve`,
                              {
                                version: j.version,
                                startsOn: f.get("startsOn"),
                              },
                            );
                            setNotice("已核准入社，會員名冊已更新。");
                            await refresh();
                          })}
                        >
                          <label>
                            實際入社日期
                            <input
                              name="startsOn"
                              type="date"
                              defaultValue={taipeiToday()}
                              max={taipeiToday()}
                              required
                            />
                          </label>
                          <button className="button primary" disabled={busy}>
                            核准入社
                          </button>
                        </form>
                      )}
                    </article>
                  )))}
            {detail && tab === "members" && (
              <section className="live-card" aria-label="會員詳情">
                <h3>
                  {detail.callName} · {detail.name}
                </h3>
                <p>Email：{detail.email || "未公開"}</p>
                <p>電話：{detail.phone || "未公開"}</p>
                <button onClick={() => setDetail(null)}>關閉詳情</button>
              </section>
            )}
            <nav className="live-pagination" aria-label="列表分頁">
              <button
                disabled={busy || loading || page <= 1}
                onClick={() => setPage((v) => v - 1)}
              >
                上一頁
              </button>
              <span>
                第 {page} 頁 · 共 {total} 筆
              </span>
              <button
                disabled={busy || loading || page * 20 >= total}
                onClick={() => setPage((v) => v + 1)}
              >
                下一頁
              </button>
            </nav>
          </section>
        </>
      )}
      <footer>
        本地串接模式使用真實 Session 與資料庫。公開地圖與行事曆仍為展示資料。
      </footer>
    </main>
  );
}
