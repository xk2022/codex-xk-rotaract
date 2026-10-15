import type { CommunityClub } from '../phase2/model';
import { businessInstant, projectBusiness, type BusinessCompany, type BusinessMember, type ExposureGrant } from '../phase3/businessModel';

export interface CouponInput { companyId: string; title: string; description: string; terms: string; startsAt: string; endsAt: string; totalQuota: number; perMemberLimit: number; }
export interface CouponOffer extends CouponInput { id: string; status: 'draft' | 'pending' | 'approved' | 'rejected' | 'suspended'; version: number; reviewReason?: string; }
export interface CouponClaim { id: string; offerId: string; companyId: string; memberId: string; code: string; status: 'available' | 'used' | 'void'; version: number; claimedAt: string; startsAt: string; expiresAt: string; title: string; description: string; terms: string; usedAt?: string; voidReason?: string; }
export interface CouponActor { memberId: string; role: 'member' | 'content_admin'; }
export interface CouponState { offers: CouponOffer[]; claims: CouponClaim[]; requests: { requestId: string; memberId: string; offerId: string; claimId: string }[]; }
export interface CouponContext { companies: BusinessCompany[]; members: BusinessMember[]; clubs: CommunityClub[]; grants: ExposureGrant[]; asOf: string; }
export type CouponAction = { type: 'create'; actor: CouponActor; input: CouponInput }
 | { type: 'update'; actor: CouponActor; id: string; version: number; input: CouponInput }
 | { type: 'submit' | 'approve' | 'reject' | 'suspend'; actor: CouponActor; id: string; version: number; reason?: string }
 | { type: 'claim'; actor: CouponActor; id: string; requestId: string }
 | { type: 'redeem'; actor: CouponActor; code: string; companyId: string; claimVersion: number; offerVersion: number }
 | { type: 'void'; actor: CouponActor; id: string; version: number; reason: string };
export type CouponResult = { ok: true; state: CouponState; offer?: CouponOffer; claim?: CouponClaim } | { ok: false; error: string };
export function couponInstant(value: string): number {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/.test(value)) return NaN;
    const time = Date.parse(value);
    return Number.isFinite(time) && new Date(time).toISOString().slice(0, 19) === value.slice(0, 19) ? time : NaN;
}
export function validateCouponInput(input: CouponInput): string[] {
    const errors: string[] = [];
    if (!input.title.trim() || input.title.length > 120) errors.push('優惠名稱需為 1～120 字。');
    if (!input.description.trim() || input.description.length > 2000 || !input.terms.trim() || input.terms.length > 2000) errors.push('請填寫優惠內容與使用條件，各限 2000 字。');
    if (!(couponInstant(input.startsAt) < couponInstant(input.endsAt))) errors.push('請填寫有效起迄時間，結束須晚於開始。');
    if (![input.totalQuota, input.perMemberLimit].every(n => Number.isSafeInteger(n) && n > 0) || input.perMemberLimit > input.totalQuota) errors.push('總名額與每人上限須為正整數，且每人上限不可超過總名額。');
    return errors;
}
export function eligibleCouponMember(memberId: string, context: CouponContext): boolean {
    const now = businessInstant(context.asOf);
    if (!Number.isFinite(now)) return false;
    const date = new Date(now + 8 * 3600000); const year = date.getUTCFullYear() - (date.getUTCMonth() < 6 ? 1 : 0);
    return context.members.some(m => m.id === memberId && m.active && m.confirmation === 'confirmed' && m.membershipYear === year && context.clubs.some(c => c.id === m.clubId && c.enabled));
}
export function couponRemaining(state: CouponState, offer: CouponOffer): number { return Math.max(0, offer.totalQuota - state.claims.filter(c => c.offerId === offer.id).length); }
export function couponAvailable(offer: CouponOffer, context: CouponContext): boolean {
    const company = context.companies.find(c => c.id === offer.companyId); const now = businessInstant(context.asOf);
    return offer.status === 'approved' && couponInstant(offer.startsAt) <= now && now < couponInstant(offer.endsAt) && !!company && !!projectBusiness(company, context.members, context.clubs, context.grants, context.asOf);
}
export function projectCoupons(state: CouponState, context: CouponContext): (CouponOffer & { remaining: number; companyName: string })[] {
    return state.offers.filter(o => couponAvailable(o, context)).map(o => ({ ...o, remaining: couponRemaining(state, o), companyName: context.companies.find(c => c.id === o.companyId)!.name }));
}
export function projectMyClaims(state: CouponState, actor: CouponActor): CouponClaim[] { return actor.memberId ? state.claims.filter(c => c.memberId === actor.memberId).map(c => ({ ...c })) : []; }
export function lookupCouponCode(state: CouponState, code: string, companyId: string, actor: CouponActor, context: CouponContext): { id: string; title: string; status: CouponClaim['status']; expiresAt: string; claimVersion: number; offerVersion: number } | undefined {
    const company = context.companies.find(c => c.id === companyId && c.ownerId === actor.memberId);
    const claim = state.claims.find(c => c.code === code.trim() && c.companyId === companyId);
    const offer = claim && state.offers.find(o => o.id === claim.offerId);
    return company && claim && offer ? { id: claim.id, title: claim.title, status: claim.status, expiresAt: claim.expiresAt, claimVersion: claim.version, offerVersion: offer.version } : undefined;
}
function fields(input: CouponInput): CouponInput { return { companyId: input.companyId, title: input.title.trim(), description: input.description.trim(), terms: input.terms.trim(), startsAt: input.startsAt, endsAt: input.endsAt, totalQuota: input.totalQuota, perMemberLimit: input.perMemberLimit }; }
export function applyCouponAction(state: CouponState, action: CouponAction, context: CouponContext, random: () => string = () => crypto.randomUUID()): CouponResult {
    const fail = (error: string): CouponResult => ({ ok: false, error });
    if (!action.actor.memberId) return fail('請先登入。');
    if (!Number.isFinite(businessInstant(context.asOf))) return fail('系統時間無效，請重試。');
    const companyFor = (id: string) => context.companies.find(c => c.id === id);
    const owner = (id: string) => companyFor(id)?.ownerId === action.actor.memberId;
    const saveOffer = (offer: CouponOffer): CouponResult => ({ ok: true, offer, state: { ...state, offers: state.offers.some(o => o.id === offer.id) ? state.offers.map(o => o.id === offer.id ? offer : o) : [...state.offers, offer] } });
    if (action.type === 'create') {
        if (!owner(action.input.companyId)) return fail('僅公司建立者可建立優惠。');
        const errors = validateCouponInput(action.input); if (errors.length) return fail(errors.join(' '));
        return saveOffer({ ...fields(action.input), id: `offer-${random()}`, status: 'draft', version: 1 });
    }
    if (action.type === 'void' || action.type === 'redeem') {
        const claim = action.type === 'void' ? state.claims.find(c => c.id === action.id && c.memberId === action.actor.memberId) : state.claims.find(c => c.code === action.code.trim() && c.companyId === action.companyId && owner(c.companyId));
        if (!claim) return fail('找不到可操作的兌換紀錄。');
        const offer = state.offers.find(o => o.id === claim.offerId);
        if (!offer || claim.status !== 'available' || businessInstant(context.asOf) >= couponInstant(claim.expiresAt)) return fail('兌換碼已使用、作廢或到期。');
        if (claim.version !== (action.type === 'void' ? action.version : action.claimVersion)) return fail('紀錄已變更，請重新確認。');
        if (action.type === 'void' && !action.reason.trim()) return fail('請填寫作廢原因。');
        if (action.type === 'redeem' && (offer.version !== action.offerVersion || offer.status === 'suspended' || companyFor(claim.companyId)?.status === 'suspended' || businessInstant(context.asOf) < couponInstant(claim.claimedAt) || businessInstant(context.asOf) < couponInstant(claim.startsAt))) return fail('優惠或公司狀態已變更，請重新確認。');
        const updated: CouponClaim = { ...claim, version: claim.version + 1, status: action.type === 'void' ? 'void' : 'used', ...(action.type === 'void' ? { voidReason: action.reason.trim() } : { usedAt: new Date(context.asOf).toISOString() }) };
        return { ok: true, claim: updated, state: { ...state, claims: state.claims.map(c => c.id === updated.id ? updated : c) } };
    }
    const offer = state.offers.find(o => o.id === action.id);
    if (!offer) return fail('找不到優惠。');
    if (action.type === 'claim') {
        if (!action.requestId.trim()) return fail('請重新發送領取請求。');
        const request = state.requests.find(r => r.requestId === action.requestId);
        if (request) {
            if (request.memberId !== action.actor.memberId || request.offerId !== offer.id) return fail('請求識別碼已用於其他操作。');
            const claim = state.claims.find(c => c.id === request.claimId); return claim ? { ok: true, state, claim } : fail('請求紀錄無效。');
        }
        if (!eligibleCouponMember(action.actor.memberId, context)) return fail('僅當年度已確認的正常社員可領取；寬限、廣告與暫時曝光不授予資格。');
        if (!couponAvailable(offer, context)) return fail('優惠尚未開放、已到期或商家目前未公開。');
        if (!couponRemaining(state, offer)) return fail('優惠名額已滿。');
        if (state.claims.filter(c => c.offerId === offer.id && c.memberId === action.actor.memberId).length >= offer.perMemberLimit) return fail('已達每人領取上限；使用或作廢不會釋回名額。');
        const token = random(); if (state.claims.some(c => c.code === `XK-${token}`)) return fail('無法產生兌換碼，請重試。');
        const claim: CouponClaim = { id: `claim-${token}`, code: `XK-${token}`, offerId: offer.id, companyId: offer.companyId, memberId: action.actor.memberId, status: 'available', version: 1, claimedAt: new Date(context.asOf).toISOString(), startsAt: offer.startsAt, expiresAt: offer.endsAt, title: offer.title, description: offer.description, terms: offer.terms };
        return { ok: true, claim, state: { ...state, claims: [...state.claims, claim], requests: [...state.requests, { requestId: action.requestId, memberId: action.actor.memberId, offerId: offer.id, claimId: claim.id }] } };
    }
    if (offer.version !== action.version) return fail('優惠已更新，請重新載入後再操作。');
    if (action.type === 'update' || action.type === 'submit') {
        if (!owner(offer.companyId)) return fail('僅公司建立者可維護優惠。');
        if (offer.status === 'suspended') return fail('優惠已暫停，請聯絡內容管理員。');
        if (action.type === 'update') {
            if (action.input.companyId !== offer.companyId) return fail('不可變更優惠所屬公司。');
            const errors = validateCouponInput(action.input); if (errors.length) return fail(errors.join(' '));
            const issued = state.claims.filter(c => c.offerId === offer.id);
            if (action.input.totalQuota < issued.length || issued.some(c => issued.filter(x => x.memberId === c.memberId).length > action.input.perMemberLimit)) return fail('名額與每人上限不可低於已領取數量。');
            return saveOffer({ ...offer, ...fields(action.input), status: 'draft', version: offer.version + 1, reviewReason: undefined });
        }
        if (!['draft', 'rejected'].includes(offer.status) || validateCouponInput(offer).length || !(businessInstant(context.asOf) < couponInstant(offer.endsAt))) return fail('請完成有效草稿後再送審。');
        return saveOffer({ ...offer, status: 'pending', version: offer.version + 1, reviewReason: undefined });
    }
    if (action.actor.role !== 'content_admin') return fail('僅內容管理員可審核優惠。');
    if (!action.reason?.trim()) return fail('請填寫審核或暫停原因。');
    if (action.type !== 'suspend' && offer.status !== 'pending') return fail('僅待審優惠可核准或退回。');
    if (action.type === 'suspend' && (offer.status === 'suspended' || (offer.status !== 'approved' && !state.claims.some(c => c.offerId === offer.id)))) return fail('僅已核准或曾領取的優惠可暫停。');
    if (action.type === 'approve' && (validateCouponInput(offer).length || !(businessInstant(context.asOf) < couponInstant(offer.endsAt)))) return fail('優惠資料無效或已到期。');
    return saveOffer({ ...offer, status: action.type === 'approve' ? 'approved' : action.type === 'reject' ? 'rejected' : 'suspended', version: offer.version + 1, reviewReason: action.reason.trim() });
}
const base: CouponInput = { companyId: 'coffee', title: '社友咖啡交流禮', description: '手沖咖啡第二杯半價，歡迎社友交流。', terms: '限現場使用，每碼限用一次；請先出示兌換碼，由商家確認核銷。', startsAt: '2026-10-01T00:00:00Z', endsAt: '2026-11-01T00:00:00Z', totalQuota: 20, perMemberLimit: 1 };
export const demoCouponState: CouponState = { offers: [
    { ...base, id: 'coffee-welcome', status: 'approved', version: 1 },
    { ...base, companyId: 'studio', id: 'studio-consult', title: '品牌諮詢社友禮', status: 'approved', version: 1, totalQuota: 8 },
    { ...base, id: 'coffee-expired', title: '已到期示範', endsAt: '2026-10-10T00:00:00Z', status: 'approved', version: 1 },
    { ...base, id: 'coffee-full', title: '名額已滿示範', totalQuota: 1, status: 'approved', version: 1 },
    { ...base, id: 'coffee-draft', title: '週末交流草稿', status: 'draft', version: 1 },
], claims: [{ id: 'claim-demo-full', offerId: 'coffee-full', companyId: 'coffee', memberId: 'peer-6', code: 'XK-DEMO-ALREADY-USED', status: 'used', version: 2, claimedAt: '2026-10-12T02:00:00Z', startsAt: base.startsAt, expiresAt: base.endsAt, title: '名額已滿示範', description: base.description, terms: base.terms, usedAt: '2026-10-12T03:00:00Z' }], requests: [] };
