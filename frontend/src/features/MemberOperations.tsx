import { useState } from "react";
import type { FormEvent } from "react";
import {
  CalendarDays,
  Check,
  ClipboardCheck,
  Clock3,
  FileClock,
  GraduationCap,
  ShieldCheck,
} from "lucide-react";
import { clubName, isManager, statusLabel, actorClub } from "../domain";
import type { Actor, Command, State } from "../domain";
export type MemberOperationsProps = {
  state: State;
  actor: Actor;
  run: (command: Command, message: string) => boolean;
};
const today = "2026-10-15";
export function MembershipView({ state, actor, run }: MemberOperationsProps) {
  const self = state.members.find((m) => m.id === state.currentMemberId)!;
  const manager = isManager(actor);
  const members = state.members.filter((m) =>
    manager
      ? m.clubId === actorClub(actor) &&
        ["confirmed", "unconfirmed"].includes(m.status)
      : m.id === self.id && ["confirmed", "unconfirmed"].includes(m.status),
  );
  const requests = state.endRequests.filter((r) =>
    manager ? r.clubId === actorClub(actor) : r.memberId === self.id,
  );
  const [memberId, setMemberId] = useState(members[0]?.id ?? "");
  const selectedMemberId = members.some((m) => m.id === memberId)
    ? memberId
    : (members[0]?.id ?? "");
  const [kind, setKind] = useState<"resigned" | "ob">("ob");
  const direct = manager;
  const [reason, setReason] = useState("");
  const [date, setDate] = useState(today);
  const [consent, setConsent] = useState(false);
  const [rejections, setRejections] = useState<Record<string, string>>({});
  if (!manager && actor !== "member")
    return (
      <section className="panel detail-body">
        <h2>此功能由會員本人與所屬社團辦理</h2>
        <p className="muted">請切換會員本人、社長或秘書體驗。</p>
      </section>
    );
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!consent) return;
    if (
      run(
        {
          type: "requestEnd",
          id: crypto.randomUUID(),
          memberId: manager ? selectedMemberId : self.id,
          reason: kind,
          explanation: reason,
          endsOn: date,
          direct: manager && direct,
        },
        manager && direct
          ? "社籍已結束，歷史已保留。"
          : "申請已送出，社籍保留至管理者確認。",
      )
    ) {
      setReason("");
      setConsent(false);
    }
  };
  return (
    <div className="section-stack">
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>
              <GraduationCap size={20} />
              退社與 OB
            </h2>
            <p>結束一段社籍，也好好保留曾經一起走過的路。</p>
          </div>
        </div>
        <div className="detail-body">
          <div className="info-note">
            <ShieldCheck size={18} />
            申請階段保留原社籍。核准後退出正常名冊與免費曝光，歷史預設隱藏；付費廣告期限另行判斷。
          </div>
          <form className="form" onSubmit={submit}>
            {members.length ? (
              <>
                <div className="two-fields">
                  {manager && (
                    <label>
                      辦理社員
                      <select
                        value={selectedMemberId}
                        onChange={(e) => setMemberId(e.target.value)}
                        required
                      >
                        {members.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.callName} · {m.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <label>
                    異動類型
                    <select
                      value={kind}
                      onChange={(e) =>
                        setKind(e.target.value as "ob" | "resigned")
                      }
                    >
                      <option value="ob">OB（扶青社畢業）</option>
                      <option value="resigned">退社</option>
                    </select>
                  </label>
                  <label>
                    社籍結束日
                    <input
                      type="date"
                      value={date}
                      max={today}
                      required
                      onChange={(e) => setDate(e.target.value)}
                    />
                  </label>
                </div>
                <label>
                  辦理原因
                  <textarea
                    rows={3}
                    required
                    maxLength={1000}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="說明辦理原因，將保留於受控異動紀錄。"
                  />
                </label>
                {manager && (
                  <label className="check-row">
                    <input type="checkbox" checked={direct} disabled />
                    由管理者直接辦理，不建立待審申請
                  </label>
                )}
                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    required
                  />
                  我已確認資料及影響；完成後以更正流程處理，不直接刪除歷史。
                </label>
                <button
                  className="button primary"
                  type="submit"
                  disabled={!consent}
                >
                  <Check size={16} />
                  {direct && manager ? "確認直接辦理" : "送出社籍結束申請"}
                </button>
              </>
            ) : (
              <div className="empty">
                <h3>目前沒有可辦理的有效社籍</h3>
                <p>已結束社籍可於歷史經歷查閱。</p>
              </div>
            )}
          </form>
        </div>
      </section>
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>
              <FileClock size={19} />
              {manager ? "社籍異動待辦" : "我的辦理紀錄"}
            </h2>
            <p>審核、撤回與歷史結果放在同一處。</p>
          </div>
        </div>
        <div className="request-list">
          {requests.length ? (
            requests.map((r) => {
              const m = state.members.find((m) => m.id === r.memberId)!;
              return (
                <article className="request-card" key={r.id}>
                  <div className="request-person">
                    <div>
                      <h3>
                        {m.callName} · {r.reason === "ob" ? "OB" : "退社"}
                      </h3>
                      <p>
                        {clubName(r.clubId)} · 結束日 {r.endsOn}
                      </p>
                    </div>
                    <span
                      className={`badge ${r.status === "approved" ? "confirmed" : "unconfirmed"}`}
                    >
                      {
                        {
                          pending: "待確認",
                          approved: "已辦理",
                          rejected: "已拒絕",
                          withdrawn: "已撤回",
                        }[r.status]
                      }
                    </span>
                  </div>
                  <blockquote>{r.explanation}</blockquote>
                  {r.decisionReason && (
                    <p className="rejection-reason">回覆：{r.decisionReason}</p>
                  )}
                  {r.status === "pending" && (
                    <div className="transfer-actions">
                      {manager ? (
                        <>
                          <button
                            className="button primary"
                            onClick={() =>
                              run(
                                {
                                  type: "reviewEnd",
                                  id: r.id,
                                  approve: true,
                                  reason: "",
                                },
                                "已核准，原社籍結束並保留歷史。",
                              )
                            }
                          >
                            核准辦理
                          </button>
                          <input
                            aria-label={`${m.callName} 異動拒絕原因`}
                            placeholder="拒絕時填原因"
                            value={rejections[r.id] ?? ""}
                            onChange={(e) =>
                              setRejections({
                                ...rejections,
                                [r.id]: e.target.value,
                              })
                            }
                          />
                          <button
                            className="button secondary"
                            onClick={() =>
                              run(
                                {
                                  type: "reviewEnd",
                                  id: r.id,
                                  approve: false,
                                  reason: rejections[r.id] ?? "",
                                },
                                "已拒絕，原社籍保留。",
                              )
                            }
                          >
                            拒絕
                          </button>
                        </>
                      ) : (
                        <button
                          className="button secondary"
                          onClick={() =>
                            run(
                              { type: "withdrawEnd", id: r.id },
                              "申請已撤回，原社籍保留。",
                            )
                          }
                        >
                          撤回申請
                        </button>
                      )}
                    </div>
                  )}
                </article>
              );
            })
          ) : (
            <div className="empty">
              <Clock3 size={28} />
              <h3>尚無社籍結束紀錄</h3>
              <p>送出申請或直接辦理後，會在這裡看到進度。</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
export function AnnualView({ state, actor, run }: MemberOperationsProps) {
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [showOnlyPending, setShowOnlyPending] = useState(false);
  const [preview, setPreview] = useState("current");
  const [applied, setApplied] = useState(false);
  if (!isManager(actor))
    return (
      <section className="panel detail-body">
        <h2>年度名冊由社團管理者確認</h2>
        <p className="muted">請切換台北星光社長或台中山海秘書。</p>
      </section>
    );
  const rows = state.members.filter(
    (m) =>
      m.clubId === actorClub(actor) &&
      m.status !== "unaffiliated" &&
      (!showOnlyPending || m.status === "unconfirmed") &&
      `${m.name} ${m.callName}`.toLowerCase().includes(query.toLowerCase()),
  );
  const validPicked = picked.filter((id) =>
    rows.some((m) => m.id === id && m.status === "unconfirmed"),
  );
  const pending = rows.filter((m) => m.status === "unconfirmed");
  return (
    <div className="section-stack">
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>
              <CalendarDays size={20} />
              {state.demoYear ?? 2026} — {(state.demoYear ?? 2026) + 1} 年度名冊
            </h2>
            <p>{clubName(actorClub(actor))} · 7/1 起新年度，7/31 寬限結束。</p>
          </div>
          <span className="badge unconfirmed">待確認 {pending.length} 位</span>
        </div>
        <div className="detail-body">
          <div className="stepper">
            <span>
              <b>7/1</b>職務交接／沿用名冊
            </span>
            <span>
              <b>7/31</b>未確認者暫保留曝光
            </span>
            <span>
              <b>8/1</b>未確認者隱藏免費曝光
            </span>
          </div>
          <div className="filters">
            <input
              aria-label="搜尋年度社員"
              placeholder="搜尋社員"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <label className="check-row">
              <input
                type="checkbox"
                checked={showOnlyPending}
                onChange={(e) => setShowOnlyPending(e.target.checked)}
              />
              僅看待確認
            </label>
            <button
              className="button secondary"
              disabled={!pending.length}
              onClick={() => setPicked(pending.map((m) => m.id))}
            >
              選取待確認社員
            </button>
            <button
              className="button primary"
              disabled={!validPicked.length}
              onClick={() => {
                validPicked.forEach((memberId) =>
                  run(
                    {
                      type: "confirmYear",
                      memberId,
                      year: state.demoYear ?? 2026,
                    },
                    "年度名冊已確認，恢復免費曝光資格。",
                  ),
                );
                setPicked([]);
              }}
            >
              <ClipboardCheck size={16} />
              確認選取（{validPicked.length}）
            </button>
          </div>
          <div className="record-list">
            {rows.map((m) => (
              <div className="record-row" key={m.id}>
                <input
                  type="checkbox"
                  aria-label={`選取 ${m.callName}`}
                  disabled={m.status !== "unconfirmed"}
                  checked={validPicked.includes(m.id)}
                  onChange={(e) =>
                    setPicked(
                      e.target.checked
                        ? [...picked, m.id]
                        : picked.filter((id) => id !== m.id),
                    )
                  }
                />
                <div className="record-main">
                  <strong>
                    {m.callName} <small>{m.name}</small>
                  </strong>
                  <small>入社日 {m.startsOn}</small>
                </div>
                <span className={`badge ${m.status}`}>
                  {statusLabel[m.status]}
                </span>
                <span className="muted record-note">
                  {m.status === "confirmed"
                    ? "免費資格有效"
                    : m.status === "unconfirmed"
                      ? "確認後恢復免費資格"
                      : "不提供免費資格"}
                </span>
                {m.status === "unconfirmed" && (
                  <button
                    className="button secondary"
                    onClick={() =>
                      run(
                        {
                          type: "confirmYear",
                          memberId: m.id,
                          year: state.demoYear ?? 2026,
                        },
                        "年度確認完成，恢復免費地圖曝光。",
                      )
                    }
                  >
                    確認續留
                  </button>
                )}
              </div>
            ))}
            {!rows.length && (
              <div className="empty">
                <h3>沒有符合條件的社員</h3>
              </div>
            )}
          </div>
        </div>
      </section>
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>年度邊界情境預覽</h2>
            <p>只模擬假資料狀態，不會啟動真實排程。</p>
          </div>
        </div>
        <div className="detail-body form">
          <label>
            情境
            <select
              aria-label="年度邊界情境"
              value={preview}
              onChange={(e) => {
                setPreview(e.target.value);
                setApplied(false);
              }}
            >
              <option value="current">目前資料（2026/10/15）</option>
              <option value="july">下年度 7 月：寬限保留</option>
              <option value="august">下年度 8/1：尚未確認</option>
            </select>
          </label>
          <p className="muted">
            {preview === "july"
              ? "未退社、未OB的原社員保留至7/31；已結束社籍不會復活。"
              : preview === "august"
                ? "未完成新年度確認的有效社籍改為待確認，隱藏免費曝光；有效付費廣告不受影響。"
                : "目前是本年度已過寬限期的合成資料。"}
          </p>
          {preview === "august" && (
            <button
              className="button secondary"
              disabled={applied}
              onClick={() => {
                if (
                  run(
                    { type: "annualBoundary", year: 2027 },
                    "已套用下年度8/1情境，可重新確認社員。",
                  )
                )
                  setApplied(true);
              }}
            >
              {applied ? "情境已套用" : "套用至本社假資料"}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
