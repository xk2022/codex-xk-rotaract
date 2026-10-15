export const reportReasons = { missing: '公司不存在', address: '地址錯誤', impersonation: '資料冒用', other: '其他問題' } as const;
export type ReportReason = keyof typeof reportReasons;
export type ReportStatus = 'open' | 'processing' | 'closed';
export interface ReportActor { memberId: string; role: 'member' | 'content_admin' }
export interface BusinessReport { id: string; companyId: string; companyName: string; reporterId: string; reason: ReportReason; description: string; status: ReportStatus; version: number; createdAt: string; updatedAt: string; assignedTo?: string; resolution?: string }
export interface ReportContext { memberIds: string[]; publicCompanies: { id: string; name: string }[]; asOf: string }
export type ReportAction = { type: 'create'; actor: ReportActor; companyId: string; reason: ReportReason; description: string } | { type: 'accept' | 'close'; actor: ReportActor; id: string; version: number; resolution: string };
export type ReportResult = { ok: true; reports: BusinessReport[]; report: BusinessReport } | { ok: false; error: string };
export function visibleReports(reports: BusinessReport[], actor: ReportActor | null): BusinessReport[] {
    if (!actor) return [];
    return reports.filter(report => actor.role === 'content_admin' || report.reporterId === actor.memberId);
}
export function applyReportAction(reports: BusinessReport[], action: ReportAction, context: ReportContext, id: () => string = () => crypto.randomUUID()): ReportResult {
    if (!action.actor.memberId || !['member', 'content_admin'].includes(action.actor.role)) return { ok: false, error: '請先以會員身分登入。' };
    if (!Number.isFinite(Date.parse(context.asOf))) return { ok: false, error: '情境時間無效，請重新整理。' };
    if (action.type === 'create') {
        if (action.actor.role !== 'member' || !context.memberIds.includes(action.actor.memberId)) return { ok: false, error: '請使用有效會員身分回報。' };
        const company = context.publicCompanies.find(company => company.id === action.companyId);
        if (!company) return { ok: false, error: '此商家目前未公開，無法新增回報；既有案件仍可追蹤。' };
        if (!Object.hasOwn(reportReasons, action.reason) || !action.description.trim() || action.description.trim().length > 2000) return { ok: false, error: '請選擇原因並填寫 1～2000 字說明。' };
        if (reports.some(report => report.reporterId === action.actor.memberId && report.companyId === company.id && report.status !== 'closed')) return { ok: false, error: '你已有此商家的未結案件，請查看進度，避免重複回報。' };
        const report: BusinessReport = { id: id(), companyId: company.id, companyName: company.name, reporterId: action.actor.memberId, reason: action.reason, description: action.description.trim(), status: 'open', version: 1, createdAt: context.asOf, updatedAt: context.asOf };
        return { ok: true, reports: [...reports, report], report };
    }
    if (action.actor.role !== 'content_admin') return { ok: false, error: '僅內容管理員可處理案件。' };
    const current = reports.find(report => report.id === action.id);
    if (!current) return { ok: false, error: '找不到案件。' };
    if (current.version !== action.version) return { ok: false, error: '案件已更新，請重新選取並確認最新狀態。' };
    if ((action.type === 'accept' && current.status !== 'open') || (action.type === 'close' && current.status !== 'processing')) return { ok: false, error: '案件狀態已改變；請先接案，再填寫結果結案。' };
    if (!action.resolution.trim() || action.resolution.trim().length > 2000) return { ok: false, error: '請填寫 1～2000 字處理說明。' };
    const report: BusinessReport = { ...current, status: action.type === 'accept' ? 'processing' : 'closed', assignedTo: action.actor.memberId, resolution: action.resolution.trim(), version: current.version + 1, updatedAt: context.asOf };
    return { ok: true, reports: reports.map(item => item.id === report.id ? report : item), report };
}
