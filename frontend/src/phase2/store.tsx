import { createContext, useContext, useRef, useState, type ReactNode } from 'react';
import { initialOrganizations, type OrgCommand, type OrgContext, type OrgState } from '../features/organizationModel';
import { applyEventAction, demoClubs, demoEvents, type ActionResult, type EventAction } from './model';
import { synchronizeOrganization, type OrganizationCommunityState } from './organizationSync';
interface CommunityState extends OrganizationCommunityState {
    dispatch: (action: EventAction) => ActionResult;
    dispatchOrganization: (command: OrgCommand, context: OrgContext) => OrgState;
    reset: () => void;
}
const CommunityContext = createContext<CommunityState | null>(null);
function initialState(): OrganizationCommunityState {
    return { events: structuredClone(demoEvents), clubs: structuredClone(demoClubs), organizations: initialOrganizations() };
}
export function CommunityProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState(initialState);
    const latest = useRef(state);
    function commit(next: OrganizationCommunityState) { latest.current = next; setState(next); }
    function dispatch(action: EventAction): ActionResult {
        const current = latest.current;
        const result = applyEventAction(current.events, current.clubs, action);
        if (result.ok) commit({ ...current, events: action.type === 'create' || action.type === 'copy' ? [...current.events, result.event] : current.events.map(e => e.id === result.event.id ? result.event : e) });
        return result;
    }
    function dispatchOrganization(command: OrgCommand, context: OrgContext): OrgState {
        const next = synchronizeOrganization(latest.current, command, context, new Date());
        commit(next);
        return next.organizations;
    }
    return <CommunityContext.Provider value={{ ...state, dispatch, dispatchOrganization, reset: () => commit(initialState()) }}>{children}</CommunityContext.Provider>;
}
export function useCommunityDemo(): CommunityState {
    const state = useContext(CommunityContext);
    if (!state) throw new Error('CommunityProvider is required');
    return state;
}
