import { createContext, useContext, useRef, useState, type ReactNode } from 'react';
import { applyEventAction, demoClubs, demoEvents, type ActionResult, type CommunityClub, type CommunityEvent, type EventAction } from './model';
interface CommunityState {
    events: CommunityEvent[];
    clubs: CommunityClub[];
    dispatch: (action: EventAction) => ActionResult;
}
const CommunityContext = createContext<CommunityState | null>(null);
export function CommunityProvider({ children }: {
    children: ReactNode;
}) {
    const [events, setEvents] = useState<CommunityEvent[]>(() => structuredClone(demoEvents));
    const [clubs] = useState<CommunityClub[]>(() => structuredClone(demoClubs));
    const latest = useRef(events);
    function dispatch(action: EventAction): ActionResult {
        const result = applyEventAction(latest.current, clubs, action);
        if (result.ok) {
            latest.current = action.type === 'create' || action.type === 'copy' ? [...latest.current, result.event] : latest.current.map(e => e.id === result.event.id ? result.event : e);
            setEvents(latest.current);
        }
        return result;
    }
    return <CommunityContext.Provider value={{ events, clubs, dispatch }}>{children}</CommunityContext.Provider>;
}
export function useCommunityDemo(): CommunityState {
    const state = useContext(CommunityContext);
    if (!state)
        throw new Error('CommunityProvider is required');
    return state;
}
