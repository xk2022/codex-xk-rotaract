import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { mkdir } from 'node:fs/promises';
const screenshotDir = fileURLToPath(new URL('../../docs/previews/', import.meta.url));
await mkdir(screenshotDir, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, headless: true, args: ['--no-sandbox'] });
try {
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1 });
await page.emulateMedia({ reducedMotion: 'reduce' });
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(`${process.env.BASE_URL || 'http://127.0.0.1:5173/'}#/demo`);
await page.getByRole('heading',{name:'管理總覽.'}).waitFor();
await page.screenshot({path:`${screenshotDir}/phase1-desktop.png`,fullPage:true});
const actor=async role=>{await page.getByLabel('體驗身分').selectOption(role);};
const nav=async name=>{await page.getByRole('navigation',{name:'主要選單'}).getByRole('button',{name,exact:true}).click();};
// Approval requires the selected club and produces a discoverable member only after approval.
await nav('入社申請');
await page.getByRole('button',{name:'核准入社',exact:true}).click();
await nav('會員名冊');
await page.getByRole('button',{name:'查看 Nina',exact:true}).click();
await page.getByRole('tabpanel').getByText('會員已隱藏').waitFor();
assert(await page.getByRole('tabpanel').getByText('nina@example.test').isVisible());
// Hidden email is respected even by managers.
await actor('member');await nav('個人資料');
await page.getByLabel('顯示我的 Email').uncheck();
await actor('taipei');await nav('會員名冊');
await page.getByRole('button',{name:'查看 Cora',exact:true}).click();
assert.equal(await page.getByRole('tabpanel').getByText('會員已隱藏').count(),2);
// Both approvals leave the current membership untouched until member executes.
await actor('member');await nav('轉社作業');
await page.getByRole('button',{name:'申請轉社',exact:true}).click();
await page.getByRole('button',{name:'送出轉社申請',exact:true}).click();
await actor('taipei');await page.getByRole('button',{name:'代表本社核准'}).click();
await actor('taichung');await page.getByRole('button',{name:'代表本社核准'}).click();
await actor('member');
assert(await page.getByText('待本人最終確認',{exact:true}).isVisible());
await nav('個人資料');
assert(await page.locator('.journey').getByText('台北星光扶青社',{exact:true}).isVisible());
await nav('轉社作業');await page.getByRole('button',{name:'本人確認，執行轉社'}).click();
assert(await page.getByText('轉社完成',{exact:true}).isVisible());
await nav('個人資料');
assert(await page.locator('.journey>p').getByText('台中山海扶青社',{exact:true}).isVisible());
assert(!(await page.getByRole('checkbox',{name:'公開 台北星光扶青社 歷史'}).isChecked()));
// Original club can inspect only its historical snapshot, not current contacts.
await actor('taipei');await nav('轉社作業');
await page.getByRole('button',{name:'查看本社歷史'}).click();
assert(await page.getByRole('dialog').getByText('Cora · 林予安',{exact:true}).isVisible());
assert.equal(await page.getByRole('dialog').getByText('cora@example.test',{exact:true}).count(),0);
await page.getByRole('button',{name:'關閉視窗'}).click();
// Visitor registration, application, approval round trip.
await actor('visitor');await page.getByRole('button',{name:'註冊體驗',exact:true}).click();
await page.getByRole('dialog').getByLabel('姓名',{exact:true}).fill('合成新會員');await page.getByRole('dialog').getByLabel('Call name',{exact:true}).fill('Nova');
await page.getByRole('dialog').getByLabel('Email',{exact:true}).fill('nova@example.test');await page.getByRole('dialog').getByLabel('示範密碼',{exact:true}).fill('only demo password');
await page.getByRole('button',{name:'建立示範會員'}).click();
await page.getByRole('button',{name:'申請加入社團',exact:true}).first().click();
await page.getByLabel('入社說明').fill('合成資料：期待一起服務。');
await page.getByRole('button',{name:'送出入社申請'}).click();
await actor('taipei');await page.getByRole('button',{name:'核准入社',exact:true}).click();
await nav('會員名冊');await page.getByRole('button',{name:'查看 Nova'}).click();
await page.getByRole('tabpanel').getByText('nova@example.test').waitFor();
// Confirming year makes hidden unconfirmed record regular.
await nav('會員名冊');await page.getByLabel('包含非正常／待確認社籍').check();await page.getByRole('button',{name:'查看 Mia'}).click();
await page.getByRole('button',{name:'確認本年度社員'}).click();
assert(await page.locator('.profile-header').getByText('正常社籍',{exact:true}).isVisible());
// Narrow viewport: drawer works, no horizontal page overflow, native modal traps focus.
await page.getByRole('button',{name:'重設示範資料'}).click();
await page.setViewportSize({width:390,height:844});
await page.screenshot({path:`${screenshotDir}/phase1-mobile.png`,fullPage:true});
assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
await page.getByRole('button',{name:'開啟選單'}).click();await nav('會員名冊');
assert(await page.locator('.mobile-members').isVisible());
assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
await page.getByRole('button',{name:'開啟選單'}).click();await nav('轉社作業');
await actor('member');await page.getByRole('button',{name:'申請轉社',exact:true}).click();
assert(await page.getByRole('dialog').isVisible());await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').count(),0);
await page.setViewportSize({width:360,height:800});
assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
assert.deepEqual(errors,[]);
} finally { await browser.close(); }
console.log('PASS: browser registration→join→approval, privacy, three-stage transfer, history, annual confirmation, 390/360px layouts, mobile drawer, Escape modal; no browser errors.');
