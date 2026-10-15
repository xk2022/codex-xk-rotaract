import { createContext, useContext, useRef, useState, type ReactNode } from 'react';
import { useCommunityDemo } from '../phase2/store';
import { useBusinessDemo } from '../phase3/businessStore';
import { applyCouponAction, demoCouponState, type CouponAction, type CouponContext, type CouponResult, type CouponState } from './couponModel';
interface CouponStore extends CouponState { context: CouponContext; asOf: string; dispatch: (action: CouponAction) => CouponResult; reset: () => void; }
const Context = createContext<CouponStore | null>(null);
export function CouponProvider({ children }: { children: ReactNode }) {
    const business = useBusinessDemo(); const { clubs } = useCommunityDemo();
    const [state, setState] = useState<CouponState>(() => structuredClone(demoCouponState)); const latest = useRef(state);
    const context: CouponContext = { companies: business.companies, members: business.members, grants: business.grants, clubs, asOf: business.asOf };
    function commit(value: CouponState) { latest.current = value; setState(value); }
    function dispatch(action: CouponAction): CouponResult { const result = applyCouponAction(latest.current, action, context); if (result.ok) commit(result.state); return result; }
    return <Context.Provider value={{ ...state, context, asOf: business.asOf, dispatch, reset: () => commit(structuredClone(demoCouponState)) }}>{children}</Context.Provider>;
}
export function useCouponDemo(): CouponStore { const value = useContext(Context); if (!value) throw new Error('CouponProvider is required'); return value; }
