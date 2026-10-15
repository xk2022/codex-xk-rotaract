import { useRef, useState } from 'react';
import { useBusinessDemo } from '../phase3/businessStore';
import type { MaintainerInvitation } from './invitationModel';
import './company-invitations.css';

const statuses: Record<MaintainerInvitation['status'], string> = { pending: '待回覆', accepted: '已接受', rejected: '已拒絕', cancelled: '已取消', revoked: '已撤銷' };
const formatDate = (value: string) => Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '日期無效';
type Confirmation = { type: 'accept' | 'reject' | 'cancel'; invitation: MaintainerInvitation; companyVersion: number } | { type: 'revoke'; companyId: string; companyName: string; companyVersion: number; memberId: string };
const actionNames = { accept: '接受邀請', reject: '拒絕邀請', cancel: '取消邀請', revoke: '撤銷維護權' };
export function CompanyInvitations() {
    const business = useBusinessDemo();
    const [memberId, setMemberId] = useState(() => {
        const requested = new URLSearchParams(window.location.hash.split('?')[1]).get('businessMember');
        return business.members.some(m => m.id === requested) ? requested! : 'm1';
    });
    const [tab, setTab] = useState<'owned' | 'received'>(() => business.companies.some(c => c.ownerId === memberId) ? 'owned' : 'received');
    const [companyId, setCompanyId] = useState('');
    const [inviteeId, setInviteeId] = useState('');
    const [filter, setFilter] = useState('all');
    const [message, setMessage] = useState('');
    const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
    const [dialogError, setDialogError] = useState('');
    const dialog = useRef<HTMLDialogElement>(null);
    const owned = business.companies.filter(c => c.ownerId === memberId);
    const company = owned.find(c => c.id === companyId) ?? owned[0];
    const actor = { memberId, role: 'member' as const };
    const name = (id: string) => business.members.find(m => m.id === id)?.callName ?? id;
    const rows = business.invitations.filter(i => tab === 'owned' ? i.ownerId === memberId && i.companyId === company?.id : i.inviteeId === memberId);
    const visible = rows.filter(i => filter === 'all' || i.status === filter);
    const candidates = business.members.filter(m => m.id !== memberId && !company?.acceptedMaintainerIds.includes(m.id) && !business.invitations.some(i => i.companyId === company?.id && i.inviteeId === m.id && i.status === 'pending'));
    function close() { dialog.current?.close(); setConfirmation(null); setDialogError(''); }
    function ask(next: Confirmation) { setConfirmation(next); setDialogError(''); dialog.current?.showModal(); }
    function send() {
        if (!company || !inviteeId) return;
        const result = business.dispatchInvitation({ type: 'invite', actor, companyId: company.id, companyVersion: company.version, inviteeId });
        setMessage(result.ok ? `已邀請 ${name(inviteeId)}，對方接受後才會取得維護權。` : result.error);
        if (result.ok) setInviteeId('');
    }
    function execute() {
        if (!confirmation) return;
        const result = confirmation.type === 'revoke'
            ? business.dispatchInvitation({ type: 'revoke', actor, companyId: confirmation.companyId, companyVersion: confirmation.companyVersion, memberId: confirmation.memberId })
            : business.dispatchInvitation({ type: confirmation.type, actor, id: confirmation.invitation.id, version: confirmation.invitation.version, companyVersion: confirmation.companyVersion });
        if (!result.ok) { setDialogError(result.error); return; }
        setMessage(`已完成${actionNames[confirmation.type]}。`); close();
    }
    return <section className="company-invitations" aria-label="公司共同維護邀請">
        <header><p className="ci-eyebrow">會員服務 / 共同維護</p><h2>公司共同維護邀請</h2><p>邀請信任的會員一起更新公司資料；對方接受前，不會開放公司非公開內容。</p></header>
        <label className="ci-identity">共同維護示範身分<select aria-label="共同維護示範身分" value={memberId} onChange={e => { setMemberId(e.target.value); setTab(business.companies.some(c => c.ownerId === e.target.value) ? 'owned' : 'received'); setFilter('all'); setCompanyId(''); setInviteeId(''); setMessage(''); }}><option value="">未登入訪客</option>{business.members.map(m => <option key={m.id} value={m.id}>{m.callName}（{m.id}）</option>)}</select></label>
        <p className="ci-note">假資料展示，接受或撤銷後立即更新本次體驗的商家維護權；重新整理後還原。時間以台北呈現。</p>
        <p role="status" aria-live="polite">{message}</p>
        {!memberId ? <div className="ci-empty"><h3>請登入後管理邀請</h3><p>本頁可切換上方示範身分體驗流程。</p><a href="#/login">前往登入</a></div> : <>
            <div className="ci-tabs" aria-label="邀請檢視"><button type="button" aria-pressed={tab === 'owned'} onClick={() => { setTab('owned'); setFilter('all'); }}>管理我的公司</button><button type="button" aria-pressed={tab === 'received'} onClick={() => { setTab('received'); setFilter('all'); }}>收到的邀請</button></div>
            <div className="ci-permissions"><strong>共同維護權範圍</strong><p>接受後可查看並編輯公司營業資料（包含非公開欄位）。不授予社籍、免費曝光資格、優惠建立或核銷權；只有建立者能管理維護人選。</p></div>
            {tab === 'owned' && (company ? <div className="ci-panel"><label>我的公司<select aria-label="我的公司" value={company.id} onChange={e => { setCompanyId(e.target.value); setInviteeId(''); setMessage(''); }}>{owned.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
                <form onSubmit={e => { e.preventDefault(); send(); }}><label>邀請共同維護會員<select aria-label="邀請共同維護會員" required value={inviteeId} onChange={e => setInviteeId(e.target.value)}><option value="">請選擇會員</option>{candidates.map(m => <option key={m.id} value={m.id}>{m.callName}（{m.id}）</option>)}</select></label><button type="submit" disabled={!inviteeId}>送出維護邀請</button></form>
                {!candidates.length && <p>目前沒有可邀請的新對象，請先處理待回覆邀請。</p>}
                <a href={`#/demo?view=businesses&company=${encodeURIComponent(company.id)}&businessMember=${encodeURIComponent(memberId)}`}>維護此公司資料</a>
                <h3>目前共同維護人員</h3>{!company.acceptedMaintainerIds.length ? <p>尚無共同維護人員。</p> : <ul className="ci-maintainers">{company.acceptedMaintainerIds.map(id => <li key={id}><span>{name(id)}（{id}）</span><button type="button" onClick={() => ask({ type: 'revoke', companyId: company.id, companyName: company.name, companyVersion: company.version, memberId: id })}>撤銷 {name(id)} 維護權</button></li>)}</ul>}
            </div> : <div className="ci-empty"><h3>目前沒有由你建立的公司</h3><p>共同維護者可到商家管理更新資料，但不能邀請其他維護人員。</p><a href={`#/demo?view=businesses&businessMember=${encodeURIComponent(memberId)}`}>前往商家管理</a></div>)}
            <div className="ci-list-heading"><h3>{tab === 'owned' ? '此公司的邀請紀錄' : '我的受邀紀錄'}</h3><label>邀請狀態<select aria-label="邀請狀態" value={filter} onChange={e => setFilter(e.target.value)}><option value="all">全部狀態</option>{Object.entries(statuses).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label></div>
            <p>共 {rows.length} 筆，顯示 {visible.length} 筆。</p>
            {!visible.length ? <div className="ci-empty"><h3>目前沒有符合的邀請</h3><p>{filter !== 'all' ? '請調整狀態篩選。' : tab === 'received' ? '公司建立者送出邀請後，會在這裡顯示。' : '送出邀請後，可在這裡追蹤回覆或取消邀請。'}</p></div> : <div className="ci-list">{visible.map(invitation => {
                const linked = business.companies.find(c => c.id === invitation.companyId);
                return <article className="ci-card" key={invitation.id}><div className="ci-card-heading"><h3>{invitation.companyName}</h3><span className="ci-badge">{statuses[invitation.status]}</span></div>{tab === 'owned' && <p>受邀會員：{name(invitation.inviteeId)}（{invitation.inviteeId}）</p>}<dl><div><dt>邀請時間</dt><dd>{formatDate(invitation.createdAt)}</dd></div><div><dt>最後更新</dt><dd>{formatDate(invitation.updatedAt)}</dd></div></dl>
                    <div className="ci-actions">{invitation.status === 'pending' && linked && (tab === 'owned' ? <button type="button" onClick={() => ask({ type: 'cancel', invitation, companyVersion: linked.version })}>取消邀請</button> : <><button type="button" onClick={() => ask({ type: 'accept', invitation, companyVersion: linked.version })}>接受邀請</button><button type="button" onClick={() => ask({ type: 'reject', invitation, companyVersion: linked.version })}>拒絕邀請</button></>)}
                    {tab === 'received' && invitation.status === 'accepted' && linked?.acceptedMaintainerIds.includes(memberId) && <a href={`#/demo?view=businesses&company=${encodeURIComponent(invitation.companyId)}&businessMember=${encodeURIComponent(memberId)}`}>維護此公司資料</a>}</div>
                </article>;
            })}</div>}
        </>}
        <dialog ref={dialog} aria-labelledby="ci-confirm-title" onCancel={() => { setConfirmation(null); setDialogError(''); }}><h3 id="ci-confirm-title">確認{confirmation ? actionNames[confirmation.type] : '操作'}</h3>{confirmation && <><p>公司：{confirmation.type === 'revoke' ? confirmation.companyName : confirmation.invitation.companyName}</p><p>{confirmation.type === 'accept' ? '接受後可維護此公司的非公開營業資料。此權限不包含社籍、免費曝光或優惠核銷。' : confirmation.type === 'revoke' ? `撤銷後，${name(confirmation.memberId)} 將立即失去共同維護權。不會刪除公司資料或既有獨立會員關聯。` : confirmation.type === 'cancel' ? '取消後，對方不能再接受這筆邀請；需要時可重新邀請。' : '拒絕後不會取得公司維護權。'}</p></>}{dialogError && <p className="ci-error" role="alert">{dialogError} 請取消並重新選取操作，取得最新狀態。</p>}<div className="ci-actions"><button type="button" onClick={close} autoFocus>返回</button><button type="button" onClick={execute} disabled={!!dialogError}>確定{confirmation ? actionNames[confirmation.type] : '執行'}</button></div></dialog>
    </section>;
}
