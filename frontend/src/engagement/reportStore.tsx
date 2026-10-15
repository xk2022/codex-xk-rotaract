import { createContext, useContext, useRef, useState, type ReactNode } from 'react';
import { useBusinessDemo } from '../phase3/businessStore';
import { applyReportAction, type BusinessReport, type ReportAction, type ReportResult } from './reportModel';
interface ReportStore { reports: BusinessReport[]; dispatch: (action: ReportAction) => ReportResult; reset: () => void }
const Context = createContext<ReportStore | null>(null);
export function ReportProvider({ children }: { children: ReactNode }) {
    const business = useBusinessDemo();
    const [reports, setReports] = useState<BusinessReport[]>([]);
    const latest = useRef(reports);
    function commit(next: BusinessReport[]) { latest.current = next; setReports(next); }
    function dispatch(action: ReportAction) {
        const result = applyReportAction(latest.current, action, { memberIds: business.members.map(member => member.id), publicCompanies: business.publicBusinesses, asOf: business.asOf });
        if (result.ok) commit(result.reports);
        return result;
    }
    return <Context.Provider value={{ reports, dispatch, reset: () => commit([]) }}>{children}</Context.Provider>;
}
export function useReportDemo() { const value = useContext(Context); if (!value) throw new Error('ReportProvider is required'); return value; }
