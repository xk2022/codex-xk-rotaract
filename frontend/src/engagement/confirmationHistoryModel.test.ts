import { describe, expect, it } from 'vitest';
import { demoClubs } from '../phase2/model';
import { applyBusinessAction, businessConfirmation, demoBusinessCompanies, demoBusinessMembers, demoExposureGrants } from '../phase3/businessModel';
import { confirmationExpiresAt, projectOwnConfirmations } from './confirmationHistoryModel';

const context = { members: demoBusinessMembers, clubs: demoClubs, grants: demoExposureGrants, asOf: '2026-10-15T12:00:00+08:00' };
const company = { ...demoBusinessCompanies[0], endorsements: [{ memberId: 'peer-1', confirmedAt: '2026-10-01T03:00:00Z' }, { memberId: 'peer-2', confirmedAt: '2026-10-02T03:00:00Z' }] };
describe('own business confirmation history', () => {
    it('projects only own allowlisted history and no contact, location or other members', () => {
        const rows = projectOwnConfirmations([company], 'peer-1', context);
        expect(rows).toHaveLength(1);
        expect(rows[0]).toEqual({ companyId: company.id, companyName: company.name, confirmedAt: '2026-10-01T03:00:00Z', expiresAt: '2027-10-01T11:00:00.000+08:00', version: company.version, counted: true, publiclyVisible: true });
        expect(Object.keys(rows[0]).sort()).toEqual(['companyId', 'companyName', 'confirmedAt', 'expiresAt', 'version', 'counted', 'publiclyVisible'].sort());
        expect(projectOwnConfirmations([company], 'peer-3', context)).toEqual([]);
        expect(projectOwnConfirmations([company], '', context)).toEqual([]);
        expect(projectOwnConfirmations([company], 'unknown', context)).toEqual([]);
    });
    it('keeps hidden company history and permits withdrawing without renewed eligibility', () => {
        const hidden = { ...company, status: 'suspended' as const, endorsements: [{ memberId: 'm7', confirmedAt: '2026-09-01T03:00:00Z' }] };
        const rows = projectOwnConfirmations([hidden], 'm7', context);
        expect(rows[0]).toMatchObject({ counted: false, publiclyVisible: false });
        const result = applyBusinessAction([hidden], { type: 'unendorse', actor: { memberId: 'm7', role: 'member' }, id: hidden.id, version: hidden.version }, context);
        expect(result.ok).toBe(true);
        if (result.ok) expect(projectOwnConfirmations([result.company], 'm7', context)).toEqual([]);
        expect(applyBusinessAction([hidden], { type: 'unendorse', actor: { memberId: 'peer-1', role: 'member' }, id: hidden.id, version: hidden.version }, context).ok).toBe(false);
    });
    it('matches confirmation cutoff exactly, including a Taipei leap-day anniversary', () => {
        const leap = { ...company, endorsements: [{ memberId: 'peer-1', confirmedAt: '2024-02-29T15:59:00Z' }] };
        const expires = confirmationExpiresAt(leap.endorsements[0].confirmedAt);
        expect(expires).toBe('2025-02-28T23:59:00.000+08:00');
        const historic = { ...context, members: context.members.map(m => ({ ...m, membershipYear: 2024 })) };
        for (const asOf of ['2025-02-28T23:58:59+08:00', expires]) {
            const row = projectOwnConfirmations([leap], 'peer-1', { ...historic, asOf })[0];
            expect(row.counted).toBe(businessConfirmation(leap, historic.members, historic.clubs, asOf).confirmationCount === 1);
        }
        expect(projectOwnConfirmations([leap], 'peer-1', { ...historic, asOf: expires })[0].counted).toBe(false);
    });
    it('does not count future confirmations or company owners and maintainers', () => {
        const future = { ...company, endorsements: [{ memberId: 'peer-1', confirmedAt: '2026-11-01T03:00:00Z' }, { memberId: 'm1', confirmedAt: '2026-10-01T03:00:00Z' }, { memberId: 'm5', confirmedAt: '2026-10-01T03:00:00Z' }] };
        for (const id of ['peer-1', 'm1', 'm5']) expect(projectOwnConfirmations([future], id, context)[0].counted).toBe(false);
        expect(confirmationExpiresAt('invalid')).toBe('');
    });
});
