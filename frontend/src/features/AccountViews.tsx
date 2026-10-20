import { useEffect, useRef, useState } from "react";
import "./account-view.css";
import type { FormEvent } from "react";
import type { Member } from "../domain";
import {
  codePatch,
  consumeReset,
  contactPatch,
  demoLogin,
  DEMO_PASSWORD,
  profilePatch,
  resetUsable,
  type ResetTicket,
} from "./accountModel";

type Mode = "login" | "forgot" | "reset";
type AuthProps = {
  mode: Mode;
  members: Member[];
  onLogin: (id: string) => void;
  onRegister: () => void;
  onMode: (mode: Mode) => void;
};

export function AuthView({
  mode,
  members,
  onLogin,
  onRegister,
  onMode,
}: AuthProps) {
  const [identity, setIdentity] = useState("cora@example.test");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [ticket, setTicket] = useState<ResetTicket | null>(null);
  const [previousTicket, setPreviousTicket] = useState<ResetTicket | null>(
    null,
  );
  const [openedTicket, setOpenedTicket] = useState<ResetTicket | null>(null);
  const [clockOffset, setClockOffset] = useState(0);
  const [notice, setNotice] = useState("");
  const [isError, setIsError] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const now = () => Date.now() + clockOffset;

  const switchMode = (next: Mode) => {
    setPassword("");
    setConfirmation("");
    setShowPassword(false);
    setIsError(false);
    setNotice("");
    onMode(next);
  };
  const openLink = (selected: ResetTicket | null) => {
    setPassword("");
    setConfirmation("");
    if (!resetUsable(selected, ticket, now())) {
      setIsError(true);
      setNotice("此連結已失效：可能已重送、使用或超過 30 分鐘。請重新申請。");
      return;
    }
    setOpenedTicket(selected);
    switchMode("reset");
  };
  function submit(event: FormEvent) {
    event.preventDefault();
    setIsError(false);
    try {
      if (mode === "login") {
        const id = demoLogin(members, identity, password);
        if (!id) throw new Error("登入識別或示範密碼不正確。");
        setPassword("");
        onLogin(id);
      } else if (mode === "forgot") {
        const member = members.find(
          (m) => m.email.toLowerCase() === identity.trim().toLowerCase(),
        );
        setPreviousTicket(ticket);
        setTicket(
          member ? { memberId: member.id, issuedAt: now(), used: false } : null,
        );
        setNotice("若此 Email 已登錄，將產生模擬重設信件；沒有實際寄信。");
      } else {
        if (!resetUsable(openedTicket, ticket, now()))
          throw new Error("連結已失效，請重新申請。");
        setTicket(consumeReset(openedTicket, now(), password, confirmation));
        setOpenedTicket(null);
        switchMode("login");
        setNotice("模擬重設完成。新密碼未保存；請使用公開示範密碼登入。");
      }
    } catch (error) {
      setIsError(true);
      setNotice((error as Error).message);
    }
  }
  return (
    <section className="panel auth-view">
      <div className="feature-header">
        <h2>
          {mode === "login"
            ? "歡迎回來"
            : mode === "forgot"
              ? "找回帳號密碼"
              : "設定新的示範密碼"}
        </h2>
        <p>合成資料體驗，不會寄信或保存真實密碼。請勿輸入真實密碼。</p>
      </div>
      <div className="detail-body section-stack">
        <div className="auth-task-summary">
          <span className="auth-step">
            {mode === "login"
              ? "會員入口"
              : mode === "forgot"
                ? "步驟 1 / 2"
                : "步驟 2 / 2"}
          </span>
          <p>
            {mode === "login"
              ? "使用任一登入識別，繼續管理你的會員資料。"
              : mode === "forgot"
                ? "先輸入登錄信箱，再開啟下方模擬信件中的重設連結。"
                : "設定並確認新示範密碼，完成後返回登入。"}
          </p>
        </div>
        <p className="auth-demo-note">
          合成帳號共用示範密碼：<strong>{DEMO_PASSWORD}</strong>
        </p>
        {notice && (
          <p
            id="auth-feedback"
            role={isError ? "alert" : "status"}
            className={`notice auth-feedback ${isError ? "error" : "success"}`}
          >
            {notice}
          </p>
        )}
        <form className="form" onSubmit={submit}>
          {mode !== "reset" && (
            <label>
              {mode === "login" ? "Email、國碼電話或帳號代號" : "已登錄 Email"}
              <input
                required
                type={mode === "forgot" ? "email" : "text"}
                value={identity}
                onChange={(e) => setIdentity(e.target.value)}
                aria-describedby={`auth-identity-hint${isError ? " auth-feedback" : ""}`}
                aria-invalid={isError || undefined}
                autoComplete="username"
              />
            </label>
          )}
          {mode !== "reset" && (
            <p id="auth-identity-hint" className="field-hint">
              {mode === "login"
                ? "可輸入完整 Email、含國碼電話（如 +886912000101），或帳號代號（如 rot_cora27）。"
                : "使用原登錄信箱，例如 cora@example.test；此體驗不會實際寄送郵件。"}
            </p>
          )}
          {mode !== "forgot" && (
            <label>
              {mode === "login" ? "示範密碼" : "新示範密碼（12～128 字元）"}
              <input
                required
                type={showPassword ? "text" : "password"}
                aria-invalid={isError || undefined}
                aria-describedby={isError ? "auth-feedback" : undefined}
                maxLength={256}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
              />
            </label>
          )}
          {mode === "reset" && (
            <label>
              再次輸入新示範密碼
              <input
                required
                type={showPassword ? "text" : "password"}
                aria-invalid={isError || undefined}
                aria-describedby={isError ? "auth-feedback" : undefined}
                maxLength={256}
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                autoComplete="new-password"
              />
            </label>
          )}
          {mode !== "forgot" && (
            <button
              type="button"
              className="auth-password-toggle"
              aria-pressed={showPassword}
              aria-label={showPassword ? "隱藏密碼內容" : "顯示密碼內容"}
              onClick={() => setShowPassword((value) => !value)}
            >
              {showPassword ? "隱藏密碼" : "顯示密碼"}
            </button>
          )}
          {mode === "reset" && (
            <p className="field-hint">
              12～128
              字元，可使用空白及貼上；請避免常見弱密碼。新值不會保存，完成後仍使用公開示範密碼登入。
            </p>
          )}
          <button className="button primary">
            {mode === "login"
              ? "登入示範帳號"
              : mode === "forgot"
                ? "產生／重送模擬信件"
                : "完成模擬重設"}
          </button>
        </form>
        {mode === "forgot" && ticket && (
          <div className="notice">
            <strong>模擬信件預覽</strong>
            <p>
              收件人：{members.find((m) => m.id === ticket.memberId)?.email}
              。連結一次性、30 分鐘有效；重送後舊連結失效。
            </p>
            <div className="two-fields">
              <button
                className="button secondary"
                onClick={() => openLink(ticket)}
              >
                開啟這次重設連結
              </button>
              {previousTicket && (
                <button
                  className="button secondary"
                  onClick={() => openLink(previousTicket)}
                >
                  測試上一封失效連結
                </button>
              )}
            </div>
          </div>
        )}
        {(mode === "forgot" || mode === "reset") && ticket && (
          <button
            className="button secondary"
            onClick={() => {
              setIsError(false);
              setClockOffset((offset) => offset + 31 * 60_000);
              setNotice(
                "已將示範時間推進 31 分鐘；開啟連結或提交重設，可體驗過期處理。",
              );
            }}
          >
            模擬經過 31 分鐘
          </button>
        )}
        <div className="two-fields">
          {mode === "login" ? (
            <>
              <button
                className="button secondary"
                onClick={() => switchMode("forgot")}
              >
                忘記密碼
              </button>
              <button className="button secondary" onClick={onRegister}>
                建立會員帳號
              </button>
            </>
          ) : (
            <button
              className="button secondary"
              onClick={() => switchMode("login")}
            >
              返回登入
            </button>
          )}
          {mode === "reset" && (
            <button
              className="button secondary"
              onClick={() => switchMode("forgot")}
            >
              重新申請連結
            </button>
          )}
        </div>
        <p className="field-hint">
          無法使用原
          Email？正式系統將由平台管理者協助人工復原；此雛形不收取身分證明。
        </p>
      </div>
    </section>
  );
}

type AccountProps = {
  member: Member;
  members: Member[];
  onUpdate: (patch: Partial<Member>) => void;
  onAudit: (message: string) => void;
};

export function AccountView({
  member,
  members,
  onUpdate,
  onAudit,
}: AccountProps) {
  const tabs = ["基本資料", "登入聯絡資料", "帳號代號"];
  const [tab, setTab] = useState(0);
  const [noticeType, setNoticeType] = useState<"success" | "error">("success");
  const [avatarDraft, setAvatarDraft] = useState(member.avatarUrl ?? "");
  const [name, setName] = useState(member.name);
  const [callName, setCallName] = useState(member.callName);
  const [kind, setKind] = useState<"phone" | "email">("phone");
  const [contact, setContact] = useState("");
  const [password, setPassword] = useState("");
  const [codePassword, setCodePassword] = useState("");
  const [code, setCode] = useState("");
  const [notice, setNotice] = useState("");
  const [uploading, setUploading] = useState(false);
  const alive = useRef(true);
  const uploadVersion = useRef(0);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      uploadVersion.current += 1;
    };
  }, []);

  const basicDirty =
    name !== member.name ||
    callName !== member.callName ||
    avatarDraft !== (member.avatarUrl ?? "");
  const contactDirty = contact !== "" && contact !== member[kind];
  const codeDirty =
    code !== "" && code.toLowerCase() !== member.code.toLowerCase();
  const dirty = [basicDirty, contactDirty, codeDirty];
  const anyDirty = dirty.some(Boolean);
  const selectTab = (index: number) => {
    setTab(index);
    setPassword("");
    setCodePassword("");
    setNotice("");
  };
  const discard = () => {
    setName(member.name);
    setCallName(member.callName);
    setAvatarDraft(member.avatarUrl ?? "");
    setContact("");
    setCode("");
    setPassword("");
    setCodePassword("");
    uploadVersion.current += 1;
    setUploading(false);
    setNoticeType("success");
    setNotice("已放棄尚未儲存的變更，保留目前已儲存資料。");
  };
  const showError = (message: string) => {
    setNoticeType("error");
    setNotice(message);
  };
  const apply = (action: () => Partial<Member>, message: string) => {
    try {
      onUpdate(action());
      onAudit(message);
      setNoticeType("success");
      setNotice(message);
      setPassword("");
      setCodePassword("");
      return true;
    } catch (error) {
      showError((error as Error).message);
      return false;
    }
  };
  async function uploadAvatar(file: File) {
    const version = ++uploadVersion.current;
    if (
      !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
      file.size > 2 * 1024 * 1024
    ) {
      showError("請使用 2 MiB 內的 PNG、JPEG 或 WebP 圖片。");
      return;
    }
    setUploading(true);
    let image: ImageBitmap | undefined;
    try {
      image = await createImageBitmap(file);
      if (
        image.width > 4096 ||
        image.height > 4096 ||
        image.width < 1 ||
        image.height < 1
      ) {
        throw new Error("圖片尺寸須介於 1～4096 像素，請縮小後重試。");
      }
      const canvas = document.createElement("canvas");
      const scale = Math.min(1, 512 / Math.max(image.width, image.height));
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("無法處理圖片，請換一張圖片重試。");
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const avatarUrl = canvas.toDataURL("image/png");
      if (alive.current && uploadVersion.current === version) {
        setAvatarDraft(avatarUrl);
        setNoticeType("success");
        setNotice("頭像預覽已準備好，請按「儲存基本資料」套用。");
      }
    } catch (error) {
      if (alive.current && uploadVersion.current === version) {
        showError(
          error instanceof Error && error.message.startsWith("圖片尺寸")
            ? error.message
            : "圖片無法解碼或處理，請使用有效的 PNG、JPEG 或 WebP 圖片。",
        );
      }
    } finally {
      image?.close();
      if (alive.current && uploadVersion.current === version)
        setUploading(false);
    }
  }
  const codeLocked = (member.codeChanges ?? 0) >= 1;
  return (
    <section
      className="panel account-settings"
      data-unsaved={anyDirty ? "true" : "false"}
    >
      <div className="feature-header">
        <h2>我的帳號設定</h2>
        <p>電話、Email 與帳號代號，皆對應你的同一份會員資料。</p>
      </div>
      <div className="account-tabs" role="tablist" aria-label="帳號設定分類">
        {tabs.map((label, index) => (
          <button
            key={label}
            id={`account-tab-${index}`}
            type="button"
            role="tab"
            aria-selected={tab === index}
            aria-controls={`account-panel-${index}`}
            tabIndex={tab === index ? 0 : -1}
            className={tab === index ? "active" : ""}
            onClick={() => selectTab(index)}
            onKeyDown={(event) => {
              let next: number;
              if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
              else if (event.key === "ArrowLeft")
                next = (index + tabs.length - 1) % tabs.length;
              else if (event.key === "Home") next = 0;
              else if (event.key === "End") next = tabs.length - 1;
              else return;
              event.preventDefault();
              selectTab(next);
              document.getElementById(`account-tab-${next}`)?.focus();
            }}
          >
            {label}
            {dirty[index] && (
              <span className="account-dirty-dot" aria-label="有未儲存變更">
                {" "}
                ·
              </span>
            )}
          </button>
        ))}
      </div>
      <div className="detail-body section-stack">
        {anyDirty && (
          <div className="account-draft-bar" role="status">
            <span>有未儲存變更，切換分頁會保留草稿。</span>
            <button
              type="button"
              className="button secondary"
              onClick={discard}
            >
              放棄變更
            </button>
          </div>
        )}
        <div
          id="account-panel-0"
          role="tabpanel"
          aria-labelledby="account-tab-0"
          hidden={tab !== 0}
        >
          {notice && tab === 0 && (
            <p
              id="account-feedback-0"
              role={noticeType === "error" ? "alert" : "status"}
              className={`notice account-feedback ${noticeType}`}
            >
              {notice}
            </p>
          )}
          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault();
              if (
                apply(
                  () => ({
                    ...profilePatch(name, callName),
                    avatarUrl: avatarDraft || undefined,
                  }),
                  "已更新本人基本資料。",
                )
              ) {
                setName(name.trim());
                setCallName(callName.trim());
              }
            }}
          >
            <h3>基本資料</h3>
            <div className="two-fields">
              <label>
                姓名
                <input
                  required
                  maxLength={100}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label>
                Call name
                <input
                  required
                  maxLength={100}
                  value={callName}
                  onChange={(e) => setCallName(e.target.value)}
                />
              </label>
            </div>
            <p className="field-hint">
              本階段姓名可自行修改；後續金流身分驗證另行擴充。
            </p>
            <button
              className="button primary"
              disabled={!basicDirty || uploading}
            >
              儲存基本資料
            </button>
          </form>
          <div className="form account-avatar-block">
            <h3>會員頭像</h3>
            {avatarDraft && (
              <img
                src={avatarDraft}
                alt="本人頭像預覽"
                width="88"
                height="88"
              />
            )}
            <label>
              上傳頭像（PNG／JPEG／WebP，最多 2 MiB、4096 × 4096 像素）
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                disabled={uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void uploadAvatar(file);
                  e.target.value = "";
                }}
              />
            </label>
            {uploading && <p role="status">正在檢查並處理圖片…</p>}
            <p className="field-hint">
              圖片將重新編碼並縮放至最多 512 像素，只保存本次示範預覽。
            </p>
          </div>
        </div>
        <div
          id="account-panel-1"
          role="tabpanel"
          aria-labelledby="account-tab-1"
          hidden={tab !== 1}
        >
          {notice && tab === 1 && (
            <p
              id="account-feedback-1"
              role={noticeType === "error" ? "alert" : "status"}
              className={`notice account-feedback ${noticeType}`}
            >
              {notice}
            </p>
          )}
          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault();
              if (
                apply(
                  () => contactPatch(member, members, kind, contact, password),
                  `已更新本人${kind === "phone" ? "電話" : "Email"}。`,
                )
              )
                setContact("");
            }}
          >
            <h3>變更登入聯絡資料</h3>
            <div className="account-impact-summary" id="account-contact-impact">
              <strong>一次更新一項登入識別</strong>
              <p>
                更新成功後，舊{kind === "phone" ? "電話" : "Email"}
                立即無法登入；其他登入方式與會員資料維持原有關聯。
              </p>
              {contactDirty && (
                <p>
                  本次將{kind === "phone" ? "電話" : "Email"}更新為：
                  <b>{contact}</b>
                </p>
              )}
            </div>
            <p>
              目前電話：{member.phone || "未填寫"}
              <br />
              目前 Email：{member.email}
            </p>
            <label>
              本次變更項目
              <select
                value={kind}
                onChange={(e) => {
                  const nextKind = e.target.value as "phone" | "email";
                  if (
                    contactDirty &&
                    !window.confirm(
                      "目前聯絡資料尚未儲存，確定放棄並切換變更項目？",
                    )
                  )
                    return;
                  setKind(nextKind);
                  setContact("");
                  setPassword("");
                  setNotice("");
                }}
              >
                <option value="phone">電話</option>
                <option value="email">Email</option>
              </select>
            </label>
            <label>
              新的{kind === "phone" ? "電話（含國碼）" : "Email"}
              <input
                required
                type={kind === "email" ? "email" : "tel"}
                aria-describedby={`account-contact-impact${noticeType === "error" && notice ? " account-feedback-1" : ""}`}
                aria-invalid={(noticeType === "error" && !!notice) || undefined}
                value={contact}
                onChange={(e) => setContact(e.target.value)}
              />
            </label>
            <label>
              輸入目前示範密碼，確認本人
              <input
                required
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </label>
            <p className="field-hint">
              一次只變更一項。示範密碼：{DEMO_PASSWORD}
              。後續可選擇加入電話／Email 驗證。
            </p>
            <button className="button primary" disabled={!contactDirty}>
              驗證並更新單項資料
            </button>
          </form>
        </div>
        <div
          id="account-panel-2"
          role="tabpanel"
          aria-labelledby="account-tab-2"
          hidden={tab !== 2}
        >
          {notice && tab === 2 && (
            <p
              id="account-feedback-2"
              role={noticeType === "error" ? "alert" : "status"}
              className={`notice account-feedback ${noticeType}`}
            >
              {notice}
            </p>
          )}
          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault();
              if (
                apply(
                  () => codePatch(member, members, code, codePassword),
                  "已修改帳號代號；舊代號保留且無法登入。",
                )
              )
                setCode("");
            }}
          >
            <h3>帳號代號</h3>
            <div className="account-impact-summary" id="account-code-impact">
              <strong>
                {codeLocked ? "唯一一次修改已使用" : "此項修改只能執行一次"}
              </strong>
              <p>
                {codeLocked
                  ? "目前代號仍可登入；電話與 Email 也可繼續使用。"
                  : "確認後無法再次修改。舊代號將保留，且不再接受登入；所有會員資料仍屬於同一帳號。"}
              </p>
              {codeDirty && (
                <p>
                  本次變更：<b>{member.code}</b> → <b>{code}</b>
                </p>
              )}
            </div>
            <p>
              目前：{member.code} · 剩餘修改次數：{codeLocked ? "0" : "1"}
            </p>
            <label>
              新代號
              <input
                required
                disabled={codeLocked}
                minLength={6}
                maxLength={20}
                pattern="[A-Za-z0-9_]+"
                aria-describedby={`account-code-impact${noticeType === "error" && notice ? " account-feedback-2" : ""}`}
                aria-invalid={(noticeType === "error" && !!notice) || undefined}
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </label>
            <label>
              輸入目前示範密碼，確認本人
              <input
                required
                type="password"
                disabled={codeLocked}
                value={codePassword}
                onChange={(e) => setCodePassword(e.target.value)}
                autoComplete="current-password"
              />
            </label>
            <p className="field-hint">
              6～20
              字元英文字母、數字與底線，不分大小寫。全平台唯一，舊代號永久保留。
            </p>
            <button
              className="button primary"
              disabled={codeLocked || !codeDirty}
            >
              確認使用唯一一次修改
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
