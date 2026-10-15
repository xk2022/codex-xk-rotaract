import {describe,it,expect} from 'vitest';
import {authHref,publicReturnTarget,readAuthContinuation} from './authContinuation';
describe('登入後接續白名單',()=>{
 it('社團加入意圖往返編碼並保留對應社團',()=>{const link=authHref('register','#/club?id=taichung','join');expect(readAuthContinuation(link)).toEqual({target:'#/club?id=taichung',joinClubId:'taichung'});});
 it('一般公開頁返回不自動開入社',()=>{for(const target of ['#/','#/map','#/calendar','#/clubs','#/business?id=coffee','#/event?id=city-walk','#/club?id=taipei']) expect(readAuthContinuation(authHref('login',target))).toEqual({target});});
 it('拒絕外站、腳本、後台、雙重編碼與重複參數',()=>{for(const value of ['https://evil.test','//evil.test','javascript:alert(1)','#/demo?view=roles','#/workspace','#/club?id=../../x','#/club?id=x&admin=1','%23%2Fmap','#/club?id=']){expect(publicReturnTarget(value)).toBeUndefined();expect(readAuthContinuation(`#/login?returnTo=${encodeURIComponent(value)}`)).toBeUndefined();}expect(readAuthContinuation('#/login?returnTo=%23%2Fmap&returnTo=%23%2F')).toBeUndefined();});
 it('無社團目標不產生入社意圖，無目的地回一般登入',()=>{expect(readAuthContinuation(authHref('login','#/business?id=coffee','join'))).toEqual({target:'#/business?id=coffee'});expect(authHref('register','#/unknown')).toBe('#/register');});
});
