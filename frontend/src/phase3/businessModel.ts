import type { CommunityClub } from '../phase2/model';

export const industries = [{ id: 'food', name: '餐飲咖啡' }, { id: 'professional', name: '專業服務' }, { id: 'travel', name: '生活旅遊' }, { id: 'retail', name: '零售選物' }] as const;
export type BusinessStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'suspended';
export interface BusinessInput {
    name: string; description: string; industryIds: string[]; city: string;
    phone: string; email: string; website: string; address: string;
    publicFlags: { phone: boolean; email: boolean; website: boolean; address: boolean };
    locationConsent: boolean; latitude: number | null; longitude: number | null;
}
export interface BusinessCompany extends BusinessInput {
    id: string; ownerId: string; acceptedMaintainerIds: string[]; acceptedMemberIds: string[];
    status: BusinessStatus; version: number; reviewReason?: string;
    firstPublishedAt?: string; endorsements?: { memberId: string; confirmedAt: string }[];
}
export interface BusinessMember {
    id: string; callName: string; clubId: string; active: boolean;
    membershipYear: number; confirmation: 'confirmed' | 'grace' | 'unconfirmed';
}
export interface ExposureGrant { id: string; companyId: string; startsOn: string; status: 'active' | 'void'; }
export interface PublicBusiness {
    id: string; name: string; description: string; industryIds: string[]; city: string;
    phone?: string; email?: string; website?: string; address?: string;
    latitude?: number; longitude?: number; mapVisible: boolean;
    trialEndsAt?: string; communityConfirmed: boolean; confirmationCount: number; lastConfirmedAt?: string;
    exposure: 'free' | 'advertisement' | 'trial'; contacts: { callName: string; clubId: string; clubName: string }[];
}
export interface BusinessActor { memberId: string; role: 'member' | 'content_admin' | 'club_manager' | 'district_manager'; }
export type BusinessAction = { type: 'create'; actor: BusinessActor; input: BusinessInput }
    | { type: 'update'; actor: BusinessActor; id: string; version: number; input: BusinessInput }
    | { type: 'publish' | 'endorse' | 'unendorse' | 'submit' | 'approve' | 'reject' | 'suspend'; actor: BusinessActor; id: string; version: number; reason?: string };
export type BusinessResult = { ok: true; company: BusinessCompany } | { ok: false; error: string };
export interface BusinessQuery { keyword?: string; city?: string; clubId?: string; industryId?: string; mapOnly?: boolean; }

export function safeBusinessWebsite(value: string): string | undefined {
    try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : undefined; } catch { return undefined; }
}
function validDate(value: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}
export function grantEndsOn(startsOn: string): string {
    if (!validDate(startsOn)) return '';
    const [year, month, day] = startsOn.split('-').map(Number);
    const maximum = new Date(Date.UTC(year + 1, month, 0)).getUTCDate();
    return `${year + 1}-${String(month).padStart(2, '0')}-${String(Math.min(day, maximum)).padStart(2, '0')}`;
}
export function businessInstant(value: string): number {
    if (validDate(value)) return Date.parse(`${value}T00:00:00+08:00`);
    if (!validDate(value.slice(0, 10))) return NaN;
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/.test(value)) return NaN;
    return Date.parse(value);
}
function taipeiDate(asOf: string): string {
    const instant = businessInstant(asOf);
    return Number.isFinite(instant) ? new Date(instant + 8 * 3600000).toISOString().slice(0, 10) : '';
}
export function validBusinessMember(member: BusinessMember, clubs: CommunityClub[], asOf: string): boolean {
    const date = taipeiDate(asOf);
    if (!date) return false;
    const month = Number(date.slice(5, 7));
    const year = Number(date.slice(0, 4)) - (month < 7 ? 1 : 0);
    return member.active && ((member.membershipYear === year && (member.confirmation === 'confirmed' || (month === 7 && member.confirmation === 'grace')))
        || (month === 7 && member.membershipYear === year - 1 && ['confirmed', 'grace'].includes(member.confirmation)))
        && clubs.some(c => c.id === member.clubId && c.enabled);
}
function eligibleMembers(company: BusinessCompany, members: BusinessMember[], clubs: CommunityClub[], asOf: string) {
    const accepted = new Set([company.ownerId, ...company.acceptedMemberIds]);
    return members.filter(m => accepted.has(m.id) && validBusinessMember(m, clubs, asOf));
}
export function trialEndsAt(company: BusinessCompany): string | undefined {
    const start = company.firstPublishedAt ? businessInstant(company.firstPublishedAt) : NaN;
    return Number.isFinite(start) ? new Date(start + 72 * 3600000).toISOString() : undefined;
}
export function businessEligibility(company: BusinessCompany, members: BusinessMember[], clubs: CommunityClub[], grants: ExposureGrant[], asOf: string): { free: boolean; paid: boolean; trial: boolean; eligible: boolean } {
    const date = taipeiDate(asOf);
    if (!date) return { free: false, paid: false, trial: false, eligible: false };
    const free = eligibleMembers(company, members, clubs, asOf).length > 0;
    const paid = grants.some(g => g.companyId === company.id && g.status === 'active' && validDate(g.startsOn) && g.startsOn <= date && date < grantEndsOn(g.startsOn));
    const trialEnd = trialEndsAt(company);
    const now = businessInstant(asOf);
    const trial = !!trialEnd && now >= businessInstant(company.firstPublishedAt!) && now < businessInstant(trialEnd);
    return { free, paid, trial, eligible: free || paid || trial };
}
export interface BusinessContext { members: BusinessMember[]; clubs: CommunityClub[]; asOf: string; grants?: ExposureGrant[]; }
export function businessConfirmation(company: BusinessCompany, members: BusinessMember[], clubs: CommunityClub[], asOf: string): { confirmationCount: number; communityConfirmed: boolean; lastConfirmedAt?: string } {
    const now = businessInstant(asOf);
    const excluded = new Set([company.ownerId, ...company.acceptedMaintainerIds]);
    const seen = new Set<string>();
    const valid = (company.endorsements ?? []).filter(e => {
        const member = members.find(m => m.id === e.memberId);
        const at = businessInstant(e.confirmedAt);
        const date = taipeiDate(e.confirmedAt);
        const end = date ? businessInstant(`${grantEndsOn(date)}T${new Date(at + 8 * 3600000).toISOString().slice(11, 23)}+08:00`) : NaN;
        if (!member?.id || excluded.has(member.id) || seen.has(member.id) || !validBusinessMember(member, clubs, asOf) || !(at <= now && now < end)) return false;
        seen.add(member.id); return true;
    });
    return { confirmationCount: valid.length, communityConfirmed: valid.length >= 6, ...(valid.length ? { lastConfirmedAt: valid.map(e => e.confirmedAt).sort((a,b) => businessInstant(b) - businessInstant(a))[0] } : {}) };
}
function hasPublicContact(input: BusinessInput): boolean {
    return (['phone', 'email', 'website', 'address'] as const).some(key => input.publicFlags[key] && input[key].trim() && (key !== 'website' || safeBusinessWebsite(input.website)));
}
export function validateBusinessInput(input: BusinessInput): string[] {
    const errors: string[] = [];
    if (!input.name.trim() || input.name.trim().length > 200) errors.push('公司名稱需為 1～200 字。');
    if (!input.industryIds.length || input.industryIds.some(id => !industries.some(i => i.id === id))) errors.push('請選擇有效產業。');
    if (!input.city.trim()) errors.push('請填寫地區。');
    if (!hasPublicContact(input)) errors.push('至少提供並公開一項營業聯絡方式。');
    if (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) errors.push('請填寫有效 Email。');
    if (input.website && !safeBusinessWebsite(input.website)) errors.push('網站僅接受完整 http／https 網址。');
    if ((input.latitude !== null || input.longitude !== null) && !validCoordinates(input.latitude, input.longitude)) errors.push('座標需同時填寫有效緯度與經度。');
    return errors;
}
function validCoordinates(latitude: number | null, longitude: number | null): boolean {
    return latitude !== null && longitude !== null && Number.isFinite(latitude) && Number.isFinite(longitude) && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}
export function projectBusiness(company: BusinessCompany, members: BusinessMember[], clubs: CommunityClub[], grants: ExposureGrant[], asOf: string): PublicBusiness | undefined {
    const qualification = businessEligibility(company, members, clubs, grants, asOf);
    if (company.status !== 'approved' || !qualification.eligible || validateBusinessInput(company).length) return undefined;
    // Construct the allowlist explicitly. No private fields or member identifiers are copied.
    // Free exposure lists qualifying members only. Independent advertising can identify
    // accepted former members using call name and public club metadata, never private identity.
    const contactMembers = (qualification.paid || qualification.trial) ? members : eligibleMembers(company, members, clubs, asOf);
    const contacts = contactMembers.filter(m => [company.ownerId, ...company.acceptedMemberIds].includes(m.id) && m.callName.trim()).flatMap(m => {
        // Paid exposure is independent of active club eligibility. A disabled club's
        // already-public name remains historical attribution, not free eligibility.
        const club = clubs.find(c => c.id === m.clubId && c.public && (qualification.paid || qualification.trial || c.enabled));
        return club ? [{ callName: m.callName, clubId: club.id, clubName: club.name }] : [];
    });
    const mapVisible = company.locationConsent && validCoordinates(company.latitude, company.longitude);
    return { id: company.id, name: company.name, description: company.description, industryIds: [...company.industryIds], city: company.city,
        ...(company.publicFlags.phone && company.phone ? { phone: company.phone } : {}),
        ...(company.publicFlags.email && company.email ? { email: company.email } : {}),
        ...(company.publicFlags.website && safeBusinessWebsite(company.website) ? { website: safeBusinessWebsite(company.website) } : {}),
        ...(company.publicFlags.address && company.address ? { address: company.address } : {}),
        ...(mapVisible ? { latitude: company.latitude!, longitude: company.longitude! } : {}),
        mapVisible, exposure: qualification.paid ? 'advertisement' : qualification.free ? 'free' : 'trial', contacts,
        ...(trialEndsAt(company) ? { trialEndsAt: trialEndsAt(company) } : {}), ...businessConfirmation(company, members, clubs, asOf) };
}
export function filterBusinesses(list: PublicBusiness[], query: BusinessQuery): PublicBusiness[] {
    const keyword = query.keyword?.trim().toLocaleLowerCase() ?? '';
    return list.filter(b => (!query.mapOnly || b.mapVisible) && (!query.city || b.city === query.city) && (!query.industryId || b.industryIds.includes(query.industryId)) && (!query.clubId || b.contacts.some(c => c.clubId === query.clubId)) && (!keyword || [b.name, b.description, ...b.contacts.flatMap(c => [c.callName, c.clubName])].join(' ').toLocaleLowerCase().includes(keyword)));
}
export function canMaintainBusiness(company: BusinessCompany, actor: BusinessActor): boolean {
    return !!actor.memberId && (company.ownerId === actor.memberId || company.acceptedMaintainerIds.includes(actor.memberId));
}
function inputFields(input: BusinessInput): BusinessInput {
    return { name: input.name.trim(), description: input.description, industryIds: [...input.industryIds], city: input.city,
        phone: input.phone, email: input.email, website: input.website, address: input.address,
        publicFlags: { phone: input.publicFlags.phone, email: input.publicFlags.email, website: input.publicFlags.website, address: input.publicFlags.address },
        locationConsent: input.locationConsent, latitude: input.latitude, longitude: input.longitude };
}
export function applyBusinessAction(companies: BusinessCompany[], action: BusinessAction, context?: BusinessContext): BusinessResult {
    if (action.type === 'create') {
        if (!action.actor.memberId) return { ok: false, error: '請先選擇會員身分。' };
        if (!action.input.name.trim() || action.input.name.trim().length > 200) return { ok: false, error: '公司名稱需為 1～200 字。' };
        let number = companies.length + 1;
        while (companies.some(c => c.id === `business-${number}`)) number++;
        return { ok: true, company: { ...inputFields(action.input), id: `business-${number}`, ownerId: action.actor.memberId, acceptedMaintainerIds: [], acceptedMemberIds: [], status: 'draft', version: 1 } };
    }
    const company = companies.find(c => c.id === action.id);
    if (!company) return { ok: false, error: '找不到公司。' };
    if (company.version !== action.version) return { ok: false, error: '資料版本已更新，請重新載入；目前輸入仍保留。' };
    if (action.type === 'endorse' || action.type === 'unendorse') {
        if (!action.actor.memberId) return { ok: false, error: '請先登入帳號。' };
        if (action.type === 'endorse') {
            if (!context || !context.members.some(m => m.id === action.actor.memberId && validBusinessMember(m, context.clubs, context.asOf))) return { ok: false, error: '僅具有效社籍的登入會員可以確認。' };
            if (canMaintainBusiness(company, action.actor)) return { ok: false, error: '本人與公司維護者不能確認自己的公司。' };
            if (!projectBusiness(company, context.members, context.clubs, context.grants ?? [], context.asOf)) return { ok: false, error: '僅目前公開曝光的公司可以確認。' };
        }
        const existing = (company.endorsements ?? []).find(e => e.memberId === action.actor.memberId);
        if (action.type === 'endorse' && existing) return { ok: false, error: '每個帳號僅能確認一次，請先撤回原確認。' };
        if (action.type === 'unendorse' && !existing) return { ok: false, error: '尚未確認，無法撤回。' };
        const endorsements = (company.endorsements ?? []).filter(e => e.memberId !== action.actor.memberId);
        if (action.type === 'endorse') endorsements.push({ memberId: action.actor.memberId, confirmedAt: new Date(businessInstant(context!.asOf)).toISOString() });
        return { ok: true, company: { ...company, endorsements, version: company.version + 1 } };
    }
    if (action.type === 'update' || action.type === 'submit' || action.type === 'publish') {
        if (!canMaintainBusiness(company, action.actor)) return { ok: false, error: '僅公司本人或已接受邀請的維護者可以操作。' };
        if (company.status === 'suspended') return { ok: false, error: '公司已暫停，請聯絡平台處理。' };
        if (action.type === 'update') {
            if (!action.input.name.trim() || action.input.name.trim().length > 200) return { ok: false, error: '公司名稱需為 1～200 字。' };
            const significant = company.name.trim() !== action.input.name.trim() || company.address !== action.input.address || company.latitude !== action.input.latitude || company.longitude !== action.input.longitude;
            return { ok: true, company: { ...company, ...inputFields(action.input), endorsements: significant ? [] : company.endorsements, status: 'draft', reviewReason: undefined, version: company.version + 1 } };
        }
        if (action.type === 'publish') {
            if (!context || !Number.isFinite(businessInstant(context.asOf))) return { ok: false, error: '請提供有效發布時間。' };
            const errors = validateBusinessInput(company);
            if (errors.length) return { ok: false, error: errors.join(' ') };
            return { ok: true, company: { ...company, status: 'approved', firstPublishedAt: company.firstPublishedAt ?? new Date(businessInstant(context.asOf)).toISOString(), reviewReason: undefined, version: company.version + 1 } };
        }
        if (!['draft', 'rejected'].includes(company.status)) return { ok: false, error: '僅草稿或退回資料可送審。' };
        const errors = validateBusinessInput(company);
        if (errors.length) return { ok: false, error: errors.join(' ') };
        return { ok: true, company: { ...company, status: 'pending', reviewReason: undefined, version: company.version + 1 } };
    }
    if (action.actor.role !== 'content_admin') return { ok: false, error: '僅平台內容管理員可以審核。' };
    if ((action.type === 'approve' && company.status !== 'pending') || (action.type === 'reject' && !['pending', 'approved'].includes(company.status))) return { ok: false, error: '僅待審核公司可以核可或退回。' };
    if (action.type === 'suspend' && company.status !== 'approved') return { ok: false, error: '僅已核可公司可以暫停。' };
    if (action.type !== 'approve' && !action.reason?.trim()) return { ok: false, error: '請填寫處理原因。' };
    if (action.type === 'approve') { const errors = validateBusinessInput(company); if (errors.length) return { ok: false, error: errors.join(' ') }; }
    return { ok: true, company: { ...company, status: action.type === 'approve' ? 'approved' : action.type === 'reject' ? 'rejected' : 'suspended', reviewReason: action.reason?.trim(), version: company.version + 1 } };
}

export const demoBusinessMembers: BusinessMember[] = [
    { id: 'm1', callName: 'Sunny', clubId: 'taipei', active: true, membershipYear: 2026, confirmation: 'confirmed' },
    { id: 'm5', callName: 'Alex', clubId: 'taichung', active: true, membershipYear: 2026, confirmation: 'confirmed' },
    { id: 'm7', callName: 'Jo', clubId: 'kaohsiung', active: true, membershipYear: 2025, confirmation: 'unconfirmed' },
    ...Array.from({ length: 6 }, (_, i): BusinessMember => ({ id: `peer-${i + 1}`, callName: `Peer ${i + 1}`, clubId: 'taipei', active: true, membershipYear: 2026, confirmation: 'confirmed' })),
    { id: 'account-only', callName: 'Nova', clubId: '', active: false, membershipYear: 0, confirmation: 'unconfirmed' },
    { id: 'm-ob', callName: 'River', clubId: 'taipei', active: false, membershipYear: 2025, confirmation: 'unconfirmed' },
];
const base: BusinessInput = { name: '', description: '', city: '台北', industryIds: ['professional'], phone: '02-0000-0101', email: 'private-business@example.invalid', website: '', address: '示範營業地址（合成）', publicFlags: { phone: true, email: false, website: false, address: false }, locationConsent: true, latitude: 25.04, longitude: 121.53 };
function fixture(id: string, name: string, ownerId: string, values: Partial<BusinessInput> = {}): BusinessCompany { return { ...structuredClone(base), ...values, id, name, ownerId, acceptedMaintainerIds: [], acceptedMemberIds: [], status: 'approved', version: 1, firstPublishedAt: '2026-01-01T00:00:00Z' }; }
export const demoBusinessCompanies: BusinessCompany[] = [
    { ...fixture('coffee', '日常之間咖啡', 'm1', { industryIds: ['food'], description: '一杯咖啡的時間，讓新的交流自然發生。提供手沖咖啡、輕食與小型聚會空間。' }), acceptedMaintainerIds: ['m5'], acceptedMemberIds: ['m5'] },
    fixture('studio', '向光設計工作室', 'm5', { city: '台中', industryIds: ['professional'], phone: '04-0000-0202', description: '從品牌識別到日常設計，陪伴在地品牌找到自己的樣貌。', latitude: 24.15, longitude: 120.67 }),
    fixture('travel', '南方慢旅', 'm7', { city: '高雄', industryIds: ['travel'], phone: '07-0000-0303', description: '用步行認識一座城市，探索巷弄裡的故事與人情。', latitude: 22.63, longitude: 120.3 }),
    fixture('no-coordinates', '線上品牌顧問', 'm1', { latitude: null, longitude: null, locationConsent: false }),
    fixture('private', '未公開聯絡公司', 'm1', { publicFlags: { phone: false, email: false, website: false, address: false } }),
    { ...fixture('unapproved', '待審核示範公司', 'm1'), status: 'pending' },
    fixture('no-eligibility', '無曝光資格示範', 'm-ob'),
    fixture('account-paid', '獨立廣告示範商家', 'account-only'),
    fixture('expired', '廣告已到期示範', 'm-ob'),
];
export const demoExposureGrants: ExposureGrant[] = [
    { id: 'grant-account', companyId: 'account-paid', startsOn: '2026-07-01', status: 'active' },
    { id: 'grant-travel', companyId: 'travel', startsOn: '2026-07-01', status: 'active' },
    { id: 'grant-expired', companyId: 'expired', startsOn: '2025-10-15', status: 'active' },
];
