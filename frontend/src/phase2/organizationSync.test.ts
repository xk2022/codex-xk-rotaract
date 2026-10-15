import { describe, expect, it } from 'vitest';
import { initialOrganizations, type OrgContext } from '../features/organizationModel';
import { applyEventAction, demoClubs, demoEvents, publicClubs, publicProjection, type CommunityEvent } from './model';
import { synchronizeOrganization, type OrganizationCommunityState } from './organizationSync';
const ctx: OrgContext = { actor: 'district', office: 'president', district: 'D3481' };
const at = new Date('2026-10-23T15:00:00Z');
const seed = (): OrganizationCommunityState => ({ organizations: initialOrganizations(), clubs: structuredClone(demoClubs), events: structuredClone(demoEvents) });
const status = (enabled: boolean) => ({ type: 'status' as const, clubId: 'taipei', enabled, reason: '測試狀態同步' });
describe('organization / community synchronization', () => {
    it('withdraws ongoing and future events at captured time, preserves ended and exact end boundary history', () => {
        const state = seed();
        const boundary: CommunityEvent = { ...state.events[0], id: 'boundary', time: { kind: 'timed', startAt: '2026-10-23T14:00:00Z', endAt: at.toISOString(), timeZone: 'Asia/Taipei' } };
        state.events.push(boundary);
        const next = synchronizeOrganization(state, status(false), ctx, at);
        expect(publicClubs(next.clubs).some(c => c.id === 'taipei')).toBe(false);
        expect(next.clubs.find(c => c.id === 'taipei')?.disabledAt).toBe(at.toISOString());
        const visible = publicProjection(next.events, next.clubs, at).map(e => e.id);
        expect(visible).toContain('city-walk');
        expect(visible).toContain('boundary');
        expect(visible).not.toContain('cross-day');
        expect(next.events.find(e => e.id === 'cross-day')).toMatchObject({ status: 'published', publicWithdrawnAt: at.toISOString(), version: 1 });
        expect(state.events.find(e => e.id === 'cross-day')?.publicWithdrawnAt).toBeUndefined();
        expect(next.clubs.find(c => c.id === 'kaohsiung')).toEqual(state.clubs.find(c => c.id === 'kaohsiung'));
    });
    it('keeps withdrawal after restoration and time passage, while copied/new drafts can publish normally', () => {
        const stopped = synchronizeOrganization(seed(), status(false), ctx, at);
        const restored = synchronizeOrganization(stopped, status(true), ctx, new Date('2026-10-24T15:00:00Z'));
        expect(publicProjection(restored.events, restored.clubs, new Date('2027-01-01')).map(e => e.id)).not.toContain('cross-day');
        expect(restored.clubs.find(c => c.id === 'taipei')).toMatchObject({ enabled: true, public: true, emailPublic: true });
        const actor = { role: 'club_president' as const, clubId: 'taipei' };
        const copied = applyEventAction(restored.events, restored.clubs, { type: 'copy', actor, id: 'cross-day', version: 1 }, 'copy');
        expect(copied.ok).toBe(true);
        if (!copied.ok) throw Error(copied.error);
        expect(copied.event.publicWithdrawnAt).toBeUndefined();
        const published = applyEventAction([copied.event], restored.clubs, { type: 'publish', actor, id: 'copy', version: 0 });
        expect(published.ok && publicProjection([published.event], restored.clubs).length).toBe(1);
        const draft = restored.events.find(e => e.id === 'draft')!;
        const fresh = applyEventAction(restored.events, restored.clubs, { type: 'publish', actor, id: draft.id, version: draft.version });
        expect(fresh.ok && publicProjection([fresh.event], restored.clubs).length).toBe(1);
    });
    it('rejects wrong district before changing either projection', () => {
        const state = seed();
        expect(() => synchronizeOrganization(state, status(false), { ...ctx, district: 'D3462' }, at)).toThrow('不可操作其他地區');
        expect(state.clubs.find(c => c.id === 'taipei')?.enabled).toBe(true);
    });
    it('retains privacy and public names on status-only commands, explicit privacy edits still apply', () => {
        const state = seed();
        const next = synchronizeOrganization(state, status(false), ctx, at);
        expect(next.clubs[0].name).toBe(state.clubs[0].name);
        expect(next.clubs[0].emailPublic).toBe(true);
        const edited = synchronizeOrganization(next, { type: 'edit', clubId: 'taipei', patch: { publicEmail: false } }, ctx, at);
        expect(edited.clubs[0].emailPublic).toBe(false);
    });
    it('projects completed cross-district moves only after both approvals and preserves other fixtures', () => {
        let state = synchronizeOrganization(seed(), { type: 'move', id: 'move', clubId: 'taipei', to: 'D3462', reason: '調整' }, ctx, at);
        state = synchronizeOrganization(state, { type: 'approveMove', id: 'move' }, ctx, at);
        expect(state.clubs[0].districtId).toBe('d3481');
        state = synchronizeOrganization(state, { type: 'approveMove', id: 'move' }, { ...ctx, district: 'D3462' }, at);
        expect(state.clubs[0].districtId).toBe('d3462');
        expect(() => synchronizeOrganization(state, status(false), ctx, at)).toThrow();
    });
    it('preserves actual club type when projecting newly created clubs', () => {
        const state = synchronizeOrganization(seed(), { type: 'add', id: 'rotary', name: '新扶輪社', clubType: '扶輪社' }, ctx, at);
        expect(state.clubs.find(c => c.id === 'rotary')).toMatchObject({ clubTypeCode: 'ROTARY', districtId: 'd3481', emailPublic: false });
    });
});
