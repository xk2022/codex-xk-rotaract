import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  CalendarDays,
  ExternalLink,
  MapPin,
  Menu,
  Sparkles,
  X,
} from "lucide-react";
import "./public-home.css";
import {
  PublicCommunity,
  CommunityHighlights,
} from "../phase2/PublicCommunity";
import { BusinessPublic } from "../phase3/BusinessPublic";

export type PublicPage =
  "home" | "map" | "calendar" | "clubs" | "club" | "event" | "business";
type Props = {
  page: PublicPage;
  onNavigate: (page: PublicPage) => void;
  onLogin: () => void;
  onRegister: () => void;
  onAdmin: () => void;
};
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
  const menuToggle = useRef<HTMLButtonElement>(null);
  useEffect(() => { setMenu(false); }, [page]);
  useEffect(() => {
    if (!menu) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setMenu(false);
      menuToggle.current?.focus();
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [menu]);
  const navigate = (value: PublicPage) => {
    onNavigate(value);
    setMenu(false);
  };
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
            ref={menuToggle}
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
            onBlur={(event) => {
              const next = event.relatedTarget;
              if (next instanceof Node && !event.currentTarget.contains(next) && next !== menuToggle.current) setMenu(false);
            }}
          >
            <button
              aria-current={page === "home" ? "page" : undefined}
              onClick={() => navigate("home")}
            >
              首頁
            </button>
            <button
              aria-current={page === "map" || page === "business" ? "page" : undefined}
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
            <button
              aria-current={
                page === "clubs" || page === "club" ? "page" : undefined
              }
              onClick={() => navigate("clubs")}
            >
              探索社團
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
                  <span /> 連結社友，探索你的生活圈
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
                    <small>商家與活動公開瀏覽，會員資料登入後查詢。</small>
                  </p>
                </div>
              </div>
              <div className="ph-hero-art">
                <CommunityArt />
                <span className="ph-art-caption">
                  從一場相遇，開始新的可能 ↗
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
                    <p className="ph-eyebrow">認識商家・參與活動・連結社友</p>
                    <h2 id="ph-discover-title">你的扶青生活，從這裡展開</h2>
                  </div>
                  <p>讓交流走進日常，讓每次相遇都有新的可能。</p>
                </div>
                <div className="ph-entry-grid">
                  <button
                    className="ph-entry ph-entry-map"
                    onClick={() => navigate("map")}
                  >
                    <span className="ph-entry-number">01 / 探索商家</span>
                    <MapPin size={39} strokeWidth={1.4} />
                    <h3>商家地圖</h3>
                    <span className="ph-product-name">Rotaract BizMap</span>
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
                    <span className="ph-entry-number">02 / 扶青資訊</span>
                    <Sparkles size={39} strokeWidth={1.4} />
                    <h3>扶青資訊</h3>
                    <span className="ph-product-name">Rotaract Info</span>
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
                    <span className="ph-entry-number">03 / 參與活動</span>
                    <CalendarDays size={39} strokeWidth={1.4} />
                    <h3>社團行事曆</h3>
                    <span className="ph-product-name">Rotaract Kalendar</span>
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
            <CommunityHighlights />
            <section className="ph-join ph-container">
              <div>
                <p className="ph-eyebrow">加入會員，找到你的社群</p>
                <h2>從認識彼此，到一起做更多。</h2>
                <p>
                  免費建立帳號，申請加入所屬社團；管理者核准後，你的資料才會依隱私設定顯示於會員名冊。
                </p>
              </div>
              <button className="ph-button ph-button-red" onClick={onRegister}>
                建立會員帳號 <ArrowRight size={18} />
              </button>
            </section>
          </>
        ) : page === "map" || page === "business" ? (
          <BusinessPublic page={page} />
        ) : (
          <PublicCommunity page={page} />
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

    </div>
  );
}
