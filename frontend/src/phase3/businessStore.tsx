import { createContext, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { useCommunityDemo } from '../phase2/store';
import { applyBusinessAction, demoBusinessCompanies, demoBusinessMembers, demoExposureGrants, projectBusiness, type BusinessAction, type BusinessCompany, type BusinessMember, type BusinessResult, type ExposureGrant, type PublicBusiness } from './businessModel';

interface BusinessState {
    companies: BusinessCompany[]; members: BusinessMember[]; grants: ExposureGrant[];
    asOf: string; setAsOf: (date: string) => void; publicBusinesses: PublicBusiness[];
    dispatch: (action: BusinessAction) => BusinessResult; reset: () => void;
}
const BusinessContext = createContext<BusinessState | null>(null);
export function BusinessProvider({ children }: { children: ReactNode }) {
    const { clubs } = useCommunityDemo();
    const [companies, setCompanies] = useState(() => structuredClone(demoBusinessCompanies));
    const [asOf, setAsOf] = useState('2026-10-15');
    const latest = useRef(companies);
    const members = demoBusinessMembers;
    const grants = demoExposureGrants;
    function commit(next: BusinessCompany[]) { latest.current = next; setCompanies(next); }
    function dispatch(action: BusinessAction): BusinessResult {
        const result = applyBusinessAction(latest.current, action);
        if (result.ok) commit(action.type === 'create' ? [...latest.current, result.company] : latest.current.map(c => c.id === result.company.id ? result.company : c));
        return result;
    }
    const publicBusinesses = useMemo(() => companies.flatMap(company => {
        const projection = projectBusiness(company, members, clubs, grants, asOf);
        return projection ? [projection] : [];
    }), [companies, members, clubs, grants, asOf]);
    return <BusinessContext.Provider value={{ companies, members, grants, asOf, setAsOf, publicBusinesses, dispatch, reset: () => { commit(structuredClone(demoBusinessCompanies)); setAsOf('2026-10-15'); } }}>{children}</BusinessContext.Provider>;
}
export function useBusinessDemo(): BusinessState {
    const value = useContext(BusinessContext);
    if (!value) throw new Error('BusinessProvider is required');
    return value;
}
