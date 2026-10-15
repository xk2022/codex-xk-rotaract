import { createContext, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { applyInvitationAction, type MaintainerInvitation, type InvitationAction, type InvitationResult } from '../engagement/invitationModel';
import { useCommunityDemo } from '../phase2/store';
import { applyBusinessAction, demoBusinessCompanies, demoBusinessMembers, demoExposureGrants, projectBusiness, type BusinessAction, type BusinessCompany, type BusinessMember, type BusinessResult, type ExposureGrant, type PublicBusiness } from './businessModel';

interface BusinessState {
    companies: BusinessCompany[]; members: BusinessMember[]; grants: ExposureGrant[];
    asOf: string; setAsOf: (date: string) => void; publicBusinesses: PublicBusiness[];
    invitations: MaintainerInvitation[]; dispatchInvitation: (action: InvitationAction) => InvitationResult;
    dispatch: (action: BusinessAction) => BusinessResult; reset: () => void;
}
const BusinessContext = createContext<BusinessState | null>(null);
export function BusinessProvider({ children }: { children: ReactNode }) {
    const { clubs } = useCommunityDemo();
    const [companies, setCompanies] = useState(() => structuredClone(demoBusinessCompanies));
    const [asOf, setAsOf] = useState('2026-10-15T12:00:00+08:00');
    const latest = useRef(companies);
    const [invitations, setInvitations] = useState<MaintainerInvitation[]>([]);
    const latestInvitations = useRef(invitations);
    function commitInvitations(next: MaintainerInvitation[]) { latestInvitations.current = next; setInvitations(next); }
    const members = demoBusinessMembers;
    const grants = demoExposureGrants;
    function commit(next: BusinessCompany[]) { latest.current = next; setCompanies(next); }
    function dispatch(action: BusinessAction): BusinessResult {
        const result = applyBusinessAction(latest.current, action, { members, clubs, grants, asOf });
        if (result.ok) commit(action.type === 'create' ? [...latest.current, result.company] : latest.current.map(c => c.id === result.company.id ? result.company : c));
        return result;
    }
    function dispatchInvitation(action: InvitationAction): InvitationResult {
        const result = applyInvitationAction(latest.current, latestInvitations.current, action, { members, asOf });
        if (result.ok) { commit(result.companies); commitInvitations(result.invitations); }
        return result;
    }
    const publicBusinesses = useMemo(() => companies.flatMap(company => {
        const projection = projectBusiness(company, members, clubs, grants, asOf);
        return projection ? [projection] : [];
    }), [companies, members, clubs, grants, asOf]);
    return <BusinessContext.Provider value={{ companies, members, grants, asOf, setAsOf, publicBusinesses, dispatch, invitations, dispatchInvitation, reset: () => { commit(structuredClone(demoBusinessCompanies)); commitInvitations([]); setAsOf('2026-10-15T12:00:00+08:00'); } }}>{children}</BusinessContext.Provider>;
}
export function useBusinessDemo(): BusinessState {
    const value = useContext(BusinessContext);
    if (!value) throw new Error('BusinessProvider is required');
    return value;
}
