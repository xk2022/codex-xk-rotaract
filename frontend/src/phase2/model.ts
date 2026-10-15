export type EventRole = 'guest' | 'member' | 'club_manager' | 'club_president' | 'club_secretary' | 'club_backup' | 'district_manager';
export interface EventActor {
    role: EventRole;
    clubId?: string;
    districtId?: string;
}
export interface CommunityClub {
    id: string;
    name: string;
    districtId: string;
    districtName: string;
    city: string;
    description: string;
    address: string;
    email: string;
    website: string;
    enabled: boolean;
    public: boolean;
    clubTypeCode: 'ROTARACT';
    emailPublic: boolean;
    websitePublic: boolean;
    addressPublic: boolean;
    disabledAt?: string;
}
export type EventTime = {
    kind: 'timed';
    startAt: string;
    endAt: string;
    timeZone: string;
} | {
    kind: 'allDay';
    startDate: string;
    endDateExclusive: string;
    timeZone: string;
};
export interface CommunityEvent {
    id: string;
    title: string;
    description: string;
    location: string;
    organizerType: 'club' | 'district';
    organizerId: string;
    visibility: 'public' | 'members' | 'club';
    status: 'draft' | 'published' | 'cancelled' | 'archived';
    time: EventTime;
    cancellationReason?: string;
    version: number;
}
export type EventInput = Omit<CommunityEvent, 'id' | 'status' | 'version' | 'cancellationReason'>;
export type EventAction = {
    type: 'create';
    actor: EventActor;
    input: EventInput;
} | {
    type: 'update';
    actor: EventActor;
    id: string;
    version: number;
    input: EventInput;
} | {
    type: 'publish' | 'archive' | 'copy';
    actor: EventActor;
    id: string;
    version: number;
} | {
    type: 'cancel';
    actor: EventActor;
    id: string;
    version: number;
    reason: string;
};
export type ActionResult = {
    ok: true;
    event: CommunityEvent;
} | {
    ok: false;
    error: string;
    fieldErrors?: Record<string, string>;
};
export const demoClubs: CommunityClub[] = [
    { id: 'taipei', name: '台北星光扶青社', districtId: 'd3481', districtName: '3481 地區', city: '台北', description: '從城市出發，串連青年與在地服務，一起讓改變發生。', address: '台北市中正區（合成示例）', email: 'taipei@example.test', website: 'https://example.test', enabled: true, public: true, clubTypeCode: 'ROTARACT', emailPublic: true, websitePublic: true, addressPublic: true },
    { id: 'taichung', name: '台中山海扶青社', districtId: 'd3462', districtName: '3462 地區', city: '台中', description: '結合職業交流與社區服務，讓每一份熱情都有舞台。', address: '台中市西區（合成示例）', email: 'taichung@example.test', website: 'https://example.test', enabled: true, public: true, clubTypeCode: 'ROTARACT', emailPublic: true, websitePublic: true, addressPublic: true },
    { id: 'kaohsiung', name: '高雄扶青社', districtId: 'd3510', districtName: '3510 地區', city: '高雄', description: '以海港城市的溫度，和夥伴創造友誼與服務。', address: '高雄市前金區（合成示例）', email: 'kaohsiung@example.test', website: 'https://example.test', enabled: true, public: true, clubTypeCode: 'ROTARACT', emailPublic: true, websitePublic: true, addressPublic: true },
    { id: 'disabled', name: '停用示例社', districtId: 'd3481', districtName: '3481 地區', city: '台北', description: '僅供停用規則驗證。', address: '', email: '', website: '', enabled: false, disabledAt: '2026-08-01T00:00:00Z', public: false, clubTypeCode: 'ROTARACT', emailPublic: false, websitePublic: false, addressPublic: false },
];
const timed = (start: string, end: string): EventTime => ({ kind: 'timed', startAt: start, endAt: end, timeZone: 'Asia/Taipei' });
const fixture = (id: string, title: string, organizerId: string, time: EventTime, extra: Partial<CommunityEvent> = {}): CommunityEvent => ({ id, title, organizerId, organizerType: 'club', description: '這是一場合成資料活動，邀請夥伴一起交流、服務並認識社區。無報名及簽到功能。', location: '社區活動空間（合成示例）', visibility: 'public', status: 'published', time, version: 0, ...extra });
export const demoEvents: CommunityEvent[] = [
    fixture('city-walk', '城市散步・一起認識在地', 'taipei', timed('2026-10-17T02:00:00Z', '2026-10-17T05:00:00Z')),
    fixture('beach-cleanup', '週末淨灘・為海洋留白', 'kaohsiung', timed('2026-10-24T00:00:00Z', '2026-10-24T04:00:00Z')),
    fixture('career-talk', '青年的下一站・職涯分享', 'taichung', timed('2026-10-31T06:00:00Z', '2026-10-31T09:00:00Z')),
    fixture('cross-day', '跨日服務接力', 'taipei', timed('2026-10-23T14:00:00Z', '2026-10-24T02:00:00Z')),
    fixture('all-day', '社區服務週末', 'taichung', { kind: 'allDay', startDate: '2026-10-10', endDateExclusive: '2026-10-12', timeZone: 'Asia/Taipei' }),
    fixture('cancelled', '海港交流日', 'kaohsiung', timed('2026-10-18T02:00:00Z', '2026-10-18T04:00:00Z'), { status: 'cancelled', cancellationReason: '天候因素，為確保參與者安全取消。' }),
    fixture('members-only', '會員交流沙龍', 'taipei', timed('2026-10-20T10:00:00Z', '2026-10-20T12:00:00Z'), { visibility: 'members' }),
    fixture('club-only', '社內工作會議', 'taipei', timed('2026-10-21T10:00:00Z', '2026-10-21T12:00:00Z'), { visibility: 'club' }),
    fixture('draft', '服務計畫草稿', 'taipei', timed('2026-11-01T02:00:00Z', '2026-11-01T04:00:00Z'), { status: 'draft' }),
    fixture('disabled-future', '停用社未來活動', 'disabled', timed('2026-12-01T02:00:00Z', '2026-12-01T04:00:00Z')),
    fixture('disabled-history', '停用前服務紀錄', 'disabled', timed('2025-10-01T02:00:00Z', '2025-10-01T04:00:00Z')),
    fixture('district-day', '地區青年服務論壇', 'd3481', timed('2026-10-25T01:00:00Z', '2026-10-25T09:00:00Z'), { organizerType: 'district' }),
];
const publisherRoles: EventRole[] = ['club_president', 'club_secretary', 'club_backup'];
export function canManageEvent(actor: EventActor, event: Pick<CommunityEvent, 'organizerType' | 'organizerId'>, clubs: CommunityClub[] = demoClubs): boolean {
    if (event.organizerType === 'district')
        return actor.role === 'district_manager' && actor.districtId === event.organizerId && clubs.some(c => c.districtId === event.organizerId);
    return (actor.role === 'club_manager' || publisherRoles.includes(actor.role)) && actor.clubId === event.organizerId && clubs.some(c => c.id === event.organizerId);
}
export function canPublishEvent(actor: EventActor, event: Pick<CommunityEvent, 'organizerType' | 'organizerId'>, clubs: CommunityClub[] = demoClubs): boolean {
    return canManageEvent(actor, event, clubs) && (actor.role === 'district_manager' || publisherRoles.includes(actor.role)) && (event.organizerType === 'district' || clubs.some(c => c.id === event.organizerId && c.enabled));
}
export function publicClubs(clubs: CommunityClub[]): CommunityClub[] {
    return clubs.filter(c => c.enabled && c.public).map(c => ({
        ...c,
        email: c.emailPublic ? c.email : '',
        website: c.websitePublic ? c.website : '',
        address: c.addressPublic ? c.address : '',
    }));
}
function partsAt(date: Date, timeZone: string): string {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
    const get = (name: string) => parts.find(p => p.type === name)?.value;
    return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}
export function validTimeZone(zone: string): boolean { try {
    new Intl.DateTimeFormat('en', { timeZone: zone }).format();
    return true;
}
catch {
    return false;
} }
export type TimeConversion = {
    ok: true;
    value: string;
} | {
    ok: false;
    error: string;
};
export function localDateTimeToUtc(local: string, timeZone: string, disambiguation?: 'earlier' | 'later'): TimeConversion {
    if (!validTimeZone(timeZone))
        return { ok: false, error: '請輸入有效的 IANA 時區。' };
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local))
        return { ok: false, error: '請輸入完整日期與時間。' };
    const naive = Date.parse(`${local}:00Z`);
    if (!Number.isFinite(naive) || new Date(naive).toISOString().slice(0, 16) !== local)
        return { ok: false, error: '日期或時間無效。' };
    const matches = new Set<number>();
    // Sample nearby offsets, then verify the exact wall clock. This catches DST gaps and folds.
    for (let h = -36; h <= 36; h += 3) {
        const probe = naive + h * 3600000;
        const wall = Date.parse(`${partsAt(new Date(probe), timeZone)}:00Z`);
        const candidate = naive - (wall - probe);
        if (partsAt(new Date(candidate), timeZone) === local)
            matches.add(candidate);
    }
    const sorted = [...matches].sort((a, b) => a - b);
    if (!sorted.length)
        return { ok: false, error: '此時間因夏令時間跳時不存在，請選擇其他時間。' };
    if (sorted.length > 1 && !disambiguation)
        return { ok: false, error: '此時間因夏令時間回撥出現兩次，請明確選擇較早或較晚時段。' };
    return { ok: true, value: new Date(disambiguation === 'later' ? sorted[sorted.length - 1] : sorted[0]).toISOString() };
}
export function utcToLocalDateTime(iso: string, timeZone = 'Asia/Taipei'): string { return partsAt(new Date(iso), timeZone); }
function dateValid(value: string) { return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value; }
export function eventBounds(event: Pick<CommunityEvent, 'time'>): {
    start: Date;
    end: Date;
} {
    const time = event.time;
    if (time.kind === 'timed')
        return { start: new Date(time.startAt), end: new Date(time.endAt) };
    const start = localDateTimeToUtc(`${time.startDate}T00:00`, time.timeZone, 'earlier');
    const end = localDateTimeToUtc(`${time.endDateExclusive}T00:00`, time.timeZone, 'earlier');
    return { start: new Date(start.ok ? start.value : NaN), end: new Date(end.ok ? end.value : NaN) };
}
export function formatEventDate(event: CommunityEvent): string {
    if (event.time.kind === 'allDay') {
        const last = new Date(`${event.time.endDateExclusive}T00:00:00Z`);
        last.setUTCDate(last.getUTCDate() - 1);
        return `${event.time.startDate} – ${last.toISOString().slice(0, 10)} · 全天`;
    }
    const { start, end } = eventBounds(event);
    const format = new Intl.DateTimeFormat('zh-TW', { timeZone: event.time.timeZone, month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    return `${format.format(start)} – ${format.format(end)} · ${event.time.timeZone}`;
}
export function publicProjection(events: CommunityEvent[], clubs: CommunityClub[], now = new Date()): CommunityEvent[] {
    return events.filter(e => e.visibility === 'public' && ['published', 'cancelled'].includes(e.status) && (e.organizerType === 'district' ? clubs.some(c => c.districtId === e.organizerId) : clubs.some(c => c.id === e.organizerId && (c.enabled || !!c.disabledAt && eventBounds(e).end <= now && eventBounds(e).end.getTime() <= Date.parse(c.disabledAt)))));
}
export function visibleEvents(events: CommunityEvent[], clubs: CommunityClub[], actor: EventActor, now = new Date()): CommunityEvent[] {
    const publicIds = new Set(publicProjection(events, clubs, now).map(e => e.id));
    return events.filter(e => publicIds.has(e.id) || canManageEvent(actor, e, clubs) || (actor.role !== 'guest' && ['published', 'cancelled'].includes(e.status) && (e.organizerType === 'district' || clubs.some(c => c.id === e.organizerId && c.enabled)) && (e.visibility === 'members' || (e.visibility === 'club' && e.organizerType === 'club' && e.organizerId === actor.clubId))));
}
export interface EventQuery {
    keyword?: string;
    clubId?: string;
    districtId?: string;
    from?: string;
    to?: string;
}
export function searchEvents(events: CommunityEvent[], query: EventQuery, clubs: CommunityClub[] = demoClubs): CommunityEvent[] {
    const keyword = query.keyword?.trim().toLocaleLowerCase();
    return events.filter(e => {
        const club = e.organizerType === 'club' ? clubs.find(c => c.id === e.organizerId) : undefined;
        const bounds = eventBounds(e);
        return (!keyword || `${e.title} ${e.description} ${e.location} ${club?.name ?? ''}`.toLocaleLowerCase().includes(keyword)) && (!query.clubId || e.organizerType === 'club' && e.organizerId === query.clubId) && (!query.districtId || (e.organizerType === 'district' ? e.organizerId : club?.districtId) === query.districtId) && (!query.from || bounds.end.getTime() > Date.parse(query.from)) && (!query.to || bounds.start.getTime() < Date.parse(query.to));
    }).sort((a, b) => eventBounds(a).start.getTime() - eventBounds(b).start.getTime() || a.id.localeCompare(b.id));
}
function validInstant(value: string): boolean {
    const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/.exec(value);
    if (!match || !dateValid(match[1]) || +match[2] > 23 || +match[3] > 59 || +(match[4] ?? '0') > 59)
        return false;
    const offset = match[5];
    if (offset !== 'Z' && (+offset.slice(1, 3) > 23 || +offset.slice(4, 6) > 59))
        return false;
    return Number.isFinite(Date.parse(value));
}
export function validateEventInput(input: EventInput, clubs: CommunityClub[] = demoClubs): Record<string, string> {
    const errors: Record<string, string> = {};
    if (!input.title.trim() || input.title.length > 200)
        errors.title = '標題須為 1～200 字。';
    if (input.description.length > 10000)
        errors.description = '說明最多 10000 字。';
    if (input.location.length > 300)
        errors.location = '地點最多 300 字。';
    if (!['club', 'district'].includes(input.organizerType) || !input.organizerId || !clubs.some(c => input.organizerType === 'club' ? c.id === input.organizerId : c.districtId === input.organizerId))
        errors.organizerId = '請選擇有效主辦單位。';
    if (!['public', 'members', 'club'].includes(input.visibility) || input.organizerType === 'district' && input.visibility === 'club')
        errors.visibility = '請選擇適合主辦範圍的可見性。';
    if (!validTimeZone(input.time.timeZone))
        errors.timeZone = '請輸入有效的 IANA 時區。';
    else if (input.time.kind === 'allDay') {
        if (!dateValid(input.time.startDate) || !dateValid(input.time.endDateExclusive) || input.time.endDateExclusive <= input.time.startDate)
            errors.time = '全天結束日期須晚於開始日期（結束日不含當天）。';
        else {
            const bounds = eventBounds(input);
            if (!Number.isFinite(bounds.start.getTime()) || !Number.isFinite(bounds.end.getTime()))
                errors.time = '日期在所選時區不存在，請調整日期。';
        }
    }
    else {
        if (!validInstant(input.time.startAt) || !validInstant(input.time.endAt))
            errors.time = '活動時間須包含 UTC 或時差資訊。';
        const bounds = eventBounds(input);
        if (!Number.isFinite(bounds.start.getTime()) || !Number.isFinite(bounds.end.getTime()) || bounds.end <= bounds.start)
            errors.time = '結束時間須晚於開始時間。';
    }
    return errors;
}
export function applyEventAction(events: CommunityEvent[], clubs: CommunityClub[], action: EventAction, newId: string = crypto.randomUUID()): ActionResult {
    if (action.type === 'create') {
        if (!canManageEvent(action.actor, action.input, clubs))
            return { ok: false, error: '沒有此主辦單位的維護權限。' };
        if (action.input.organizerType === 'club' && !clubs.some(c => c.id === action.input.organizerId && c.enabled))
            return { ok: false, error: '停用社團不能新增活動。' };
        const fieldErrors = validateEventInput(action.input, clubs);
        if (Object.keys(fieldErrors).length)
            return { ok: false, error: '請檢查活動欄位。', fieldErrors };
        return { ok: true, event: { ...action.input, title: action.input.title.trim(), id: newId, status: 'draft', version: 0 } };
    }
    const event = events.find(e => e.id === action.id);
    if (!event || !canManageEvent(action.actor, event, clubs))
        return { ok: false, error: '找不到活動或沒有維護權限。' };
    if (event.version !== action.version)
        return { ok: false, error: '活動已由其他操作更新，請重新讀取；您的草稿尚未儲存。' };
    if (action.type === 'copy') {
        if (event.organizerType === 'club' && !clubs.some(c => c.id === event.organizerId && c.enabled))
            return { ok: false, error: '停用社團不能新增活動。' };
        const { cancellationReason: _reason, ...rest } = event;
        return { ok: true, event: { ...rest, id: newId, title: `${event.title.slice(0, 194)}（副本）`, status: 'draft', version: 0 } };
    }
    if (action.type === 'update') {
        if (event.status !== 'draft')
            return { ok: false, error: '只有草稿可以編輯；已發布活動請複製成新草稿。' };
        if (!canManageEvent(action.actor, action.input, clubs) || action.input.organizerId !== event.organizerId || action.input.organizerType !== event.organizerType)
            return { ok: false, error: '不能在編輯時變更主辦單位。' };
        const fieldErrors = validateEventInput(action.input, clubs);
        if (Object.keys(fieldErrors).length)
            return { ok: false, error: '請檢查活動欄位。', fieldErrors };
        return { ok: true, event: { ...event, ...action.input, title: action.input.title.trim(), version: event.version + 1 } };
    }
    if (action.type === 'publish') {
        if (event.status !== 'draft' || !canPublishEvent(action.actor, event, clubs))
            return { ok: false, error: '只有有發布權限的管理者可發布有效社團或所屬地區草稿。' };
        const fieldErrors = validateEventInput(event, clubs);
        if (Object.keys(fieldErrors).length)
            return { ok: false, error: '活動資料不完整，無法發布。', fieldErrors };
        return { ok: true, event: { ...event, status: 'published', version: event.version + 1 } };
    }
    if (!canManageEvent(action.actor, event, clubs) || !(action.actor.role === 'district_manager' || publisherRoles.includes(action.actor.role)))
        return { ok: false, error: '您沒有取消或封存權限。' };
    if (action.type === 'cancel') {
        if (event.status !== 'published' || !action.reason.trim() || action.reason.length > 1000)
            return { ok: false, error: '僅能取消已發布活動，且須填寫 1～1000 字原因。' };
        return { ok: true, event: { ...event, status: 'cancelled', cancellationReason: action.reason.trim(), version: event.version + 1 } };
    }
    if (event.status !== 'published')
        return { ok: false, error: '僅能封存已發布活動。' };
    return { ok: true, event: { ...event, status: 'archived', version: event.version + 1 } };
}
