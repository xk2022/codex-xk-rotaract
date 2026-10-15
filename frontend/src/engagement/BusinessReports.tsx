import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useBusinessDemo } from '../phase3/businessStore';
import { useReportDemo } from './reportStore';
import { reportReasons, visibleReports, type BusinessReport, type ReportActor, type ReportReason } from './reportModel';
import './engagement.css';
const statuses = { open: '待受理', processing: '處理中', closed: '已結案' };
export function BusinessReports({ companyId }: { companyId?: string }) {
    const business = useBusinessDemo();
    const store = useReportDemo();
    const [identity, setIdentity] = useState('anonymous');
    const actor: ReportActor | null = identity === 'anonymous' ? null : identity === 'admin' ? { memberId: 'content-admin', role: 'content_admin' } : { memberId: identity, role: 'member' };
    const [company, setCompany] = useState(companyId ?? '');
    const [reason, setReason] = useState<ReportReason>('address');
    const [description, setDescription] = useState('');
    const [selected, setSelected] = useState<BusinessReport | null>(null);
    const [resolution, setResolution] = useState('');
    const [filter, setFilter] = useState('all');
    const [message, setMessage] = useState('');
    const dirty = !!description.trim() || !!resolution.trim();
    const previousHash = useRef(window.location.hash);
    const acceptedNavigation = useRef(false);
    useEffect(() => { if (!dirty) return; const guard = (event: BeforeUnloadEvent) => { if (acceptedNavigation.current) return; event.preventDefault(); event.returnValue = ''; }; window.addEventListener('beforeunload', guard); return () => window.removeEventListener('beforeunload', guard); }, [dirty]);
    useLayoutEffect(() => {
        previousHash.current = window.location.hash;
        acceptedNavigation.current = false;
        if (!companyId || !dirty) return;
        function guardNavigation(event: MouseEvent) {
            const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
            if (!(link instanceof HTMLAnchorElement) || event.defaultPrevented || link.hasAttribute('download')) return;
            const destination = new URL(link.href, window.location.href);
            const sameDocument = destination.origin === window.location.origin && destination.pathname === window.location.pathname && destination.search === window.location.search;
            // Hash changes, browser back and direct hash edits share one guard.
            if (sameDocument) return;
            if (!window.confirm('尚有未送出的內容，要捨棄嗎？')) { event.preventDefault(); event.stopImmediatePropagation(); }
            else acceptedNavigation.current = true;
        }
        function guardHashChange() {
            const destination = window.location.hash;
            if (destination === previousHash.current) return;
            if (!window.confirm('尚有未送出的內容，要捨棄嗎？')) {
                window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}${previousHash.current}`);
                return;
            }
            previousHash.current = destination;
        }
        document.addEventListener('click', guardNavigation, true);
        window.addEventListener('hashchange', guardHashChange);
        return () => { document.removeEventListener('click', guardNavigation, true); window.removeEventListener('hashchange', guardHashChange); };
    }, [companyId, dirty]);
    const reports = visibleReports(store.reports, actor).filter(report => (!companyId || report.companyId === companyId) && (filter === 'all' || report.status === filter));
    const publicCompany = business.publicBusinesses.find(item => item.id === (companyId ?? company));
    function discard() { return !dirty || window.confirm('尚有未送出的內容，要捨棄嗎？'); }
    function selectReport(report: BusinessReport) { if (!discard()) return; setSelected({ ...report }); setDescription(''); setResolution(''); setMessage(''); }
    return <section className="engagement reports" aria-label="商家回報與追蹤" data-unsaved={dirty ? 'true' : undefined}>
        <header><p className="engagement-kicker">資料品質與信任</p><h2>商家回報與追蹤</h2><p>地址不正確、公司不存在或資料遭冒用？提交回報後，可在此追蹤處理結果。回報不會自動下架或更改商家資料。</p></header>
        <div className="engagement-notice">假資料體驗：與正式登入無關，重新整理即還原。請勿填寫身分證、電話等敏感資料；不會發送真實通知。</div>
        <label>回報示範身分<select aria-label="回報示範身分" value={identity} onChange={event => { if (!discard()) return; setIdentity(event.target.value); setDescription(''); setResolution(''); setSelected(null); setMessage(''); }}><option value="anonymous">訪客（不顯示私人案件）</option><option value="peer-1">Peer 1・會員</option><option value="peer-2">Peer 2・會員</option><option value="admin">內容管理員</option></select></label>
        <div role="status" aria-live="polite">{message}</div>
        {!actor && <p>請先登入以新增或追蹤自己的案件。<a href="#/login">前往登入</a>；也可選擇上述示範會員體驗。</p>}
        {actor?.role === 'member' && <form onSubmit={event => { event.preventDefault(); const result = store.dispatch({ type: 'create', actor, companyId: companyId ?? company, reason, description }); if (!result.ok) { setMessage(result.error); return; } setDescription(''); setSelected(result.report); setMessage('回報已建立，可在下方追蹤進度。'); }}>
            <h3>新增回報</h3>
            {companyId ? <p>商家：{publicCompany?.name ?? '目前未公開'} </p> : <label>回報商家<select aria-label="回報商家" required value={company} onChange={event => setCompany(event.target.value)}><option value="">請選擇目前公開的商家</option>{business.publicBusinesses.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
            <label>回報原因<select aria-label="回報原因" value={reason} onChange={event => setReason(event.target.value as ReportReason)}>{Object.entries(reportReasons).map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select></label>
            <label>問題說明<textarea aria-label="問題說明" required maxLength={2000} rows={4} value={description} onChange={event => setDescription(event.target.value)} placeholder="請具體描述問題及正確資訊的來源，避免個人敏感資料。" /></label>
            <button type="submit" disabled={!publicCompany}>送出商家回報</button>
            {!publicCompany && <p>請選擇目前公開的商家。商家隱藏後，既有案件仍可查看。</p>}
        </form>}
        {actor && <><div className="engagement-heading"><h3>{actor.role === 'content_admin' ? '案件處理' : '我的回報'}（{reports.length}）</h3><label>案件狀態<select aria-label="案件狀態" value={filter} onChange={event => { const next = event.target.value; if (selected && next !== 'all' && selected.status !== next) { if (!discard()) return; setSelected(null); setDescription(''); setResolution(''); } setFilter(next); }}><option value="all">全部</option>{Object.entries(statuses).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label></div>
            <div className="engagement-list">{reports.length === 0 && <p>目前沒有符合條件的案件。</p>}{reports.map(report => <button type="button" className="engagement-case" key={report.id} onClick={() => selectReport(report)} aria-pressed={selected?.id === report.id}><strong>{report.companyName}</strong><span>{reportReasons[report.reason]} · {statuses[report.status]}</span><small>建立於 {new Date(report.createdAt).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}</small></button>)}</div>
            {selected && (!companyId || selected.companyId === companyId) && visibleReports(store.reports, actor).some(item => item.id === selected.id) && <article className="engagement-detail"><h3>案件詳情：{selected.companyName}</h3><p>案件編號：{selected.id}</p><p>進度：{statuses[selected.status]} · 第 {selected.version} 版</p><p>原因：{reportReasons[selected.reason]}</p><p className="engagement-copy">{selected.description}</p><p>更新時間：{new Date(selected.updatedAt).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}</p><h4>處理說明與結果</h4><p className="engagement-copy">{selected.resolution ?? '等待內容管理員受理。'}</p>
                {selected.status === 'closed' && <p>處理已完成。資料更正須由商家維護者確認並更新，本案件不會覆寫商家資料。<a href="#/demo?view=businesses">前往商家維護（假資料）</a></p>}
                {actor.role === 'content_admin' && selected.status !== 'closed' && <form onSubmit={event => { event.preventDefault(); const result = store.dispatch({ type: selected.status === 'open' ? 'accept' : 'close', actor, id: selected.id, version: selected.version, resolution }); if (!result.ok) { setMessage(result.error); return; } setSelected(result.report); setResolution(''); setMessage(result.report.status === 'closed' ? '已結案，回報者可查看處理結果。' : '已接案，請調查後填寫結果結案。'); }}><label>處理說明<textarea aria-label="處理說明" required rows={3} maxLength={2000} value={resolution} onChange={event => setResolution(event.target.value)} /></label><button type="submit">{selected.status === 'open' ? '接案處理' : '確認結案'}</button></form>}
            </article>}
        </>}
    </section>;
}
