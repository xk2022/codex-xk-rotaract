import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useBusinessDemo } from './businessStore';
import { useCommunityDemo } from '../phase2/store';
import { businessEligibility, businessConfirmation, trialEndsAt, canMaintainBusiness, industries, validateBusinessInput } from './businessModel';
import type { BusinessActor, BusinessCompany, BusinessInput, BusinessAction } from './businessModel';
import './business-workspace.css';

const labels = { draft: '草稿', pending: '待發布', approved: '已發布', rejected: '已退回', suspended: '已暫停' };
const identities: { label: string; actor: BusinessActor }[] = [
  { label: 'Sunny｜公司建立者', actor: { memberId: 'm1', role: 'member' } },
  { label: 'Alex｜已接受的維護者', actor: { memberId: 'm5', role: 'member' } },
  { label: 'Jo｜待確認會員（72 小時示範）', actor: { memberId: 'm7', role: 'member' } },
  { label: '廣告帳號｜無社籍公司建立者', actor: { memberId: 'account-only', role: 'member' } },
  { label: '商家內容管理員｜事後治理', actor: { memberId: 'content-admin', role: 'content_admin' } },
  { label: 'OB｜無當年度社籍建立者', actor: { memberId: 'm-ob', role: 'member' } },
];
const blank = (): BusinessInput => ({ name: '', description: '', industryIds: [], city: '', phone: '', email: '', website: '', address: '', publicFlags: { phone: false, email: false, website: false, address: false }, locationConsent: false, latitude: null, longitude: null });
function inputOf(company: BusinessCompany): BusinessInput {
  const { name, description, industryIds, city, phone, email, website, address, publicFlags, locationConsent, latitude, longitude } = company;
  return structuredClone({ name, description, industryIds, city, phone, email, website, address, publicFlags, locationConsent, latitude, longitude });
}
function inputForActor(company: BusinessCompany, actor: BusinessActor): BusinessInput {
  const input = inputOf(company);
  if (actor.role === 'content_admin') {
    for (const key of ['phone', 'email', 'website', 'address'] as const) if (!input.publicFlags[key]) input[key] = '';
    if (!input.locationConsent) { input.latitude = null; input.longitude = null; }
  }
  return input;
}
function taipeiLocal(value: string): string {
  const instant = new Date(value.length === 10 ? `${value}T00:00:00+08:00` : value).getTime();
  return Number.isFinite(instant) ? new Date(instant + 8 * 60 * 60 * 1000).toISOString().slice(0, 16) : '';
}
function displayInstant(value: string): string {
  return new Date(value).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false }) + '（台北）';
}
export function BusinessWorkspace() {
  const store = useBusinessDemo();
  const { clubs } = useCommunityDemo();
  const [identity, setIdentity] = useState(() => { const id = new URLSearchParams(window.location.hash.split('?')[1]).get('businessMember'); return Math.max(0, identities.findIndex(i => i.actor.memberId === id)); });
  const actor = identities[identity].actor;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState<BusinessInput>(blank);
  const [baseline, setBaseline] = useState(() => JSON.stringify(blank()));
  const [version, setVersion] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState('');
  const [reason, setReason] = useState('');
  const [intent, setIntent] = useState<'publish' | 'reject' | 'suspend' | null>(null);
  const [conflicted, setConflicted] = useState(false);
  const reviewDialog = useRef<HTMLDialogElement>(null);
  const previewDialog = useRef<HTMLDialogElement>(null);
  const selected = store.companies.find(company => company.id === selectedId);
  const dirty = editing && JSON.stringify(input) !== baseline;
  const isReviewer = actor.role === 'content_admin';
  const companies = store.companies.filter(company => isReviewer || canMaintainBusiness(company, actor));
  const allowLeave = () => (!dirty && !conflicted) || window.confirm('尚有未儲存的商家內容。確定捨棄變更嗎？');
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [dirty]);
  function open(company?: BusinessCompany) {
    if (!allowLeave()) return;
    const next = company ? inputForActor(company, actor) : blank();
    setSelectedId(company?.id ?? null); setInput(next); setBaseline(JSON.stringify(next)); setVersion(company?.version ?? 0);
    setEditing(true); setErrors([]); setNotice(''); setConflicted(false);
  }
  useEffect(() => { const id = new URLSearchParams(window.location.hash.split('?')[1]).get('company'); const company = store.companies.find(c => c.id === id && (isReviewer || canMaintainBusiness(c, actor))); if (company) open(company); }, []);
  function update<K extends keyof BusinessInput>(key: K, value: BusinessInput[K]) { setInput(current => ({ ...current, [key]: value })); }
  function save(event: FormEvent) {
    event.preventDefault(); setErrors([]);
    const result = store.dispatch(selectedId ? { type: 'update', actor, id: selectedId, version: conflicted ? version - 1 : version, input } : { type: 'create', actor, input });
    if (!result.ok) { setErrors([result.error]); return; }
    setSelectedId(result.company.id); setVersion(result.company.version); setInput(inputOf(result.company)); setBaseline(JSON.stringify(inputOf(result.company))); setConflicted(false);
    setNotice('草稿已儲存。確認內容後，點選「發布公司」自行發布。');
  }
  function request(type: 'publish' | 'reject' | 'suspend') {
    if (!selected) return;
    if (dirty) { setErrors(['請先儲存草稿，再發布公司或處理內容。']); return; }
    if (type === 'publish') { const issues = validateBusinessInput(inputOf(selected)); if (issues.length) { setErrors(issues); return; } }
    setReason(''); setErrors([]); setIntent(type); reviewDialog.current?.showModal();
  }
  function perform(event: FormEvent) {
    event.preventDefault(); if (!selected || !intent) return;
    const action: BusinessAction = { type: intent, actor, id: selected.id, version: conflicted ? version - 1 : version, reason };
    const result = store.dispatch(action);
    if (!result.ok) { setErrors([result.error]); return; }
    const next = inputForActor(result.company, actor);
    setVersion(result.company.version); setInput(next); setBaseline(JSON.stringify(next)); setNotice(`商家狀態：${labels[result.company.status]}`);
    reviewDialog.current?.close(); setIntent(null);
  }
  const eligibility = selected ? businessEligibility(selected, store.members, clubs, store.grants, store.asOf) : null;
  const trialExpiry = selected ? trialEndsAt(selected) : undefined;
  const confirmation = selected ? businessConfirmation(selected, store.members, clubs, store.asOf) : undefined;
  const duplicateName = input.name.trim() && store.companies.some(company => company.id !== selectedId && company.name.trim().toLocaleLowerCase() === input.name.trim().toLocaleLowerCase());
  const hasContact = (['phone', 'email', 'website', 'address'] as const).some(key => input.publicFlags[key] && input[key].trim());
  return <section className="bw-workspace" aria-label="會員商家維護" data-unsaved={dirty ? 'true' : 'false'}>
    <header className="bw-header"><div><p className="bw-eyebrow">BUSINESS STUDIO · 合成資料示範</p><h2>讓你的專業，被看見</h2><p>維護公司資訊、選擇公開聯絡方式，儲存後自行發布公司。</p></div><a href="#/map" className="bw-button">查看公開商家</a></header>
    <div className="bw-demo"><label>商家示範身分<select value={identity} onChange={event => { if (!allowLeave()) return; setIdentity(Number(event.target.value)); setEditing(false); setSelectedId(null); setErrors([]); setNotice(''); }}>{identities.map((identity, index) => <option key={identity.actor.memberId} value={index}>{identity.label}</option>)}</select></label><label>曝光資格情境時間（台北）<input type="datetime-local" value={taipeiLocal(store.asOf)} onChange={event => { if (event.target.value && allowLeave()) { store.setAsOf(`${event.target.value}+08:00`); if (dirty) setEditing(false); } }} /></label><p>此處切換僅模擬商家權限，不代表社團、地區或帳號支援管理者可修改他人公司。重新整理會重設資料。</p></div>
    {notice && <p className="bw-notice" role="status">{notice}</p>}
    {errors.length > 0 && <div className="bw-error" role="alert"><strong>請確認以下內容</strong><ul>{errors.map(error => <li key={error}>{error}</li>)}</ul></div>}
    <div className="bw-layout"><aside className="bw-panel"><div className="bw-row"><h3>{isReviewer ? '商家內容治理' : '我的公司'}</h3>{!isReviewer && <button className="bw-button primary" onClick={() => open()}>新增公司</button>}</div><p>僅建立者與已接受邀請的維護者可編輯。</p><div className="bw-company-list">{companies.map(company => <button key={company.id} className={`bw-company ${selectedId === company.id ? 'selected' : ''}`} onClick={() => open(company)} aria-pressed={selectedId === company.id}><strong>{company.name || '未命名草稿'}</strong><span>{labels[company.status]} · v{company.version}</span></button>)}</div>{companies.length === 0 && <p>目前沒有可維護的公司。</p>}</aside>
    <div className="bw-panel bw-editor">{!editing ? <div className="bw-empty"><h3>從一間公司開始</h3><p>選擇公司查看內容，或新增你的公司草稿。營業聯絡資料獨立填寫，不會帶入私人電話與信箱。</p></div> : <>
      <div className="bw-row"><h3>{selected ? selected.name || '公司草稿' : '新增公司草稿'}</h3><span className="bw-status">{selected ? labels[selected.status] : '尚未儲存'}</span></div>
      {selected?.reviewReason && <p className="bw-notice">退回／暫停原因：{selected.reviewReason}</p>}
      {selected?.status === 'pending' && !isReviewer && <p className="bw-notice">這是舊流程保留的待發布資料；請儲存草稿後自行發布。</p>}
      {selected?.status === 'suspended' && <p className="bw-notice">此商家已暫停，請依原因聯絡內容管理員處理；目前無法修改或重新發布。</p>}
      {selected?.status === 'approved' && !isReviewer && <p className="bw-notice">修改已發布內容並儲存會暫時撤下公開、回到草稿，需再點選發布公司。重新發布不會重設首次發布的 72 小時期限。</p>}
      {duplicateName && <p className="bw-notice">已有相同名稱的公司，請確認是否為同一家公司。系統不會自動合併資料；如需共同維護，請聯絡既有建立者。</p>}
      <form onSubmit={save} noValidate><fieldset disabled={isReviewer || selected?.status === 'suspended'}><legend>公司基本資料</legend><label>公司名稱（必填，上限 200 字）<input value={input.name} maxLength={200} onChange={event => update('name', event.target.value)} /></label><label>公司介紹<textarea value={input.description} maxLength={2000} rows={4} onChange={event => update('description', event.target.value)} /></label><label>城市／地區<input value={input.city} maxLength={80} onChange={event => update('city', event.target.value)} /></label><fieldset className="bw-industries"><legend>產業（至少一項，可複選）</legend>{industries.map(industry => <label key={industry.id}><input type="checkbox" checked={input.industryIds.includes(industry.id)} onChange={event => update('industryIds', event.target.checked ? [...input.industryIds, industry.id] : input.industryIds.filter(id => id !== industry.id))} />{industry.name}</label>)}</fieldset></fieldset>
      <fieldset disabled={isReviewer || selected?.status === 'suspended'}><legend>營業聯絡與公開設定</legend><p>至少填寫並公開一項營業聯絡方式。未勾選的欄位不會出現在公開預覽。</p>{([{ key: 'phone', label: '公司電話', type: 'tel' }, { key: 'email', label: '公司 Email', type: 'email' }, { key: 'website', label: '公司網站（https:// 或 http://）', type: 'url' }, { key: 'address', label: '營業地址', type: 'text' }] as const).map(field => <div className="bw-contact" key={field.key}><label>{field.label}<input type={field.type} value={input[field.key]} maxLength={500} onChange={event => { update(field.key, event.target.value); if (field.key === 'address' && event.target.value !== input.address) setInput(current => ({ ...current, latitude: null, longitude: null })); }} /></label><label className="bw-check"><input type="checkbox" checked={input.publicFlags[field.key]} onChange={event => update('publicFlags', { ...input.publicFlags, [field.key]: event.target.checked })} />公開</label></div>)}</fieldset>
      <fieldset disabled={isReviewer || selected?.status === 'suspended'}><legend>地圖位置</legend><p>人工填寫已確認的營業座標，不會自動定位或推算地址。修改地址會清空舊座標，請重新確認。</p><div className="bw-coordinate">{(['latitude', 'longitude'] as const).map(key => <label key={key}>{key === 'latitude' ? '緯度（−90～90）' : '經度（−180～180）'}<input type="number" step="any" value={input[key] ?? ''} onChange={event => update(key, event.target.value === '' ? null : Number(event.target.value))} /></label>)}</div><label className="bw-check"><input type="checkbox" checked={input.locationConsent} onChange={event => update('locationConsent', event.target.checked)} />我同意公開此營業位置，讓訪客在商家地圖查詢</label></fieldset>
      <div className="bw-actions">{!isReviewer && selected?.status !== 'suspended' && <button className="bw-button primary" type="submit">儲存草稿</button>}<button className="bw-button" type="button" onClick={() => previewDialog.current?.showModal()}>預覽公開欄位</button>{selected && !isReviewer && ['draft', 'pending', 'rejected'].includes(selected.status) && <button className="bw-button" type="button" onClick={() => request('publish')}>發布公司</button>}</div></form>
      {selected && <section className="bw-exposure" aria-label="曝光資格"><h4>曝光資格（唯讀）</h4><p>{eligibility?.paid ? '有效付費廣告資格' : eligibility?.free ? '當年度社籍免費資格' : eligibility?.trial ? '首次發布 72 小時暫時曝光' : selected.firstPublishedAt ? '暫時曝光已到期或無資格：隱藏公開資料' : '尚未發布：未開始暫時曝光'} · {store.asOf}</p>{selected.firstPublishedAt ? <><p>首次發布：{displayInstant(selected.firstPublishedAt)}</p><p>72 小時期限：{trialExpiry ? displayInstant(trialExpiry) : '—'}（期限不含此時刻，重新發布不重算）</p></> : <p>尚未首次發布；平台帳號首次發布後才開始計算 72 小時。</p>}<p>社友確認：{confirmation?.confirmationCount ?? 0} 人 · {confirmation?.communityConfirmed ? '已取得社友確認標章' : '尚未達六位社友確認門檻'}</p><p>需已發布且公開聯絡有效，地圖另需位置同意與有效座標。已登入的平台帳號首次發布享 72 小時暫時曝光；到期後須有效社籍或廣告資格。本輪不提供收款、廣告啟用或優惠核銷。</p></section>}
      {selected && isReviewer && <div className="bw-actions">{['pending', 'approved'].includes(selected.status) && <button className="bw-button" onClick={() => request('reject')}>退回改善</button>}{selected.status === 'approved' && <button className="bw-button danger" onClick={() => request('suspend')}>暫停公開</button>}</div>}
      {selected && <div className="bw-conflict"><button className="bw-button" onClick={() => { setConflicted(true); setNotice('已模擬版本衝突。下次儲存／發布／治理操作將拒絕，並保留你的輸入。'); }}>模擬版本衝突</button><button className="bw-button" onClick={() => open(selected)}>捨棄變更並載入最新版本</button></div>}
    </>}</div></div>
    <dialog className="bw-dialog" ref={previewDialog} aria-label="商家公開欄位預覽"><h3>公開欄位預覽</h3><p>這是尚未發布的欄位預覽；實際公開仍須發布並符合曝光資格。</p><h4>{input.name || '尚未填寫公司名稱'}</h4><p>{input.description}</p><p>{input.city} · {industries.filter(industry => input.industryIds.includes(industry.id)).map(industry => industry.name).join('、')}</p>{(['phone', 'email', 'website', 'address'] as const).filter(key => input.publicFlags[key] && input[key].trim()).map(key => <p key={key}>{({phone:'公司電話',email:'公司 Email',website:'公司網站',address:'營業地址'})[key]}：{input[key]}</p>)}{!hasContact && <p>目前沒有公開聯絡方式，尚不能上架。</p>}{input.locationConsent && input.latitude !== null && input.longitude !== null && Number.isFinite(input.latitude) && Number.isFinite(input.longitude) && Math.abs(input.latitude) <= 90 && Math.abs(input.longitude) <= 180 && <p>已同意公開位置：{input.latitude}, {input.longitude}</p>}<button className="bw-button" onClick={() => previewDialog.current?.close()}>關閉預覽</button></dialog>
    <dialog className="bw-dialog" ref={reviewDialog} aria-label="確認商家狀態變更"><form onSubmit={perform}><h3>{intent === 'publish' ? '發布公司' : intent === 'reject' ? '退回改善' : '暫停公開'}</h3><p>本次處理版本 v{version}。發布不會授予社籍或付費權益；內容管理員可事後依原因退回或暫停。</p>{(intent === 'reject' || intent === 'suspend') && <label>原因（必填）<textarea required value={reason} onChange={event => setReason(event.target.value)} maxLength={1000} /></label>}{errors.length > 0 && <p role="alert">{errors.join('；')}</p>}<div className="bw-actions"><button className="bw-button primary" type="submit">確認</button><button className="bw-button" type="button" onClick={() => reviewDialog.current?.close()}>取消</button></div></form></dialog>
  </section>;
}
