import { describe, expect, it } from 'vitest';
import { demoClubs } from '../phase2/model';
import { applyBusinessAction, businessEligibility, canMaintainBusiness, demoBusinessCompanies, demoBusinessMembers, demoExposureGrants, filterBusinesses, grantEndsOn, projectBusiness, validateBusinessInput, type BusinessCompany } from './businessModel';

const coffee = demoBusinessCompanies.find(c => c.id === 'coffee')!;
const member = { memberId: 'm1', role: 'member' as const };
const admin = { memberId: 'admin', role: 'content_admin' as const };
function project(company = coffee, date = '2026-10-15') { return projectBusiness(company, demoBusinessMembers, demoClubs, demoExposureGrants, date); }
describe('business public projection and lifecycle', () => {
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
    it('free exposure lists qualifying call names only and missing call names disable map projection', () => {
        const members = demoBusinessMembers.map(m => m.id === 'm5' ? { ...m, active: false } : m);
        expect(projectBusiness(coffee, members, demoClubs, [], '2026-10-15')?.contacts.map(c => c.callName)).toEqual(['Sunny']);
        const result = projectBusiness(coffee, members.map(m => ({ ...m, callName: '' })), demoClubs, [], '2026-10-15');
        expect(result?.mapVisible).toBe(false);
        expect(result?.latitude).toBeUndefined();
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
