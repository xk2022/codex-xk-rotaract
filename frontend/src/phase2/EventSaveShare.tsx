import { useState } from 'react';
import { useCommunityDemo } from './store';
import type { CommunityEvent } from './model';
import { eventCalendarFile, publicEventLink } from './eventExport';
import './event-save-share.css';
export function EventSaveShare({event}:{event:CommunityEvent}) {
 const {clubs}=useCommunityDemo();const [message,setMessage]=useState('');const [manual,setManual]=useState(false);const url=publicEventLink(event.id,window.location.href);const cancelled=event.status==='cancelled';
 async function copy(){try{await navigator.clipboard.writeText(url);setMessage('活動連結已複製。');setManual(false);}catch{setManual(true);setMessage('無法自動複製，請選取下方完整連結手動複製。');}}
 async function share(){if(!navigator.share){setManual(true);setMessage('此瀏覽器不支援系統分享，可複製連結。');return;}try{await navigator.share({title:`${cancelled?'【已取消】':''}${event.title}`,text:cancelled?'活動已取消，請查看最新公告。':'查看活動時間、地點與最新公告。',url});setMessage('已完成系統分享操作。');}catch(error){if(error instanceof Error&&error.name==='AbortError'){setMessage('已取消分享。');return;}setManual(true);setMessage('系統分享未完成，可改用複製連結。');}}
 function download(){const content=eventCalendarFile(event,clubs,window.location.href);if(!content){setMessage('目前無法匯出此活動，請重新查看最新公告。');return;}const blob=new Blob([content],{type:'text/calendar;charset=utf-8'});const href=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=href;anchor.download=`rotaract-event-${event.id.replace(/[^A-Za-z0-9_-]/g,'_')}.ics`;anchor.click();setTimeout(()=>URL.revokeObjectURL(href),1000);setMessage(cancelled?'已下載含取消狀態的行事曆檔，請確認個人行事曆中的原紀錄。':'已下載行事曆檔，請開啟檔案並在個人行事曆確認匯入。');}
 return <section className="event-save-share" aria-label="保存與分享活動"><h2>保存與分享</h2><p>{cancelled?'活動已取消。可分享最新公告，或下載含取消狀態的檔案，供你更新原行事曆紀錄。':'把活動存入個人行事曆，或分享給一起參與的夥伴。'}</p><div className="ess-actions"><button onClick={download}>{cancelled?'下載取消狀態（ICS）':'加入個人行事曆（ICS）'}</button><button onClick={()=>void copy()}>複製活動連結</button><button onClick={()=>void share()}>手機／系統分享</button></div><p className="ess-note">單次下載，不會自動同步更正或取消，也不代表報名成功。匯入及更新方式依行事曆軟體而異，參與前請回來確認最新公告。</p><p role="status" aria-live="polite">{message}</p>{manual&&<label>手動複製活動連結<input aria-label="手動複製活動連結" readOnly value={url} onFocus={e=>e.target.select()}/></label>}</section>;
}
