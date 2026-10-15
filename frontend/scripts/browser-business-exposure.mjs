import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {fileURLToPath} from 'node:url';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const base=process.env.BASE_URL||'http://127.0.0.1:5173/';
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(12000);
const hash=async h=>{await page.evaluate(h=>{location.hash=h;},h);await page.waitForTimeout(120);};
try {
 await page.goto(`${base}#/demo?view=businesses`);
 const workspace=page.getByRole('region',{name:'會員商家維護'});await workspace.waitFor();
 await workspace.getByLabel('商家示範身分').selectOption('2');
 await workspace.getByRole('button',{name:'新增公司',exact:true}).click();
 const title=`三日曝光測試${Date.now()}`;
 await workspace.getByLabel('公司名稱（必填，上限 200 字）',{exact:true}).fill(title);
 await workspace.getByLabel('城市／地區',{exact:true}).fill('高雄');
 await workspace.getByRole('checkbox',{name:'餐飲咖啡',exact:true}).check();
 await workspace.getByLabel('公司電話',{exact:true}).fill('07-0000-9999');
 await workspace.locator('.bw-contact').filter({has:page.getByLabel('公司電話',{exact:true})}).getByRole('checkbox',{name:'公開',exact:true}).check();
 await workspace.getByLabel('緯度（−90～90）',{exact:true}).fill('22.63');
 await workspace.getByLabel('經度（−180～180）',{exact:true}).fill('120.3');
 await workspace.getByRole('checkbox',{name:'我同意公開此營業位置',exact:false}).check();
 await workspace.getByRole('button',{name:'儲存草稿',exact:true}).click();
 await workspace.getByRole('button',{name:'發布公司',exact:true}).click();
 await page.getByRole('dialog',{name:'確認商家狀態變更'}).getByRole('button',{name:'確認',exact:true}).click();
 await hash('/map');await page.getByLabel('搜尋商家',{exact:true}).fill(title);
 assert.equal(await page.locator('.bp-pin').count(),1);
 await page.locator('.ph-business-card').click();await page.getByRole('heading',{level:1,name:title}).waitFor();
 const detailHash=new URL(page.url()).hash;
 assert.match(await page.locator('body').innerText(),/三日暫時曝光/);
 const panel=page.locator('.bp-confirmation');
 assert.equal(await panel.getByRole('button',{name:'我曾到訪／使用服務，確認商家存在',exact:true}).count(),0);
 for(let i=1;i<=6;i++) {
   await page.getByLabel('確認身分示範',{exact:true}).selectOption(`peer-${i}`);
   await panel.getByRole('button',{name:'我曾到訪／使用服務，確認商家存在',exact:true}).click();
   assert.match(await panel.innerText(),new RegExp(`目前累計 ${i} 位`));
 }
 assert.ok(await page.locator('.bp-confirmed').count()>0);
 if(process.env.WRITE_PREVIEWS==='1') { await page.setViewportSize({width:360,height:900}); await page.locator('body').click({position:{x:1,y:1}}); await page.screenshot({path:fileURLToPath(new URL('../../docs/previews/business-trial-confirmed-mobile.png',import.meta.url)),fullPage:true}); await page.setViewportSize({width:1440,height:1000}); }
 await panel.getByRole('button',{name:'我曾到訪／使用服務，確認商家存在',exact:true}).click();
 assert.match(await panel.innerText(),/每個帳號僅能確認一次/);
 await panel.getByRole('button',{name:'撤回我的確認',exact:true}).click();
 assert.match(await panel.innerText(),/目前累計 5 位/);
 assert.equal(await page.locator('.bp-confirmed').count(),0);
 await panel.getByRole('button',{name:'我曾到訪／使用服務，確認商家存在',exact:true}).click();
 await hash('/demo?view=businesses');
 await workspace.getByLabel('商家示範身分').selectOption('2');
 await workspace.getByLabel('曝光資格情境時間（台北）').fill('2026-10-18T11:59:59');
 await hash(detailHash);await page.getByRole('heading',{level:1,name:title}).waitFor();
 await hash('/demo?view=businesses');await workspace.getByLabel('曝光資格情境時間（台北）').fill('2026-10-18T12:00');
 await hash(detailHash);await page.getByRole('heading',{name:'找不到公開商家',exact:true}).waitFor();
 await hash('/business?id=account-paid');await page.getByRole('heading',{level:1,name:'獨立廣告示範商家'}).waitFor();
 assert.match(await page.locator('body').innerText(),/廣告/);
 assert.deepEqual(errors,[]);
 console.log('PASS exposure: self-publish pending member, six independent confirmations, duplicate rejected, withdraw removes badge, exact 72h expiry hides even confirmed company, independent nonmember paid exposure');
}finally{await browser.close();}
