import { organizationTransition, type OrgCommand, type OrgContext, type OrgState } from '../features/organizationModel';
import { eventBounds, type CommunityClub, type CommunityEvent } from './model';
export interface OrganizationCommunityState {
    organizations: OrgState;
    clubs: CommunityClub[];
    events: CommunityEvent[];
}
/** Validate original organization scope before committing both projections atomically. */
export function synchronizeOrganization(state: OrganizationCommunityState, command: OrgCommand, context: OrgContext, now = new Date()): OrganizationCommunityState {
    const organizations = organizationTransition(state.organizations, context, command);
    let events = state.events;
    const clubs = [...state.clubs];
    for (const org of organizations.clubs) {
        const before = state.organizations.clubs.find(c => c.id === org.id);
        const index = clubs.findIndex(c => c.id === org.id);
        if (before && JSON.stringify(before) === JSON.stringify(org) && !(command.type === 'edit' && command.clubId === org.id)) continue;
        const existing = index < 0 ? undefined : clubs[index];
        const districtId = org.district.toLowerCase();
        const next: CommunityClub = existing ? { ...existing } : {
            id: org.id, name: org.name, districtId, districtName: `${org.district.slice(1)} 地區`,
            city: '', description: org.description, address: '', email: org.email, website: org.website,
            enabled: org.enabled, public: true, clubTypeCode: org.type === '扶輪社' ? 'ROTARY' : 'ROTARACT',
            emailPublic: org.publicEmail, websitePublic: org.publicWebsite, addressPublic: false,
        };
        const edited = (field: string) => command.type === 'edit' && command.clubId === org.id && Object.hasOwn(command.patch, field);
        // Admin and public seeds differ; unrelated commands must not overwrite public privacy or names.
        if (!before || before.name !== org.name || edited('name')) next.name = org.name;
        if (!before || before.description !== org.description || edited('description')) next.description = org.description;
        if (!before || before.email !== org.email || edited('email')) next.email = org.email;
        if (!before || before.website !== org.website || edited('website')) next.website = org.website;
        if (!before || before.publicEmail !== org.publicEmail || edited('publicEmail')) next.emailPublic = org.publicEmail;
        if (!before || before.publicWebsite !== org.publicWebsite || edited('publicWebsite')) next.websitePublic = org.publicWebsite;
        if (!before || before.district !== org.district) {
            next.districtId = districtId;
            next.districtName = `${org.district.slice(1)} 地區`;
        }
        if (!before || before.enabled !== org.enabled) {
            next.enabled = org.enabled;
            next.disabledAt = org.enabled ? undefined : now.toISOString();
            if (!org.enabled) events = events.map(event =>
                event.organizerType === 'club' && event.organizerId === org.id &&
                ['published', 'cancelled'].includes(event.status) && !event.publicWithdrawnAt &&
                eventBounds(event).end.getTime() > now.getTime()
                    ? { ...event, publicWithdrawnAt: now.toISOString(), version: event.version + 1 }
                    : event);
        }
        if (index < 0) clubs.push(next); else clubs[index] = next;
    }
    return { organizations, clubs, events };
}
