import { useEffect, useState, useRef } from "react";
import type { Actor, State } from "../domain";
import { clubName, actorClub, clubs } from "../domain";
import {
  caseLabel,
  consentLabel,
  decideConsent,
  reviewCase,
  requestBlocked,
  invalidateRequests,
  supportFollowup,
} from "./historySupportModel";
import type { Consent, SupportCase } from "./historySupportModel";
export function useCaseDemo() {
  const [requests, setRequests] = useState<Consent[]>([]);
  const [cases, setCases] = useState<SupportCase[]>([]);
  return {
    requests,
    setRequests,
    cases,
    setCases,
    reset: () => {
      setRequests([]);
      setCases([]);
    },
  };
}
type Demo = ReturnType<typeof useCaseDemo>;
type Props = {
  catalog?: readonly {id:string;name:string;district:string}[];
  district?: string;
  state: State;
  actor: Actor;
  onChangeState: (state: State) => void;
  onAudit: (text: string) => void;
  demo: Demo;
};
const historyVersion = (h: State["history"][number]) =>
  JSON.stringify([
    h.memberId,
    h.clubId,
    h.startsOn,
    h.endsOn,
    h.nameSnapshot,
    h.callNameSnapshot,
    h.version ?? 0,
  ]);
export function HistoryView({
  state,
  actor,
  onChangeState,
  onAudit,
  demo,
  catalog = clubs, district = "D3481",
}: Props) {
  const [notice, setNotice] = useState("");
  const [confirmRequest, setConfirmRequest] = useState<string | null>(null);
  const [moderate, setModerate] = useState(false);
  const [exception, setException] = useState(false);
  const [password, setPassword] = useState("");
  const [reason, setReason] = useState("");
  useEffect(() => {
    demo.setRequests((rs) => {
      const stale = rs.some(
        (r) =>
          r.status === "pending" &&
          (!state.history[r.index] ||
            historyVersion(state.history[r.index]) !== r.version),
      );
      return stale
        ? rs.map((r) =>
            r.status === "pending" &&
            (!state.history[r.index] ||
              historyVersion(state.history[r.index]) !== r.version)
              ? { ...r, status: "invalidated" }
              : r,
          )
        : rs;
    });
  }, [state.history, demo.setRequests]);
  const scope = (h: State["history"][number]) =>
    actor === "member"
      ? h.memberId === state.currentMemberId
      : actor === "district"
        ? catalog.find(c => c.id === h.clubId)?.district === district
        : actorClub(actor) === h.clubId;
  const audit = (h: State["history"][number], text: string) =>
    onAudit(`[會員:${h.memberId}][社團:${h.clubId}] ${text}`);
  const update = (index: number, visible: boolean) => {
    onChangeState({
      ...state,
      history: state.history.map((h, i) =>
        i === index ? { ...h, visible, version: (h.version ?? 0) + 1 } : h,
      ),
    });
    demo.setRequests((rs) => invalidateRequests(rs, index));
  };
  const attempt = (fn: () => void) => {
    try {
      fn();
    } catch (e) {
      setNotice((e as Error).message);
    }
  };
  if (actor === "visitor")
    return (
      <section className="panel detail-body">
        <h2>請登入查看歷史公開設定</h2>
      </section>
    );
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>歷史經歷與公開同意</h2>
          <p>公開須本人決定；管理者可隱藏，不能代替本人同意。</p>
        </div>
      </div>
      <div className="detail-body form">
        <p className="info-note">
          {actor === "district"
            ? `地區示範範圍：${district}，只顯示目前轄內社團。`
            : actor === "platform"
              ? "平台支援身分不自動取得歷史操作權；例外須另外確認。"
              : actor === "member"
                ? "僅顯示自己的歷史與待辦。"
                : "僅顯示本社歷史。"}{" "}
          同意請求有效七日，拒絕或逾期後七日內不可重提；內容或公開設定變更需重新同意。
        </p>
        {actor !== "member" && actor !== "platform" && <label className="check-row"><input type="checkbox" checked={moderate} onChange={e => setModerate(e.target.checked)} />示範已額外授予歷史協助權（history:moderate）</label>}
        {actor === "platform" && (
          <fieldset>
            <legend>特定管理者例外（示範）</legend>
            <label>
              <input
                type="checkbox"
                checked={exception}
                onChange={(e) => setException(e.target.checked)}
              />
              明確啟用已授權的歷史例外權限
            </label>
            <label>
              操作理由
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            <label>
              再次驗證密碼
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <small>示範密碼：DemoPass2026!；正式系統由後端驗證授權。</small>
          </fieldset>
        )}
        {!state.history.length && (
          <>
            <p>目前尚無已結束社籍。</p>
            {(actor === "member" || actor === "taipei") && (
              <button
                className="button secondary"
                onClick={() => {
                  onChangeState({
                    ...state,
                    history: [
                      {
                        memberId: "m1",
                        clubId: "taipei",
                        startsOn: "2022-07-01",
                        endsOn: "2024-07-01",
                        nameSnapshot: "林予安",
                        callNameSnapshot: "Cora",
                        visible: false,
                      },
                    ],
                  });
                  setNotice("已加入一筆合成歷史，預設隱藏。");
                }}
              >
                載入示範歷史
              </button>
            )}
          </>
        )}
        {state.history.map(
          (h, index) =>
            (scope(h) ||
              (actor === "platform" &&
                exception &&
                password === "DemoPass2026!" &&
                reason.trim())) && (
              <section
                className="panel detail-body"
                key={`${h.memberId}-${index}`}
              >
                <h3>
                  {h.callNameSnapshot} · {clubName(h.clubId)}
                </h3>
                <p>
                  {h.startsOn} — {h.endsOn} · {h.visible ? "已公開" : "隱藏"}
                </p>
                {actor === "member" ? (
                  <button
                    className="button secondary"
                    onClick={() => {
                      update(index, !h.visible);
                      audit(h, h.visible ? "本人隱藏歷史" : "本人公開歷史");
                      setNotice("歷史公開設定已更新。");
                    }}
                  >
                    {h.visible ? "隱藏歷史" : "本人確認公開"}
                  </button>
                ) : (
                  <div className="actions">
                    <button
                      className="button secondary"
                      disabled={!h.visible || (actor !== "platform" && !moderate)}
                      onClick={() => {
                        update(index, false);
                        audit(h, "管理者隱藏歷史");
                        setNotice("已隱藏，重新公開仍需本人同意。");
                      }}
                    >
                      隱藏
                    </button>
                    <button
                      className="button primary"
                      disabled={
                        h.visible || (actor !== "platform" && !moderate) || requestBlocked(demo.requests, index)
                      }
                      onClick={() => {
                        demo.setRequests((rs) => [
                          ...rs,
                          {
                            id: crypto.randomUUID(),
                            index,
                            memberId: h.memberId,
                            requestedBy: actor === "district" ? `${district}地區管理者` : (catalog.find(c => c.id === actorClub(actor))?.name ?? "獲授權平台管理者"),
                            version: historyVersion(h),
                            expires: Date.now() + 7 * 86400000,
                            status: "pending",
                          },
                        ]);
                        audit(h, "提出歷史公開同意請求");
                        setNotice("已新增本人待辦，尚未公開。");
                      }}
                    >
                      請求本人同意公開
                    </button>
                    {actor === "platform" && (
                      <button
                        className="button secondary"
                        onClick={() => {
                          update(index, true);
                          audit(h, `特定管理者例外公開：${reason}`);
                          setNotice("已記錄驗證及例外理由。");
                        }}
                      >
                        依例外權限公開
                      </button>
                    )}
                  </div>
                )}
                {demo.requests
                  .filter((r) => r.index === index)
                  .map((r) => (
                    <div key={r.id}>
                      <p>
                        {r.expires <= Date.now() && r.status === "pending"
                          ? "已逾期"
                          : consentLabel[r.status]}{" "}
                        · 到期 {new Date(r.expires).toLocaleDateString("zh-TW")}
                      </p>
                      {r.status === "pending" && (
                        <button
                          className="text-button"
                          onClick={() => {
                            demo.setRequests((rs) =>
                              rs.map((x) =>
                                x.id === r.id
                                  ? {
                                      ...x,
                                      status: "expired",
                                      expires: Date.now(),
                                      decidedAt: Date.now(),
                                    }
                                  : x,
                              ),
                            );
                            setNotice("已模擬逾期，七日後可再次提出。");
                          }}
                        >
                          模擬請求逾期
                        </button>
                      )}
                      {actor === "member" && r.status === "pending" && (
                        <div className="actions">
                          {[true, false].map((approve) => (
                            <button
                              key={String(approve)}
                              className="button secondary"
                              onClick={() =>
                                approve ? setConfirmRequest(r.id) : attempt(() => {
                                  const result = decideConsent(
                                    r,
                                    approve,
                                    historyVersion(h),
                                  );
                                  if (approve) update(index, true);
                                  demo.setRequests((rs) =>
                                    rs.map((x) => (x.id === r.id ? result : x)),
                                  );
                                  audit(
                                    h,
                                    approve
                                      ? "本人同意歷史公開請求"
                                      : "本人拒絕歷史公開請求",
                                  );
                                  setNotice(
                                    approve
                                      ? "已同意並公開。"
                                      : "已拒絕，維持原公開設定。",
                                  );
                                })
                              }
                            >
                              {approve ? "同意公開此版本" : "拒絕"}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
              </section>
            ),
        )}
        {confirmRequest && actor === "member" && (() => {
          const request = demo.requests.find(r => r.id === confirmRequest);
          const history = request && state.history[request.index];
          return request && history ? <ConsentPrompt history={history} requestedBy={request.requestedBy ?? "社團授權管理者"} onClose={() => setConfirmRequest(null)} onAccept={() => {
            if (request.memberId !== state.currentMemberId) throw new Error("只有本人可以同意。");
            const result = decideConsent(request, true, historyVersion(history));
            update(request.index, true);
            demo.setRequests(rs => rs.map(r => r.id === request.id ? result : r));
            audit(history, "本人彈窗同意指定版本歷史公開");
            setNotice("已同意公開指定版本，其他經歷不受影響。");
            setConfirmRequest(null);
          }} /> : null;
        })()}
        {notice && <p role="status">{notice}</p>}
      </div>
    </section>
  );
}
export function SupportView({ state, actor, onAudit, demo }: Props) {
  const [notice, setNotice] = useState("");
  if (actor !== "member" && actor !== "platform")
    return (
      <section className="panel detail-body">
        <h2>帳號支援</h2>
        <p>
          請切換會員本人提交，或平台支援管理者處理。社團管理者無法查閱核身案件。
        </p>
        <p>無法登入時，可透過登入頁的人工協助入口取得收據。</p>
      </section>
    );
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>帳號復原與舊會員資料認領</h2>
          <p>僅使用合成說明；請勿上傳真實證件，不會寄送真實郵件。</p>
        </div>
      </div>
      <div className="detail-body form">
        {actor === "member" && (
          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              demo.setCases((cs) => [
                ...cs,
                {
                  id: `CASE-${Date.now()}`,
                  memberId: state.currentMemberId,
                  kind: form.get("kind") as SupportCase["kind"],
                  message: String(form.get("message")),
                  status: "pending",
                  reply: "",
                },
              ]);
              e.currentTarget.reset();
              setNotice("已建立示範案件，請保留案件收據。");
            }}
          >
            <label>
              申請類型
              <select name="kind">
                <option value="recovery">帳號人工復原</option>
                <option value="claim">認領舊會員資料</option>
              </select>
            </label>
            <label>
              說明（僅填合成資訊）
              <textarea name="message" required maxLength={1000} />
            </label>
            <button className="button primary">提交人工核身申請</button>
          </form>
        )}
        {demo.cases
          .filter(
            (c) => actor === "platform" || c.memberId === state.currentMemberId,
          )
          .map((c) => (
            <section className="panel detail-body" key={c.id}>
              <h3>
                {c.kind === "claim" ? "舊會員資料認領" : "帳號人工復原"} ·{" "}
                {caseLabel[c.status]}
              </h3>
              <small>收據：{c.id}</small>
              <p>{c.message}</p>
              {c.reply && <p>平台回覆：{c.reply}</p>}
              {c.status === "approved" && actor === "member" && (
                <SupportFollowup item={c} demo={demo} />
              )}
              {c.status === "approved" && (
                <p className="info-note">
                  已完成示範核身；未實際修改帳號或合併資料。資料認領須另確認關聯，避免自動合併。
                </p>
              )}
              {actor === "platform" &&
                ["pending", "supplement"].includes(c.status) && (
                  <form
                    className="form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      try {
                        const result = reviewCase(
                          c,
                          f.get("decision") as SupportCase["status"],
                          String(f.get("reply")),
                        );
                        demo.setCases((cs) =>
                          cs.map((x) => (x.id === c.id ? result : x)),
                        );
                        onAudit(
                          `[會員:${c.memberId}] 平台人工核身案件：${caseLabel[result.status]}`,
                        );
                        setNotice("案件狀態已更新。");
                      } catch (err) {
                        setNotice((err as Error).message);
                      }
                    }}
                  >
                    <label>
                      處理結果
                      <select name="decision">
                        <option value="supplement">要求補件</option>
                        <option value="approved">已完成核身，核准</option>
                        <option value="rejected">退回</option>
                      </select>
                    </label>
                    <label>
                      核身結果／原因
                      <textarea name="reply" required maxLength={1000} />
                    </label>
                    <button className="button primary">確認處理結果</button>
                  </form>
                )}
              {actor === "member" && c.status === "supplement" && (
                <form
                  className="form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    demo.setCases((cs) =>
                      cs.map((x) =>
                        x.id === c.id
                          ? {
                              ...x,
                              status: "pending",
                              message: `${x.message}\n補充：${String(f.get("reply"))}`,
                            }
                          : x,
                      ),
                    );
                    setNotice("已送出合成補件。");
                  }}
                >
                  <label>
                    補充說明
                    <textarea name="reply" required maxLength={1000} />
                  </label>
                  <button className="button secondary">送出補件</button>
                </form>
              )}
            </section>
          ))}
        {!demo.cases.some(
          (c) => actor === "platform" || c.memberId === state.currentMemberId,
        ) && <p>尚無支援案件。</p>}
        {notice && <p role="status">{notice}</p>}
      </div>
    </section>
  );
}
const labels: Record<string, string> = {
  register: "建立帳號",
  apply: "提出入社申請",
  review: "審核入社申請",
  withdrawApplication: "撤回入社申請",
  confirmYear: "年度社員確認",
  privacy: "更新隱私設定",
  profile: "更新個人資料",
  transfer: "提出轉社申請",
  approveTransfer: "社團核准轉社",
  executeTransfer: "本人確認轉社",
  withdrawTransfer: "撤回轉社",
  rejectTransfer: "拒絕轉社",
  historyVisibility: "調整歷史公開設定",
  requestEnd: "提出退社或 OB 申請",
  reviewEnd: "審核社籍結束申請",
  withdrawEnd: "撤回社籍結束申請",
  annualBoundary: "執行年度狀態更新",
};
export function AuditView({
  entries,
  actor,
}: {
  entries: string[];
  actor: Actor;
  state: State;
}) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>異動紀錄</h2>
          <p>依目前身分範圍顯示；不記錄密碼或證件內容。</p>
        </div>
      </div>
      <div className="detail-body">
        {actor === "visitor" ? (
          <p>請登入查看。</p>
        ) : entries.length ? (
          <ol>
            {entries.map((entry, i) => (
              <li key={i}>
                {entry
                  .replace(/\[(?:會員|社團|member|club|metadata):[^\]]*\]/g, "")
                  .split(" · ")
                  .map((part) => labels[part] ?? part)
                  .join(" · ")}
              </li>
            ))}
          </ol>
        ) : (
          <p>目前範圍尚無異動紀錄，完成操作後將顯示於此。</p>
        )}
      </div>
    </section>
  );
}
function SupportFollowup({ item, demo }: { item: SupportCase; demo: Demo }) {
  const [email, setEmail] = useState("");
  const next = (action: NonNullable<SupportCase["followup"]>) =>
    demo.setCases((cs) =>
      cs.map((c) => (c.id === item.id ? supportFollowup(c, action) : c)),
    );
  return (
    <div className="form">
      <h4>核身後續步驟（模擬）</h4>
      {item.kind === "claim" ? (
        <>
          <p>
            請確認舊會員關聯資料為本人所有；此操作只記錄確認，不會合併未知資料。
          </p>
          <button
            className="button secondary"
            disabled={item.followup === "associationConfirmed"}
            onClick={() => next("associationConfirmed")}
          >
            {item.followup === "associationConfirmed"
              ? "已確認關聯，待正式資料處理"
              : "本人確認關聯資料"}
          </button>
        </>
      ) : (
        <>
          {!item.followup && (
            <form
              className="form"
              onSubmit={(e) => {
                e.preventDefault();
                next("emailConfirmed");
              }}
            >
              <label>
                新聯絡 Email（合成資料）
                <input
                  type="email"
                  required
                  pattern="[^@]+@example\.test"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <button className="button secondary">
                開啟模擬連結並確認新信箱
              </button>
            </form>
          )}
          {item.followup === "emailConfirmed" && (
            <button
              className="button secondary"
              onClick={() => next("resetReady")}
            >
              開啟模擬密碼重設連結
            </button>
          )}
          {item.followup === "resetReady" && (
            <p role="status">
              模擬重設流程已就緒。正式服務將提供一次性限時重設頁；本示範未修改任何帳號或密碼。
            </p>
          )}
        </>
      )}
    </div>
  );
}
export function PublicSupportView({ demo }: { demo: Demo }) {
  const [receipt, setReceipt] = useState("");
  const [lookup, setLookup] = useState("");
  const [searched, setSearched] = useState(false);
  const item = demo.cases.find(
    (c) => c.id === receipt && c.memberId === "anonymous",
  );
  return (
    <section className="panel detail-body">
      <h2>無法登入？申請人工協助</h2>
      <p>
        僅示範受理與案件收據；不收真實證件，不寄真實郵件。登入識別是否存在，不會在此揭露。收據查詢僅供假資料體驗，正式服務須另驗證私密憑證。
      </p>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          setReceipt(lookup.trim());
          setSearched(true);
        }}
      >
        <label>
          查詢自己的案件收據
          <input
            value={lookup}
            onChange={(e) => setLookup(e.target.value)}
            required
          />
        </label>
        <button className="button secondary">查詢案件</button>
      </form>
      {searched && !item && <p role="status">查無此示範收據，或資料已重設。</p>}
      {item ? (
        <>
          <p role="status">
            收據：{item.id} · {caseLabel[item.status]}
          </p>
          <p>{item.reply || "平台尚未回覆。"}</p>
          {item.status === "supplement" && (
            <form
              className="form"
              onSubmit={(e) => {
                e.preventDefault();
                const data = new FormData(e.currentTarget);
                demo.setCases((cs) =>
                  cs.map((c) =>
                    c.id === item.id
                      ? {
                          ...c,
                          status: "pending",
                          message: `${c.message}\n補充：${String(data.get("reply"))}`,
                        }
                      : c,
                  ),
                );
              }}
            >
              <label>
                補充合成說明
                <textarea name="reply" required maxLength={1000} />
              </label>
              <button className="button secondary">提交補件</button>
            </form>
          )}
          {item.status === "approved" && (
            <SupportFollowup item={item} demo={demo} />
          )}
          <button
            className="text-button"
            onClick={() => {
              setReceipt("");
              setSearched(false);
            }}
          >
            另提新申請
          </button>
        </>
      ) : (
        <form
          className="form"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const id = `CASE-${crypto.randomUUID()}`;
            demo.setCases((cs) => [
              ...cs,
              {
                id,
                memberId: "anonymous",
                kind: "recovery",
                message: `合成聯絡管道：${String(f.get("contact"))}；${String(f.get("message"))}`,
                status: "pending",
                reply: "",
              },
            ]);
            setReceipt(id);
            setLookup(id);
            setSearched(false);
          }}
        >
          <label>
            可收信的聯絡 Email（請用 example.test）
            <input
              name="contact"
              type="email"
              required
              pattern="[^@]+@example\.test"
            />
          </label>
          <label>
            合成案件說明
            <textarea name="message" required maxLength={1000} />
          </label>
          <button className="button primary">取得案件收據</button>
        </form>
      )}
    </section>
  );
}

function ConsentPrompt({history,requestedBy,onClose,onAccept}:{history:State['history'][number];requestedBy:string;onClose:()=>void;onAccept:()=>void}) {
  const dialog=useRef<HTMLDialogElement>(null);
  const [error,setError]=useState('');
  useEffect(()=>{dialog.current?.showModal()},[]);
  return <dialog ref={dialog} className="modal" onCancel={onClose} aria-labelledby="consent-title"><header><div><span className="eyebrow">YOUR PRIVACY, YOUR CHOICE</span><h2 id="consent-title">同意公開這筆歷史？</h2></div><button className="icon-button" onClick={onClose} aria-label="關閉同意視窗">×</button></header><div className="form"><p>請求者：{requestedBy}。只有以下這一筆指定版本經歷會變更。</p><div className="info-note">{history.callNameSnapshot} · {clubName(history.clubId)}<br/>{history.startsOn} — {history.endsOn}</div><p className="field-hint">公開欄位：社團、類型、起迄期間與狀態。依歷史公開投影呈現，不包含電話、Email、內部原因或核身證據。</p>{error&&<p role="alert" className="notice error">{error}</p>}<div className="actions"><button className="button secondary" onClick={onClose}>稍後再說</button><button className="button primary" onClick={()=>{try{onAccept()}catch(e){setError((e as Error).message)}}}>我同意公開這個版本</button></div></div></dialog>
}
