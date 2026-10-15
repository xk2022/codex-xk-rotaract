import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Coffee,
  ExternalLink,
  MapPin,
  Menu,
  Search,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import "./public-home.css";

export type PublicPage = "home" | "map" | "calendar";
type Props = {
  page: PublicPage;
  onNavigate: (page: PublicPage) => void;
  onLogin: () => void;
  onRegister: () => void;
  onAdmin: () => void;
};
const businesses = [
  {
    id: "coffee",
    name: "日常之間咖啡",
    callName: "Sunny",
    club: "台北示範扶青社",
    category: "餐飲咖啡",
    city: "台北",
    phone: "02-0000-0101",
    description:
      "一杯咖啡的時間，讓新的交流自然發生。提供手沖咖啡、輕食與小型聚會空間。",
    x: 69,
    y: 25,
  },
  {
    id: "studio",
    name: "向光設計工作室",
    callName: "Alex",
    club: "台中示範扶青社",
    category: "專業服務",
    city: "台中",
    phone: "04-0000-0202",
    description: "從品牌識別到日常設計，陪伴在地品牌找到自己的樣貌。",
    x: 46,
    y: 49,
  },
  {
    id: "travel",
    name: "南方慢旅",
    callName: "Jo",
    club: "高雄示範扶青社",
    category: "生活旅遊",
    city: "高雄",
    phone: "07-0000-0303",
    description: "用步行認識一座城市，探索巷弄裡的故事與人情。",
    x: 31,
    y: 76,
  },
];
const events = [
  {
    day: 18,
    month: "10",
    title: "城市散步・一起認識在地",
    club: "台北示範扶青社",
    city: "台北",
    type: "交流",
    time: "10:00–12:00",
    description: "一場開放的城市散步，透過街區觀察與分享，遇見不同的生活視角。",
  },
  {
    day: 24,
    month: "10",
    title: "週末淨灘・為海洋留白",
    club: "台中示範扶青社",
    city: "台中",
    type: "服務",
    time: "09:00–11:30",
    description: "邀請大家一起走向海邊，用簡單的行動照顧我們生活的環境。",
  },
  {
    day: 31,
    month: "10",
    title: "青年的下一站・職涯分享",
    club: "高雄示範扶青社",
    city: "高雄",
    type: "成長",
    time: "14:00–16:00",
    description: "來自不同領域的青年分享工作與生活的選擇，讓交流成為新的靈感。",
  },
];
function CommunityArt() {
  return (
    <svg
      className="ph-illustration"
      viewBox="0 0 560 440"
      role="img"
      aria-label="青年在城市中連結、交流與探索的插畫"
    >
      <defs>
        <pattern
          id="ph-grid"
          width="30"
          height="30"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M 30 0 L 0 0 0 30"
            fill="none"
            stroke="#dbcfc1"
            strokeWidth=".6"
          />
        </pattern>
      </defs>
      <circle cx="290" cy="225" r="194" fill="#ede4d6" />
      <circle cx="290" cy="225" r="194" fill="url(#ph-grid)" />
      <path
        d="M75 340C163 296 157 193 273 213S362 323 492 238"
        fill="none"
        stroke="#c8102e"
        strokeWidth="3"
        strokeDasharray="7 9"
      />
      <path d="M77 357L493 357" stroke="#493c35" strokeWidth="2" />
      <rect
        x="116"
        y="236"
        width="105"
        height="121"
        rx="5"
        fill="#fffaf2"
        stroke="#493c35"
        strokeWidth="2"
      />
      <path d="M105 236L168 197L232 236Z" fill="#c8102e" />
      <rect x="132" y="254" width="23" height="29" rx="2" fill="#e4c8a6" />
      <rect x="179" y="254" width="23" height="29" rx="2" fill="#e4c8a6" />
      <rect x="153" y="307" width="34" height="50" rx="15" fill="#493c35" />
      <rect
        x="352"
        y="178"
        width="91"
        height="179"
        rx="5"
        fill="#d8b48c"
        stroke="#493c35"
        strokeWidth="2"
      />
      {[196, 231, 266].map((y) => (
        <g key={y}>
          <rect x="369" y={y} width="17" height="18" fill="#fffaf2" />
          <rect x="409" y={y} width="17" height="18" fill="#fffaf2" />
        </g>
      ))}
      <rect x="380" y="314" width="36" height="43" fill="#493c35" />
      <circle cx="278" cy="231" r="21" fill="#c38d68" />
      <path
        d="M256 227Q254 195 280 204Q300 202 301 226L290 219L279 223L265 217Z"
        fill="#493c35"
      />
      <path d="M255 261Q278 250 299 263L313 315H242Z" fill="#c8102e" />
      <path
        d="M256 314L251 357M288 314L301 357"
        stroke="#493c35"
        strokeWidth="13"
        strokeLinecap="round"
      />
      <path
        d="M254 269L229 294M297 270L327 248"
        stroke="#c38d68"
        strokeWidth="11"
        strokeLinecap="round"
      />
      <rect
        x="323"
        y="225"
        width="21"
        height="28"
        rx="3"
        fill="#fffaf2"
        stroke="#493c35"
        strokeWidth="2"
        transform="rotate(14 323 225)"
      />
      <g transform="translate(211 100)">
        <rect
          width="139"
          height="54"
          rx="27"
          fill="#fffaf2"
          stroke="#493c35"
          strokeWidth="1.5"
        />
        <text
          x="69"
          y="34"
          textAnchor="middle"
          fontSize="20"
          fontWeight="700"
          fill="#c8102e"
        >
          Hello, Rotaract!
        </text>
      </g>
      <g transform="translate(72 151)">
        <circle r="30" fill="#c8102e" />
        <path
          d="M-10-5A10 10 0 1 1 10-5C10 3 0 15 0 15S-10 3-10-5"
          fill="none"
          stroke="white"
          strokeWidth="2"
        />
        <circle cy="-5" r="3" fill="white" />
      </g>
      <g transform="translate(469 123) rotate(12)">
        <rect
          x="-26"
          y="-26"
          width="52"
          height="52"
          rx="12"
          fill="#fffaf2"
          stroke="#493c35"
          strokeWidth="1.5"
        />
        <path
          d="M-14-9H14M-14 1H14M-14 11H4M-7-18V-10M7-18V-10"
          stroke="#c8102e"
          strokeWidth="3"
        />
      </g>
      <path
        d="M457 357V307M457 331Q426 330 433 307Q459 309 457 331M458 318Q481 318 480 295Q455 297 458 318"
        fill="#76937c"
        stroke="#493c35"
        strokeWidth="2"
      />
      <path
        d="M117 99L124 115L141 121L124 127L117 144L111 127L94 121L111 115Z"
        fill="#c8102e"
      />
    </svg>
  );
}
export function PublicHome({
  page,
  onNavigate,
  onLogin,
  onRegister,
  onAdmin,
}: Props) {
  const [menu, setMenu] = useState(false);
  const [city, setCity] = useState("全部地區");
  const [query, setQuery] = useState("");
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [eventIndex, setEventIndex] = useState<number | null>(null);
  const [monthOffset, setMonthOffset] = useState(0);
  const detailTrigger = useRef<HTMLElement | null>(null);
  const hasDetail = businessId !== null || eventIndex !== null;
  useEffect(() => {
    setBusinessId(null);
    setEventIndex(null);
    setMenu(false);
  }, [page]);
  useEffect(() => {
    if (!hasDetail) return;
    const trigger = detailTrigger.current;
    return () => {
      if (trigger?.isConnected) trigger.focus();
    };
  }, [hasDetail]);
  const openBusiness = (id: string) => {
    detailTrigger.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setBusinessId(id);
  };
  const openEvent = (index: number) => {
    detailTrigger.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setEventIndex(index);
  };
  const navigate = (value: PublicPage) => {
    onNavigate(value);
    setMenu(false);
    setBusinessId(null);
    setEventIndex(null);
  };
  const filtered = businesses.filter(
    (b) =>
      (city === "全部地區" || b.city === city) &&
      `${b.name}${b.callName}${b.club}${b.category}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const selectedBusiness = businesses.find((b) => b.id === businessId);
  const selectedEvent = eventIndex === null ? null : events[eventIndex];
  const monthDate = new Date(2026, 9 + monthOffset, 1);
  const daysInMonth = new Date(
    monthDate.getFullYear(),
    monthDate.getMonth() + 1,
    0,
  ).getDate();
  const monthEvents = monthOffset === 0 ? events : [];
  return (
    <div className="ph-site">
      <a
        className="skip-link"
        href="#public-main"
        onClick={(e) => {
          e.preventDefault();
          const main = document.getElementById("public-main");
          main?.focus();
          main?.scrollIntoView();
        }}
      >
        跳至主要內容
      </a>
      <header className="ph-header">
        <div className="ph-container ph-header-inner">
          <button
            className="ph-brand"
            onClick={() => navigate("home")}
            aria-label="Rotaract 萬花筒首頁"
          >
            <span className="ph-brand-word">
              Rotaract<span>萬花筒</span>
            </span>
            <span className="ph-brand-divider" />
            <span className="ph-brand-small">
              CONNECT.
              <br />
              MAKE A DIFFERENCE.
            </span>
          </button>
          <button
            className="ph-menu-toggle"
            onClick={() => setMenu(!menu)}
            aria-expanded={menu}
            aria-controls="ph-navigation"
            aria-label={menu ? "關閉導覽選單" : "開啟導覽選單"}
          >
            {menu ? <X /> : <Menu />}
          </button>
          <nav
            id="ph-navigation"
            className={`ph-nav ${menu ? "is-open" : ""}`}
            aria-label="公開網站導覽"
          >
            <button
              aria-current={page === "home" ? "page" : undefined}
              onClick={() => navigate("home")}
            >
              首頁
            </button>
            <button
              aria-current={page === "map" ? "page" : undefined}
              onClick={() => navigate("map")}
            >
              商家地圖
            </button>
            <button
              aria-current={page === "calendar" ? "page" : undefined}
              onClick={() => navigate("calendar")}
            >
              社團行事曆
            </button>
            <a
              href="https://www.instagram.com/mdiorit/"
              target="_blank"
              rel="noopener noreferrer"
            >
              扶青資訊 <ExternalLink size={13} />
            </a>
            <span className="ph-nav-separator" />
            <button onClick={onLogin}>會員登入</button>
            <button className="ph-button ph-button-dark" onClick={onRegister}>
              加入生活圈 <ArrowRight size={15} />
            </button>
          </nav>
        </div>
      </header>
      <main id="public-main" tabIndex={-1}>
        {page === "home" ? (
          <>
            <section className="ph-hero ph-container">
              <div className="ph-hero-copy">
                <p className="ph-eyebrow">
                  <span /> TOGETHER, WE CREATE MORE.
                </p>
                <h1>
                  玩轉你的
                  <br />
                  <em>扶青年代</em>
                  <span className="ph-title-dot">。</span>
                </h1>
                <p className="ph-hero-description">
                  把志同道合的人，連成生活的無限可能。
                  <br />
                  從一間好店、一場活動開始，
                  <br className="ph-mobile-break" />
                  探索屬於你的扶青生活圈。
                </p>
                <div className="ph-hero-actions">
                  <button
                    className="ph-button ph-button-red"
                    onClick={() => navigate("map")}
                  >
                    探索商家地圖 <ArrowRight size={18} />
                  </button>
                  <button
                    className="ph-text-button"
                    onClick={() => navigate("calendar")}
                  >
                    看看近期活動 <ArrowDown size={16} />
                  </button>
                </div>
                <div className="ph-hero-note">
                  <span className="ph-mini-avatars">
                    <i>S</i>
                    <i>A</i>
                    <i>J</i>
                  </span>
                  <p>
                    因為連結，讓生活更有意思。
                    <br />
                    <small>CONNECT PEOPLE. EXPLORE POSSIBILITIES.</small>
                  </p>
                </div>
              </div>
              <div className="ph-hero-art">
                <CommunityArt />
                <span className="ph-art-caption">
                  YOUR NEXT CONNECTION STARTS HERE ↗
                </span>
              </div>
            </section>
            <section
              className="ph-discover"
              aria-labelledby="ph-discover-title"
            >
              <div className="ph-container">
                <div className="ph-section-heading">
                  <div>
                    <p className="ph-eyebrow">EXPLORE THE COMMUNITY</p>
                    <h2 id="ph-discover-title">你的扶青生活，從這裡展開</h2>
                  </div>
                  <p>讓交流走進日常，讓每次相遇都有新的可能。</p>
                </div>
                <div className="ph-entry-grid">
                  <button
                    className="ph-entry ph-entry-map"
                    onClick={() => navigate("map")}
                  >
                    <span className="ph-entry-number">01 / DISCOVER</span>
                    <MapPin size={39} strokeWidth={1.4} />
                    <h3>Rotaract BizMap</h3>
                    <p>
                      找到身邊的扶青好店，
                      <br />
                      讓每次消費多一份連結。
                    </p>
                    <span className="ph-entry-link">
                      探索商家地圖 <ArrowRight size={18} />
                    </span>
                  </button>
                  <a
                    className="ph-entry ph-entry-info"
                    href="https://www.instagram.com/mdiorit/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span className="ph-entry-number">02 / CONNECT</span>
                    <Sparkles size={39} strokeWidth={1.4} />
                    <h3>Rotaract Info</h3>
                    <p>
                      發現扶青的新鮮事，
                      <br />
                      接住每一個值得分享的時刻。
                    </p>
                    <span className="ph-entry-link">
                      前往扶青資訊 <ExternalLink size={17} />
                    </span>
                  </a>
                  <button
                    className="ph-entry ph-entry-calendar"
                    onClick={() => navigate("calendar")}
                  >
                    <span className="ph-entry-number">03 / EXPERIENCE</span>
                    <CalendarDays size={39} strokeWidth={1.4} />
                    <h3>Rotaract Kalendar</h3>
                    <p>
                      把期待的活動放進行事曆，
                      <br />
                      下一場相遇，就在不遠處。
                    </p>
                    <span className="ph-entry-link">
                      查看社團行事曆 <ArrowRight size={18} />
                    </span>
                  </button>
                </div>
              </div>
            </section>
            <section className="ph-join ph-container">
              <div>
                <p className="ph-eyebrow">
                  A LITTLE CONNECTION. A BIG POSSIBILITY.
                </p>
                <h2>從認識彼此，到一起做更多。</h2>
                <p>加入會員，連結社友，開啟你的扶青生活新篇章。</p>
              </div>
              <button className="ph-button ph-button-red" onClick={onRegister}>
                建立會員帳號 <ArrowRight size={18} />
              </button>
            </section>
          </>
        ) : (
          <section className="ph-directory ph-container">
            <button className="ph-back" onClick={() => navigate("home")}>
              <ChevronLeft size={16} /> 回首頁
            </button>
            <div className="ph-directory-heading">
              <p className="ph-eyebrow">
                {page === "map" ? "ROTARACT BIZMAP" : "ROTARACT KALENDAR"}
              </p>
              <h1>
                {page === "map"
                  ? "相遇，從一間好店開始。"
                  : "讓下一場相遇，有個日期。"}
              </h1>
              <p>
                {page === "map"
                  ? "探索社友的品牌與專業，把連結帶進日常生活。"
                  : "認識身邊的社團活動，一起參與、交流與行動。"}
              </p>
            </div>
            {page === "map" ? (
              <>
                <div className="ph-filters">
                  <label className="ph-search">
                    <Search size={18} />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="搜尋商家、Call Name 或社團"
                      aria-label="搜尋商家"
                    />
                  </label>
                  <label className="ph-city-filter">
                    地區
                    <select
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                    >
                      {["全部地區", "台北", "台中", "高雄"].map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </label>
                  <span>{filtered.length} 間示範商家</span>
                </div>
                <div className="ph-map-layout">
                  <div
                    className="ph-map-canvas"
                    aria-label="商家分布示意圖，非真實定位"
                  >
                    <svg viewBox="0 0 620 490" aria-hidden="true">
                      <rect width="620" height="490" fill="#e5eadf" />
                      <path
                        d="M0 116C154 29 141 260 304 198S421 360 620 278M-20 380C107 223 249 460 417 394S568 418 640 355"
                        fill="none"
                        stroke="#cfdbc5"
                        strokeWidth="72"
                      />
                      <path
                        d="M-20 150L650 380M144-30L299 520M-20 379L631 78M446-20L385 510"
                        stroke="#faf8ef"
                        strokeWidth="22"
                      />
                      <path
                        d="M-20 150L650 380M144-30L299 520M-20 379L631 78M446-20L385 510"
                        stroke="#d3c9b9"
                        strokeWidth="1.5"
                      />
                      <path
                        d="M520-10Q359 159 510 316T550 510"
                        stroke="#b8d2da"
                        strokeWidth="40"
                        fill="none"
                      />
                    </svg>
                    {filtered.map((b) => (
                      <button
                        key={b.id}
                        className={`ph-map-pin ${businessId === b.id ? "is-selected" : ""}`}
                        style={{ left: `${b.x}%`, top: `${b.y}%` }}
                        onClick={() => openBusiness(b.id)}
                        aria-label={`查看${b.name}`}
                      >
                        <MapPin size={23} fill="currentColor" />
                        <span>{b.name}</span>
                      </button>
                    ))}
                    <span className="ph-map-disclaimer">
                      商家分布示意・非真實定位
                    </span>
                  </div>
                  <div className="ph-business-list">
                    {filtered.length === 0 ? (
                      <div className="ph-empty">
                        <Search size={30} />
                        <h3>沒有符合的商家</h3>
                        <p>試試其他關鍵字或地區。</p>
                        <button
                          className="ph-text-button"
                          onClick={() => {
                            setQuery("");
                            setCity("全部地區");
                          }}
                        >
                          清除篩選
                        </button>
                      </div>
                    ) : (
                      filtered.map((b) => (
                        <button
                          className={`ph-business-card ${businessId === b.id ? "is-selected" : ""}`}
                          key={b.id}
                          onClick={() => openBusiness(b.id)}
                        >
                          <span
                            className={`ph-business-art ph-business-art-${b.id}`}
                          >
                            <Coffee size={32} strokeWidth={1.2} />
                            <small>{b.category}</small>
                          </span>
                          <span className="ph-business-content">
                            <small>
                              {b.city} · {b.category}
                            </small>
                            <strong>{b.name}</strong>
                            <span>
                              {b.callName} ｜ {b.club}
                            </span>
                            <span className="ph-business-more">
                              查看商家 <ArrowRight size={14} />
                            </span>
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
                <p className="ph-member-prompt">
                  <Users size={17} /> 想認識更多社友？
                  <button onClick={onLogin}>
                    登入後查詢會員資料 <ArrowRight size={14} />
                  </button>
                </p>
              </>
            ) : (
              <>
                <div className="ph-calendar-toolbar">
                  <div className="ph-calendar-controls">
                    <button
                      aria-label="上一個月"
                      onClick={() => setMonthOffset(monthOffset - 1)}
                    >
                      <ChevronLeft size={19} />
                    </button>
                    <h2>
                      {monthDate.getFullYear()} 年 {monthDate.getMonth() + 1} 月
                    </h2>
                    <button
                      aria-label="下一個月"
                      onClick={() => setMonthOffset(monthOffset + 1)}
                    >
                      <ChevronRight size={19} />
                    </button>
                  </div>
                  <button
                    className="ph-text-button"
                    onClick={() => setMonthOffset(0)}
                  >
                    回到示範月份
                  </button>
                  <span>公開活動 · {monthEvents.length} 場</span>
                </div>
                <div className="ph-calendar-layout">
                  <div className="ph-calendar-grid">
                    {["日", "一", "二", "三", "四", "五", "六"].map((d) => (
                      <div className="ph-weekday" key={d}>
                        {d}
                      </div>
                    ))}
                    {Array.from({ length: monthDate.getDay() }, (_, i) => (
                      <div className="ph-day ph-day-empty" key={`empty-${i}`} />
                    ))}
                    {Array.from({ length: daysInMonth }, (_, i) => {
                      const day = i + 1;
                      const event = monthEvents.find((e) => e.day === day);
                      return (
                        <div
                          key={day}
                          className={`ph-day ${event ? "has-event" : ""}`}
                        >
                          <span>{day}</span>
                          {event && (
                            <button
                              onClick={() => openEvent(events.indexOf(event))}
                              aria-label={`10月${day}日 ${event.title}`}
                            >
                              <span>{event.type}</span>
                              <span>{event.title}</span>
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="ph-event-list">
                    <h3>這個月，一起參與</h3>
                    {monthEvents.length ? (
                      monthEvents.map((event) => (
                        <button
                          className="ph-event-card"
                          key={event.day}
                          onClick={() => openEvent(events.indexOf(event))}
                        >
                          <span className="ph-event-date">
                            <small>OCT</small>
                            <strong>{event.day}</strong>
                          </span>
                          <span>
                            <small>
                              {event.city} · {event.type}
                            </small>
                            <strong>{event.title}</strong>
                            <span>{event.club}</span>
                            <span>{event.time}</span>
                          </span>
                          <ArrowRight size={16} />
                        </button>
                      ))
                    ) : (
                      <div className="ph-empty">
                        <CalendarDays size={30} />
                        <h3>這個月尚無示範活動</h3>
                        <p>可回到 2026 年 10 月查看活動預覽。</p>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </section>
        )}
      </main>
      <footer className="ph-footer">
        <div className="ph-container ph-footer-main">
          <div>
            <button
              className="ph-footer-brand"
              onClick={() => navigate("home")}
            >
              Rotaract<span>萬花筒</span>
            </button>
            <p>連結每一份熱情，創造生活的更多可能。</p>
          </div>
          <div className="ph-footer-links">
            <button onClick={onLogin}>會員登入</button>
            <button onClick={onRegister}>註冊會員</button>
            <button onClick={onAdmin}>
              管理後台 <ArrowRight size={13} />
            </button>
          </div>
        </div>
        <div className="ph-container ph-footer-bottom">
          <span>© 2026 Rotaract 扶青生活圈</span>
          <span>畫面預覽・內容為示範資料</span>
        </div>
      </footer>
      {(selectedBusiness || selectedEvent) && (
        <div
          className="ph-modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setBusinessId(null);
              setEventIndex(null);
            }
          }}
        >
          <div
            className="ph-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ph-detail-title"
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setBusinessId(null);
                setEventIndex(null);
              }
              if (e.key === "Tab") {
                const controls =
                  e.currentTarget.querySelectorAll<HTMLButtonElement>("button");
                const first = controls[0];
                const last = controls[controls.length - 1];
                if (e.shiftKey && document.activeElement === first) {
                  e.preventDefault();
                  last?.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                  e.preventDefault();
                  first?.focus();
                }
              }
            }}
          >
            <button
              className="ph-modal-close"
              autoFocus
              aria-label="關閉詳情"
              onClick={() => {
                setBusinessId(null);
                setEventIndex(null);
              }}
            >
              <X size={20} />
            </button>
            {selectedBusiness ? (
              <>
                <p className="ph-eyebrow">
                  {selectedBusiness.city} / {selectedBusiness.category}
                </p>
                <h2 id="ph-detail-title">{selectedBusiness.name}</h2>
                <p>{selectedBusiness.description}</p>
                <dl>
                  <div>
                    <dt>Call Name</dt>
                    <dd>{selectedBusiness.callName}</dd>
                  </div>
                  <div>
                    <dt>所屬社團</dt>
                    <dd>{selectedBusiness.club}</dd>
                  </div>
                  <div>
                    <dt>公司聯絡電話</dt>
                    <dd>{selectedBusiness.phone}（示範）</dd>
                  </div>
                </dl>
              </>
            ) : (
              selectedEvent && (
                <>
                  <p className="ph-eyebrow">
                    2026 / 10 / {selectedEvent.day} · {selectedEvent.type}
                  </p>
                  <h2 id="ph-detail-title">{selectedEvent.title}</h2>
                  <p>{selectedEvent.description}</p>
                  <dl>
                    <div>
                      <dt>主辦社團</dt>
                      <dd>{selectedEvent.club}</dd>
                    </div>
                    <div>
                      <dt>活動地區</dt>
                      <dd>{selectedEvent.city}</dd>
                    </div>
                    <div>
                      <dt>活動時間</dt>
                      <dd>{selectedEvent.time}</dd>
                    </div>
                  </dl>
                  <p className="ph-modal-note">
                    此為公開活動示範，尚未開放活動報名。
                  </p>
                </>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
