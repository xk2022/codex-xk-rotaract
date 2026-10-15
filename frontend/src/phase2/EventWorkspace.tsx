import { useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  CalendarDays,
  Check,
  Copy,
  Eye,
  Globe2,
  MapPin,
  Plus,
  Save,
  ShieldCheck,
  X,
} from "lucide-react";
import "./event-workspace.css";
import { useCommunityDemo } from "./store";
import {
  canManageEvent,
  canPublishEvent,
  formatEventDate,
  localDateTimeToUtc,
  utcToLocalDateTime,
  validateEventInput,
  visibleEvents,
} from "./model";
import type {
  EventActor,
  CommunityEvent,
  EventInput,
  EventAction,
  EventRole,
} from "./model";

const statusLabels = {
  draft: "草稿",
  published: "已發布",
  cancelled: "已取消",
  archived: "已封存",
};
const visibilityLabels = {
  public: "所有人可見",
  members: "登入會員可見",
  club: "所屬社團可見",
};

function ConfirmEventAction({
  title,
  label,
  children,
  reasonRequired = false,
  onConfirm,
  danger = false,
}: {
  title: string;
  label: string;
  children: ReactNode;
  reasonRequired?: boolean;
  onConfirm: (reason: string) => void;
  danger?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  return (
    <>
      <button
        type="button"
        className={`ew-button ${danger ? "danger" : ""}`}
        onClick={() => {
          setError("");
          setReason("");
          dialog.current?.showModal();
        }}
      >
        {label}
      </button>
      <dialog ref={dialog} className="ew-dialog" aria-label={title}>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (reasonRequired && !reason.trim()) {
              setError("請填寫取消原因，讓參與者清楚了解變動。");
              return;
            }
            try {
              onConfirm(reason.trim());
              dialog.current?.close();
            } catch (error) {
              setError(
                error instanceof Error ? error.message : "操作未完成，請重試。",
              );
            }
          }}
        >
          <h3>{title}</h3>
          <div>{children}</div>
          {reasonRequired && (
            <label>
              取消原因（必填）
              <textarea
                autoFocus
                value={reason}
                maxLength={1000}
                required
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
          )}
          {error && (
            <p className="ew-error" role="alert">
              {error}
            </p>
          )}
          <div className="ew-actions">
            <button
              type="button"
              className="ew-button"
              onClick={() => dialog.current?.close()}
            >
              返回
            </button>
            <button
              type="submit"
              className={`ew-button ${danger ? "danger" : "primary"}`}
            >
              確認{label}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}

interface EventForm {
  title: string;
  description: string;
  location: string;
  organizerType: "club" | "district";
  organizerId: string;
  visibility: "public" | "members" | "club";
  timeZone: string;
  allDay: boolean;
  start: string;
  end: string;
  startFold: "" | "earlier" | "later";
  endFold: "" | "earlier" | "later";
}
function formFrom(event?: CommunityEvent, actor?: EventActor): EventForm {
  const time = event?.time;
  return {
    title: event?.title ?? "",
    description: event?.description ?? "",
    location: event?.location ?? "",
    organizerType:
      event?.organizerType ??
      (actor?.role === "district_manager" ? "district" : "club"),
    organizerId:
      event?.organizerId ??
      (actor?.role === "district_manager" ? actor.districtId : actor?.clubId) ??
      "",
    visibility: event?.visibility ?? "public",
    timeZone: time?.timeZone ?? "Asia/Taipei",
    allDay: time?.kind === "allDay",
    start: time
      ? time.kind === "allDay"
        ? time.startDate
        : utcToLocalDateTime(time.startAt, time.timeZone)
      : "2026-11-07T10:00",
    end: time
      ? time.kind === "allDay"
        ? time.endDateExclusive
        : utcToLocalDateTime(time.endAt, time.timeZone)
      : "2026-11-07T12:00",
    startFold: "",
    endFold: "",
  };
}
function toInput(form: EventForm): EventInput {
  const base = {
    title: form.title,
    description: form.description,
    location: form.location,
    organizerType: form.organizerType,
    organizerId: form.organizerId,
    visibility: form.visibility,
  };
  if (form.allDay)
    return {
      ...base,
      time: {
        kind: "allDay",
        startDate: form.start,
        endDateExclusive: form.end,
        timeZone: form.timeZone,
      },
    };
  const start = localDateTimeToUtc(
      form.start,
      form.timeZone,
      form.startFold || undefined,
    ),
    end = localDateTimeToUtc(
      form.end,
      form.timeZone,
      form.endFold || undefined,
    );
  if (!start.ok) throw new Error(`開始時間：${start.error}`);
  if (!end.ok) throw new Error(`結束時間：${end.error}`);
  return {
    ...base,
    time: {
      kind: "timed",
      startAt: start.value,
      endAt: end.value,
      timeZone: form.timeZone,
    },
  };
}
const roleLabels: Record<EventRole, string> = {
  guest: "訪客",
  member: "一般會員",
  club_manager: "一般社團管理者",
  club_president: "社長",
  club_secretary: "秘書",
  club_backup: "社團備援帳號",
  district_manager: "地區管理者",
};

export function EventWorkspace({ actor }: { actor: EventActor }) {
  const { events, clubs, dispatch } = useCommunityDemo();
  const [roleOverride, setRoleOverride] = useState<EventRole | null>(null);
  const effectiveActor: EventActor = {
    ...actor,
    role: roleOverride ?? actor.role,
  };
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState("");
  const [visibility, setVisibility] = useState("");
  const [scope, setScope] = useState("");
  const [editing, setEditing] = useState<{
    id: string | null;
    version: number;
    status: CommunityEvent["status"];
  } | null>(null);
  const [form, setForm] = useState<EventForm>(() => formFrom(undefined, actor));
  const [savedForm, setSavedForm] = useState("");
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const correctionDialog = useRef<HTMLDialogElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const dirty = editing !== null && JSON.stringify(form) !== savedForm;
  const manageable = events.filter((event) =>
    canManageEvent(effectiveActor, event, clubs),
  );
  const organizerOptions =
    actor.role === "district_manager"
      ? [
          {
            id: actor.districtId ?? "d3481",
            type: "district" as const,
            name: `${clubs.find((c) => c.districtId === actor.districtId)?.districtName ?? "所屬地區"} · 地區活動`,
          },
        ]
      : clubs
          .filter((c) => c.id === actor.clubId && c.enabled)
          .map((c) => ({ id: c.id, type: "club" as const, name: c.name }));
  const canCreate = organizerOptions.some((o) =>
    canManageEvent(
      effectiveActor,
      { organizerType: o.type, organizerId: o.id },
      clubs,
    ),
  );
  useEffect(() => {
    setRoleOverride(null);
    setEditing(null);
    setError("");
    setNotice("");
  }, [actor.role, actor.clubId, actor.districtId]);
  function confirmDiscard() {
    return !dirty || window.confirm("活動變更尚未儲存，確定捨棄這次編輯？");
  }
  function openEditor(event?: CommunityEvent) {
    if (event && event.status !== "draft" && event.status !== "published") {
      setError("活動已取消或封存，不能再編輯；目前輸入仍保留，可複製文字後返回列表。");
      return;
    }
    if (!confirmDiscard()) return;
    const next = formFrom(event, effectiveActor);
    setEditing({ id: event?.id ?? null, version: event?.version ?? 0, status: event?.status ?? "draft" });
    setForm(next);
    setSavedForm(JSON.stringify(next));
    setPreview(false);
    setError("");
    setNotice("");
    window.setTimeout(() => {
      editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      editorRef.current
        ?.querySelector<HTMLInputElement>("input[required]")
        ?.focus({ preventScroll: true });
    }, 0);
  }
  function command(action: EventAction) {
    const result = dispatch(action);
    if (!result.ok) {
      const fields = Object.values(result.fieldErrors ?? {}).join(" ");
      throw new Error(`${result.error}${fields ? ` ${fields}` : ""}`);
    }
    return result.event;
  }
  function save(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const input = toInput(form);
      const fieldErrors = validateEventInput(input, clubs);
      if (Object.keys(fieldErrors).length)
        throw new Error(Object.values(fieldErrors).join(" "));
      if (selectedEvent?.status === "published") {
        correctionDialog.current?.showModal();
        return;
      }
      persist();
    } catch (error) {
      setError(error instanceof Error ? error.message : "請檢查活動欄位。");
    }
  }
  function persist() {
    if (!editing) return;
    setError("");
    try {
      const input = toInput(form);
      const result = command(
        editing.id
          ? {
              type: "update",
              actor: effectiveActor,
              id: editing.id,
              version: editing.version,
              input,
            }
          : { type: "create", actor: effectiveActor, input },
      );
      const next = formFrom(result, effectiveActor);
      setForm(next);
      setSavedForm(JSON.stringify(next));
      setEditing({ id: result.id, version: result.version, status: result.status });
      setNotice(
        result.status === "published"
          ? result.publicWithdrawnAt ? "活動內容已更正；仍維持撤下公開曝光。" : "活動內容已更正，維持已發布；讀者會看到最新內容。"
          : effectiveActor.role === "club_manager"
          ? "草稿已儲存，請交由社長／秘書或備援帳號發布。"
          : "草稿已儲存；確認預覽後，再從活動列表發布。",
      );
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "儲存失敗；輸入內容已保留。",
      );
    }
  }
  const readOnly = effectiveActor.role === "member";
  const readable = readOnly
    ? visibleEvents(events, clubs, effectiveActor)
    : manageable;
  const listOrganizers = readOnly
    ? [
        ...new Map(
          readable.map((event) => [
            event.organizerId,
            {
              id: event.organizerId,
              name:
                event.organizerType === "club"
                  ? (clubs.find((c) => c.id === event.organizerId)?.name ??
                    "社團")
                  : (clubs.find((c) => c.districtId === event.organizerId)
                      ?.districtName ?? "地區"),
            },
          ]),
        ).values(),
      ]
    : organizerOptions;
  const filtered = readable.filter(
    (event) =>
      (!keyword ||
        `${event.title} ${event.description} ${event.location}`
          .toLowerCase()
          .includes(keyword.trim().toLowerCase())) &&
      (!status || event.status === status) &&
      (!visibility || event.visibility === visibility) &&
      (!scope || event.organizerId === scope),
  );
  const selectedEvent = editing?.id
    ? events.find((e) => e.id === editing.id)
    : undefined;
  const correcting = editing?.status === "published";
  const terminal = selectedEvent?.status === "cancelled" || selectedEvent?.status === "archived";
  const conflict = selectedEvent && selectedEvent.version !== editing?.version;
  let previewEvent: CommunityEvent | undefined;
  if (preview) {
    try {
      const input = toInput(form);
      if (!Object.keys(validateEventInput(input, clubs)).length)
        previewEvent = {
          ...input,
          id: "preview",
          status: "published",
          version: 0,
        };
    } catch {
      /* Show validation below without discarding draft. */
    }
  }
  const organizerName = (
    event: Pick<CommunityEvent, "organizerType" | "organizerId">,
  ) =>
    event.organizerType === "club"
      ? (clubs.find((c) => c.id === event.organizerId)?.name ?? "社團")
      : (clubs.find((c) => c.districtId === event.organizerId)?.districtName ??
        "地區");
  return (
    <section
      className="event-workspace"
      aria-label={readOnly ? "會員活動閱讀工作區" : "活動管理工作區"}
    >
      <header className="ew-heading">
        <div>
          <span className="ew-eyebrow">Community events · Phase 02</span>
          <h2>讓每一場相聚，清楚被看見</h2>
          <p>
            {readOnly
              ? "閱讀公開、會員限定與自己社團的活動，掌握每一次相聚。"
              : "從草稿到公開行事曆，在同一處整理社團活動。"}
          </p>
        </div>
        {canCreate && (
          <button className="ew-button primary" onClick={() => openEditor()}>
            <Plus size={18} />
            新增活動草稿
          </button>
        )}
      </header>
      <div className="ew-demo ew-panel">
        <div>
          <strong>活動身分示範</strong>
          <p className="ew-note">
            合成資料互動；重新整理會重設。此切換僅展示操作差異，並非正式授權。
          </p>
        </div>
        {actor.clubId && actor.role.startsWith("club_") ? (
          <label>
            本社示範身分
            <select
              aria-label="本社示範身分"
              value={effectiveActor.role}
              onChange={(e) => {
                if (!confirmDiscard()) return;
                setEditing(null);
                setError("");
                setNotice("");
                setRoleOverride(e.target.value as EventRole);
              }}
            >
              {(
                [
                  "club_president",
                  "club_secretary",
                  "club_backup",
                  "club_manager",
                ] as EventRole[]
              ).map((role) => (
                <option key={role} value={role}>
                  {roleLabels[role]}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <span className="ew-chip">
            <ShieldCheck size={15} />
            &nbsp;{roleLabels[effectiveActor.role]}
          </span>
        )}
      </div>
      {notice && (
        <div className="ew-success" role="status">
          <Check size={16} /> {notice}
        </div>
      )}
      {error && (
        <div className="ew-error" role="alert">
          {error}
        </div>
      )}
      {!readOnly && !canCreate && manageable.length === 0 ? (
        <div className="ew-panel ew-empty">
          <CalendarDays size={32} />
          <h3>這個身分沒有活動維護範圍</h3>
          <p className="ew-note">
            活動由所屬社團管理者，或地區活動的地區管理者維護。你可以從公開行事曆探索活動。
          </p>
        </div>
      ) : (
        <>
          <div className="ew-summary">
            <span>
              {readOnly ? "可閱讀活動" : "維護範圍"} {readable.length} 場
            </span>
            {!readOnly && (
              <span>
                草稿 {manageable.filter((e) => e.status === "draft").length} 場
              </span>
            )}
            <span>
              已發布 {readable.filter((e) => e.status === "published").length}{" "}
              場
            </span>
            <span>
              {readOnly
                ? "包含公開、會員限定與自己社團活動；不含他社內部活動或草稿"
                : "僅顯示目前身分有權維護的活動"}
            </span>
          </div>
          <div className="ew-panel ew-toolbar">
            <label>
              搜尋活動
              <input
                type="search"
                placeholder="標題、說明或地點"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
              />
            </label>
            <label>
              狀態
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="">全部狀態</option>
                {Object.entries(statusLabels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              顯示範圍
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value)}
              >
                <option value="">全部可見性</option>
                {Object.entries(visibilityLabels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              主辦單位
              <select value={scope} onChange={(e) => setScope(e.target.value)}>
                <option value="">
                  {readOnly ? "所有可閱讀主辦單位" : "所有維護單位"}
                </option>
                {listOrganizers.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div
            className="ew-list"
            aria-label={readOnly ? "可閱讀活動列表" : "可管理活動列表"}
          >
            {filtered.length === 0 ? (
              <div className="ew-panel ew-empty">
                <CalendarDays size={30} />
                <h3>沒有符合條件的活動</h3>
                <p className="ew-note">
                  {readOnly
                    ? "試試其他關鍵字或顯示範圍；只會顯示你有權閱讀的活動。"
                    : "試試其他關鍵字，或建立第一份活動草稿。"}
                </p>
                <button
                  className="ew-button"
                  onClick={() => {
                    setKeyword("");
                    setStatus("");
                    setVisibility("");
                    setScope("");
                  }}
                >
                  清除篩選
                </button>
              </div>
            ) : (
              filtered.map((event) => {
                const date =
                  event.time.kind === "allDay"
                    ? event.time.startDate
                    : utcToLocalDateTime(
                        event.time.startAt,
                        event.time.timeZone,
                      ).slice(0, 10);
                const publisher = canPublishEvent(effectiveActor, event, clubs);
                return (
                  <article className="ew-card" key={event.id}>
                    <div className="ew-date">
                      <span>
                        {date.slice(0, 4)} / {date.slice(5, 7)}
                      </span>
                      <strong>{date.slice(8, 10)}</strong>
                    </div>
                    <div>
                      <div className="ew-badges">
                        <span className={`ew-chip ${event.status}`}>
                          {statusLabels[event.status]}
                        </span>
                        <span className="ew-chip">
                          {event.publicWithdrawnAt ? "已撤下公開曝光" : visibilityLabels[event.visibility]}
                        </span>
                      </div>
                      {event.publicWithdrawnAt && <p className="ew-local-warning">社團停用時已撤下公開曝光。恢復或更正原筆不會重新公開；如需發布，請複製為新草稿。</p>}
                      <h3>{event.title}</h3>
                      <div className="ew-meta">
                        <span>
                          <CalendarDays size={14} />
                          {formatEventDate(event)}
                        </span>
                        <span>
                          <MapPin size={14} />
                          {event.location || "地點待公告"}
                        </span>
                      </div>
                      <div className="ew-meta">
                        <span>{organizerName(event)}</span>
                        {!readOnly && <span>版本 {event.version}</span>}
                      </div>
                      {event.cancellationReason && (
                        <p className="ew-note">
                          取消原因：{event.cancellationReason}
                        </p>
                      )}
                      {event.status === "draft" && !publisher && (
                        <p className="ew-help">
                          草稿待發布者處理，請交由社長／秘書或備援帳號發布。
                        </p>
                      )}
                    </div>
                    {readOnly ? (
                      <details className="ew-reader-details">
                        <summary className="ew-button">閱讀活動詳情</summary>
                        <div className="ew-reader-body">
                          <h4>{event.title}</h4>
                          <p className="ew-description">
                            {event.description || "主辦單位尚未提供活動說明。"}
                          </p>
                          <p className="ew-help">
                            {visibilityLabels[event.visibility]} ·{" "}
                            {organizerName(event)} · {formatEventDate(event)}
                          </p>
                        </div>
                      </details>
                    ) : (
                      <div className="ew-actions">
                        {event.status === "draft" && (
                          <button
                            className="ew-button"
                            onClick={() => openEditor(event)}
                          >
                            編輯草稿
                          </button>
                        )}
                        {event.status === "draft" && publisher && (
                          <ConfirmEventAction
                            title="確認發布活動"
                            label="發布"
                            onConfirm={() => {
                              if (editing?.id === event.id && dirty)
                                throw new Error(
                                  "請先儲存目前草稿，再發布最新內容。",
                                );
                              command({
                                type: "publish",
                                actor: effectiveActor,
                                id: event.id,
                                version: event.version,
                              });
                              if (editing?.id === event.id) setEditing(null);
                              setNotice("活動已發布，依設定的可見性顯示。");
                            }}
                          >
                            <p>即將發布「{event.title}」。</p>
                            <p>
                              {visibilityLabels[event.visibility]}；
                              {formatEventDate(event)}
                              。請確認時間、主辦與顯示範圍。
                            </p>
                          </ConfirmEventAction>
                        )}
                        {event.status === "published" && publisher && (
                          <>
                            <button className="ew-button" onClick={() => openEditor(event)}>
                              更正活動內容
                            </button>
                            <ConfirmEventAction
                              title="取消活動並保留公告"
                              label="取消活動"
                              reasonRequired
                              danger
                              onConfirm={(reason) => {
                                command({
                                  type: "cancel",
                                  actor: effectiveActor,
                                  id: event.id,
                                  version: event.version,
                                  reason,
                                });
                                setNotice(
                                  "活動已取消；公開活動會保留取消標示與原因。",
                                );
                              }}
                            >
                              <p>
                                取消後不能復活原活動。如要重新舉辦，請複製為新草稿。
                              </p>
                            </ConfirmEventAction>
                            <ConfirmEventAction
                              title="封存活動"
                              label="封存"
                              onConfirm={() => {
                                command({
                                  type: "archive",
                                  actor: effectiveActor,
                                  id: event.id,
                                  version: event.version,
                                });
                                setNotice(
                                  "已封存，公開行事曆移除，管理端保留紀錄。",
                                );
                              }}
                            >
                              <p>
                                將「{event.title}
                                」封存，從公開行事曆移除，管理端保留紀錄。
                              </p>
                            </ConfirmEventAction>
                          </>
                        )}
                        <button
                          className="ew-button"
                          onClick={() => {
                            if (!confirmDiscard()) return;
                            try {
                              const copied = command({
                                type: "copy",
                                actor: effectiveActor,
                                id: event.id,
                                version: event.version,
                              });
                              setEditing(null);
                              const next = formFrom(copied, effectiveActor);
                              setEditing({
                                id: copied.id,
                                version: copied.version,
                                status: copied.status,
                              });
                              setForm(next);
                              setSavedForm(JSON.stringify(next));
                              setPreview(false);
                              setError("");
                              setNotice(
                                "已複製為新草稿，不會帶入取消狀態或原因。",
                              );
                              window.setTimeout(
                                () =>
                                  editorRef.current?.scrollIntoView({
                                    behavior: "smooth",
                                  }),
                                0,
                              );
                            } catch (e) {
                              setError(
                                e instanceof Error ? e.message : "複製失敗。",
                              );
                            }
                          }}
                        >
                          <Copy size={15} />
                          複製
                        </button>
                      </div>
                    )}
                  </article>
                );
              })
            )}
          </div>
        </>
      )}
      {editing && (
        <div
          className="ew-panel"
          ref={editorRef}
          data-unsaved={dirty ? "true" : "false"}
          aria-label={correcting ? "已發布活動編輯器" : "活動草稿編輯器"}
        >
          <div className="ew-editor-head">
            <div>
              <span className="ew-eyebrow">{correcting ? "Published event correction" : "Event draft"}</span>
              <h3>{correcting ? "更正已發布活動" : editing.id ? "編輯活動草稿" : "建立活動草稿"}</h3>
            </div>
            <button
              className="ew-button"
              aria-label="關閉活動編輯器"
              onClick={() => {
                if (confirmDiscard()) setEditing(null);
              }}
            >
              <X size={18} />
            </button>
          </div>
          {terminal && <div className="ew-error" role="alert">活動已取消或封存，不能儲存更正；目前輸入仍保留，可複製文字後返回列表。</div>}
          {conflict && (
            <div className="ew-error" role="alert">
              版本已更新；目前輸入仍保留。可先複製文字，再重新載入最新資料。
              <button
                className="ew-button"
                onClick={() => {
                  if (selectedEvent && !terminal) openEditor(selectedEvent);
                }}
                disabled={terminal}
              >
                載入最新版本
              </button>
            </div>
          )}
          {selectedEvent && (selectedEvent.status === "draft" || correcting) && !conflict && (
            <div className="ew-local-warning">
              版本驗證示範：可模擬另一位管理者更新同一筆活動，再儲存驗證衝突時會保留輸入。
              <button
                type="button"
                className="ew-button"
                onClick={() => {
                  try {
                    command({
                      type: "update",
                      actor: effectiveActor,
                      id: selectedEvent.id,
                      version: selectedEvent.version,
                      input: toInput(formFrom(selectedEvent, effectiveActor)),
                    });
                    setNotice(
                      "已模擬其他操作更新版本；你的編輯內容仍保留，儲存時將檢查版本。",
                    );
                  } catch (error) {
                    setError(
                      error instanceof Error ? error.message : "模擬未完成。",
                    );
                  }
                }}
              >
                模擬其他人更新
              </button>
            </div>
          )}
          <form className="ew-form" onSubmit={save}>
            <div className="ew-form-grid">
              <label className="ew-full">
                活動標題（必填）
                <input
                  required
                  maxLength={200}
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="為活動取一個清楚易懂的名字"
                />
                <span className="ew-count">{form.title.length} / 200</span>
              </label>
              <label>
                主辦單位（必填）
                <select
                  required
                  value={form.organizerId}
                  disabled={Boolean(editing.id)}
                  onChange={(e) => {
                    const o = organizerOptions.find(
                      (o) => o.id === e.target.value,
                    );
                    if (o)
                      setForm({
                        ...form,
                        organizerId: o.id,
                        organizerType: o.type,
                      });
                  }}
                >
                  {organizerOptions.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
                <span className="ew-help">
                  草稿建立後主辦固定；轉主辦需另行受控處理。
                </span>
              </label>
              <label>
                顯示範圍
                <select
                  value={form.visibility}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      visibility: e.target.value as EventForm["visibility"],
                    })
                  }
                >
                  {Object.entries(visibilityLabels)
                    .filter(
                      ([key]) =>
                        form.organizerType !== "district" || key !== "club",
                    )
                    .map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                </select>
                <span className="ew-help">
                  私人活動不會出現在匿名公開行事曆。
                </span>
              </label>
              <label className="ew-full">
                地點
                <input
                  maxLength={300}
                  value={form.location}
                  onChange={(e) =>
                    setForm({ ...form, location: e.target.value })
                  }
                  placeholder="活動場地或線上會議方式"
                />
              </label>
              <label className="ew-full">
                活動說明
                <textarea
                  maxLength={10000}
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  placeholder="介紹活動目的、流程及需要注意的事項"
                />
                <span className="ew-count">
                  {form.description.length} / 10000 · 以純文字安全呈現
                </span>
              </label>
            </div>
            <div className="ew-time-panel">
              <div className="ew-form-grid">
                <label>
                  活動時區（IANA）
                  <input
                    list="event-timezones"
                    required
                    value={form.timeZone}
                    onChange={(e) =>
                      setForm({ ...form, timeZone: e.target.value })
                    }
                  />
                  <datalist id="event-timezones">
                    {[
                      "Asia/Taipei",
                      "Asia/Tokyo",
                      "Asia/Singapore",
                      "Europe/London",
                      "America/New_York",
                      "America/Los_Angeles",
                      "Australia/Sydney",
                      "UTC",
                    ].map((zone) => (
                      <option key={zone} value={zone} />
                    ))}
                  </datalist>
                  <span className="ew-help">
                    時間以此時區輸入；跨時區儲存為 UTC。
                  </span>
                </label>
                <label className="ew-check">
                  <input
                    type="checkbox"
                    checked={form.allDay}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        allDay: e.target.checked,
                        start: e.target.checked
                          ? form.start.slice(0, 10)
                          : `${form.start.slice(0, 10)}T10:00`,
                        end: e.target.checked
                          ? form.end.slice(0, 10)
                          : `${form.end.slice(0, 10)}T12:00`,
                      })
                    }
                  />
                  全天活動
                </label>
                <label>
                  {form.allDay ? "開始日期（含當天）" : "開始日期與時間"}
                  <input
                    type={form.allDay ? "date" : "datetime-local"}
                    required
                    value={form.start}
                    onChange={(e) =>
                      setForm({ ...form, start: e.target.value, startFold: "" })
                    }
                  />
                </label>
                <label>
                  {form.allDay ? "結束日期（不含當天）" : "結束日期與時間"}
                  <input
                    type={form.allDay ? "date" : "datetime-local"}
                    required
                    value={form.end}
                    onChange={(e) =>
                      setForm({ ...form, end: e.target.value, endFold: "" })
                    }
                  />
                </label>
                {!form.allDay && (
                  <>
                    <label>
                      開始時間回撥選擇
                      <select
                        value={form.startFold}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            startFold: e.target.value as EventForm["startFold"],
                          })
                        }
                      >
                        <option value="">一般時間／如有重複則提醒</option>
                        <option value="earlier">較早的時段</option>
                        <option value="later">較晚的時段</option>
                      </select>
                    </label>
                    <label>
                      結束時間回撥選擇
                      <select
                        value={form.endFold}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            endFold: e.target.value as EventForm["endFold"],
                          })
                        }
                      >
                        <option value="">一般時間／如有重複則提醒</option>
                        <option value="earlier">較早的時段</option>
                        <option value="later">較晚的時段</option>
                      </select>
                    </label>
                  </>
                )}
              </div>
              <p className="ew-help">
                {form.allDay
                  ? "全天採「起日含、迄日不含」：例如 11/7 一天，開始填 11/7、結束填 11/8。"
                  : "支援跨日。結束必須晚於開始；夏令時間跳時會拒絕，回撥重複時須明確選擇較早／較晚時段。"}
              </p>
            </div>
            <div className="ew-actions">
              <button
                type="button"
                className="ew-button"
                onClick={() => setPreview(!preview)}
              >
                <Eye size={16} />
                {preview ? "收起預覽" : "預覽讀者畫面"}
              </button>
              <span className="ew-help">預覽不會發布或儲存活動。</span>
            </div>
            {preview &&
              (previewEvent ? (
                <div className="ew-preview">
                  <span className="ew-eyebrow">
                    {form.visibility === "public"
                      ? "公開內容預覽"
                      : "私人內容預覽 · 匿名不可見"}
                  </span>
                  <h3>{previewEvent.title || "尚未填寫標題"}</h3>
                  <div className="ew-meta">
                    <span>
                      <CalendarDays size={15} />
                      {formatEventDate(previewEvent)}
                    </span>
                    <span>
                      <Globe2 size={15} />
                      {visibilityLabels[previewEvent.visibility]}
                    </span>
                  </div>
                  <strong>{organizerName(previewEvent)}</strong>
                  <p className="ew-note">
                    {previewEvent.location || "地點待公告"}
                  </p>
                  <p className="ew-description">
                    {previewEvent.description || "尚未填寫說明"}
                  </p>
                </div>
              ) : (
                <div className="ew-error" role="alert">
                  目前欄位無法預覽，請確認必填標題、完整時間、結束晚於開始與夏令時間選擇。
                </div>
              ))}
            {effectiveActor.role === "club_manager" && (
              <div className="ew-readonly">
                一般管理者可建立及維護草稿。儲存後交由社長／秘書或備援帳號發布；這不會新增另一個審核狀態。
              </div>
            )}
            <footer className="ew-editor-footer">
              <span className="ew-help">
                {dirty ? "有尚未儲存的變更" : "目前無未儲存變更"} ·{" "}
                {editing.id ? `版本 ${editing.version}` : "尚未建立"}
              </span>
              <div className="ew-actions">
                <button
                  type="button"
                  className="ew-button"
                  onClick={() => {
                    if (confirmDiscard()) setEditing(null);
                  }}
                >
                  返回列表
                </button>
                <button type="submit" className="ew-button primary" disabled={terminal}>
                  <Save size={16} />
                  {correcting ? "儲存更正" : "儲存草稿"}
                </button>
              </div>
            </footer>
          </form>
        </div>
      )}
      <dialog ref={correctionDialog} className="ew-dialog" aria-label="確認更正已發布活動">
        <form onSubmit={(event) => {
          event.preventDefault();
          persist();
          correctionDialog.current?.close();
        }}>
          <h3>確認更正已發布活動</h3>
          <p>將更新「{form.title}」的原筆內容，{selectedEvent?.publicWithdrawnAt ? "維持撤下公開曝光，更正不會重新公開。" : "維持已發布，依新的時間與顯示範圍立即呈現。"}請確認地點、時間與活動說明。</p>
          <p className="ew-note">此示範不會發送通知；更正不會建立另一場活動。</p>
          <div className="ew-actions">
            <button type="button" className="ew-button" onClick={() => correctionDialog.current?.close()}>返回編輯</button>
            <button type="submit" className="ew-button primary">確認儲存更正</button>
          </div>
        </form>
      </dialog>
      <p className="ew-note">
        前端互動初版 ·
        不含報名、名額、付款或簽到。正式權限與版本驗證仍須後端實作。
      </p>
    </section>
  );
}
