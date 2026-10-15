import { useState } from "react";
import { actorClub, isManager } from "../domain";
import type { Member } from "../domain";
import {
  initialOrganizations,
  organizationTransition,
} from "./organizationModel";
import type {
  OrgCommand,
  OrgContext,
  OrganizationActor,
  Office,
  OrgClub,
} from "./organizationModel";
export function useOrganizationDemo(onAudit?: (message: string) => void) {
  const [state, setState] = useState(initialOrganizations);
  const [district, setDistrict] = useState("D3481");
  function dispatch(command: OrgCommand, context: OrgContext) {
    const next = organizationTransition(state, context, command);
    setState(next);
    const targetClub = "clubId" in command ? command.clubId : command.type === "add" ? command.id : command.type === "removeRole" ? state.roles.find(r => r.id === command.id)?.clubId : command.type === "approveMove" ? state.proposals.find(p => p.id === command.id)?.clubId : undefined;
    const labels:Record<OrgCommand['type'],string>={edit:'更新社團資料',status:command.type === 'status' && command.enabled ? '恢復社團' : '停用社團',add:'新增社團',role:'授予社團角色',removeRole:'撤銷角色',move:'提出跨區提案',approveMove:'地區核准跨區'};
    onAudit?.(`[社團:${targetClub ?? 'none'}] ${labels[command.type]} · ${next.clubs.find(c => c.id === targetClub)?.name ?? '社團'}`);
  }
  return { state, district, setDistrict, dispatch, reset: () => { setState(initialOrganizations()); setDistrict("D3481") } };
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
function useScope(actor: OrganizationActor, organization: OrganizationController) {
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
        onChange={(e) => scope.setDistrict(e.target.value)}
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
        onChange={(e) => scope.setOffice(e.target.value as Office)}
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
  const allowed =
    actor === "district" || isManager(actor);
  const options = organization.state.clubs.filter((c) =>
    actor === "district" ? c.district === scope.district : c.id === actorClub(actor),
  );
  const [selected, setSelected] = useState("");
  const c = options.find((c) => c.id === selected) ?? options[0];
  return (
    <div className="section-stack">
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
            onChange={(e) => setSelected(e.target.value)}
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
      {field("description", "社團簡介")}
      <div className="two-fields">
        {field("email", "聯絡 Email")}
        {field("website", "官方網站")}
        {field("social", "社群連結")}
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
      <button className="button primary" type="submit">
        儲存社團資料
      </button>
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
    actor === "district" ? c.district === scope.district : c.id === actorClub(actor),
  );
  const c = options.find((c) => c.id === clubId) ?? options[0];
  const permitted = !!c && (actor === "district" || scope.office !== "manager");
  const day = preview ? "2027-07-01" : "2026-10-15";
  const eligible = members.filter(
    (m) => m.clubId === c?.id && m.status === "confirmed",
  );
  return (
    <div className="section-stack">
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
        <h3>授權清單 · {day}</h3>
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
              <button
                className="button"
                disabled={!permitted}
                onClick={() =>
                  feedback.run(() =>
                    organization.dispatch(
                      { type: "removeRole", id: r.id },
                      scope.context,
                    ),
                  )
                }
              >
                撤銷授權
              </button>
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
        <h3>新增授權／預先指定下任</h3>
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
          <button type="submit" className="button primary">
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
    <div className="section-stack">
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
            <p>
              停用會停止新申請與免費地圖曝光，終止未完成入社／轉社。保留既有社籍及歷史；獨立有效付費廣告不受影響。恢復不重開已終止案件。
            </p>
            <button
              className="button"
              onClick={() =>
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
              {c.enabled ? "確認停用" : "確認恢復"}
            </button>
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
        <h3>跨區提案</h3>
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
        <h3>新增轄內社團</h3>
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
