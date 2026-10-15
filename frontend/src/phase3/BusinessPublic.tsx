import { authHref } from "../engagement/authContinuation";
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Building2, ChevronLeft, ExternalLink, MapPin, Search } from 'lucide-react';
import { useCommunityDemo } from '../phase2/store';
import { useBusinessDemo } from './businessStore';
import { filterBusinesses, industries, safeBusinessWebsite, type PublicBusiness } from './businessModel';
import { BusinessReports } from '../engagement/BusinessReports';
import './business-public.css';

type Filters = { keyword: string; districtId: string; city: string; clubId: string; industryId: string; view: 'map' | 'list' };
const empty: Filters = { keyword: '', districtId: '', city: '', clubId: '', industryId: '', view: 'map' };
const storageKey = 'xk-business-public-filters-v1';
function readFilters(): Filters {
  try {
    const value = JSON.parse(sessionStorage.getItem(storageKey) || '{}') as Partial<Filters>;
    return { ...empty, ...Object.fromEntries(Object.entries(value).filter(([key, item]) => Object.hasOwn(empty, key) && typeof item === 'string' && item.length < 300)), view: value.view === 'list' ? 'list' : 'map' };
  } catch { return { ...empty }; }
}
const detailUrl = (id: string) => `#/business?id=${encodeURIComponent(id)}`;
function IndustryNames({ ids }: { ids: string[] }) { return <>{ids.map(id => industries.find(i => i.id === id)?.name).filter(Boolean).join(' · ')}</>; }
function ContactNames({ business }: { business: PublicBusiness }) {
  return <>{business.contacts.map((contact, index) => <span key={`${contact.clubId}-${contact.callName}-${index}`}>{contact.callName} ｜ {contact.clubName}</span>)}</>;
}
function taipeiTime(value: string): string {
  const instant = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00+08:00` : value);
  return Number.isFinite(instant.getTime()) ? `${new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(instant)}（台北時間）` : '時間尚未設定';
}
function Exposure({ business }: { business: PublicBusiness }) {
  return <span className="bp-badges"><span className={`bp-badge ${business.exposure === 'advertisement' ? 'bp-ad' : business.exposure === 'trial' ? 'bp-trial' : ''}`}>{business.exposure === 'advertisement' ? '廣告' : business.exposure === 'trial' ? '三日暫時曝光' : '社友商家'}</span>{business.communityConfirmed && <span className="bp-badge bp-confirmed">社友已確認</span>}</span>;
}
function CommunityConfirmation({ business }: { business: PublicBusiness }) {
  const { companies, members, dispatch } = useBusinessDemo();
  const [memberId, setMemberId] = useState('');
  const [notice, setNotice] = useState('');
  const company = companies.find(c => c.id === business.id);
  function confirm(type: 'endorse' | 'unendorse') {
    if (!memberId || !company) { setNotice('請先登入；此處可使用確認身分示範體驗流程。'); return; }
    const result = dispatch({ type, actor: { memberId, role: 'member' }, id: company.id, version: company.version });
    setNotice(result.ok ? type === 'endorse' ? '已記錄本次到訪／使用確認。' : '已撤回你的確認。' : result.error);
  }
  return <section className="bp-panel bp-confirmation" aria-labelledby="bp-confirm-title"><h2 id="bp-confirm-title">社友確認商家存在</h2>
    <p>目前累計 <strong>{business.confirmationCount}</strong> 位有效社友確認，達 6 位時顯示「社友已確認」。</p>
    {business.lastConfirmedAt && <p className="bp-note">最近確認：{taipeiTime(business.lastConfirmedAt)}</p>}
    <p className="bp-note">確認紀錄有效一年。此標章僅表示社友曾到訪或使用服務，不是平台對合法性、品質或交易的保證，也不會延長商家曝光。</p>
    <div className="bp-confirm-controls"><label>確認身分示範<select aria-label="確認身分示範" value={memberId} onChange={event => { setMemberId(event.target.value); setNotice(''); }}><option value="">匿名訪客</option>{members.filter(member => member.id.startsWith('peer-')).map(member => <option key={member.id} value={member.id}>{member.callName}（合成社友）</option>)}</select></label>
    <p className="bp-note">純展示身分切換，並非真實登入或授權。商家本人及維護者不可替自己的商家計次；每位社友僅計一次，可撤回。</p>
    {memberId ? <div className="bp-confirm-actions"><button className="bp-primary" onClick={() => confirm('endorse')}>我曾到訪／使用服務，確認商家存在</button><button className="bp-confirm-withdraw" onClick={() => confirm('unendorse')}>撤回我的確認</button></div> : <p><a href={authHref("login")}>登入後確認商家</a>，或選擇上方示範身分體驗。</p>}
    <p><a href="#/demo?view=confirmations">查看／撤回我的商家確認（假資料）</a></p><p role="status" aria-live="polite">{notice}</p></div>
  </section>;
}
export function BusinessPublic({ page }: { page: 'map' | 'business' }) {
  const { publicBusinesses, asOf } = useBusinessDemo();
  const { clubs } = useCommunityDemo();
  const [filters, setFilters] = useState<Filters>(readFilters);
  const [selected, setSelected] = useState('');
  const [recovered, setRecovered] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const query = new URLSearchParams(window.location.hash.split('?')[1] || '');
  const scenario = recovered ? null : query.get('businessState');
  useEffect(() => { try { sessionStorage.setItem(storageKey, JSON.stringify(filters)); } catch { /* Query remains usable when storage is unavailable. */ } }, [filters]);
  const visibleClubs = clubs.filter(club => publicBusinesses.some(b => b.contacts.some(c => c.clubId === club.id)));
  const districts = [...new Map(visibleClubs.map(club => [club.districtId, club.districtName])).entries()];
  const filtered = filterBusinesses(publicBusinesses, filters).filter(b => !filters.districtId || b.contacts.some(contact => clubs.some(club => club.id === contact.clubId && club.districtId === filters.districtId)));
  const pins = filtered.filter(b => b.mapVisible);
  const business = publicBusinesses.find(b => b.id === query.get('id'));
  const set = (key: keyof Filters, value: string) => { setFilters(old => ({ ...old, [key]: value, ...(key === 'districtId' ? { clubId: '' } : {}) })); setSelected(''); };
  function retry() { setRecovered(true); requestAnimationFrame(() => heading.current?.focus()); }
  function selectPin(id: string) {
    setSelected(id);
    const card = document.getElementById(`business-card-${id}`);
    card?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'nearest' });
    card?.focus({ preventScroll: true });
  }
  if (page === 'business') return <section className="bp-page ph-container">
    <a className="bp-back" href="#/map"><ChevronLeft size={18} /> 返回商家地圖與名錄</a>
    {!business ? <div className="bp-empty"><h1>找不到公開商家</h1><p>這間商家目前沒有公開資料，或連結已失效。</p><a href="#/map">瀏覽公開商家</a><p><a href="#/demo?view=confirmations">查看／撤回本人既有確認（假資料）</a> · <a href="#/demo?view=reports">追蹤既有回報（假資料）</a></p></div> : <>
      <header className="bp-detail-hero"><div className="bp-detail-art" aria-hidden="true"><Building2 size={80} strokeWidth={1} /><span>ROTARACT / BUSINESS</span></div><div><Exposure business={business} /><p className="bp-kicker">{business.city} · <IndustryNames ids={business.industryIds} /></p><h1>{business.name}</h1><div className="bp-contacts"><ContactNames business={business} /></div></div></header>
      {business.exposure === 'trial' && business.trialEndsAt && <p className="bp-trial-note">首次自行發布的三日暫時曝光，將於 {taipeiTime(business.trialEndsAt)} 到期；期滿須符合當年度社籍免費資格或持有有效廣告，才會繼續公開。</p>}
      <div className="bp-detail-grid"><article className="bp-panel"><h2>關於商家</h2><p className="bp-description">{business.description || '商家尚未提供介紹。'}</p><h2>社友連結</h2><div className="bp-detail-clubs">{business.contacts.map((contact, index) => <p key={`${contact.clubId}-${index}`}><strong>{contact.callName}</strong><br />{clubs.some(c => c.id === contact.clubId && c.enabled && c.public) ? <a href={`#/club?id=${encodeURIComponent(contact.clubId)}`}>{contact.clubName} <ArrowRight size={14} /></a> : <span>{contact.clubName}</span>}</p>)}</div></article>
      <aside className="bp-panel"><h2>營業聯絡方式</h2><dl className="bp-contact-list">
        {business.phone && <><dt>電話</dt><dd><a href={`tel:${business.phone.replace(/[^+\d]/g, '')}`}>{business.phone}</a></dd></>}
        {business.email && <><dt>Email</dt><dd><a href={`mailto:${business.email}`}>{business.email}</a></dd></>}
        {business.website && safeBusinessWebsite(business.website) && <><dt>網站</dt><dd><a href={safeBusinessWebsite(business.website)} target="_blank" rel="noopener noreferrer">商家網站 <ExternalLink size={14} /><span className="bp-sr">（另開視窗）</span></a></dd></>}
        {business.address && <><dt>營業地址</dt><dd>{business.address}</dd></>}
      </dl><p className="bp-note">僅顯示商家同意公開的營業聯絡資訊。</p>{!business.mapVisible && <p className="bp-note">此商家提供名錄查詢，暫無公開地圖位置。</p>}</aside></div>
      <section className="bp-panel bp-coupon-entry" aria-label="商家會員優惠">
        <h2>會員專屬優惠</h2><p>登入且具當年度正常社籍，可領取優惠兌換碼；使用條件以各項優惠說明為準。</p>
        <a className="bp-primary" href={authHref("login")}>登入使用會員優惠</a>
        <p className="bp-note"><a href={`#/demo?view=coupons&company=${encodeURIComponent(business.id)}`}>體驗此商家優惠（假資料）</a></p>
      </section>
      <CommunityConfirmation key={business.id} business={business} />
      <BusinessReports key={`report-${business.id}`} companyId={business.id} />
      <p className="bp-demo-note">本頁為合成資料展示。曝光資格示範時間：{taipeiTime(asOf)}。會員優惠請由上方登入入口使用；展示操作可選擇假資料體驗。</p>
    </>}
  </section>;
  return <section className="bp-page ph-container">
    <header className="bp-heading"><div><p className="bp-kicker">ROTARACT BIZMAP</p><h1 ref={heading} tabIndex={-1}>從社友連結，發現好商家。</h1><p>尋找在地服務，也認識每間商家背後的扶青夥伴。</p></div><span className="bp-demo-label">假資料體驗</span></header>
    <div className="bp-filter-panel"><div className="bp-search"><Search size={20} aria-hidden="true" /><label className="bp-sr" htmlFor="bp-keyword">搜尋商家</label><input id="bp-keyword" value={filters.keyword} onChange={e => set('keyword', e.target.value)} placeholder="搜尋商家、Call Name 或社團" /></div>
      <div className="bp-filter-grid">
        <label>扶輪地區<select aria-label="扶輪地區" value={filters.districtId} onChange={e => set('districtId', e.target.value)}><option value="">全部扶輪地區</option>{districts.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
        <label>城市<select aria-label="城市" value={filters.city} onChange={e => set('city', e.target.value)}><option value="">全部城市</option>{[...new Set(publicBusinesses.map(b => b.city))].sort().map(city => <option key={city}>{city}</option>)}</select></label>
        <label>產業<select aria-label="產業" value={filters.industryId} onChange={e => set('industryId', e.target.value)}><option value="">全部產業</option>{industries.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</select></label>
        <label>所屬社團<select aria-label="所屬社團" value={filters.clubId} onChange={e => set('clubId', e.target.value)}><option value="">全部社團</option>{visibleClubs.filter(c => !filters.districtId || c.districtId === filters.districtId).map(club => <option key={club.id} value={club.id}>{club.name}</option>)}</select></label>
      </div><button className="bp-clear" onClick={() => { setFilters({ ...empty, view: filters.view }); setSelected(''); }}>清除商家篩選</button>
    </div>
    {scenario === 'error' || scenario === 'loading' ? <div className="bp-empty" role={scenario === 'error' ? 'alert' : 'status'}><h2>{scenario === 'error' ? '商家資料暫時無法載入' : '正在載入商家資料…'}</h2><p>這是{scenario === 'error' ? '載入失敗' : '載入中'}的假資料情境，不代表真實服務狀態。</p><button className="bp-primary" onClick={retry}>{scenario === 'error' ? '重試載入示範資料' : '完成示範載入'}</button></div> : <>
      <div className="bp-results-head"><p role="status" aria-live="polite">找到 <strong>{filtered.length}</strong> 間示範商家 · {pins.length} 個公開位置</p><div className="bp-view-switch" role="group" aria-label="商家檢視方式"><button aria-pressed={filters.view === 'map'} onClick={() => set('view', 'map')}>示意圖與列表</button><button aria-pressed={filters.view === 'list'} onClick={() => set('view', 'list')}>僅列表</button></div></div>
      {!filtered.length ? <div className="bp-empty"><Search size={32} aria-hidden="true" /><h2>沒有符合的商家</h2><p>試試其他關鍵字、城市或社團。</p><button className="bp-primary" onClick={() => setFilters({ ...empty, view: filters.view })}>清除篩選</button></div> : <div className={`bp-results bp-view-${filters.view}`}>
        {filters.view === 'map' && <aside className="bp-map-panel" aria-label="商家連結示意圖"><div className="bp-map-title"><MapPin size={20} /><strong>商家連結示意</strong></div><p>未串接地圖供應商；標記位置為排版示意，非真實定位。</p><div className="bp-map-canvas">{pins.map((b, index) => <button key={b.id} className={`bp-pin ${b.exposure === 'advertisement' ? 'bp-pin-ad' : ''} ${selected === b.id ? 'is-selected' : ''}`} onClick={() => selectPin(b.id)} aria-label={`在列表選取${b.name}${b.exposure === 'advertisement' ? '（廣告）' : ''}`} aria-pressed={selected === b.id}><MapPin size={24} fill="currentColor" /><span><small>{String(index + 1).padStart(2, '0')}</small>{b.name}{b.exposure === 'advertisement' && <em>廣告</em>}</span></button>)}{!pins.length && <p className="bp-no-pins">此篩選結果沒有公開位置，請使用右方或下方名錄。</p>}</div><div className="bp-map-legend"><span>● 社友商家</span><span>● 廣告（色違）</span></div><p className="bp-note">沒有公開位置的商家仍可從列表查看。</p></aside>}
        <div className="bp-business-list">{filtered.map(b => <a id={`business-card-${b.id}`} key={b.id} href={detailUrl(b.id)} className={`ph-business-card bp-business-card ${selected === b.id ? 'is-selected' : ''}`}><div className={`bp-card-art ${b.exposure === 'advertisement' ? 'bp-card-ad' : ''}`} aria-hidden="true"><Building2 size={36} strokeWidth={1.2} /><span>{b.city}</span></div><div className="bp-card-body"><Exposure business={b} /><p className="bp-kicker">{b.city} · <IndustryNames ids={b.industryIds} /></p><h2>{b.name}</h2><div className="bp-contacts"><ContactNames business={b} /></div><p className="bp-card-description">{b.description}</p>{!b.mapVisible && <small className="bp-note">僅名錄 · 無公開地圖位置</small>}<span className="bp-more">查看商家詳情 <ArrowRight size={16} /></span></div></a>)}</div>
      </div>}
    </>}
    <p className="bp-demo-note">曝光資格示範時間：{taipeiTime(asOf)}。營業資訊由商家提供；本次為合成資料展示，請勿輸入真實個資。會員資料查詢請先<a href={authHref("login")}>登入</a>。</p>
  </section>;
}
