import { eventBounds, publicProjection, type CommunityClub, type CommunityEvent } from './model';
function text(value: string): string { return value.replace(/\r\n|\r/g,'\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,'').replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,'); }
export function foldCalendarLine(value: string): string {
 const encoder=new TextEncoder(); let line='';let size=0;const lines:string[]=[];
 for(const character of value){const length=encoder.encode(character).length;if(size+length>75){lines.push(line);line=' ';size=1;}line+=character;size+=length;}lines.push(line);return lines.join('\r\n');
}
export function publicEventLink(eventId:string, siteUrl:string):string {
 const url=new URL(siteUrl);if(!['http:','https:'].includes(url.protocol)||url.username||url.password) throw new Error('網站網址無效。');url.search='';url.hash=`/event?id=${encodeURIComponent(eventId)}`;return url.href;
}
const instant=(date:Date)=>date.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
export function eventCalendarFile(event:CommunityEvent,clubs:CommunityClub[],siteUrl:string,now=new Date()):string|undefined {
 try {
  if(!publicProjection([event],clubs,now).length||!Number.isFinite(now.getTime())||!Number.isSafeInteger(event.version)||event.version<0) return;
  const {start,end}=eventBounds(event);if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||start>=end)return;
  const url=publicEventLink(event.id,siteUrl); const site=new URL(url);
  const timing=event.time.kind==='allDay'?[`DTSTART;VALUE=DATE:${event.time.startDate.replace(/-/g,'')}`,`DTEND;VALUE=DATE:${event.time.endDateExclusive.replace(/-/g,'')}`]:[`DTSTART:${instant(start)}`,`DTEND:${instant(end)}`];
  const description=[event.description,event.status==='cancelled'?`活動已取消：${event.cancellationReason||'請洽主辦單位。'}`:'',`活動詳情：${url}`].filter(Boolean).join('\n\n');
  return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//XK Rotaract//Public Events//ZH-TW','CALSCALE:GREGORIAN','METHOD:PUBLISH','BEGIN:VEVENT',`UID:event-${encodeURIComponent(event.id)}-${encodeURIComponent(site.pathname)}@${site.host}`,`DTSTAMP:${instant(now)}`,`SEQUENCE:${event.version}`,`STATUS:${event.status==='cancelled'?'CANCELLED':'CONFIRMED'}`,...timing,`SUMMARY:${text(event.title)}`,`DESCRIPTION:${text(description)}`,`LOCATION:${text(event.location)}`,`URL:${url}`,'END:VEVENT','END:VCALENDAR'].map(foldCalendarLine).join('\r\n')+'\r\n';
 } catch { return undefined; }
}
