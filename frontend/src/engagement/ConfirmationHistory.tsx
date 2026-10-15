import { useRef, useState } from 'react';
import { useBusinessDemo } from '../phase3/businessStore';
import { useCommunityDemo } from '../phase2/store';
import { projectOwnConfirmations, type OwnConfirmation } from './confirmationHistoryModel';
import './confirmation-history.css';

const date = (value: string) => value && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '日期無效';
export function ConfirmationHistory() {
    const business = useBusinessDemo();
    const { clubs } = useCommunityDemo();
    const [memberId, setMemberId] = useState('peer-1');
    const [filter, setFilter] = useState('all');
    const [selected, setSelected] = useState<OwnConfirmation | null>(null);
    const [message, setMessage] = useState('');
    const dialog = useRef<HTMLDialogElement>(null);
    const rows = projectOwnConfirmations(business.companies, memberId, { ...business, clubs });
    const visible = rows.filter(row => filter === 'all' || (filter === 'counted' ? row.counted : !row.counted));
    function close() { dialog.current?.close(); setSelected(null); }
    function withdraw() {
        if (!selected) return;
        const result = business.dispatch({ type: 'unendorse', actor: { memberId, role: 'member' }, id: selected.companyId, version: selected.version });
        setMessage(result.ok ? `已撤回對「${selected.companyName}」的確認。` : result.error);
        close();
    }
    return <section className="confirmation-history" aria-label="我的商家確認紀錄">
        <header><p className="ch-eyebrow">會員服務 / 商家確認</p><h2>我的商家確認紀錄</h2><p>確認有效期為一年；公司隱藏或社籍資格改變後，仍可在這裡撤回本人的確認。</p></header>
        <div className="ch-tools"><label>確認紀錄示範身分<select value={memberId} onChange={e => { setMemberId(e.target.value); setMessage(''); }}>
            {business.members.map(member => <option key={member.id} value={member.id}>{member.callName}{member.id === 'm7' ? '（社籍待確認）' : ''}</option>)}
        </select></label><label>確認狀態<select value={filter} onChange={e => setFilter(e.target.value)}><option value="all">全部紀錄</option><option value="counted">仍計入確認</option><option value="inactive">目前不計入</option></select></label></div>
        <p className="ch-note">假資料展示，與其他功能共用商家狀態；重新整理後還原。所有日期以台北時間呈現。</p>
        <p role="status" aria-live="polite">{message}</p>
        <p>共 {rows.length} 筆本人確認，顯示 {visible.length} 筆。</p>
        {visible.length === 0 ? <div className="ch-empty"><h3>目前沒有符合的確認紀錄</h3><p>可前往公開商家詳情確認曾實際接觸的公司，或調整上方篩選。</p><a href="#/map">探索商家</a></div> : <div className="ch-list">{visible.map(row => <article className="ch-card" key={row.companyId}>
            <div><h3>{row.companyName}</h3><div className="ch-tags"><span>{row.counted ? '仍計入確認' : '目前不計入'}</span><span>{row.publiclyVisible ? '商家公開中' : '商家已隱藏'}</span></div></div>
            <dl><div><dt>本人確認時間</dt><dd>{date(row.confirmedAt)}</dd></div><div><dt>一年效期截止（不含）</dt><dd>{date(row.expiresAt)}</dd></div></dl>
            {!row.counted && <p>確認已過期、尚未生效，或目前社籍／維護身分不符合計入條件。</p>}
            {!row.publiclyVisible && <p>此處僅保留公司名稱與本人確認紀錄；商家聯絡資料與位置不公開。</p>}
            <div className="ch-actions">{row.publiclyVisible && <a href={`#/business?id=${encodeURIComponent(row.companyId)}`}>查看公開商家</a>}<button type="button" onClick={() => { setSelected(row); dialog.current?.showModal(); }}>撤回確認</button></div>
        </article>)}</div>}
        <dialog ref={dialog} aria-labelledby="ch-withdraw-title" onCancel={() => setSelected(null)}><h3 id="ch-withdraw-title">確認撤回商家確認</h3><p>確定撤回對「{selected?.companyName}」的本人確認？撤回後不再計入社友確認數；日後需符合資格且商家公開中才可重新確認。</p><div className="ch-actions"><button type="button" onClick={close} autoFocus>保留確認</button><button type="button" onClick={withdraw}>確定撤回</button></div></dialog>
    </section>;
}
