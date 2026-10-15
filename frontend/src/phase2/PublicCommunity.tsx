import { useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Search,
  Users,
  ExternalLink,
  Clock,
} from "lucide-react";
import { useCommunityDemo } from "./store";
import {
  publicProjection,
  publicClubs,
  eventBounds,
  formatEventDate,
  type CommunityEvent,
  type CommunityClub,
} from "./model";
import "./public-community.css";

const go = (kind: "club" | "event", id: string) =>
  `#/${kind}?id=${encodeURIComponent(id)}`;
const safeWeb = (value: string) => {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
};
function ClubCard({ club }: { club: CommunityClub }) {
  return (
    <a className="pc-club-card" href={go("club", club.id)}>
      <div className={`pc-club-art pc-art-${club.id}`} aria-hidden="true">
        <Users size={48} strokeWidth={1.2} />
        <span>CONNECT / {club.city}</span>
      </div>
      <div className="pc-card-body">
        <span className="pc-kicker">
          {club.districtName} · {club.city}
        </span>
        <h3>{club.name}</h3>
        <p>{club.description}</p>
        <span className="pc-card-link">
          認識這個社團 <ArrowRight size={16} />
        </span>
      </div>
    </a>
  );
}
function EventCard({
  event,
  clubs,
}: {
  event: CommunityEvent;
  clubs: CommunityClub[];
}) {
  const club = clubs.find((c) => c.id === event.organizerId);
  const districtName = clubs.find(
    (c) => c.districtId === event.organizerId,
  )?.districtName;
  const start = eventBounds(event).start;
  return (
    <a
      className={`ph-event-card ${event.status === "cancelled" ? "pc-cancelled" : ""}`}
      href={go("event", event.id)}
    >
      <span className="ph-event-date">
        <small>
          {new Intl.DateTimeFormat("zh-TW", {
            month: "numeric",
            timeZone: event.time.timeZone,
          }).format(start)}
        </small>
        <strong>
          {
            new Intl.DateTimeFormat("zh-TW", {
              day: "numeric",
              timeZone: event.time.timeZone,
            })
              .formatToParts(start)
              .find((part) => part.type === "day")?.value
          }
        </strong>
      </span>
      <span>
        <small>
          {club?.city ?? "地區活動"} · 公開活動{" "}
          {event.status === "cancelled" ? "· 已取消" : ""}
        </small>
        <strong>{event.title}</strong>
        <span>{club?.name ?? districtName ?? "地區主辦"}</span>
        <span>{formatEventDate(event)}</span>
      </span>
      <ArrowRight size={16} />
    </a>
  );
}
export function CommunityHighlights() {
  const { clubs, events } = useCommunityDemo();
  const [homeSearch, setHomeSearch] = useState("");
  const visible = publicClubs(clubs).filter((club) =>
    `${club.name} ${club.city} ${club.description}`
      .toLowerCase()
      .includes(homeSearch.toLowerCase().trim()),
  );
  const upcoming = publicProjection(events, clubs)
    .filter(
      (e) =>
        e.status === "published" && eventBounds(e).end.getTime() > Date.now(),
    )
    .sort(
      (a, b) => eventBounds(a).start.getTime() - eventBounds(b).start.getTime(),
    )
    .slice(0, 2);
  return (
    <section className="ph-container pc-highlights">
      <div className="ph-section-heading">
        <div>
          <p className="ph-eyebrow">FIND YOUR PEOPLE</p>
          <h2>每一個社團，都是新的起點。</h2>
        </div>
        <a className="pc-card-link" href="#/clubs">
          探索所有社團 <ArrowRight size={16} />
        </a>
      </div>
      <label className="ph-search pc-home-search">
        <Search size={18} />
        <input
          aria-label="首頁搜尋社團"
          placeholder="搜尋社團名稱或城市，找到你的生活圈"
          value={homeSearch}
          onChange={(e) => setHomeSearch(e.target.value)}
        />
      </label>
      {!visible.length && (
        <div className="ph-empty" role="status">
          <h3>沒有符合條件的公開社團</h3>
          <button className="ph-text-button" onClick={() => setHomeSearch("")}>
            清除搜尋
          </button>
        </div>
      )}
      <div className="pc-club-grid">
        {visible.slice(0, 3).map((club) => (
          <ClubCard key={club.id} club={club} />
        ))}
      </div>
      <div className="pc-home-events">
        <div>
          <p className="ph-eyebrow">SAVE THE DATE</p>
          <h2>把相遇排進日常。</h2>
          <p>從一場公開活動，認識一起行動的人。</p>
          <a className="pc-card-link" href="#/calendar">
            完整行事曆 <ArrowRight size={16} />
          </a>
        </div>
        <div>
          {!upcoming.length && (
            <p className="ph-empty">
              目前尚無即將舉行的公開活動，歡迎查看行事曆中的活動紀錄。
            </p>
          )}
          {upcoming.map((event) => (
            <EventCard key={event.id} event={event} clubs={clubs} />
          ))}
        </div>
      </div>
    </section>
  );
}
export function PublicCommunity({
  page,
}: {
  page: "calendar" | "clubs" | "club" | "event";
}) {
  const { events, clubs } = useCommunityDemo();
  const [keyword, setKeyword] = useState("");
  const [city, setCity] = useState("全部地區");
  const [clubId, setClubId] = useState("");
  const [view, setView] = useState<"calendar" | "list">(() =>
    window.matchMedia("(max-width:560px)").matches ? "list" : "calendar",
  );
  const [offset, setOffset] = useState(0);
  const visibleClubs = publicClubs(clubs);
  const visibleEvents = publicProjection(events, clubs);
  const id = new URLSearchParams(window.location.hash.split("?")[1] ?? "").get(
    "id",
  );
  const club = visibleClubs.find((c) => c.id === id);
  const event = visibleEvents.find((e) => e.id === id);
  const date = new Date(2026, 9 + offset, 1);
  const y = date.getFullYear();
  const m = date.getMonth();
  const monthStart = Date.UTC(y, m, 1) - 8 * 3600000;
  const monthEnd = Date.UTC(y, m + 1, 1) - 8 * 3600000;
  const filtered = visibleEvents
    .filter((e) => {
      const org = clubs.find((c) => c.id === e.organizerId);
      const bounds = eventBounds(e);
      return (
        bounds.start.getTime() < monthEnd &&
        bounds.end.getTime() > monthStart &&
        (!clubId || e.organizerId === clubId) &&
        (city === "全部地區" || org?.city === city) &&
        `${e.title} ${e.description} ${e.location} ${org?.name ?? ""}`
          .toLowerCase()
          .includes(keyword.toLowerCase().trim())
      );
    })
    .sort(
      (a, b) => eventBounds(a).start.getTime() - eventBounds(b).start.getTime(),
    );
  const reset = () => {
    setKeyword("");
    setCity("全部地區");
    setClubId("");
  };
  const missing = (page === "club" && !club) || (page === "event" && !event);
  if (missing)
    return (
      <section className="ph-container pc-notfound">
        <span className="pc-kicker">404 / PUBLIC COMMUNITY</span>
        <h1>找不到這個公開頁面</h1>
        <p>內容可能未公開、已撤下，或連結有誤。</p>
        <a className="ph-button ph-button-red" href="#/clubs">
          探索公開社團 <ArrowRight size={16} />
        </a>
        <a href="#/calendar">查看公開活動</a>
      </section>
    );
  if (page === "club" && club)
    return (
      <section className="ph-container pc-detail">
        <a className="ph-back" href="#/clubs">
          <ChevronLeft size={16} />
          所有社團
        </a>
        <div className="pc-detail-hero">
          <div>
            <p className="ph-eyebrow">
              {club.districtName} / {club.city}
            </p>
            <h1>{club.name}</h1>
            <p className="pc-lead">{club.description}</p>
            <span className="pc-pill">公開社團介紹</span>
          </div>
          <div className={`pc-club-art pc-art-${club.id}`} aria-hidden="true">
            <Users size={85} strokeWidth={1} />
            <span>TOGETHER, WE CONNECT.</span>
          </div>
        </div>
        <div className="pc-detail-layout">
          <section>
            <h2>關於我們</h2>
            <p className="pc-prose">{club.description}</p>
            <h2>社團公開活動</h2>
            {visibleEvents
              .filter((e) => e.organizerId === club.id)
              .sort(
                (a, b) =>
                  eventBounds(a).start.getTime() -
                  eventBounds(b).start.getTime(),
              )
              .map((e) => (
                <EventCard key={e.id} event={e} clubs={clubs} />
              ))}
            {!visibleEvents.some((e) => e.organizerId === club.id) && (
              <p className="ph-empty">目前尚無公開活動，歡迎稍後再回來看看。</p>
            )}
          </section>
          <aside className="pc-facts">
            <h2>社團資訊</h2>
            <dl>
              <dt>所屬地區</dt>
              <dd>{club.districtName}</dd>
              <dt>活動城市</dt>
              <dd>{club.city}</dd>
            </dl>
            <p>社團聯絡方式依公開設定顯示；會員私人資料不在此頁提供。</p>
            <PublicContacts club={club} />
            <a className="pc-card-link" href="#/register">
              註冊後申請加入社團 <ArrowRight size={16} />
            </a>
          </aside>
        </div>
      </section>
    );
  if (page === "event" && event) {
    const organizer = clubs.find((c) => c.id === event.organizerId);
    const districtName = clubs.find(
      (c) => c.districtId === event.organizerId,
    )?.districtName;
    return (
      <section className="ph-container pc-detail">
        <a className="ph-back" href="#/calendar">
          <ChevronLeft size={16} />
          社團行事曆
        </a>
        <div className="pc-event-banner">
          <CalendarDays size={64} strokeWidth={1} />
          <span>MEET. CONNECT. MAKE A DIFFERENCE.</span>
        </div>
        <div className="pc-detail-layout">
          <article>
            <p className="ph-eyebrow">ROTARACT / 公開活動</p>
            <h1>{event.title}</h1>
            {event.status === "cancelled" && (
              <div className="pc-cancel-notice" role="status">
                <strong>此活動已取消</strong>
                <p>
                  取消原因：
                  {event.cancellationReason || "主辦單位已取消本活動。"}
                </p>
              </div>
            )}
            {event.status === "archived" && (
              <p className="pc-pill">活動已封存 · 公開歷史</p>
            )}
            <h2>關於這場活動</h2>
            <p className="pc-prose">{event.description}</p>
            <h2>參與提醒</h2>
            <p>
              此頁提供公開活動資訊。本階段未提供站內報名、簽到或付款，參與方式請以主辦單位公告為準。
            </p>
          </article>
          <aside className="pc-facts">
            <h2>活動資訊</h2>
            <dl>
              <dt>
                <Clock size={16} /> 日期與時間
              </dt>
              <dd>{formatEventDate(event)}</dd>
              <dt>活動時區</dt>
              <dd>{event.time.timeZone}</dd>
              <dt>
                <MapPin size={16} /> 活動地點
              </dt>
              <dd>{event.location}</dd>
              <dt>主辦單位</dt>
              <dd>
                {organizer &&
                visibleClubs.some((c) => c.id === organizer.id) ? (
                  <a href={go("club", organizer.id)}>
                    {organizer.name} <ExternalLink size={13} />
                  </a>
                ) : (
                  (organizer?.name ?? districtName ?? "地區主辦活動")
                )}
              </dd>
            </dl>
            <p>內容為示範資料；時間依活動所設時區顯示。</p>
          </aside>
        </div>
      </section>
    );
  }
  return (
    <section className="ph-directory ph-container">
      <a className="ph-back" href="#/">
        <ChevronLeft size={16} />
        回首頁
      </a>
      <div className="ph-directory-heading">
        <p className="ph-eyebrow">
          {page === "clubs" ? "ROTARACT COMMUNITY" : "COMMUNITY CALENDAR"}
        </p>
        <h1>
          {page === "clubs" ? "找到你的同路人。" : "讓下一場相遇，有個日期。"}
        </h1>
        <p>
          {page === "clubs"
            ? "從城市到社團，認識一起交流、服務與成長的夥伴。"
            : "認識身邊的社團活動，一起參與、交流與行動。"}
        </p>
      </div>
      <div className="ph-event-filters pc-filters">
        <label className="ph-search">
          <Search size={18} />
          <input
            aria-label={page === "clubs" ? "搜尋社團" : "搜尋活動"}
            placeholder={
              page === "clubs"
                ? "搜尋社團名稱、城市或簡介"
                : "搜尋活動名稱、地點或社團"
            }
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
        </label>
        <label className="ph-city-filter">
          {page === "clubs" ? "社團地區" : "活動地區"}
          <select
            aria-label={page === "clubs" ? "社團地區" : "活動地區"}
            value={city}
            onChange={(e) => setCity(e.target.value)}
          >
            {["全部地區", ...new Set(visibleClubs.map((c) => c.city))].map(
              (c) => (
                <option key={c}>{c}</option>
              ),
            )}
          </select>
        </label>
        {page === "calendar" && (
          <>
            <label className="ph-city-filter">
              主辦社團
              <select
                aria-label="主辦社團"
                value={clubId}
                onChange={(e) => setClubId(e.target.value)}
              >
                <option value="">全部社團</option>
                {visibleClubs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        <button className="ph-clear-filter" onClick={reset}>
          清除{page === "clubs" ? "社團" : "活動"}篩選
        </button>
      </div>
      {page === "clubs" ? (
        <>
          <p role="status">
            找到{" "}
            {
              visibleClubs.filter(
                (c) =>
                  (city === "全部地區" || c.city === city) &&
                  `${c.name} ${c.city} ${c.description}`
                    .toLowerCase()
                    .includes(keyword.toLowerCase().trim()),
              ).length
            }{" "}
            個公開社團
          </p>
          <div className="pc-club-grid">
            {visibleClubs
              .filter(
                (c) =>
                  (city === "全部地區" || c.city === city) &&
                  `${c.name} ${c.city} ${c.description}`
                    .toLowerCase()
                    .includes(keyword.toLowerCase().trim()),
              )
              .map((c) => (
                <ClubCard key={c.id} club={c} />
              ))}
          </div>
          {!visibleClubs.some(
            (c) =>
              (city === "全部地區" || c.city === city) &&
              `${c.name} ${c.city} ${c.description}`
                .toLowerCase()
                .includes(keyword.toLowerCase().trim()),
          ) && (
            <div className="ph-empty">
              <Users size={32} />
              <h2>沒有符合條件的社團</h2>
              <p>試試其他關鍵字或地區。</p>
              <button className="ph-text-button" onClick={reset}>
                查看全部社團
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="ph-calendar-toolbar">
            <div className="ph-calendar-controls">
              <button
                aria-label="上一個月"
                onClick={() => setOffset(offset - 1)}
              >
                <ChevronLeft size={19} />
              </button>
              <h2>
                {y} 年 {m + 1} 月
              </h2>
              <button
                aria-label="下一個月"
                onClick={() => setOffset(offset + 1)}
              >
                <ChevronRight size={19} />
              </button>
            </div>
            <button className="ph-text-button" onClick={() => setOffset(0)}>
              回到示範月份
            </button>
            <span role="status" aria-live="polite">
              公開活動 · {filtered.length} 場
            </span>
            <div
              className="ph-view-switch"
              role="group"
              aria-label="活動顯示方式"
            >
              <button
                aria-pressed={view === "calendar"}
                onClick={() => setView("calendar")}
              >
                月曆
              </button>
              <button
                aria-pressed={view === "list"}
                onClick={() => setView("list")}
              >
                活動列表
              </button>
            </div>
          </div>
          <p className="pc-time-note">
            月曆以 Asia/Taipei
            顯示日期，詳情保留活動原設時區。含跨日活動與公開取消紀錄。
          </p>
          <div className={`ph-calendar-layout ph-calendar-view-${view}`}>
            <div className="ph-calendar-grid" hidden={view === "list"}>
              {["日", "一", "二", "三", "四", "五", "六"].map((d) => (
                <div className="ph-weekday" key={d}>
                  {d}
                </div>
              ))}
              {Array.from({ length: date.getDay() }, (_, i) => (
                <div className="ph-day ph-day-empty" key={"blank" + i} />
              ))}
              {Array.from(
                { length: new Date(y, m + 1, 0).getDate() },
                (_, i) => {
                  const day = i + 1;
                  const start = Date.UTC(y, m, day) - 8 * 3600000;
                  const daily = filtered.filter((e) => {
                    const b = eventBounds(e);
                    return (
                      b.start.getTime() < start + 86400000 &&
                      b.end.getTime() > start
                    );
                  });
                  return (
                    <div
                      className={`ph-day ${daily.length ? "has-event" : ""}`}
                      key={day}
                    >
                      <span>{day}</span>
                      {daily.map((e) => (
                        <a
                          className={
                            e.status === "cancelled" ? "pc-cancelled" : ""
                          }
                          key={e.id}
                          href={go("event", e.id)}
                          aria-label={`${m + 1}月${day}日 ${e.title}`}
                        >
                          <span>
                            {e.status === "cancelled" ? "已取消" : "公開活動"}
                          </span>
                          <span>{e.title}</span>
                        </a>
                      ))}
                    </div>
                  );
                },
              )}
            </div>
            <div className="ph-event-list">
              <h3>這個月，一起參與</h3>
              {filtered.map((e) => (
                <EventCard key={e.id} event={e} clubs={clubs} />
              ))}
              {!filtered.length && (
                <div className="ph-empty">
                  <CalendarDays size={30} />
                  <h3>
                    {offset === 0 ? "沒有符合篩選的活動" : "這個月尚無示範活動"}
                  </h3>
                  <p>調整篩選，或回到 2026 年 10 月查看示範活動。</p>
                  <button
                    className="ph-text-button"
                    onClick={() => {
                      reset();
                      setOffset(0);
                    }}
                  >
                    查看全部示範活動 <ArrowRight size={14} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
function PublicContacts({ club }: { club: CommunityClub }) {
  const flags = club;
  const website = flags.websitePublic ? safeWeb(club.website) : undefined;
  return (
    <>
      {flags.emailPublic &&
        club.email &&
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(club.email) && (
          <p>
            <a href={`mailto:${club.email}`}>{club.email}</a>
          </p>
        )}
      {website && (
        <p>
          <a href={website} target="_blank" rel="noopener noreferrer">
            社團官方網站 <ExternalLink size={14} />
          </a>
        </p>
      )}
    </>
  );
}
