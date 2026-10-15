import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api, ApiError, passwordValidation } from "./api";
import type { Me } from "./api";

type Props = {
  me: Me;
  onMe: (me: Me) => void;
  onDirty: (dirty: boolean) => void;
  onExpired: () => void;
  onBusy: (busy: boolean) => void;
};
export default function AccountSettings({
  me,
  onMe,
  onDirty,
  onExpired,
  onBusy,
}: Props) {
  const member = me.member;
  const [name, setName] = useState(member?.name || "");
  const [callName, setCallName] = useState(member?.callName || "");
  const [phoneVisible, setPhoneVisible] = useState(
    member?.phoneVisible || false,
  );
  const [emailVisible, setEmailVisible] = useState(
    member?.emailVisible || false,
  );
  const [kind, setKind] = useState<"email" | "phone">("email");
  const [newValue, setNewValue] = useState("");
  const [newCode, setNewCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [conflict, setConflict] = useState(false);
  useEffect(() => {
    onBusy(busy);
    return () => onBusy(false);
  }, [busy, onBusy]);
  const dirty =
    name !== member?.name ||
    callName !== member?.callName ||
    phoneVisible !== member?.phoneVisible ||
    emailVisible !== member?.emailVisible ||
    !!newValue ||
    !!newCode;
  useEffect(() => {
    onDirty(dirty || busy);
    return () => onDirty(false);
  }, [dirty, busy, onDirty]);
  async function submit(
    event: FormEvent<HTMLFormElement>,
    action: () => Promise<void>,
  ) {
    event.preventDefault();
    if (busy || conflict) return;
    const form = event.currentTarget;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (error) {
      if (error instanceof ApiError) {
        setError(
          `${error.message}${error.requestId ? `（查詢代碼：${error.requestId}）` : ""}`,
        );
        if (error.status === 409) setConflict(true);
        if (error.status === 401) {
          try {
            await api.me();
          } catch (check) {
            if (check instanceof ApiError && check.status === 401) onExpired();
          }
        }
      } else setError("連線結果未確認。請重新讀取確認資料後再操作。");
    } finally {
      const password = form.elements.namedItem("currentPassword");
      if (password instanceof HTMLInputElement) password.value = "";
      setBusy(false);
    }
  }
  async function reload() {
    if (dirty && !window.confirm("重新讀取將捨棄尚未儲存的修改，確定繼續？"))
      return;
    setBusy(true);
    setError("");
    try {
      const current = await api.me();
      onMe(current);
      setName(current.member?.name || "");
      setCallName(current.member?.callName || "");
      setPhoneVisible(current.member?.phoneVisible || false);
      setEmailVisible(current.member?.emailVisible || false);
      setNewValue("");
      setNewCode("");
      setConflict(false);
      setNotice("已讀取最新資料，請重新確認後儲存。");
    } catch (e) {
      setError(e instanceof Error ? e.message : "讀取失敗");
      if (e instanceof ApiError && e.status === 401) onExpired();
    } finally {
      setBusy(false);
    }
  }
  const password = (
    <label>
      目前密碼
      <input
        disabled={busy}
        name="currentPassword"
        type="password"
        autoComplete="current-password"
        required
        onChange={(e) =>
          e.currentTarget.setCustomValidity(
            passwordValidation(e.currentTarget.value, false),
          )
        }
      />
    </label>
  );
  const disabled = busy || conflict;
  return (
    <section aria-label="我的帳號" className="live-account" aria-busy={busy}>
      <div className="live-account-heading">
        <div>
          <h2>我的帳號</h2>
          <p>
            維護登入資料與會員隱私。每次變更電話或 Email，皆須重新輸入目前密碼。
          </p>
        </div>
        <button type="button" disabled={busy} onClick={() => void reload()}>
          重新讀取帳號
        </button>
      </div>
      {busy && <p role="status">正在處理帳號資料，完成後即可切換頁面。</p>}
      {error && (
        <div role="alert" className="live-alert">
          {error}
        </div>
      )}
      {conflict && (
        <p role="status">
          資料可能已變更，草稿仍保留。請先重新讀取，不會自動覆蓋現有資料。
        </p>
      )}
      {notice && (
        <p role="status" className="live-notice">
          {notice}
        </p>
      )}
      {member && (
        <div className="live-account-grid">
          <section className="live-card">
            <h3>基本資料</h3>
            <form
              onSubmit={(e) =>
                void submit(e, async () => {
                  const updated = await api.updateProfile({
                    version: member.version,
                    name,
                    callName,
                  });
                  onMe({ ...me, member: updated });
                  setName(updated.name);
                  setCallName(updated.callName);
                  setNotice("基本資料已儲存。");
                })
              }
            >
              <label>
                姓名
                <input
                  disabled={busy}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  maxLength={100}
                  autoComplete="name"
                />
              </label>
              <label>
                扶輪 call name
                <input
                  disabled={busy}
                  value={callName}
                  onChange={(e) => setCallName(e.target.value)}
                  required
                  maxLength={100}
                />
              </label>
              <p>姓名本階段可自行修改。頭像上傳待資產服務完成後開放。</p>
              <button className="primary" disabled={disabled}>
                儲存基本資料
              </button>
            </form>
          </section>
          <section className="live-card">
            <h3>聯絡資料隱私</h3>
            <form
              onSubmit={(e) =>
                void submit(e, async () => {
                  const updated = await api.updatePrivacy({
                    version: member.version,
                    phoneVisible,
                    emailVisible,
                  });
                  onMe({ ...me, member: updated });
                  setPhoneVisible(updated.phoneVisible);
                  setEmailVisible(updated.emailVisible);
                  setNotice("隱私設定已儲存。");
                })
              }
            >
              <label className="live-checkbox">
                <input
                  disabled={busy}
                  type="checkbox"
                  checked={phoneVisible}
                  onChange={(e) => setPhoneVisible(e.target.checked)}
                />
                在登入會員詳情顯示電話
              </label>
              <label className="live-checkbox">
                <input
                  disabled={busy}
                  type="checkbox"
                  checked={emailVisible}
                  onChange={(e) => setEmailVisible(e.target.checked)}
                />
                在登入會員詳情顯示 Email
              </label>
              <p>
                電話預設隱藏、Email
                預設開啟。這些選項不會將私人聯絡資料開放給未登入訪客。
              </p>
              <button className="primary" disabled={disabled}>
                儲存隱私設定
              </button>
            </form>
          </section>
        </div>
      )}
      <section className="live-card">
        <h3>變更登入電話或 Email</h3>
        <p>
          Email：{me.account.email}
          <br />
          電話：{me.account.phone || "尚未設定"}
        </p>
        <p>
          一次僅能變更一項。成功後舊值立即停止登入、其他裝置登出，目前裝置保留登入。後續可選擇加入電話／信箱驗證。
        </p>
        <form
          onSubmit={(e) => {
            const form = new FormData(e.currentTarget);
            void submit(e, async () => {
              const current = await api.changeContact({
                version: me.account.version,
                kind,
                newValue,
                currentPassword: String(form.get("currentPassword")),
              });
              onMe(current);
              setNewValue("");
              setNotice("登入聯絡資料已變更，目前工作階段已更新。");
            });
          }}
        >
          <label>
            變更項目
            <select
              disabled={busy}
              value={kind}
              onChange={(e) => {
                setKind(e.target.value as "email" | "phone");
                setNewValue("");
              }}
            >
              <option value="email">Email</option>
              <option value="phone">電話</option>
            </select>
          </label>
          <label>
            {kind === "email" ? "新 Email" : "新電話（含國碼）"}
            <input
              disabled={busy}
              key={kind}
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              type={kind === "email" ? "email" : "tel"}
              autoComplete={kind === "email" ? "email" : "tel"}
              required
              maxLength={kind === "email" ? 254 : 16}
              pattern={kind === "phone" ? "\\+[1-9][0-9]{6,14}" : undefined}
              placeholder={kind === "phone" ? "+886912345678" : undefined}
            />
          </label>
          {password}
          <button className="primary" disabled={disabled}>
            確認變更聯絡資料
          </button>
        </form>
      </section>
      <section className="live-card">
        <h3>會員代號</h3>
        <p>
          目前代號：<strong>{me.account.accountCode}</strong>，剩餘變更次數：
          {me.remainingCodeChanges}
        </p>
        <p>
          只可修改一次，6–20
          個英文字母、數字或底線，不可全部為數字，不分大小寫。舊代號將永久保留，無法再登入或重新分配；內部帳號關聯不變。
        </p>
        {me.remainingCodeChanges > 0 ? (
          <form
            onSubmit={(e) => {
              const form = new FormData(e.currentTarget);
              void submit(e, async () => {
                if (
                  !window.confirm("會員代號只可修改一次，確定使用這個新代號？")
                )
                  return;
                const current = await api.changeCode({
                  version: me.account.version,
                  newCode,
                  currentPassword: String(form.get("currentPassword")),
                });
                onMe(current);
                setNewCode("");
                setNotice("會員代號已更新，請使用新代號登入。");
              });
            }}
          >
            <label>
              新會員代號
              <input
                disabled={busy}
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                required
                minLength={6}
                maxLength={20}
                pattern="[A-Za-z0-9_]{6,20}"
                autoComplete="off"
              />
            </label>
            {password}
            <button className="primary" disabled={disabled}>
              確認修改會員代號
            </button>
          </form>
        ) : (
          <p role="status">已完成唯一一次代號修改，無法再次變更。</p>
        )}
      </section>
    </section>
  );
}
