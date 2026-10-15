import { useRef, useState } from "react";
import type { ReactNode } from "react";
import "./organization-view.css";
import { actorClub, isManager } from "../domain";
import type { Member } from "../domain";
import { useCommunityDemo } from "../phase2/store";
import type {
  OrgCommand,
  OrgContext,
  OrganizationActor,
  Office,
  OrgClub,
} from "./organizationModel";
function ConfirmOrganizationAction({
  label,
  title,
  children,
  disabled,
  onConfirm,
}: {
  label: string;
  title: string;
  children: ReactNode;
  disabled?: boolean;
  onConfirm: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button
        type="button"
        className="button"
        disabled={disabled}
        onClick={() => dialog.current?.showModal()}
      >
        {label}
      </button>
      <dialog ref={dialog} className="organization-confirm" aria-label={title}>
        <h3>{title}</h3>
        <div className="organization-summary">{children}</div>
        <div className="organization-actions">
          <button
            type="button"
            className="button"
            autoFocus
            onClick={() => dialog.current?.close()}
          >
            返回檢查
          </button>
          <button
            type="button"
            className="button primary"
            onClick={() => {
              onConfirm();
              dialog.current?.close();
            }}
          >
            確認執行
          </button>
        </div>
      </dialog>
    </>
  );
}
export function useOrganizationDemo(onAudit?: (message: string) => void) {
  const { organizations: state, dispatchOrganization, reset } = useCommunityDemo();
  const [district, setDistrict] = useState("D3481");
  function dispatch(command: OrgCommand, context: OrgContext) {
    const next = dispatchOrganization(command, context);
    const targetClub =
      "clubId" in command
        ? command.clubId
        : command.type === "add"
          ? command.id
          : command.type === "removeRole"
            ? state.roles.find((r) => r.id === command.id)?.clubId
            : command.type === "approveMove"
              ? state.proposals.find((p) => p.id === command.id)?.clubId
              : undefined;
    const labels: Record<OrgCommand["type"], string> = {
      edit: "更新社團資料",
      status:
        command.type === "status" && command.enabled ? "恢復社團" : "停用社團",
      add: "新增社團",
      role: "授予社團角色",
      removeRole: "撤銷角色",
      move: "提出跨區提案",
      approveMove: "地區核准跨區",
    };
    onAudit?.(
      `[社團:${targetClub ?? "none"}] ${labels[command.type]} · ${next.clubs.find((c) => c.id === targetClub)?.name ?? "社團"}`,
    );
  }
  return {
    state,
    district,
    setDistrict,
    dispatch,
    reset: () => {
      reset();
      setDistrict("D3481");
    },
  };
}
export type OrganizationController = ReturnType<typeof useOrganizationDemo>;
type Props = {
  actor: OrganizationActor;
  organization: OrganizationController;
  members: Member[];
};
const officeLabel: Record<Office, string> = {
  president: "社長",
  secretary: "秘書",
  manager: "一般管理者",
  backup: "社團備援帳號",
};
function useScope(
  actor: OrganizationActor,
  organization: OrganizationController,
) {
  const [office, setOffice] = useState<Office>(
    actor === "taichung" ? "secretary" : "president",
  );
  const { district, setDistrict } = organization;
  return {
    office,
    setOffice,
    district,
    setDistrict,
    context: { actor, office, district },
  };
}
function Scope({
  actor,
  scope,
}: {
  actor: OrganizationActor;
  scope: ReturnType<typeof useScope>;
}) {
  return actor === "district" ? (
    <label>
      示範授權地區
      <select
        value={scope.district}
        onChange={(e) => {
          if (
            document.querySelector('[data-unsaved="true"]') &&
            !window.confirm("資料尚未儲存，確定捨棄變更並切換授權地區嗎？")
          )
            return;
          scope.setDistrict(e.target.value);
        }}
      >
        <option>D3481</option>
        <option>D3462</option>
      </select>
    </label>
  ) : (
    <label>
      本社示範職務
      <select
        value={scope.office}
        onChange={(e) => {
          if (
            document.querySelector('[data-unsaved="true"]') &&
            !window.confirm("資料尚未儲存，確定捨棄變更並切換示範職務嗎？")
          )
            return;
          scope.setOffice(e.target.value as Office);
        }}
      >
        {Object.entries(officeLabel).map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}
function useFeedback() {
  const [message, setMessage] = useState("");
  return {
    message,
    run: (fn: () => void) => {
      try {
        fn();
        setMessage("已儲存本次示範變更。");
      } catch (e) {
        setMessage((e as Error).message);
      }
    },
  };
}
export function OrganizationView({ actor, organization }: Props) {
  const scope = useScope(actor, organization);
  const feedback = useFeedback();
  const allowed = actor === "district" || isManager(actor);
  const options = organization.state.clubs.filter((c) =>
    actor === "district"
      ? c.district === scope.district
      : c.id === actorClub(actor),
  );
  const [selected, setSelected] = useState("");
  const editorRegion = useRef<HTMLDivElement>(null);
  const c = options.find((c) => c.id === selected) ?? options[0];
  return (
    <div className="section-stack organization-workspace" ref={editorRegion}>
      <div className="panel">
        <h2>社團資料與公開設定</h2>
        <p>
          社團名稱與簡介公開；聯絡欄位可逐項勾選。所有操作僅保存於本次示範。
        </p>
        {allowed && <Scope actor={actor} scope={scope} />}
        <label>
          管理社團
          <select
            value={c?.id ?? ""}
            onChange={(e) => {
              if (
                editorRegion.current?.querySelector('[data-unsaved="true"]') &&
                !window.confirm("社團資料尚未儲存，確定捨棄變更並切換社團嗎？")
              )
                return;
              setSelected(e.target.value);
            }}
          >
            {options.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {!allowed || !c ? (
        <div className="panel">此身分沒有社團資料管理權限。</div>
      ) : (
        <ClubEditor
          key={`${c.id}-${scope.office}`}
          club={c}
          canBrand={actor === "district" || scope.office !== "manager"}
          save={(patch) =>
            feedback.run(() =>
              organization.dispatch(
                { type: "edit", clubId: c.id, patch },
                scope.context,
              ),
            )
          }
        />
      )}
      <p role="status">{feedback.message}</p>
    </div>
  );
}
function ClubEditor({
  club,
  canBrand,
  save,
}: {
  club: OrgClub;
  canBrand: boolean;
  save: (patch: Partial<OrgClub>) => void;
}) {
  const [draft, setDraft] = useState(club);
  const [imageError, setImageError] = useState("");
  const dirty = (
    [
      "name",
      "description",
      "email",
      "website",
      "social",
      "publicEmail",
      "publicWebsite",
      "publicSocial",
      "emblem",
    ] as const
  ).some((field) => draft[field] !== club[field]);
  const field = (
    name: "name" | "description" | "email" | "website" | "social",
    label: string,
  ) => (
    <label>
      {label}
      <input
        disabled={name === "name" && !canBrand}
        value={draft[name]}
        maxLength={name === "description" ? 5000 : 254}
        onChange={(e) => setDraft({ ...draft, [name]: e.target.value })}
      />
    </label>
  );
  async function image(file?: File) {
    if (!file) return;
    setImageError("");
    if (
      !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
      file.size > 2 * 1024 * 1024
    ) {
      setImageError("請選擇 2 MiB 內的 PNG、JPEG 或 WebP。");
      return;
    }
    try {
      const bitmap = await createImageBitmap(file);
      if (bitmap.width > 4096 || bitmap.height > 4096) {
        bitmap.close();
        throw Error("圖片長寬不得超過 4096。");
      }
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
      bitmap.close();
      setDraft((d) => ({ ...d, emblem: canvas.toDataURL("image/webp") }));
    } catch {
      setImageError("圖片無法讀取，或尺寸超過 4096。");
    }
  }
  return (
    <form
      className="panel form"
      data-unsaved={dirty ? "true" : "false"}
      onSubmit={(e) => {
        e.preventDefault();
        save({
          name: draft.name,
          description: draft.description,
          email: draft.email,
          website: draft.website,
          social: draft.social,
          publicEmail: draft.publicEmail,
          publicWebsite: draft.publicWebsite,
          publicSocial: draft.publicSocial,
          emblem: draft.emblem,
        });
      }}
    >
      <h3>{club.enabled ? "社團運作中" : "社團已停用"}</h3>
      <p>
        {club.district} · {club.type}（地區／類型由地區受控流程處理）
      </p>
      <div className="organization-section-heading">
        <span>01</span>
        <div>
          <h3>社團識別</h3>
          <p>名稱與社徽用於公開社團頁，修改僅限授權角色。</p>
        </div>
      </div>
      {field("name", "社團名稱")}
      <label>
        社徽（PNG / JPEG / WebP，2 MiB）
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={!canBrand}
          onChange={(e) => void image(e.target.files?.[0])}
        />
      </label>
      {draft.emblem && (
        <img src={draft.emblem} alt="社徽預覽" width="80" height="80" />
      )}
      {imageError && <p role="alert">{imageError}</p>}
      {!canBrand && <p>一般管理者可修改介紹與聯絡，無法修改名稱及社徽。</p>}
      <div className="organization-section-heading">
        <span>02</span>
        <div>
          <h3>介紹與聯絡</h3>
          <p>社團簡介公開；以下聯絡資料依勾選設定呈現。</p>
        </div>
      </div>
      {field("description", "社團簡介")}
      <div className="two-fields">
        {field("email", "聯絡 Email")}
        {field("website", "官方網站")}
        {field("social", "社群連結")}
      </div>
      <div className="organization-section-heading">
        <span>03</span>
        <div>
          <h3>公開範圍</h3>
          <p>未勾選的聯絡欄位不顯示於公開社團頁。</p>
        </div>
      </div>
      {(["publicEmail", "publicWebsite", "publicSocial"] as const).map(
        (k, i) => (
          <label key={k}>
            <input
              type="checkbox"
              checked={draft[k]}
              onChange={(e) => setDraft({ ...draft, [k]: e.target.checked })}
            />
            公開{["聯絡 Email", "官方網站", "社群連結"][i]}
          </label>
        ),
      )}
      <div className="organization-save-row">
        <span className="organization-draft-status" role="status">
          {dirty ? "有尚未儲存的修改" : "目前資料已儲存"}
        </span>
        <button className="button primary" type="submit">
          儲存社團資料
        </button>
      </div>
    </form>
  );
}
export function RolesView({ actor, organization, members }: Props) {
  const scope = useScope(actor, organization);
  const feedback = useFeedback();
  const [clubId, setClubId] = useState("");
  const [memberId, setMemberId] = useState("");
  const [office, setOffice] = useState<"president" | "secretary" | "manager">(
    "manager",
  );
  const [start, setStart] = useState("2026-10-15");
  const [end, setEnd] = useState("2027-06-30");
  const [preview, setPreview] = useState(false);
  const options = organization.state.clubs.filter((c) =>
    actor === "district"
      ? c.district === scope.district
      : c.id === actorClub(actor),
  );
  const c = options.find((c) => c.id === clubId) ?? options[0];
  const permitted = !!c && (actor === "district" || scope.office !== "manager");
  const day = preview ? "2027-07-01" : "2026-10-15";
  const eligible = members.filter(
    (m) => m.clubId === c?.id && m.status === "confirmed",
  );
  return (
    <div className="section-stack organization-workspace">
      <div className="panel">
        <h2>角色授權與年度交接</h2>
        <p>
          一般管理者於任期到期後，由新任社長重新分配。預先指派不會提前取得管理權。
        </p>
        <Scope actor={actor} scope={scope} />
        <label>
          社團
          <select
            value={c?.id ?? ""}
            onChange={(e) => setClubId(e.target.value)}
          >
            {options.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={preview}
            onChange={(e) => setPreview(e.target.checked)}
          />
          預覽 2027/7/1 交接後（不執行背景排程）
        </label>
      </div>
      <div className="panel">
        <div className="organization-section-heading">
          <span>01</span>
          <div>
            <h3>授權清單 · {day}</h3>
            <p>{c?.name ?? "請選擇管理社團"} · 僅顯示這個社團的職務與任期。</p>
          </div>
        </div>
        {!organization.state.roles.some((r) => r.clubId === c?.id) && (
          <div className="organization-empty">
            <strong>目前沒有個人管理授權</strong>
            <p>可在下方選擇有效社員新增授權，或預先安排下年度人選。</p>
          </div>
        )}
        {organization.state.roles
          .filter((r) => r.clubId === c?.id)
          .map((r) => (
            <div className="detail-body" key={r.id}>
              <strong>
                {members.find((m) => m.id === r.memberId)?.callName ??
                  r.memberId}{" "}
                · {officeLabel[r.office]}
              </strong>
              <p>
                {r.startsOn}～{r.endsOn} ·{" "}
                {r.startsOn > day
                  ? "尚未生效"
                  : r.endsOn < day
                    ? "已到期"
                    : "有效"}
              </p>
              <ConfirmOrganizationAction
                key={`${r.id}-${actor}-${scope.district}-${scope.office}`}
                label="撤銷授權"
                title="確認撤銷此項授權？"
                disabled={!permitted}
                onConfirm={() =>
                  feedback.run(() =>
                    organization.dispatch(
                      { type: "removeRole", id: r.id },
                      scope.context,
                    ),
                  )
                }
              >
                <p>
                  <strong>
                    {members.find((m) => m.id === r.memberId)?.callName ??
                      r.memberId}
                  </strong>{" "}
                  在 {c?.name} 的「{officeLabel[r.office]}」授權將被撤銷。
                </p>
                <p>
                  原任期：{r.startsOn}～{r.endsOn}
                  。執行後立即失去這一項職務權限，其他授權與社員身分保留。
                </p>
              </ConfirmOrganizationAction>
            </div>
          ))}
        <p>
          社團備援帳號持續保留；交接時須換密碼及撤銷舊工作階段（正式功能待後端）。
        </p>
      </div>
      <form
        className="panel form"
        onSubmit={(e) => {
          e.preventDefault();
          feedback.run(() => {
            if (!eligible.some((m) => m.id === memberId))
              throw Error("請選擇本社有效社員。");
            organization.dispatch(
              {
                type: "role",
                id: crypto.randomUUID(),
                clubId: c!.id,
                memberId,
                office,
                startsOn: start,
                endsOn: end,
              },
              scope.context,
            );
          });
        }}
      >
        <div className="organization-section-heading">
          <span>02</span>
          <div>
            <h3>新增授權／預先指定下任</h3>
            <p>先選社員與角色，再確認任期及權限範圍。</p>
          </div>
        </div>
        {!permitted && <p>目前身分無角色授權權限。</p>}
        <fieldset disabled={!permitted}>
          <label>
            社員
            <select
              value={memberId}
              onChange={(e) => setMemberId(e.target.value)}
            >
              <option value="">請選擇</option>
              {eligible.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.callName}
                </option>
              ))}
            </select>
          </label>
          <label>
            角色
            <select
              value={office}
              onChange={(e) => setOffice(e.target.value as typeof office)}
            >
              <option value="president">社長</option>
              <option value="secretary">秘書</option>
              <option value="manager">一般管理者</option>
            </select>
          </label>
          <div className="two-fields">
            <label>
              任期起日
              <input
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </label>
            <label>
              任期迄日
              <input
                type="date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </label>
          </div>
          <button
            type="button"
            className="button"
            onClick={() => {
              setStart("2027-07-01");
              setEnd("2028-06-30");
            }}
          >
            帶入下年度任期
          </button>
          <section
            className="organization-summary"
            aria-label="授權內容預覽"
            aria-live="polite"
          >
            <h4>送出前確認授權內容</h4>
            <dl>
              <div>
                <dt>授權社團</dt>
                <dd>{c?.name ?? "尚未選擇"}</dd>
              </div>
              <div>
                <dt>授權對象</dt>
                <dd>
                  {eligible.find((m) => m.id === memberId)?.callName ??
                    "請先選擇本社有效社員"}
                </dd>
              </div>
              <div>
                <dt>授予職務</dt>
                <dd>{officeLabel[office]}</dd>
              </div>
              <div>
                <dt>生效期間</dt>
                <dd>
                  {start || "未填起日"} ～ {end || "未填迄日"}
                </dd>
              </div>
            </dl>
            <p>
              {office === "manager"
                ? "可確認社員狀態、審核入社與轉社、維護介紹與聯絡資料；不可修改名稱、社徽、角色或交接人選。"
                : "可確認社員狀態、審核入社與轉社、維護社團資料及名稱／社徽，並可配置該社管理角色及交接人選。"}
            </p>
            <p>
              權限僅限本社、於任期內有效；預先指派不會提前生效，到期後不自動延長。
            </p>
          </section>
          <button
            type="submit"
            className="button primary"
            disabled={!eligible.some((m) => m.id === memberId)}
          >
            確認授權
          </button>
        </fieldset>
      </form>
      <p role="status">{feedback.message}</p>
    </div>
  );
}
export function DistrictView({ actor, organization }: Props) {
  const scope = useScope(actor, organization);
  const feedback = useFeedback();
  const [name, setName] = useState("");
  const [type, setType] = useState("扶青社");
  const [reason, setReason] = useState("");
  const [target, setTarget] = useState("D3462");
  if (actor !== "district")
    return (
      <div className="panel">
        <h2>地區管理</h2>
        <p>
          請切換至地區管理者以體驗轄內社團管理。平台身分不自動取得地區操作權。
        </p>
      </div>
    );
  return (
    <div className="section-stack organization-workspace">
      <div className="panel">
        <h2>地區社團管理</h2>
        <Scope actor={actor} scope={scope} />
        <p>
          地區切換為兩名不同地區管理者的示範。跨區須兩地分別核准，單方不可完成。
        </p>
        <label>
          本次操作原因
          <textarea
            value={reason}
            maxLength={1000}
            onChange={(e) => setReason(e.target.value)}
            placeholder="停用、恢復或跨區申請皆須填寫"
          />
        </label>
      </div>
      {organization.state.clubs
        .filter((c) => c.district === scope.district)
        .map((c) => (
          <div className="panel" key={c.id}>
            <h3>
              {c.name} · {c.enabled ? "啟用" : "停用"}
            </h3>

            <section
              className="organization-summary"
              aria-label={`${c.name}狀態變更預覽`}
            >
              <h4>{c.enabled ? "停用" : "恢復"}操作摘要</h4>
              <p>
                目標社團：<strong>{c.name}</strong>（{c.district}）
              </p>
              <p>狀態變更：{c.enabled ? "啟用 → 停用" : "停用 → 啟用"}</p>
              <p>操作原因：{reason.trim() || "請先填寫本次操作原因"}</p>
              <p>
                {c.enabled
                  ? "將停止新入社與新增活動，終止未完成入社／轉社，取消免費地圖曝光。既有社籍、歷史與獨立有效付費廣告保留。"
                  : "恢復新申請與符合資格的免費曝光；已終止申請與撤下活動不會自動重開或重新發布。"}
              </p>
            </section>
            <ConfirmOrganizationAction
              key={`${c.id}-${c.enabled}-${scope.district}`}
              label={c.enabled ? "確認停用" : "確認恢復"}
              title={`確認${c.enabled ? "停用" : "恢復"}「${c.name}」？`}
              disabled={!reason.trim()}
              onConfirm={() =>
                feedback.run(() =>
                  organization.dispatch(
                    {
                      type: "status",
                      clubId: c.id,
                      enabled: !c.enabled,
                      reason,
                    },
                    scope.context,
                  ),
                )
              }
            >
              <p>
                目標：<strong>{c.name}</strong>（{c.district}）
              </p>
              <p>原因：{reason}</p>
              <p>
                {c.enabled
                  ? "執行後立即停止新申請、終止未完成入社／轉社，並隱藏免費地圖曝光；恢復社團也不會重開已終止案件。"
                  : "恢復後可重新提出申請；已終止案件及已撤下活動仍維持原狀。"}
              </p>
              <p>既有社員與歷史資料保留，獨立有效付費廣告依原期限顯示。</p>
            </ConfirmOrganizationAction>
            <label>
              跨區目標
              <select
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              >
                <option>D3481</option>
                <option>D3462</option>
              </select>
            </label>
            <section className="organization-summary" aria-label="跨區申請摘要">
              <p>
                <strong>{c.name}</strong>：{c.district} → {target}
              </p>
              <p>原因：{reason.trim() || "尚未填寫"}</p>
              {organization.state.proposals
                .filter((p) => p.clubId === c.id && p.status === "pending")
                .map((p) => (
                  <p key={p.id}>
                    目前提案：來源 {p.from}{" "}
                    {p.sourceApproved ? "已核准" : "待核准"}／目標 {p.to}{" "}
                    {p.targetApproved ? "已核准" : "待核准"}
                    。雙方核准前維持原地區。
                  </p>
                ))}
              {!organization.state.proposals.some(
                (p) => p.clubId === c.id && p.status === "pending",
              ) && (
                <p>
                  尚無進行中提案；提出後，來源及目標地區須分別核准才會移轉。
                </p>
              )}
            </section>
            <button
              className="button"
              onClick={() =>
                feedback.run(() =>
                  organization.dispatch(
                    {
                      type: "move",
                      id: crypto.randomUUID(),
                      clubId: c.id,
                      to: target,
                      reason,
                    },
                    scope.context,
                  ),
                )
              }
            >
              提出跨區提案
            </button>
            <p>既有社籍的類型更正須另建案件重新映射，不提供直接改類型。</p>
          </div>
        ))}
      <div className="panel">
        <div className="organization-section-heading">
          <span>02</span>
          <div>
            <h3>跨區提案</h3>
            <p>檢視來源與目標地區的核准進度，僅能代表目前授權地區操作。</p>
          </div>
        </div>
        {!organization.state.proposals.some((p) =>
          [p.from, p.to].includes(scope.district),
        ) && (
          <div className="organization-empty">
            <strong>目前沒有跨區提案</strong>
            <p>需異動社團所屬地區時，先在轄內社團卡片填寫原因並提出提案。</p>
          </div>
        )}
        {organization.state.proposals
          .filter((p) => [p.from, p.to].includes(scope.district))
          .map((p) => (
            <div className="detail-body" key={p.id}>
              <strong>
                {organization.state.clubs.find((c) => c.id === p.clubId)?.name}
              </strong>
              <p>
                {p.from} → {p.to} · 來源{p.sourceApproved ? "已核准" : "待核准"}
                ／目標{p.targetApproved ? "已核准" : "待核准"} ·{" "}
                {p.status === "completed" ? "完成" : "待雙方確認"}
              </p>
              <p>{p.reason}</p>
              <button
                className="button"
                disabled={
                  p.status === "completed" ||
                  (scope.district === p.from
                    ? p.sourceApproved
                    : p.targetApproved)
                }
                onClick={() =>
                  feedback.run(() =>
                    organization.dispatch(
                      { type: "approveMove", id: p.id },
                      scope.context,
                    ),
                  )
                }
              >
                以目前地區核准
              </button>
            </div>
          ))}
        <p>完成後以新地區重新判斷轄區；原地區管理權不隨社團移轉。</p>
      </div>
      <form
        className="panel form"
        onSubmit={(e) => {
          e.preventDefault();
          feedback.run(() =>
            organization.dispatch(
              {
                type: "add",
                id: `club-${crypto.randomUUID()}`,
                name,
                clubType: type,
              },
              scope.context,
            ),
          );
        }}
      >
        <div className="organization-section-heading">
          <span>03</span>
          <div>
            <h3>新增轄內社團</h3>
            <p>建立後可維護基本資料；不會自動授予任何個人管理角色。</p>
          </div>
        </div>
        <label>
          名稱
          <input
            required
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          類型
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option>扶青社</option>
            <option disabled>扶輪社（整合預留）</option>
          </select>
        </label>
        <p>建立於 {scope.district}；首次管理帳號發放由平台權限管理案件處理。</p>
        <button className="button primary">建立社團</button>
      </form>
      <p role="status">{feedback.message}</p>
    </div>
  );
}
