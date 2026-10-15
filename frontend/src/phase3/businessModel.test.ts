import { describe, expect, it } from 'vitest';
import { demoClubs } from '../phase2/model';
import { applyBusinessAction, businessEligibility, canMaintainBusiness, demoBusinessCompanies, demoBusinessMembers, demoExposureGrants, filterBusinesses, grantEndsOn, projectBusiness, validateBusinessInput, businessConfirmation, demoExposureGrants as grants, type BusinessCompany } from './businessModel';

const coffee = demoBusinessCompanies.find(c => c.id === 'coffee')!;
const member = { memberId: 'm1', role: 'member' as const };
const admin = { memberId: 'admin', role: 'content_admin' as const };
function project(company = coffee, date = '2026-10-15') { return projectBusiness(company, demoBusinessMembers, demoClubs, demoExposureGrants, date); }
describe('business public projection and lifecycle', () => {
    const context = { members: demoBusinessMembers, clubs: demoClubs, grants, asOf: '2026-10-15T12:34:00+08:00' };
    it('self-publishes without prior approval and ends trial at the exact 72-hour instant', () => {
        const draft = { ...coffee, ownerId: 'account-only', acceptedMemberIds: [], status: 'draft' as const, firstPublishedAt: undefined };
        const actor = { memberId: 'account-only', role: 'member' as const };
        const result = applyBusinessAction([draft], { type: 'publish', actor, id: draft.id, version: 1 }, context);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(projectBusiness(result.company, context.members, demoClubs, [], '2026-10-18T12:33:59+08:00')?.exposure).toBe('trial');
        expect(projectBusiness(result.company, context.members, demoClubs, [], '2026-10-18T12:34:00+08:00')).toBeUndefined();
        const edited = applyBusinessAction([result.company], { type: 'update', actor, id: draft.id, version: 2, input: { ...draft, description: '重登後修改' } }, context);
        expect(edited.ok).toBe(true);
        if (!edited.ok) return;
        const republished = applyBusinessAction([edited.company], { type: 'publish', actor, id: draft.id, version: 3 }, { ...context, asOf: '2026-11-01' });
        expect(republished.ok && republished.company.firstPublishedAt).toBe(result.company.firstPublishedAt);
        expect(republished.ok && projectBusiness(republished.company, context.members, demoClubs, [], '2026-11-01')).toBeUndefined();
    });
    it('supports paid exposure for an account with no membership and retains all public gates', () => {
        const company = demoBusinessCompanies.find(c => c.id === 'account-paid')!;
        expect(project(company)?.exposure).toBe('advertisement');
        expect(project(company)?.mapVisible).toBe(true);
        expect(project({ ...company, status: 'suspended' })).toBeUndefined();
        expect(project({ ...company, status: 'draft' })).toBeUndefined();
        expect(project({ ...company, locationConsent: false })?.mapVisible).toBe(false);
    });
    it('uses Taipei date for paid and membership boundaries with UTC instants', () => {
        const company = demoBusinessCompanies.find(c => c.id === 'expired')!;
        expect(projectBusiness(company, context.members, demoClubs, grants, '2026-10-14T15:59:59Z')?.exposure).toBe('advertisement');
        expect(projectBusiness(company, context.members, demoClubs, grants, '2026-10-14T16:00:00Z')).toBeUndefined();
    });
    it('requires six distinct eligible peers and rejects duplicate, self, maintainer and invalid accounts', () => {
        let current = structuredClone(coffee);
        for (let i = 1; i <= 6; i++) {
            const result = applyBusinessAction([current], { type: 'endorse', actor: { memberId: `peer-${i}`, role: 'member' }, id: current.id, version: current.version }, context);
            expect(result.ok).toBe(true); if (result.ok) current = result.company;
            expect(businessConfirmation(current, context.members, demoClubs, context.asOf).communityConfirmed).toBe(i === 6);
        }
        for (const memberId of ['peer-1', 'm1', 'm5', '', 'account-only']) expect(applyBusinessAction([current], { type: 'endorse', actor: { memberId, role: 'member' }, id: current.id, version: current.version }, context).ok).toBe(false);
        const dto = projectBusiness(current, context.members, demoClubs, [], context.asOf)!;
        expect(dto.confirmationCount).toBe(6); expect(dto.communityConfirmed).toBe(true);
        expect(JSON.stringify(dto)).not.toContain('peer-');
        const removed = applyBusinessAction([current], { type: 'unendorse', actor: { memberId: 'peer-1', role: 'member' }, id: current.id, version: current.version }, context);
        expect(removed.ok && businessConfirmation(removed.company, context.members, demoClubs, context.asOf).communityConfirmed).toBe(false);
    });
    it('confirmation has an exclusive calendar-year expiry, including leap-day clamping', () => {
        const company = { ...coffee, endorsements: [{ memberId: 'peer-1', confirmedAt: '2024-02-29T12:34:00+08:00' }] };
        const members = context.members.map(m => ({ ...m, membershipYear: 2024 }));
        expect(businessConfirmation(company, members, demoClubs, '2025-02-28T12:33:59+08:00').confirmationCount).toBe(1);
        expect(businessConfirmation(company, members, demoClubs, '2025-02-28T12:34:00+08:00').confirmationCount).toBe(0);
    });
    it('significant company changes reset confirmation but phone and description do not', () => {
        const company = { ...coffee, endorsements: [{ memberId: 'peer-1', confirmedAt: context.asOf }] };
        for (const input of [{ ...company, name: '新公司名' }, { ...company, address: '新營業地址' }, { ...company, latitude: 24 }]) {
            const result = applyBusinessAction([company], { type: 'update', actor: member, id: company.id, version: 1, input }, context);
            expect(result.ok && result.company.endorsements).toEqual([]);
        }
        const result = applyBusinessAction([company], { type: 'update', actor: member, id: company.id, version: 1, input: { ...company, phone: '02-0000-9999', description: '新說明' } }, context);
        expect(result.ok && result.company.endorsements).toHaveLength(1);
    });
    it('confirmation does not grant exposure and expired invisible companies cannot be endorsed', () => {
        const company = { ...coffee, ownerId: 'account-only', acceptedMemberIds: [], endorsements: Array.from({ length: 6 }, (_, i) => ({ memberId: `peer-${i + 1}`, confirmedAt: context.asOf })) };
        expect(businessConfirmation(company, context.members, demoClubs, context.asOf).communityConfirmed).toBe(true);
        expect(projectBusiness(company, context.members, demoClubs, [], context.asOf)).toBeUndefined();
        expect(applyBusinessAction([company], { type: 'endorse', actor: { memberId: 'm1', role: 'member' }, id: company.id, version: 1 }, context).ok).toBe(false);
    });
    it('allows a signed-in account to withdraw its own confirmation after losing membership or company suspension', () => {
        const company = { ...coffee, status: 'suspended' as const, endorsements: [{ memberId: 'account-only', confirmedAt: context.asOf }] };
        const result = applyBusinessAction([company], { type: 'unendorse', actor: { memberId: 'account-only', role: 'member' }, id: company.id, version: 1 }, context);
        expect(result.ok && result.company.endorsements).toEqual([]);
    });
    it('publishes only approved qualified companies and returns no private contact or member IDs', () => {
        const result = project()!;
        expect(result.name).toBe('日常之間咖啡');
        expect(result.email).toBeUndefined();
        expect(result.address).toBeUndefined();
        expect(JSON.stringify(result)).not.toContain('private-business');
        expect(result).not.toHaveProperty('ownerId');
        expect(project({ ...coffee, status: 'pending' })).toBeUndefined();
    });
    it('requires at least one public business contact, regardless of paid status', () => {
        const hidden = { ...coffee, publicFlags: { phone: false, email: false, website: false, address: false } };
        expect(project(hidden)).toBeUndefined();
        expect(validateBusinessInput(hidden)).toContain('至少提供並公開一項營業聯絡方式。');
    });
    it('lists businesses without coordinates but never supplies map coordinates without consent', () => {
        expect(project({ ...coffee, latitude: null, longitude: null })?.mapVisible).toBe(false);
        const result = project({ ...coffee, locationConsent: false })!;
        expect(result.latitude).toBeUndefined();
        expect(result.longitude).toBeUndefined();
        expect(result.mapVisible).toBe(false);
    });
    it('permits separately consented manual business coordinates with a private address', () => {
        expect(project()?.address).toBeUndefined();
        expect(project()?.mapVisible).toBe(true);
    });
    it('shared enabled club state controls free qualification; accepted second member can qualify', () => {
        const clubs = demoClubs.map(c => c.id === 'taipei' ? { ...c, enabled: false } : c);
        expect(businessEligibility(coffee, demoBusinessMembers, clubs, [], '2026-10-15').free).toBe(true);
        expect(businessEligibility({ ...coffee, acceptedMemberIds: [] }, demoBusinessMembers, clubs, [], '2026-10-15').free).toBe(false);
    });
    it('July grace stops in August and qualification follows Rotary year', () => {
        const members = [{ ...demoBusinessMembers[0], confirmation: 'grace' as const }];
        const company = { ...coffee, acceptedMemberIds: [] };
        expect(businessEligibility(company, members, demoClubs, [], '2026-07-31').free).toBe(true);
        expect(businessEligibility(company, members, demoClubs, [], '2026-08-01').free).toBe(false);
        expect(businessEligibility(coffee, demoBusinessMembers, demoClubs, [], '2027-07-01').free).toBe(true);
        expect(businessEligibility(coffee, demoBusinessMembers, demoClubs, [], '2027-08-01').free).toBe(false);
    });
    it('July accepts previous-year confirmed grace but not previous-year unconfirmed or older years', () => {
        const company = { ...coffee, acceptedMemberIds: [] };
        const previous = { ...demoBusinessMembers[0], membershipYear: 2025 };
        expect(businessEligibility(company, [previous], demoClubs, [], '2026-07-31').free).toBe(true);
        expect(businessEligibility(company, [previous], demoClubs, [], '2026-08-01').free).toBe(false);
        expect(businessEligibility(company, [{ ...previous, confirmation: 'unconfirmed' }], demoClubs, [], '2026-07-01').free).toBe(false);
        expect(businessEligibility(company, [{ ...previous, membershipYear: 2024 }], demoClubs, [], '2026-07-01').free).toBe(false);
    });
    it('free exposure lists qualifying call names only while valid business coordinates stay independent', () => {
        const members = demoBusinessMembers.map(m => m.id === 'm5' ? { ...m, active: false } : m);
        expect(projectBusiness(coffee, members, demoClubs, [], '2026-10-15')?.contacts.map(c => c.callName)).toEqual(['Sunny']);
        const result = projectBusiness(coffee, members.map(m => ({ ...m, callName: '' })), demoClubs, [], '2026-10-15');
        expect(result?.mapVisible).toBe(true);
        expect(result?.contacts).toEqual([]);
    });
    it('paid grants use exclusive annual end dates and clamp leap day', () => {
        expect(grantEndsOn('2024-02-29')).toBe('2025-02-28');
        expect(grantEndsOn('2026-02-30')).toBe('');
        const grant = [{ id: 'x', companyId: coffee.id, startsOn: '2025-10-15', status: 'active' as const }];
        expect(businessEligibility(coffee, [], demoClubs, grant, '2026-10-14').paid).toBe(true);
        expect(businessEligibility(coffee, [], demoClubs, grant, '2026-10-15').paid).toBe(false);
    });
    it('active paid advertising takes precedence over free qualification', () => {
        const grant = [{ id: 'x', companyId: coffee.id, startsOn: '2026-01-01', status: 'active' as const }];
        expect(projectBusiness(coffee, demoBusinessMembers, demoClubs, grant, '2026-10-15')?.exposure).toBe('advertisement');
    });
    it('independent paid exposure and historical public club attribution survive club suspension', () => {
        const travel = demoBusinessCompanies.find(c => c.id === 'travel')!;
        const clubs = demoClubs.map(c => c.id === 'kaohsiung' ? { ...c, enabled: false } : c);
        const result = projectBusiness(travel, demoBusinessMembers, clubs, demoExposureGrants, '2026-10-15');
        expect(result?.exposure).toBe('advertisement');
        expect(result?.mapVisible).toBe(true);
        expect(result?.contacts).toEqual([{ callName: 'Jo', clubId: 'kaohsiung', clubName: clubs.find(c => c.id === 'kaohsiung')!.name }]);
        expect(projectBusiness(travel, demoBusinessMembers, clubs, demoExposureGrants, '2027-07-01')).toBeUndefined();
    });
    it('rejects unsafe website protocols and invalid coordinates', () => {
        expect(project({ ...coffee, website: 'javascript:alert(1)', publicFlags: { ...coffee.publicFlags, website: true } })).toBeUndefined();
        expect(validateBusinessInput({ ...coffee, latitude: 91 }).length).toBeGreaterThan(0);
    });
    it('filters only public fields and combines keyword, industry, club, city and map filters', () => {
        const list = demoBusinessCompanies.flatMap(c => project(c) ?? []);
        expect(filterBusinesses(list, { keyword: 'Sunny', industryId: 'food', clubId: 'taipei', city: '台北', mapOnly: true }).map(c => c.id)).toEqual(['coffee']);
        expect(filterBusinesses(list, { keyword: 'private-business' })).toEqual([]);
    });
    it('allows accepted maintainer but no automatic club/district edit access', () => {
        expect(canMaintainBusiness(coffee, { memberId: 'm5', role: 'member' })).toBe(true);
        expect(canMaintainBusiness(coffee, { memberId: 'other', role: 'district_manager' })).toBe(false);
        expect(applyBusinessAction([coffee], { type: 'update', actor: { memberId: 'other', role: 'club_manager' }, id: coffee.id, version: 1, input: coffee }).ok).toBe(false);
    });
    it('editing approved content removes it from public until resubmitted and reviewed', () => {
        const result = applyBusinessAction([coffee], { type: 'update', actor: member, id: coffee.id, version: 1, input: { ...coffee, name: '已更正公司' } });
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.company.status).toBe('draft');
        expect(project(result.company)).toBeUndefined();
        const submitted = applyBusinessAction([result.company], { type: 'submit', actor: member, id: coffee.id, version: 2 });
        expect(submitted.ok && submitted.company.status).toBe('pending');
    });
    it('preserves original data on version conflict', () => {
        const original = structuredClone(coffee);
        const result = applyBusinessAction([coffee], { type: 'update', actor: member, id: coffee.id, version: 0, input: { ...coffee, name: '未送出輸入' } });
        expect(result.ok).toBe(false);
        expect(coffee).toEqual(original);
    });
    it('does not accept identity or ownership changes hidden in an input object', () => {
        const result = applyBusinessAction([coffee], { type: 'update', actor: member, id: coffee.id, version: 1, input: { ...coffee, ownerId: 'attacker', id: 'other' } as BusinessCompany });
        expect(result.ok && result.company.id).toBe('coffee');
        expect(result.ok && result.company.ownerId).toBe('m1');
    });
    it('review is scoped to platform content role and requires reasons for reject or suspend', () => {
        const pending: BusinessCompany = { ...coffee, status: 'pending' };
        expect(applyBusinessAction([pending], { type: 'approve', actor: member, id: coffee.id, version: 1 }).ok).toBe(false);
        expect(applyBusinessAction([pending], { type: 'reject', actor: admin, id: coffee.id, version: 1 }).ok).toBe(false);
        expect(applyBusinessAction([pending], { type: 'approve', actor: admin, id: coffee.id, version: 1 }).ok).toBe(true);
        const result = applyBusinessAction([coffee], { type: 'suspend', actor: admin, id: coffee.id, version: 1, reason: '內容待查核' });
        expect(result.ok && project(result.company)).toBeUndefined();
    });
});
