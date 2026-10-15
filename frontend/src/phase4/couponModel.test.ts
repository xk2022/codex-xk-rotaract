import { describe, expect, it } from 'vitest';
import { demoClubs } from '../phase2/model';
import { demoBusinessCompanies, demoBusinessMembers, demoExposureGrants } from '../phase3/businessModel';
import { applyCouponAction, couponInstant, demoCouponState, eligibleCouponMember, lookupCouponCode, projectCoupons, projectMyClaims, validateCouponInput, type CouponAction, type CouponActor, type CouponContext, type CouponResult, type CouponState } from './couponModel';
const member: CouponActor = { memberId: 'peer-1', role: 'member' }, owner: CouponActor = { memberId: 'm1', role: 'member' }, admin: CouponActor = { memberId: 'admin', role: 'content_admin' };
const ctx = (): CouponContext => structuredClone({ companies: demoBusinessCompanies, members: demoBusinessMembers, clubs: demoClubs, grants: demoExposureGrants, asOf: '2026-10-15T04:00:00Z' });
const initial = () => structuredClone(demoCouponState);
function ok(r: CouponResult) { if (!r.ok) throw new Error(r.error); return r; }
let serial = 0;
const run = (s: CouponState, a: CouponAction, c = ctx()) => applyCouponAction(s, a, c, () => `test-${++serial}`);
const claim = (s = initial(), actor = member, requestId = `r-${++serial}`) => run(s, { type: 'claim', actor, id: 'coffee-welcome', requestId });
const redeem = (code: string, offerVersion = 1): Extract<CouponAction, { type: 'redeem' }> => ({ type: 'redeem', actor: owner, code, companyId: 'coffee', claimVersion: 1, offerVersion });
describe('優惠規則', () => {
 it('只投影公開有效優惠並保留滿額狀態', () => { const offers = projectCoupons(initial(), ctx()); expect(offers.map(o => o.id)).toEqual(['coffee-welcome', 'studio-consult', 'coffee-full']); expect(offers.at(-1)?.remaining).toBe(0); });
 it('匿名與非當年社員不可領', () => { for (const id of ['', 'm7', 'account-only', 'm-ob']) expect(claim(initial(), { ...member, memberId: id }).ok).toBe(false); });
 it('七月寬限不可領', () => { const c = ctx(); c.asOf = '2027-07-05T00:00:00Z'; expect(eligibleCouponMember('peer-1', c)).toBe(false); c.members[0].membershipYear = 2027; c.members[0].confirmation = 'grace'; expect(eligibleCouponMember('m1', c)).toBe(false); });
 it('社團停用不具資格', () => { const c = ctx(); c.clubs.find(x => x.id === 'taipei')!.enabled = false; expect(eligibleCouponMember('peer-1', c)).toBe(false); });
 it('同key同payload冪等，不同會員或offer拒絕', () => { const a = ok(claim(initial(), member, 'same')); const b = ok(claim(a.state, member, 'same')); expect(b.claim?.code).toBe(a.claim?.code); expect(b.state.claims.length).toBe(a.state.claims.length); expect(run(a.state, { type: 'claim', actor: member, id: 'studio-consult', requestId: 'same' }).ok).toBe(false); expect(claim(a.state, { ...member, memberId: 'peer-2' }, 'same').ok).toBe(false); });
 it('作廢不釋放每人及總名額', () => { const a = ok(claim()); const b = ok(run(a.state, { type: 'void', actor: member, id: a.claim!.id, version: 1, reason: '取消' })); expect(claim(b.state).ok).toBe(false); expect(run(initial(), { type: 'claim', actor: member, id: 'coffee-full', requestId: 'full' }).ok).toBe(false); });
 it('有效起點含、終點不含', () => { const c = ctx(); c.asOf = '2026-11-01T00:00:00Z'; expect(run(initial(), { type: 'claim', actor: member, id: 'coffee-welcome', requestId: 'end' }, c).ok).toBe(false); c.asOf = '2026-10-01T00:00:00Z'; expect(run(initial(), { type: 'claim', actor: member, id: 'coffee-welcome', requestId: 'start' }, c).ok).toBe(true); });
 it('嚴格拒絕無效日期、非UTC與浮點名額', () => { expect(Number.isNaN(couponInstant('2026-02-30T00:00:00Z'))).toBe(true); expect(Number.isNaN(couponInstant('2026-10-15T12:00:00+08:00'))).toBe(true); expect(validateCouponInput({ ...initial().offers[0], totalQuota: 1.2 }).length).toBeGreaterThan(0); });
 it('草稿及公司隱藏不能領', () => { expect(run(initial(), { type: 'claim', actor: member, id: 'coffee-draft', requestId: 'draft' }).ok).toBe(false); const c = ctx(); c.companies[0].status = 'suspended'; expect(run(initial(), { type: 'claim', actor: member, id: 'coffee-welcome', requestId: 'hidden' }, c).ok).toBe(false); });
 it('共同維護者無owner權限', () => { expect(run(initial(), { type: 'create', actor: { memberId: 'm5', role: 'member' }, input: initial().offers[0] }).ok).toBe(false); });
 it('審核需內容管理員與理由', () => { const a = ok(run(initial(), { type: 'submit', actor: owner, id: 'coffee-draft', version: 1 })); expect(run(a.state, { type: 'approve', actor: owner, id: 'coffee-draft', version: 2, reason: 'ok' }).ok).toBe(false); expect(run(a.state, { type: 'approve', actor: admin, id: 'coffee-draft', version: 2 }).ok).toBe(false); expect(ok(run(a.state, { type: 'approve', actor: admin, id: 'coffee-draft', version: 2, reason: '合規' })).offer?.status).toBe('approved'); });
 it('跨公司不可查碼核銷；查碼不投影會員', () => { const a = ok(claim()); const other: CouponActor = { memberId: 'm5', role: 'member' }; expect(lookupCouponCode(a.state, a.claim!.code, 'coffee', other, ctx())).toBeUndefined(); expect(run(a.state, { ...redeem(a.claim!.code), actor: other, companyId: 'studio' }).ok).toBe(false); expect(lookupCouponCode(a.state, a.claim!.code, 'coffee', owner, ctx())).not.toHaveProperty('memberId'); });
 it('核銷需版本相符且不可重複', () => { const a = ok(claim()); expect(run(a.state, redeem(a.claim!.code, 2)).ok).toBe(false); const b = ok(run(a.state, redeem(a.claim!.code))); expect(b.claim?.status).toBe('used'); expect(run(b.state, redeem(a.claim!.code)).ok).toBe(false); });
 it('曝光到期不影響既有碼，但公司暫停阻擋', () => { const a = ok(claim()); const c = ctx(); c.members.forEach(m => m.active = false); expect(run(a.state, redeem(a.claim!.code), c).ok).toBe(true); c.companies[0].status = 'suspended'; expect(run(a.state, redeem(a.claim!.code), c).ok).toBe(false); });
 it('編輯退草稿；原碼效期內容不變且仍可用；管理員仍可暫停', () => { const a = ok(claim()); const original = a.state.offers[0]; const b = ok(run(a.state, { type: 'update', actor: owner, id: original.id, version: 1, input: { ...original, description: '改優惠', endsAt: '2026-12-01T00:00:00Z' } })); expect(b.offer?.status).toBe('draft'); expect(b.state.claims.at(-1)?.description).toBe(original.description); expect(b.state.claims.at(-1)?.expiresAt).toBe(original.endsAt); expect(run(b.state, redeem(a.claim!.code, 2)).ok).toBe(true); const d = ok(run(b.state, { type: 'suspend', actor: admin, id: original.id, version: 2, reason: '違規' })); expect(run(d.state, redeem(a.claim!.code, 3)).ok).toBe(false); });
 it('無效系統日期拒絕且不拋例外', () => { const c = ctx(); c.asOf = '2026-02-30T00:00:00Z'; expect(run(initial(), { type: 'claim', actor: member, id: 'coffee-welcome', requestId: 'invalid' }, c).ok).toBe(false); });
 it('過期碼不可用，錢包只提供本人', () => { const a = ok(claim()); const c = ctx(); c.asOf = a.claim!.expiresAt; expect(run(a.state, redeem(a.claim!.code), c).ok).toBe(false); expect(projectMyClaims(a.state, member)).toHaveLength(1); expect(projectMyClaims(a.state, owner)).toHaveLength(0); });
 it('作廢與已用不再可核銷並持續占每人名額', () => { const a = ok(claim()); const v = ok(run(a.state, { type: 'void', actor: member, id: a.claim!.id, version: 1, reason: '取消' })); expect(run(v.state, { ...redeem(a.claim!.code), claimVersion: 2 }).ok).toBe(false); const u = ok(run(a.state, redeem(a.claim!.code))); expect(claim(u.state).ok).toBe(false); });
 it('owner延長效期不能延長原碼', () => { const a = ok(claim()); const offer = a.state.offers[0]; const b = ok(run(a.state, { type: 'update', actor: owner, id: offer.id, version: 1, input: { ...offer, endsAt: '2026-12-01T00:00:00Z' } })); const c = ctx(); c.asOf = offer.endsAt; expect(b.state.claims.at(-1)?.expiresAt).toBe(offer.endsAt); expect(run(b.state, redeem(a.claim!.code, 2), c).ok).toBe(false); });

 it('商家檢查取得領取快照與已核銷時間，且不包含會員或代碼', () => {
  const a = ok(claim()); const offer = a.state.offers[0];
  const b = ok(run(a.state, { type: 'update', actor: owner, id: offer.id, version: 1, input: { ...offer, description: '新版內容', terms: '新版條件', endsAt: '2026-12-01T00:00:00Z' } }));
  const view = lookupCouponCode(b.state, a.claim!.code, 'coffee', owner, ctx())!;
  expect(view.description).toBe(offer.description); expect(view.terms).toBe(offer.terms); expect(view.expiresAt).toBe(offer.endsAt);
  expect(view).not.toHaveProperty('memberId'); expect(view).not.toHaveProperty('code'); expect(view).not.toHaveProperty('claimedAt');
  const c = ok(run(b.state, redeem(a.claim!.code, 2)));
  expect(lookupCouponCode(c.state, a.claim!.code, 'coffee', owner, ctx())?.usedAt).toBe(c.claim?.usedAt);
  expect(lookupCouponCode(c.state, a.claim!.code, 'coffee', member, ctx())).toBeUndefined();
 });
});
