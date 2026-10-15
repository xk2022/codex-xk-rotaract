import { businessConfirmation, businessInstant, grantEndsOn, projectBusiness, type BusinessCompany, type BusinessContext } from '../phase3/businessModel';

export interface OwnConfirmation {
    companyId: string; companyName: string; confirmedAt: string; expiresAt: string;
    counted: boolean; publiclyVisible: boolean; version: number;
}
/** Same Taipei anniversary and exclusive end as businessConfirmation, including leap day. */
export function confirmationExpiresAt(confirmedAt: string): string {
    const at = businessInstant(confirmedAt);
    if (!Number.isFinite(at)) return '';
    const local = new Date(at + 8 * 3600000).toISOString();
    return `${grantEndsOn(local.slice(0, 10))}T${local.slice(11, 23)}+08:00`;
}
/** Private member history deliberately exposes no company contact, location or other endorsers. */
export function projectOwnConfirmations(companies: BusinessCompany[], memberId: string, context: BusinessContext): OwnConfirmation[] {
    if (!memberId || !context.members.some(m => m.id === memberId)) return [];
    return companies.flatMap(company => {
        const own = company.endorsements?.find(e => e.memberId === memberId);
        if (!own) return [];
        return [{ companyId: company.id, companyName: company.name, confirmedAt: own.confirmedAt,
            expiresAt: confirmationExpiresAt(own.confirmedAt), version: company.version,
            counted: businessConfirmation({ ...company, endorsements: [own] }, context.members, context.clubs, context.asOf).confirmationCount === 1,
            publiclyVisible: !!projectBusiness(company, context.members, context.clubs, context.grants ?? [], context.asOf) }];
    }).sort((a, b) => businessInstant(b.confirmedAt) - businessInstant(a.confirmedAt));
}
