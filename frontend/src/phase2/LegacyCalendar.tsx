import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays, ArrowRight, MapPin } from 'lucide-react';
import { useCommunityDemo } from './store';
import { eventBounds, formatEventDate, publicProjection, searchEvents } from './model';
import './legacy-calendar.css';

const isoDay = (date: Date) => date.toISOString().slice(0, 10);
const localToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const dateAt = (day: string) => new Date(`${day}T00:00:00Z`);
const shiftDay = (day: string, amount: number) => { const date = dateAt(day); date.setUTCDate(date.getUTCDate() + amount); return isoDay(date); };
const dayLabel = (day: string) => new Intl.DateTimeFormat('zh-TW', { timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }).format(dateAt(day));
const shiftMonth = (day: string, amount: number) => {
    const date = dateAt(day), originalDay = date.getUTCDate();
    date.setUTCDate(1); date.setUTCMonth(date.getUTCMonth() + amount);
    const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
    date.setUTCDate(Math.min(originalDay, last)); return isoDay(date);
};
const scenario = () => new URLSearchParams(window.location.hash.split('?')[1] ?? window.location.search).get('calendarState');

const savedQuery = () => {
    try {
        const value = JSON.parse(sessionStorage.getItem('public-calendar-query') ?? '{}');
        return value && typeof value === 'object' ? value : {};
    } catch { return {}; }
};
const savedString = (key: string, fallback = '') => {
    const value = savedQuery()[key];
    return typeof value === 'string' ? value : fallback;
};

/** Public-only React replacement for the legacy district / Rotary year / club calendar. */
export function LegacyCalendar() {
    const { clubs, events } = useCommunityDemo();
    const today = localToday();
    const [selectedDay, setSelectedDay] = useState(() => { const saved = savedString('selectedDay', today); return /^\d{4}-\d{2}-\d{2}$/.test(saved) && !Number.isNaN(Date.parse(saved)) && isoDay(dateAt(saved)) === saved ? saved : today; });
    const [view, setView] = useState<'calendar' | 'list'>(() => savedString('view') === 'list' ? 'list' : 'calendar');
    const [districtId, setDistrictId] = useState(() => savedString('districtId'));
    const [clubId, setClubId] = useState(() => savedString('clubId'));
    const [keyword, setKeyword] = useState(() => savedString('keyword'));
    const [loadState, setLoadState] = useState<'ready' | 'loading' | 'error'>(() => scenario() === 'error' ? 'error' : scenario() === 'loading' ? 'loading' : 'ready');
    useEffect(() => {
        try { sessionStorage.setItem('public-calendar-query', JSON.stringify({ selectedDay, districtId, clubId, keyword, view })); } catch { /* Storage may be unavailable; browsing still works. */ }
    }, [selectedDay, districtId, clubId, keyword, view]);
    const dateButtons = useRef(new Map<string, HTMLButtonElement>());
    const focusDay = useRef<string | null>(null);
    const retriedLoad = useRef(false);
    const loadedHeading = useRef<HTMLHeadingElement>(null);
    useEffect(() => {
        if (loadState !== 'loading') return;
        const timer = window.setTimeout(() => setLoadState('ready'), 700);
        return () => window.clearTimeout(timer);
    }, [loadState]);
    useEffect(() => {
        if (focusDay.current) { dateButtons.current.get(focusDay.current)?.focus(); focusDay.current = null; }
    }, [selectedDay]);
    useEffect(() => {
        if (loadState === 'ready' && retriedLoad.current) {
            loadedHeading.current?.focus();
            retriedLoad.current = false;
        }
    }, [loadState]);
    const districts = [...new Map(clubs.map(club => [club.districtId, club.districtName])).entries()].sort(([a], [b]) => a.localeCompare(b));
    // Historical clubs remain selectable only when they have a publicly visible record.
    const visible = useMemo(() => publicProjection(events, clubs), [events, clubs]);
    const eligibleClubs = clubs.filter(club => club.enabled && club.public || visible.some(event => event.organizerType === 'club' && event.organizerId === club.id));
    const availableClubs = eligibleClubs.filter(club => !districtId || club.districtId === districtId);
    const matches = useMemo(() => searchEvents(visible, { districtId, clubId, keyword }, clubs), [visible, districtId, clubId, keyword, clubs]);
    const month = selectedDay.slice(0, 7), first = `${month}-01`, firstDate = dateAt(first);
    const year = firstDate.getUTCFullYear(), monthIndex = firstDate.getUTCMonth();
    const rotaryYear = monthIndex >= 6 ? year : year - 1;
    const monthEnd = isoDay(new Date(Date.UTC(year, monthIndex + 1, 1)));
    const dayCount = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
    const indexed = useMemo(() => matches.map(event => ({ event, ...eventBounds(event) })), [matches]);
    const onDay = (day: string) => {
        const from = Date.parse(`${day}T00:00:00+08:00`), to = from + 86400000;
        return indexed.filter(event => event.start.getTime() < to && event.end.getTime() > from).map(item => item.event);
    };
    const dayEvents = onDay(selectedDay);
    const monthEvents = indexed.filter(event => event.start.getTime() < Date.parse(`${monthEnd}T00:00:00+08:00`) && event.end.getTime() > Date.parse(`${first}T00:00:00+08:00`));
    const displayedEvents = view === 'list' ? monthEvents.map(item => item.event) : dayEvents;
    function keyboardDay(event: KeyboardEvent<HTMLButtonElement>, day: string) {
        const weekday = dateAt(day).getUTCDay();
        const next = event.key === 'ArrowLeft' ? shiftDay(day, -1) : event.key === 'ArrowRight' ? shiftDay(day, 1) : event.key === 'ArrowUp' ? shiftDay(day, -7) : event.key === 'ArrowDown' ? shiftDay(day, 7) : event.key === 'Home' ? shiftDay(day, -weekday) : event.key === 'End' ? shiftDay(day, 6 - weekday) : event.key === 'PageUp' ? shiftMonth(day, -1) : event.key === 'PageDown' ? shiftMonth(day, 1) : null;
        if (next) { event.preventDefault(); focusDay.current = next; setSelectedDay(next); }
    }
    function resetFilters() { setDistrictId(''); setClubId(''); setKeyword(''); }
    return <section className="lc-calendar" aria-label="公開行事曆">
        <header className="lc-intro"><div><p className="lc-eyebrow">MEET. CONNECT. SERVE.</p><h1>把相遇，排進日常。</h1><p>選擇地區與社團，探索每一天的扶青活動。</p></div><CalendarDays size={52} strokeWidth={1} aria-hidden="true" /></header>
        <div className="lc-toolbar">
            <label>扶輪地區<select aria-label="扶輪地區" value={districtId} onChange={event => { setDistrictId(event.target.value); setClubId(''); }}><option value="">全部地區</option>{districts.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
            <label className="lc-search">搜尋公開活動<input type="search" placeholder="活動名稱、地點或社團" value={keyword} onChange={event => setKeyword(event.target.value)} /></label>
            <button type="button" className="lc-outline" onClick={resetFilters}>重設篩選</button>
        </div>
        <div className="lc-demo-note">目前為合成資料展示，時間依台北時區（UTC+8）呈現。<button type="button" onClick={() => setSelectedDay('2026-10-17')}>查看 2026 年 10 月示範</button></div>
        {loadState === 'error' ? <div className="lc-feedback" role="alert"><h2>暫時無法載入行事曆</h2><p>此為載入失敗情境示範，請重試以重新讀取合成活動資料。</p><button type="button" className="lc-primary" onClick={() => { retriedLoad.current = true; setLoadState('loading'); }}>重新載入</button></div> : loadState === 'loading' ? <div className="lc-feedback" role="status" aria-live="polite" aria-busy="true"><h2>正在載入活動…</h2><p>此為載入狀態示範，請稍候，即將呈現合成公開活動。</p></div> : <div className="lc-layout">
            <aside className="lc-year-panel" aria-label="扶輪年度與月份"><div className="lc-year-controls"><button type="button" aria-label="上一個扶輪年度" onClick={() => setSelectedDay(shiftMonth(selectedDay, -12))}><ChevronLeft size={18} /></button><strong>{rotaryYear}–{rotaryYear + 1}</strong><button type="button" aria-label="下一個扶輪年度" onClick={() => setSelectedDay(shiftMonth(selectedDay, 12))}><ChevronRight size={18} /></button></div><p>扶輪年度 · 7 月至翌年 6 月</p><nav className="lc-months" aria-label="選擇月份">{Array.from({ length: 12 }, (_, index) => {
                const m = (index + 6) % 12, y = rotaryYear + (m < 6 ? 1 : 0);
                return <button type="button" key={index} aria-pressed={monthIndex === m} aria-label={`${y} 年 ${m + 1} 月`} onClick={() => setSelectedDay(`${y}-${String(m + 1).padStart(2, '0')}-01`)}><span>{m + 1} 月</span><small>{y}</small></button>;
            })}</nav></aside>
            <div className="lc-main"><div className="lc-month-heading"><div><p className="lc-eyebrow">PUBLIC CALENDAR</p><h2 ref={loadedHeading} tabIndex={-1} aria-live="polite">{year} 年 {monthIndex + 1} 月</h2><p role="status">本月符合條件 {monthEvents.length} 場活動</p></div><div className="lc-month-actions"><button type="button" aria-label="上一個月" onClick={() => setSelectedDay(shiftMonth(selectedDay, -1))}><ChevronLeft size={18} /></button><button type="button" onClick={() => setSelectedDay(today)}>今天</button><button type="button" aria-label="下一個月" onClick={() => setSelectedDay(shiftMonth(selectedDay, 1))}><ChevronRight size={18} /></button></div></div>
                <div className="lc-view-toggle" role="group" aria-label="行事曆呈現方式"><button type="button" aria-pressed={view === 'calendar'} onClick={() => setView('calendar')}>月曆</button><button type="button" aria-pressed={view === 'list'} onClick={() => setView('list')}>活動列表</button></div>
                {view === 'calendar' && <><p className="lc-keyboard-hint" id="lc-keyboard-hint">方向鍵移動日期，Home／End 跳至週首／週末，Page Up／Down 切換月份。</p>
                <div className="lc-weekdays" aria-hidden="true">{'日一二三四五六'.split('').map(day => <span key={day}>{day}</span>)}</div>
                <div className="lc-days" role="group" aria-label={`${year} 年 ${monthIndex + 1} 月日期`} aria-describedby="lc-keyboard-hint">{Array.from({ length: firstDate.getUTCDay() }, (_, index) => <span className="lc-spacer" key={`space-${index}`} />)}{Array.from({ length: dayCount }, (_, index) => {
                    const day = `${month}-${String(index + 1).padStart(2, '0')}`, items = onDay(day);
                    return <button type="button" key={day} ref={node => { if (node) dateButtons.current.set(day, node); else dateButtons.current.delete(day); }} className={`lc-day ${day === today ? 'lc-today' : ''}`} tabIndex={day === selectedDay ? 0 : -1} aria-pressed={day === selectedDay} aria-current={day === today ? 'date' : undefined} aria-label={`${dayLabel(day)}，${items.length} 場活動${items.some(item => item.status === 'cancelled') ? '，含已取消活動' : ''}`} onClick={() => setSelectedDay(day)} onKeyDown={event => keyboardDay(event, day)}><span className="lc-day-number">{index + 1}</span>{items.length > 0 && <span className="lc-day-count">{items.length}<span className="lc-count-word"> 場活動</span></span>}{items.slice(0, 2).map(item => <span className={`lc-day-title ${item.status === 'cancelled' ? 'lc-is-cancelled' : ''}`} key={item.id}>{item.status === 'cancelled' ? '已取消 · ' : ''}{item.title}</span>)}</button>;
                })}</div></>}
                {!monthEvents.length && <p className="lc-month-empty" role="status">這個月尚無符合條件的公開活動，可切換月份或調整篩選。</p>}
                <section className="lc-agenda" aria-labelledby="lc-agenda-heading"><div className="lc-agenda-heading"><div><p className="lc-eyebrow">ON THIS DAY</p><h2 id="lc-agenda-heading">{view === 'list' ? `${year} 年 ${monthIndex + 1} 月公開活動` : dayLabel(selectedDay)}</h2></div><span role="status" aria-live="polite">{displayedEvents.length} 場活動</span></div>{!displayedEvents.length ? <div className="lc-empty"><CalendarDays size={28} aria-hidden="true" /><h3>{view === 'list' ? '這個月沒有符合條件的公開活動' : '這一天沒有符合條件的公開活動'}</h3><p>可選擇有活動標記的日期，或調整地區、社團與關鍵字。</p>{(districtId || clubId || keyword) && <button type="button" onClick={resetFilters}>清除篩選</button>}</div> : <div className="lc-event-list ph-event-list">{displayedEvents.map(event => {
                    const organizer = event.organizerType === 'club' ? clubs.find(club => club.id === event.organizerId)?.name : districts.find(([id]) => id === event.organizerId)?.[1];
                    return <a className="lc-event ph-event-card" key={event.id} href={`#/event?id=${encodeURIComponent(event.id)}`}><div><span className="lc-event-organizer">{organizer ?? '地區主辦'}{event.organizerType === 'district' ? ' · 地區活動' : ''}</span><h3>{event.title}</h3>{event.status === 'cancelled' && <p className="lc-cancel-reason"><strong>已取消</strong> · {event.cancellationReason}</p>}<p>{formatEventDate(event)}</p><p className="lc-location"><MapPin size={14} aria-hidden="true" />{event.location}</p><span className="lc-detail-link">查看活動詳情 <ArrowRight size={15} aria-hidden="true" /></span></div></a>;
                })}</div>}</section>
            </div>
            <aside className="lc-clubs" aria-label="依主辦社團篩選"><p className="lc-eyebrow">FIND YOUR CLUB</p><h2>主辦社團</h2><p>選擇地區後，這裡會顯示對應社團。</p><div className="lc-club-options"><button type="button" aria-pressed={!clubId} onClick={() => setClubId('')}>全部社團<span>含地區主辦活動</span></button>{availableClubs.map(club => <button type="button" key={club.id} aria-pressed={clubId === club.id} onClick={() => setClubId(club.id)}>{club.name}<span>{club.districtName}{!club.enabled ? ' · 歷史活動' : ''}</span></button>)}</div>{!availableClubs.length && <p role="status">此地區目前沒有可查詢社團。</p>}<p className="lc-scope-note">僅顯示已公開活動。會員或社內限定活動不會出現在此頁。</p></aside>
        </div>}
    </section>;
}
