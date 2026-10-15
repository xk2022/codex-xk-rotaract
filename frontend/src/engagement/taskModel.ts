import { actorClub, isManager, type Actor, type State } from '../domain';
import type { SupportCase } from '../features/historySupportModel';
import { businessEligibility, businessInstant, grantEndsOn, trialEndsAt, type BusinessCompany, type BusinessMember, type ExposureGrant } from '../phase3/businessModel';
import type { CommunityClub } from '../phase2/model';
export interface TaskItem { id: string; title: string; detail: string; view: 'applications'|'transfers'|'annual'|'support'|'businesses'|'profile'; priority: 'action'|'waiting'|'reminder'; companyId?: string; }
export function membershipTasks(state: State, actor: Actor, cases: SupportCase[]): TaskItem[] {
 if (actor === 'visitor') return [];
 const items: TaskItem[] = []; const manager = isManager(actor); const own = actor === 'member'; const club = actorClub(actor);
 for (const a of state.applications) if (a.status === 'pending' && (manager ? a.clubId === club : own && a.memberId === state.currentMemberId)) items.push({id:`application-${a.id}`,title:manager?'入社申請待審核':'入社申請等待回覆',detail:'查看申請進度與處理說明。',view:'applications',priority:manager?'action':'waiting'});
 for (const t of state.transfers) {
  if (!['pending','ready'].includes(t.status)) continue;
  if (manager && ((t.fromClub === club && !t.fromApproved) || (t.toClub === club && !t.toApproved))) items.push({id:`transfer-${t.id}`,title:'轉社申請待本社核可',detail:'兩社核可後，仍須本人最終確認。',view:'transfers',priority:'action'});
  else if (own && t.memberId === state.currentMemberId) items.push({id:`transfer-${t.id}`,title:t.status==='ready'?'轉社待本人最終確認':'轉社等待兩社核可',detail:'完成本人最終確認後才變更社籍。',view:'transfers',priority:t.status==='ready'?'action':'waiting'});
 }
 if (manager) { const count=state.members.filter(m=>m.clubId===club && m.status==='unconfirmed').length; if(count) items.push({id:'annual',title:`${count} 位社員待年度確認`,detail:'確認當年度社員狀態，避免影響曝光資格。',view:'annual',priority:'action'}); }
 if (own && state.members.find(m=>m.id===state.currentMemberId)?.status==='unconfirmed') items.push({id:'annual-own',title:'等待社團確認當年度社籍',detail:'請聯絡社團管理者；可查看目前社籍狀態。',view:'profile',priority:'waiting'});
 for(const c of cases) if((actor==='platform' && ['pending','supplement'].includes(c.status)) || (own && c.memberId===state.currentMemberId && c.status==='supplement')) items.push({id:`support-${c.id}`,title:actor==='platform'?(c.status==='pending'?'帳號案件待人工核身':'核身案件等待補件'):'帳號案件需要補件',detail:actor==='platform'?'查看案件進度。':'查看補件需求並回覆。',view:'support',priority:actor==='platform' && c.status==='supplement'?'waiting':'action'});
 return items;
}
export function exposureTasks(companies: BusinessCompany[], memberId: string, members: BusinessMember[], clubs: CommunityClub[], grants: ExposureGrant[], asOf: string): TaskItem[] {
 const now=businessInstant(asOf); if(!memberId || !Number.isFinite(now)) return [];
 return companies.filter(c=>c.ownerId===memberId || c.acceptedMaintainerIds.includes(memberId)).flatMap<TaskItem>(c=>{
  const q=businessEligibility(c,members,clubs,grants,asOf); const base={id:`exposure-${c.id}`,view:'businesses' as const,companyId:c.id};
  if(['draft','pending','rejected'].includes(c.status)) return [{...base,title:`${c.name}：待完善並發布`,detail:'查看草稿與處理說明；儲存不會自動曝光。',priority:'action' as const}];
  if(c.status==='suspended') return [{...base,title:`${c.name}：曝光已暫停`,detail:'查看平台處理說明，依原因更正資料。',priority:'action' as const}];
  if(c.status!=='approved') return [];
  if(!q.eligible) return [{...base,title:`${c.name}：曝光資格已到期`,detail:'查看申請進度／處理曝光資格：確認當年度社籍或有效廣告。重新發布不會重啟三日曝光。',priority:'action' as const}];
  if(q.free) return [];
  const ends=[...(q.trial&&trialEndsAt(c)?[businessInstant(trialEndsAt(c)!)]:[]),...grants.filter(g=>g.companyId===c.id&&g.status==='active'&&businessInstant(g.startsOn)<=now&&now<businessInstant(grantEndsOn(g.startsOn))).map(g=>businessInstant(grantEndsOn(g.startsOn)))];
  const end=Math.max(...ends); if(end-now>7*86400000) return [];
  return [{...base,title:`${c.name}：曝光即將到期`,detail:`距目前示範時間約 ${Math.max(1,Math.ceil((end-now)/3600000))} 小時。確認社籍或廣告資格，才能繼續曝光。`,priority:'reminder' as const}];
 });
}
