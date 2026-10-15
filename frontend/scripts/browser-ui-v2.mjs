import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const dir=fileURLToPath(new URL('../../docs/previews/',import.meta.url));
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 page.setDefaultTimeout(10000);await page.emulateMedia({reducedMotion:'reduce'});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const actor=async v=>page.getByLabel('體驗身分').selectOption(v);
 const nav=async name=>{if(await page.getByRole('button',{name:'開啟選單',exact:true}).isVisible())await page.getByRole('button',{name:'開啟選單',exact:true}).click();await page.getByRole('navigation',{name:'主要選單'}).getByRole('button',{name,exact:true}).click()};
 const form=title=>page.locator('form').filter({has:page.getByRole('heading',{name:title,exact:true})});
 const reset=async()=>{if(await page.getByRole('button',{name:'開啟選單',exact:true}).isVisible())await page.getByRole('button',{name:'開啟選單',exact:true}).click();await page.getByRole('button',{name:'重設示範資料'}).click()};
 const noOverflow=async()=>assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.goto(`${process.env.BASE_URL||'http://127.0.0.1:5173/'}#/demo`);
 // Auth/reset: resend invalidates older tickets, reset survives changing mode, login works.
 await page.getByRole('button',{name:'登出',exact:true}).click();
 await page.getByRole('button',{name:'忘記密碼',exact:true}).click();
 await page.getByLabel('已登錄 Email').fill('cora@example.test');
 await page.getByRole('button',{name:'產生／重送模擬信件'}).click();
 await page.getByRole('button',{name:'產生／重送模擬信件'}).click();
 await page.getByRole('button',{name:'測試上一封失效連結'}).click();
 assert(await page.getByText(/連結已失效|失效/).count()>0);
 await page.getByRole('button',{name:'開啟這次重設連結'}).click();
 await page.getByLabel('新示範密碼（12～128 字元）').fill('NewDemoPass2026!');
 await page.getByLabel('再次輸入新示範密碼').fill('NewDemoPass2026!');
 await page.getByRole('button',{name:'完成模擬重設'}).click();
 await page.getByLabel('Email、國碼電話或帳號代號').fill('cora@example.test');
 await page.getByLabel('示範密碼',{exact:true}).fill('DemoPass2026!');
 await page.getByRole('button',{name:'登入示範帳號'}).click();
 await nav('帳號設定');
 await page.screenshot({path:`${dir}/phase1-v2-account-desktop.png`,fullPage:true});
 // Single contact and one-time code changes persist across pages.
 const contact=form('變更登入聯絡資料');
 await contact.getByLabel('新的電話（含國碼）').fill('+886912009999');
 await contact.getByLabel('輸入目前示範密碼，確認本人').fill('wrong');
 await contact.getByRole('button',{name:'驗證並更新單項資料'}).click();
 assert(await page.getByText('示範密碼不正確。',{exact:true}).isVisible());
 await contact.getByLabel('輸入目前示範密碼，確認本人').fill('DemoPass2026!');
 await contact.getByRole('button',{name:'驗證並更新單項資料'}).click();
 assert(await contact.getByText(/目前電話：\+886912009999/).isVisible());
 const code=form('帳號代號');await code.getByLabel('新代號',{exact:true}).fill('cora_new26');
 await code.getByLabel('輸入目前示範密碼，確認本人').fill('DemoPass2026!');
 await code.getByRole('button',{name:'確認使用唯一一次修改'}).click();
 await nav('個人資料');await nav('帳號設定');
 assert(await form('帳號代號').getByRole('button',{name:'確認使用唯一一次修改'}).isDisabled());
 // Club editing and role limitations, normal management can edit only presentation/contact.
 await actor('taipei');await nav('社團資料');
 await page.getByLabel('本社示範職務').selectOption('manager');
 assert(await page.getByLabel('社團名稱',{exact:true}).isDisabled());
 await page.getByLabel('社團簡介',{exact:true}).fill('合成社團介紹：服務連結社區。');
 await page.getByRole('button',{name:'儲存社團資料'}).click();
 await page.getByLabel('本社示範職務').selectOption('president');
 await page.getByRole('checkbox',{name:'公開聯絡 Email'}).check();
 await page.getByRole('button',{name:'儲存社團資料'}).click();
 await nav('角色與交接');await page.getByLabel('社員').selectOption('m2');
 await page.getByRole('button',{name:'確認授權',exact:true}).click();
 assert(await page.getByText('Ethan · 一般管理者',{exact:true}).isVisible());
 await page.getByLabel('本社示範職務').selectOption('manager');
 assert(await page.getByRole('button',{name:'確認授權',exact:true}).isDisabled());
 // Year state persists over navigation; multiple selected changes all apply.
 await nav('年度名冊');await page.getByLabel('年度邊界情境',{exact:true}).selectOption('august');
 await page.getByRole('button',{name:'套用至本社假資料'}).click();
 await nav('會員名冊');await nav('年度名冊');
 assert(await page.getByRole('heading',{name:'2027 — 2028 年度名冊'}).isVisible());
 await page.getByRole('button',{name:'選取待確認社員'}).click();
 await page.getByRole('button',{name:/確認選取/}).click();
 assert.equal(await page.locator('.record-row .badge.unconfirmed').count(),0);
 // End membership: member files, club approves, only then OB; history retained.
 await reset();await actor('member');await nav('退社與 OB');
 await page.getByLabel('辦理原因').fill('合成畢業申請');
 await page.getByRole('checkbox',{name:/我已確認資料及影響/}).check();
 await page.getByRole('button',{name:'送出社籍結束申請'}).click();
 await actor('taipei');await nav('退社與 OB');
 await page.getByRole('button',{name:'核准辦理',exact:true}).click();
 assert(await page.getByText('已辦理',{exact:true}).isVisible());
 await actor('member');await nav('歷史與同意');
 assert(await page.getByText(/Cora · 台北星光扶青社/).isVisible());
 // History consent is a dialog; closing does not approve. Re-open to explicitly agree.
 await actor('taipei');await nav('歷史與同意');
 await page.getByRole('checkbox',{name:/示範已額外授予歷史協助權/}).check();
 await page.getByRole('button',{name:'請求本人同意公開',exact:true}).click();
 await actor('member');await nav('歷史與同意');
 await page.getByRole('button',{name:'同意公開此版本'}).click();
 await page.getByRole('dialog').getByRole('button',{name:'稍後再說'}).click();
 assert(await page.getByText('待本人同意',{exact:false}).isVisible());
 await page.getByRole('button',{name:'同意公開此版本'}).click();
 await page.getByRole('dialog').getByRole('button',{name:'我同意公開這個版本'}).click();
 assert(await page.getByText(/已同意公開指定版本/).isVisible());
 // Support cases: member submits, platform requests supplement, member resubmits, platform approves.
 await nav('帳號協助');await page.getByLabel('說明（僅填合成資訊）').fill('合成帳號復原，原信箱失效。');
 await page.getByRole('button',{name:'提交人工核身申請'}).click();
 await actor('platform');await page.getByLabel('核身結果／原因').fill('請補充原社團佐證（合成資料）。');
 await page.getByRole('button',{name:'確認處理結果'}).click();
 await actor('member');await nav('帳號協助');await page.getByLabel('補充說明').fill('合成：已取得社團具名佐證。');
 await page.getByRole('button',{name:'送出補件',exact:true}).click();
 await actor('platform');await page.getByLabel('處理結果').selectOption('approved');
 await page.getByLabel('核身結果／原因').fill('已核對獨立證據，合成核身通過。');
 await page.getByRole('button',{name:'確認處理結果'}).click();
 assert(await page.getByText(/核身核准/).count()>0);
 // New clubs flow into join options and each dynamic management persona can review.
 await reset();await actor('district');
 const add=form('新增轄內社團');await add.getByLabel('名稱',{exact:true}).fill('測試新社');await add.getByRole('button',{name:'建立社團'}).click();
 await actor('visitor');await page.getByRole('button',{name:'建立會員帳號',exact:true}).click();
 const dlg=page.getByRole('dialog');await dlg.getByLabel('姓名',{exact:true}).fill('合成新社友');await dlg.getByLabel('Call name',{exact:true}).fill('Aster');await dlg.getByLabel('Email',{exact:true}).fill('aster@example.test');await dlg.getByLabel('示範密碼',{exact:true}).fill('DemoPass2026!');await dlg.getByRole('button',{name:'建立示範會員'}).click();
 await page.getByRole('button',{name:'申請加入社團',exact:true}).first().click();
 const newClub=await page.getByLabel('選擇社團').locator('option').filter({hasText:'測試新社'}).getAttribute('value'); await page.getByLabel('選擇社團').selectOption(newClub);
 await page.getByLabel('入社說明').fill('合成新社入社');await page.getByRole('button',{name:'送出入社申請'}).click();
 const newActor=await page.getByLabel('體驗身分').locator('option').filter({hasText:'測試新社'}).getAttribute('value');
 await actor(newActor);await nav('入社申請');await page.getByRole('button',{name:'核准入社'}).click();
 await nav('會員名冊');assert(await page.getByRole('button',{name:'查看 Aster'}).isVisible());
 // Pagination and named failure states.
 await page.getByRole('button',{name:'載入分頁示範資料'}).click();
 await page.getByRole('button',{name:'下一頁',exact:true}).click();assert(await page.getByText(/第 2 \/ 2 頁/).isVisible());
 await page.getByLabel('畫面情境').selectOption('conflict');assert(await page.getByRole('heading',{name:'資料已被其他管理者更新'}).isVisible());await page.getByRole('button',{name:'重新取得資料'}).click();
 // All first-phase pages remain operable without horizontal overflow at 360px.
 await reset();await page.setViewportSize({width:360,height:800});
 for(const name of ['年度名冊','社團資料','角色與交接','退社與 OB','歷史與同意','異動紀錄']){await nav(name);await noOverflow()}
 await actor('member');await nav('帳號設定');await noOverflow();await page.screenshot({path:`${dir}/phase1-v2-account-mobile.png`,fullPage:true});
 await actor('district');await nav('地區管理');await noOverflow();
 await actor('platform');await noOverflow();
 assert.deepEqual(errors,[]);
 console.log('PASS: v2 auth/reset, account/contact/code, organization/roles, persisted annual state, OB/history consent dialog, support handoff, new-club admission, pagination, errors and 360px layouts.');
}finally{await browser.close()}
