import { businessInstant } from '../phase3/businessModel';
export type FavoriteKind='business'|'club'|'event';
export interface Favorite {id:string;memberId:string;kind:FavoriteKind;targetId:string;createdAt:string}
export interface FavoriteContext {memberIds:string[];businesses:{id:string;name:string}[];clubs:{id:string;name:string}[];events:{id:string;title:string;status:string}[];asOf:string}
export type FavoriteAction={type:'add';kind:FavoriteKind;targetId:string}|{type:'remove';id:string};
export type FavoriteResult={ok:true;favorites:Favorite[]}|{ok:false;error:string};
function target(kind:FavoriteKind,id:string,ctx:FavoriteContext):{title:string;href:string;status:'available'|'cancelled'}|undefined {
 if(kind==='event'){const item=ctx.events.find(e=>e.id===id);return item?{title:item.title,href:`#/event?id=${encodeURIComponent(id)}`,status:item.status==='cancelled'?'cancelled':'available'}:undefined;}
 const item=(kind==='business'?ctx.businesses:kind==='club'?ctx.clubs:[]).find(e=>e.id===id);return item?{title:item.name,href:`#/${kind}?id=${encodeURIComponent(id)}`,status:'available'}:undefined;
}
export function applyFavoriteAction(favorites:Favorite[],memberId:string,action:FavoriteAction,ctx:FavoriteContext,random:()=>string=()=>crypto.randomUUID()):FavoriteResult {
 if(!memberId||!ctx.memberIds.includes(memberId))return {ok:false,error:'請先選擇已註冊的會員示範身分。'};
 if(action.type==='remove'){if(!favorites.some(f=>f.id===action.id&&f.memberId===memberId))return {ok:false,error:'找不到本人的收藏紀錄。'};return {ok:true,favorites:favorites.filter(f=>!(f.id===action.id&&f.memberId===memberId))};}
 if(!['business','club','event'].includes(action.kind)||!target(action.kind,action.targetId,ctx))return {ok:false,error:'此內容目前未公開，無法新增收藏。'};
 if(!Number.isFinite(businessInstant(ctx.asOf)))return {ok:false,error:'情境時間無效，請重新整理。'};
 if(favorites.some(f=>f.memberId===memberId&&f.kind===action.kind&&f.targetId===action.targetId))return {ok:true,favorites};
 const id=random();if(!id||favorites.some(f=>f.id===id))return {ok:false,error:'無法建立收藏，請重試。'};
 return {ok:true,favorites:[...favorites,{id,memberId,kind:action.kind,targetId:action.targetId,createdAt:new Date(businessInstant(ctx.asOf)).toISOString()}]};
}
export function projectFavorites(favorites:Favorite[],memberId:string,ctx:FavoriteContext){
 if(!memberId||!ctx.memberIds.includes(memberId))return [];
 return favorites.filter(f=>f.memberId===memberId).map(f=>{const item=target(f.kind,f.targetId,ctx);return {id:f.id,kind:f.kind,createdAt:f.createdAt,title:item?.title??'此內容目前無法公開查看',status:item?.status??'unavailable' as const,...(item?{href:item.href}:{})};}).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
}
