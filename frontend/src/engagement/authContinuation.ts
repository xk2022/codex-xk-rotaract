export interface AuthContinuation { target: string; joinClubId?: string }
/** Only public, same-document destinations; no arbitrary workspace or external redirect. */
export function publicReturnTarget(value: string): string | undefined {
 if(value.length>300) return;
 if(['#/','#/map','#/calendar','#/clubs'].includes(value)) return value;
 const match=/^#\/(club|event|business)\?id=([A-Za-z0-9_-]{1,80})$/.exec(value);
 return match ? value : undefined;
}
export function readAuthContinuation(hash = window.location.hash): AuthContinuation | undefined {
 const params=new URLSearchParams(hash.split('?')[1]??'');
 if(params.getAll('returnTo').length!==1||params.getAll('intent').length>1) return;
 const target=publicReturnTarget(params.get('returnTo')??''); if(!target) return;
 const club=/^#\/club\?id=([A-Za-z0-9_-]{1,80})$/.exec(target);
 return {target,...(params.get('intent')==='join'&&club?{joinClubId:club[1]}:{})};
}
export function authHref(mode:'login'|'register',source=window.location.hash,intent?:'join'):string {
 const target=publicReturnTarget(source); if(!target) return `#/${mode}`;
 const params=new URLSearchParams({returnTo:target}); if(intent==='join'&&target.startsWith('#/club?')) params.set('intent','join');
 return `#/${mode}?${params}`;
}
