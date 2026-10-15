import {actorClub,isManager,type Actor,type State} from '../domain';
import type {OrgState} from '../features/organizationModel';
export interface HandoverOffice {office:'president'|'secretary';label:string;assignments:{callName:string;startsOn:string;endsOn:string}[]}
const validDate=(date:string)=>/^\d{4}-\d{2}-\d{2}$/.test(date)&&Number.isFinite(Date.parse(date))&&new Date(date).toISOString().slice(0,10)===date;
export function projectHandover(state:State,organizations:OrgState,actor:Actor,district:string,asOf:string){
 if(!validDate(asOf)||(!isManager(actor)&&actor!=='district'))return [];
 const roleYear=Number(asOf.slice(0,4))-(asOf.slice(5)<'07-01'?1:0);const nextStart=`${roleYear+1}-07-01`;
 return organizations.clubs.filter(c=>actor==='district'?c.district===district:c.id===actorClub(actor)).map(club=>{
  const members=state.members.filter(m=>m.clubId===club.id);const current=members.filter(m=>['confirmed','unconfirmed'].includes(m.status));
  const year=state.demoYear??2026;const confirmed=current.filter(m=>m.status==='confirmed'&&(m.annualConfirmedYear??2026)>=year).length;const pending=current.length-confirmed;const staleCount=current.filter(m=>m.status==='confirmed'&&(m.annualConfirmedYear??2026)<year).length;
  const roles=organizations.roles.filter(r=>r.clubId===club.id);
  const person=(id:string)=>members.find(m=>m.id===id&&m.status==='confirmed');
  const nextOffices:HandoverOffice[]=([{office:'president',label:'社長'},{office:'secretary',label:'秘書'}] as const).map(o=>({...o,assignments:roles.filter(r=>club.enabled&&r.office===o.office&&validDate(r.startsOn)&&validDate(r.endsOn)&&r.startsOn<=nextStart&&r.endsOn>=nextStart&&person(r.memberId)).map(r=>({callName:person(r.memberId)!.callName,startsOn:r.startsOn,endsOn:r.endsOn}))}));
  const roleRows=roles.map(r=>{const eligible=!!person(r.memberId);const valid=validDate(r.startsOn)&&validDate(r.endsOn)&&r.startsOn<=r.endsOn;const status=!valid?'invalid':!eligible?'ineligible':r.endsOn<asOf?'expired':r.startsOn>asOf?'scheduled':'active';return {id:r.id,office:r.office,callName:person(r.memberId)?.callName??'社員資格待確認',startsOn:r.startsOn,endsOn:r.endsOn,status,daysLeft:valid?Math.ceil((Date.parse(r.endsOn)-Date.parse(asOf))/86400000):null};});
  return {clubId:club.id,clubName:club.name,enabled:club.enabled,membershipYear:state.demoYear??2026,roleYear,nextStart,total:current.length,confirmed,pending,staleCount,completion:current.length?Math.round(confirmed/current.length*100):null,nextOffices,assignedOffices:nextOffices.filter(o=>o.assignments.length===1).length,roles:roleRows,expiringCount:roleRows.filter(r=>r.status==='active'&&r.daysLeft!==null&&r.daysLeft<=90).length};
 });
}
