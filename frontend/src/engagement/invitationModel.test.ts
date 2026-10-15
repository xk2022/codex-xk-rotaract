import { describe, expect, it } from 'vitest';
import { demoBusinessCompanies, demoBusinessMembers, businessEligibility, businessConfirmation, canMaintainBusiness, type BusinessActor } from '../phase3/businessModel';
import { demoClubs } from '../phase2/model';
import { applyInvitationAction, projectInvitations, type InvitationAction } from './invitationModel';
const company = structuredClone(demoBusinessCompanies.find(c => c.id === 'coffee')!);
const owner: BusinessActor = { memberId: company.ownerId, role: 'member' };
const peer: BusinessActor = { memberId: 'peer-1', role: 'member' };
const other: BusinessActor = { memberId: 'peer-2', role: 'member' };
const context = { members: demoBusinessMembers, asOf: '2026-10-15T12:00:00+08:00' };
const invite: InvitationAction = { type: 'invite', actor: owner, companyId: company.id, companyVersion: company.version, inviteeId: peer.memberId };
function pending() { const r = applyInvitationAction([company], [], invite, context, () => 'i1'); if (!r.ok) throw Error(r.error); return r; }
function reply(type: 'accept' | 'reject' | 'cancel', actor = peer): Extract<InvitationAction, { type: 'accept' | 'reject' | 'cancel' }> { return { type, actor, id: 'i1', version: 1, companyVersion: company.version }; }
describe('maintainer invitations', () => {
    it('requires consent then grants only maintenance, preserving publication and association', () => {
        const s = pending(); expect(canMaintainBusiness(s.companies[0], peer)).toBe(false);
        const r = applyInvitationAction(s.companies, s.invitations, reply('accept'), context);
        expect(r.ok).toBe(true); if (!r.ok) return;
        expect(canMaintainBusiness(r.companies[0], peer)).toBe(true);
        expect(r.companies[0]).toEqual({ ...company, acceptedMaintainerIds: [...company.acceptedMaintainerIds, peer.memberId], version: company.version + 1 });
        expect(r.invitations[0]).toMatchObject({ status: 'accepted', version: 2 });
        expect(s.invitations[0].status).toBe('pending'); expect(company.acceptedMaintainerIds).not.toContain(peer.memberId);
    });
    it('rejects self, unknown, existing maintainer and duplicate pending invitations', () => {
        for (const inviteeId of [company.ownerId, 'unknown', company.acceptedMaintainerIds[0]]) expect(applyInvitationAction([company], [], { ...invite, inviteeId }, context).ok).toBe(false);
        const s = pending(); expect(applyInvitationAction(s.companies, s.invitations, invite, context).ok).toBe(false);
    });
    it('requires the owner and rejects admin authority, anonymous and maintainers inviting others', () => {
        for (const actor of [peer, { memberId: '', role: 'member' as const }, { ...owner, role: 'content_admin' as const }, { memberId: company.acceptedMaintainerIds[0], role: 'member' as const }]) expect(applyInvitationAction([company], [], { ...invite, actor }, context).ok).toBe(false);
    });
    it('only recipient replies and owner cancels; processed invitations cannot be reused', () => {
        const s = pending();
        for (const type of ['accept', 'reject'] as const) for (const actor of [owner, other]) expect(applyInvitationAction(s.companies, s.invitations, reply(type, actor), context).ok).toBe(false);
        expect(applyInvitationAction(s.companies, s.invitations, reply('cancel', peer), context).ok).toBe(false);
        for (const [type, actor, status] of [['reject', peer, 'rejected'], ['cancel', owner, 'cancelled']] as const) {
            const r = applyInvitationAction(s.companies, s.invitations, reply(type, actor), context);
            expect(r.ok && r.invitations[0].status).toBe(status); expect(r.ok && r.companies[0]).toEqual(company);
            if (r.ok) expect(applyInvitationAction(r.companies, r.invitations, { ...reply('accept'), version: 2 }, context).ok).toBe(false);
        }
    });
    it('checks company and invitation versions and prevents duplicate accept', () => {
        const s = pending(); for (const patch of [{ version: 0 }, { companyVersion: 0 }]) expect(applyInvitationAction(s.companies, s.invitations, { ...reply('accept'), ...patch }, context).ok).toBe(false);
        const r = applyInvitationAction(s.companies, s.invitations, reply('accept'), context); if (!r.ok) throw Error(r.error);
        expect(applyInvitationAction(r.companies, r.invitations, { ...reply('accept'), version: 2, companyVersion: company.version + 1 }, context).ok).toBe(false);
    });
    it('suspended companies block acceptance, but permit cancellation and rejection', () => {
        const s = pending(); const suspended = [{ ...company, status: 'suspended' as const }];
        expect(applyInvitationAction(suspended, s.invitations, reply('accept'), context).ok).toBe(false);
        expect(applyInvitationAction(suspended, s.invitations, reply('reject'), context).ok).toBe(true);
        expect(applyInvitationAction(suspended, s.invitations, reply('cancel', owner), context).ok).toBe(true);
    });
    it('owner revokes accepted maintenance, preserving independent company association even when suspended', () => {
        const s = pending(); const a = applyInvitationAction(s.companies, s.invitations, reply('accept'), context); if (!a.ok) throw Error(a.error);
        const associated = { ...a.companies[0], acceptedMemberIds: [peer.memberId], status: 'suspended' as const };
        const action: InvitationAction = { type: 'revoke', actor: owner, companyId: company.id, companyVersion: associated.version, memberId: peer.memberId };
        expect(applyInvitationAction([associated], a.invitations, { ...action, actor: peer }, context).ok).toBe(false);
        const r = applyInvitationAction([associated], a.invitations, action, context); expect(r.ok).toBe(true); if (!r.ok) return;
        expect(r.invitations[0]).toMatchObject({ status: 'revoked', version: 3 });
        expect(r.companies[0].acceptedMemberIds).toEqual([peer.memberId]); expect(canMaintainBusiness(r.companies[0], peer)).toBe(false);
        expect(r.companies[0].ownerId).toBe(company.ownerId);
    });
    it('revokes legacy maintenance without an invitation, never the owner', () => {
        const memberId = company.acceptedMaintainerIds[0]; const action: InvitationAction = { type: 'revoke', actor: owner, companyId: company.id, companyVersion: company.version, memberId };
        const r = applyInvitationAction([company], [], action, context); expect(r.ok && r.companies[0].acceptedMaintainerIds).not.toContain(memberId);
        expect(applyInvitationAction([company], [], { ...action, memberId: owner.memberId }, context).ok).toBe(false);
    });
    it('retains endorsement history but excludes an accepted maintainer from confirmation totals', () => {
        const endorsed = { ...company, endorsements: [{ memberId: peer.memberId, confirmedAt: context.asOf }] }; const s = pending();
        expect(businessConfirmation(endorsed, demoBusinessMembers, demoClubs, context.asOf).confirmationCount).toBe(1);
        const r = applyInvitationAction([endorsed], s.invitations, reply('accept'), context); if (!r.ok) throw Error(r.error);
        expect(r.companies[0].endorsements).toEqual(endorsed.endorsements);
        expect(businessConfirmation(r.companies[0], demoBusinessMembers, demoClubs, context.asOf).confirmationCount).toBe(0);
    });
    it('projects only own invitations with an explicit allowlist', () => {
        const row = { ...pending().invitations[0], secret: 'private' };
        expect(projectInvitations([row], owner)).toHaveLength(1); expect(projectInvitations([row], peer)).toHaveLength(1);
        expect(projectInvitations([row], other)).toEqual([]); expect(projectInvitations([row], { ...owner, role: 'content_admin' })).toEqual([]);
        expect(JSON.stringify(projectInvitations([row], owner))).not.toContain('private');
    });
    it('safely rejects invalid clock, missing records, identifier collisions and backwards response time', () => {
        expect(applyInvitationAction([company], [], invite, { ...context, asOf: 'bad' }).ok).toBe(false);
        expect(applyInvitationAction([], [], invite, context).ok).toBe(false); expect(applyInvitationAction([company], [], reply('accept'), context).ok).toBe(false);
        const s = pending(); expect(applyInvitationAction([company], s.invitations, { ...invite, inviteeId: other.memberId }, context, () => 'i1').ok).toBe(false);
        expect(applyInvitationAction([company], s.invitations, reply('accept'), { ...context, asOf: '2026-10-14' }).ok).toBe(false);
    });
    it('allows reinvitation after rejection and leaves unrelated invitations intact', () => {
        const s = pending(); const r = applyInvitationAction(s.companies, s.invitations, reply('reject'), context); if (!r.ok) throw Error(r.error);
        expect(applyInvitationAction(r.companies, r.invitations, invite, context, () => 'new-id').ok).toBe(true);
        const otherRow = { ...s.invitations[0], id: 'other', companyId: 'studio' };
        const c = applyInvitationAction(s.companies, [...s.invitations, otherRow], reply('cancel', owner), context); expect(c.ok && c.invitations[1]).toEqual(otherRow);
    });
    it('allows an account-only owner to invite an inactive account without granting free exposure', () => {
        const accountCompany = structuredClone(demoBusinessCompanies.find(c => c.id === 'account-paid')!);
        const accountOwner: BusinessActor = { memberId: 'account-only', role: 'member' };
        const inactiveMember: BusinessActor = { memberId: 'm-ob', role: 'member' };
        const invited = applyInvitationAction([accountCompany], [], { type: 'invite', actor: accountOwner, companyId: accountCompany.id, companyVersion: accountCompany.version, inviteeId: inactiveMember.memberId }, context, () => 'inactive-invitation');
        expect(invited.ok).toBe(true); if (!invited.ok) return;
        const accepted = applyInvitationAction(invited.companies, invited.invitations, { type: 'accept', actor: inactiveMember, id: 'inactive-invitation', version: 1, companyVersion: accountCompany.version }, context);
        expect(accepted.ok).toBe(true); if (!accepted.ok) return;
        expect(canMaintainBusiness(accepted.companies[0], inactiveMember)).toBe(true);
        expect(accepted.companies[0].acceptedMemberIds).toEqual(accountCompany.acceptedMemberIds);
        expect(businessEligibility(accepted.companies[0], demoBusinessMembers, demoClubs, [], context.asOf)).toMatchObject({ free: false, paid: false, eligible: false });
    });

});
