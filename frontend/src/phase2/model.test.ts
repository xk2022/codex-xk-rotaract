import { describe, expect, it } from 'vitest';
import { applyEventAction, demoClubs, demoEvents, eventBounds, localDateTimeToUtc, publicClubs, publicProjection, searchEvents, validateEventInput, visibleEvents, type EventActor, type EventInput } from './model';
const president: EventActor = { role: 'club_president', clubId: 'taipei' };
const manager: EventActor = { role: 'club_manager', clubId: 'taipei' };
const draft = demoEvents.find(e => e.id === 'draft')!;
const input: EventInput = { title: '新活動', description: '', location: '', organizerType: 'club', organizerId: 'taipei', visibility: 'public', time: { kind: 'timed', startAt: '2026-11-01T02:00:00Z', endAt: '2026-11-01T03:00:00Z', timeZone: 'Asia/Taipei' } };
describe('phase 2 scope and lifecycle', () => {
    it('scopes drafts and reserves publication for publishers', () => {
        expect(applyEventAction([], demoClubs, { type: 'create', actor: manager, input }, 'new').ok).toBe(true);
        expect(applyEventAction(demoEvents, demoClubs, { type: 'publish', actor: manager, id: draft.id, version: 0 }).ok).toBe(false);
        expect(applyEventAction(demoEvents, demoClubs, { type: 'publish', actor: president, id: draft.id, version: 0 }).ok).toBe(true);
        expect(applyEventAction([], demoClubs, { type: 'create', actor: { role: 'club_president', clubId: 'taichung' }, input }).ok).toBe(false);
        expect(applyEventAction([], demoClubs, { type: 'create', actor: { role: 'district_manager', districtId: 'd3481' }, input }).ok).toBe(false);
        expect(applyEventAction([], demoClubs, { type: 'create', actor: { role: 'district_manager', districtId: 'd3462' }, input: { ...input, organizerType: 'district', organizerId: 'd3481' } }).ok).toBe(false);
    });
    it('rejects stale versions without mutating snapshots', () => {
        const before = structuredClone(demoEvents);
        expect(applyEventAction(demoEvents, demoClubs, { type: 'update', actor: president, id: draft.id, version: 5, input }).ok).toBe(false);
        expect(demoEvents).toEqual(before);
    });
    it('preserves cancellation reason and only restarts as new draft', () => {
        const event = demoEvents[0];
        expect(applyEventAction(demoEvents, demoClubs, { type: 'cancel', actor: president, id: event.id, version: 0, reason: ' ' }).ok).toBe(false);
        const cancelled = applyEventAction(demoEvents, demoClubs, { type: 'cancel', actor: president, id: event.id, version: 0, reason: '颱風' });
        expect(cancelled.ok).toBe(true);
        if (!cancelled.ok)
            return;
        expect(cancelled.event.cancellationReason).toBe('颱風');
        expect(publicProjection([cancelled.event], demoClubs)).toHaveLength(1);
        expect(applyEventAction([cancelled.event], demoClubs, { type: 'publish', actor: president, id: event.id, version: 1 }).ok).toBe(false);
        const copy = applyEventAction([cancelled.event], demoClubs, { type: 'copy', actor: president, id: event.id, version: 1 }, 'copy');
        expect(copy.ok && copy.event.status).toBe('draft');
        expect(copy.ok && copy.event.cancellationReason).toBeUndefined();
    });
    it('withdraws archived events publicly, retains scoped management and copies as draft', () => {
        const source = demoEvents[0];
        const result = applyEventAction(demoEvents, demoClubs, { type: 'archive', actor: president, id: source.id, version: source.version });
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(publicProjection([result.event], demoClubs)).toHaveLength(0);
        expect(visibleEvents([result.event], demoClubs, president)).toEqual([result.event]);
        expect(result.event.description).toBe(source.description);
        expect(applyEventAction([result.event], demoClubs, { type: 'publish', actor: president, id: source.id, version: result.event.version }).ok).toBe(false);
        const copy = applyEventAction([result.event], demoClubs, { type: 'copy', actor: president, id: source.id, version: result.event.version }, 'archived-copy');
        expect(copy.ok && copy.event.status).toBe('draft');
        expect(copy.ok && copy.event.id).toBe('archived-copy');
    });
    it('blocks disabled-club creation and retains completed public history', () => {
        const actor: EventActor = { role: 'club_president', clubId: 'disabled' };
        expect(applyEventAction([], demoClubs, { type: 'create', actor, input: { ...input, organizerId: 'disabled' } }).ok).toBe(false);
        const ids = publicProjection(demoEvents, demoClubs, new Date('2026-10-15T00:00:00Z')).map(e => e.id);
        expect(ids).toContain('disabled-history');
        expect(ids).not.toContain('disabled-future');
        expect(publicProjection(demoEvents, demoClubs, new Date('2027-01-01T00:00:00Z')).some(e => e.id === 'disabled-future')).toBe(false);
        expect(publicClubs(demoClubs).some(c => c.id === 'disabled')).toBe(false);
    });
    it('redacts club contact fields unless individually published', () => {
        const projected = publicClubs([{ ...demoClubs[0], emailPublic: false, websitePublic: false, addressPublic: false }]);
        expect(projected[0]).toMatchObject({ email: '', website: '', address: '' });
        expect(demoClubs[0].email).not.toBe('');
    });
    it('keeps private cancellation notices within the original member audience', () => {
        const membersEvent = demoEvents.find(event => event.id === 'members-only')!;
        const clubEvent = demoEvents.find(event => event.id === 'club-only')!;
        const notices = [
            membersEvent,
            { ...membersEvent, id: 'members-cancelled', status: 'cancelled' as const, cancellationReason: '場地調整' },
            clubEvent,
            { ...clubEvent, id: 'club-cancelled', status: 'cancelled' as const, cancellationReason: '場地調整' },
            { ...clubEvent, id: 'club-draft', status: 'draft' as const },
            { ...clubEvent, id: 'club-archived', status: 'archived' as const },
        ];
        const ownClub = visibleEvents(notices, demoClubs, { role: 'member', clubId: 'taipei' });
        expect(ownClub.map(event => event.id)).toEqual(['members-only', 'members-cancelled', 'club-only', 'club-cancelled']);
        expect(ownClub.find(event => event.id === 'club-cancelled')?.cancellationReason).toBe('場地調整');
        expect(visibleEvents(notices, demoClubs, { role: 'member', clubId: 'taichung' }).map(event => event.id)).toEqual(['members-only', 'members-cancelled']);
        expect(visibleEvents(notices, demoClubs, { role: 'guest' })).toHaveLength(0);
    });
    it('never exposes private/draft events anonymously and scopes club visibility', () => {
        expect(publicProjection(demoEvents, demoClubs).every(e => e.visibility === 'public' && e.status !== 'draft')).toBe(true);
        expect(visibleEvents(demoEvents, demoClubs, { role: 'guest' })).toEqual(publicProjection(demoEvents, demoClubs));
        expect(visibleEvents(demoEvents, demoClubs, { role: 'member', clubId: 'taichung' }).some(e => e.id === 'members-only')).toBe(true);
        expect(visibleEvents(demoEvents, demoClubs, { role: 'member', clubId: 'taichung' }).some(e => e.id === 'club-only')).toBe(false);
        expect(visibleEvents(demoEvents, demoClubs, { role: 'member', clubId: 'taipei' }).some(e => e.id === 'club-only')).toBe(true);
    });
});
describe('phase 2 time and validation', () => {
    it('converts Taipei wall time and rejects invalid dates/zones', () => {
        expect(localDateTimeToUtc('2026-10-17T10:00', 'Asia/Taipei')).toEqual({ ok: true, value: '2026-10-17T02:00:00.000Z' });
        expect(localDateTimeToUtc('2026-02-30T10:00', 'Asia/Taipei').ok).toBe(false);
        expect(localDateTimeToUtc('2026-10-17T10:00', 'fake/zone').ok).toBe(false);
    });
    it('rejects DST gap and requires explicit fold choice', () => {
        expect(localDateTimeToUtc('2026-03-08T02:30', 'America/New_York').ok).toBe(false);
        expect(localDateTimeToUtc('2026-11-01T01:30', 'America/New_York').ok).toBe(false);
        expect(localDateTimeToUtc('2026-11-01T01:30', 'America/New_York', 'earlier')).toEqual({ ok: true, value: '2026-11-01T05:30:00.000Z' });
        expect(localDateTimeToUtc('2026-11-01T01:30', 'America/New_York', 'later')).toEqual({ ok: true, value: '2026-11-01T06:30:00.000Z' });
    });
    it('uses half-open ranges for cross-day overlap', () => {
        const cross = demoEvents.find(e => e.id === 'cross-day')!;
        expect(searchEvents([cross], { from: '2026-10-24T00:00:00Z', to: '2026-10-25T00:00:00Z' })).toHaveLength(1);
        expect(searchEvents([cross], { from: '2026-10-24T02:00:00Z' })).toHaveLength(0);
        expect(searchEvents([cross], { to: '2026-10-23T14:00:00Z' })).toHaveLength(0);
    });
    it('preserves all-day exclusive dates and 23-hour DST day', () => {
        const event = { ...input, time: { kind: 'allDay' as const, startDate: '2026-03-08', endDateExclusive: '2026-03-09', timeZone: 'America/New_York' } };
        const bounds = eventBounds(event);
        expect(bounds.end.getTime() - bounds.start.getTime()).toBe(23 * 3600000);
        expect(validateEventInput(event)).toEqual({});
        expect(validateEventInput({ ...event, time: { ...event.time, endDateExclusive: event.time.startDate } })).toHaveProperty('time');
    });
    it('rejects ISO dates normalized by JavaScript and invalid UTC offsets', () => {
        expect(validateEventInput({ ...input, time: { kind: 'timed', startAt: '2026-02-30T02:00:00Z', endAt: '2026-03-03T03:00:00Z', timeZone: 'Asia/Taipei' } })).toHaveProperty('time');
        expect(validateEventInput({ ...input, time: { kind: 'timed', startAt: '2026-10-10T24:00:00Z', endAt: '2026-10-12T03:00:00Z', timeZone: 'Asia/Taipei' } })).toHaveProperty('time');
        expect(publicProjection([{ ...demoEvents[0], organizerType: 'district', organizerId: 'unknown' }], demoClubs)).toHaveLength(0);
    });
    it('validates field bounds, organizer and strict ending order', () => {
        expect(validateEventInput({ ...input, title: ' ', location: 'x'.repeat(301), description: 'x'.repeat(10001), organizerId: '' })).toMatchObject({ title: expect.any(String), location: expect.any(String), description: expect.any(String), organizerId: expect.any(String) });
        expect(validateEventInput({ ...input, time: { kind: 'timed', startAt: '2026-10-10T00:00:00Z', endAt: '2026-10-10T00:00:00Z', timeZone: 'Asia/Taipei' } })).toHaveProperty('time');
    });
});

describe('published event corrections', () => {
    const source = demoEvents.find(event => event.id === 'city-walk')!;
    it('updates the same published record for all publishers and retains the original snapshot', () => {
        for (const role of ['club_president', 'club_secretary', 'club_backup'] as const) {
            const result = applyEventAction(demoEvents, demoClubs, { type: 'update', actor: { ...president, role }, id: source.id, version: source.version, input: { ...input, title: '  更正活動  ', location: '新地點' } });
            expect(result.ok).toBe(true);
            if (!result.ok) continue;
            expect(result.event).toMatchObject({ id: source.id, status: 'published', version: source.version + 1, title: '更正活動', location: '新地點', time: input.time });
            expect(publicProjection([result.event], demoClubs)[0]).toMatchObject({ id: source.id, title: '更正活動' });
            expect(source.title).not.toBe('更正活動');
        }
    });
    it('withdraws a corrected public event from anonymous projection when changed to members-only', () => {
        const result = applyEventAction(demoEvents, demoClubs, { type: 'update', actor: president, id: source.id, version: source.version, input: { ...input, visibility: 'members' } });
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(publicProjection([result.event], demoClubs)).toHaveLength(0);
        expect(visibleEvents([result.event], demoClubs, { role: 'member', clubId: 'taichung' }).map(event => event.id)).toEqual([source.id]);
    });
    it('rejects managers, members, other clubs, and district actors correcting club events', () => {
        for (const actor of [manager, { role: 'member', clubId: 'taipei' }, { role: 'club_president', clubId: 'taichung' }, { role: 'district_manager', districtId: 'd3481' }] as EventActor[])
            expect(applyEventAction(demoEvents, demoClubs, { type: 'update', actor, id: source.id, version: source.version, input }).ok).toBe(false);
        const disabled = demoEvents.find(event => event.id === 'disabled-history')!;
        expect(applyEventAction(demoEvents, demoClubs, { type: 'update', actor: { role: 'club_president', clubId: 'disabled' }, id: disabled.id, version: disabled.version, input: { ...input, organizerId: 'disabled' } }).ok).toBe(false);
    });
    it('allows district correction only within the original district', () => {
        const district = demoEvents.find(event => event.id === 'district-day')!;
        const districtInput = { ...input, organizerType: 'district' as const, organizerId: district.organizerId };
        for (const districtId of [district.organizerId, 'd3462']) {
            const result = applyEventAction(demoEvents, demoClubs, { type: 'update', actor: { role: 'district_manager', districtId }, id: district.id, version: district.version, input: districtInput });
            expect(result.ok).toBe(districtId === district.organizerId);
        }
    });
    it('preserves latest content on stale correction and rejects invalid or terminal edits', () => {
        const latest = { ...source, title: '另一管理者的更正', version: source.version + 1 };
        const snapshot = structuredClone(latest);
        expect(applyEventAction([latest], demoClubs, { type: 'update', actor: president, id: source.id, version: source.version, input }).ok).toBe(false);
        expect(latest).toEqual(snapshot);
        const invalidInputs: EventInput[] = [{ ...input, title: ' ' }, { ...input, organizerId: 'taichung' }, { ...input, description: 'x'.repeat(10001) }, { ...input, time: { kind: 'timed', startAt: '2026-11-01T03:00:00Z', endAt: '2026-11-01T02:00:00Z', timeZone: 'Asia/Taipei' } }];
        for (const invalid of invalidInputs)
            expect(applyEventAction([source], demoClubs, { type: 'update', actor: president, id: source.id, version: source.version, input: invalid }).ok).toBe(false);
        for (const status of ['cancelled', 'archived'] as const)
            expect(applyEventAction([{ ...source, status }], demoClubs, { type: 'update', actor: president, id: source.id, version: source.version, input }).ok).toBe(false);
    });
});
