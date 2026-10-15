import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const base = process.env.BASE_URL || 'http://127.0.0.1:5173/';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.setDefaultTimeout(10000);
const visit = async (suffix = '') => { await page.goto(`${base}#/calendar${suffix}`); await page.getByRole('heading', { level: 1 }).waitFor(); };
try {
  await visit();
  await page.getByRole('button', { name: '查看 2026 年 10 月示範', exact: true }).click();
  await page.getByRole('button', { name: '活動列表', exact: true }).click();
  assert.doesNotMatch(await page.locator('body').innerText(), /會員交流沙龍|社內工作會議|服務計畫草稿|停用社未來活動/);
  await page.getByLabel('搜尋公開活動', { exact: true }).fill('完全不存在');
  assert.equal(await page.locator('.ph-event-card').count(), 0);
  await page.getByRole('button', { name: '重設篩選', exact: true }).click();
  assert.ok(await page.locator('.ph-event-card').count() > 0);
  await page.locator('.ph-event-card').filter({ hasText: '海港交流日' }).click();
  await page.getByRole('heading', { level: 1, name: '海港交流日' }).waitFor();
  assert.match(await page.locator('body').innerText(), /天候因素/);
  await page.reload();
  await page.getByRole('heading', { level: 1, name: '海港交流日' }).waitFor();
  await visit();
  for (const width of [360, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `overflow at ${width}`);
  }
  await visit();
  await page.getByRole('button', { name: '查看 2026 年 10 月示範', exact: true }).click();
  await page.getByRole('button', { name: '活動列表', exact: true }).click();
  await page.getByLabel('扶輪地區', { exact: true }).selectOption('d3481');
  assert.match(await page.locator('.ph-event-list').innerText(), /地區青年服務論壇/);
  await page.getByRole('button', { name: /台北星光扶青社/ }).click();
  assert.doesNotMatch(await page.locator('.ph-event-list').innerText(), /地區青年服務論壇/);
  await page.getByLabel('扶輪地區', { exact: true }).selectOption('d3462');
  assert.match(await page.locator('.ph-event-list').innerText(), /社區服務週末/);
  assert.equal(await page.getByRole('button', { name: /全部社團/ }).getAttribute('aria-pressed'), 'true');
  await page.getByRole('button', { name: '重設篩選', exact: true }).click();
  await page.getByRole('button', { name: '2027 年 6 月', exact: true }).click();
  await page.getByRole('button', { name: '下一個月', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: '2027 年 7 月', exact: true }).getAttribute('aria-pressed'), 'true');
  await page.getByRole('button', { name: '上一個月', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: '2027 年 6 月', exact: true }).getAttribute('aria-pressed'), 'true');
  await page.getByRole('button', { name: '查看 2026 年 10 月示範', exact: true }).click();
  await page.getByRole('button', { name: '月曆', exact: true }).click();
  await page.getByRole('button', { name: /2026年10月17日/ }).focus();
  await page.keyboard.press('ArrowRight');
  assert.match(await page.locator(':focus').getAttribute('aria-label'), /2026年10月18日/);
  assert.match(await page.locator('.ph-event-list').innerText(), /海港交流日/);
  for (const [day, expected] of [[10, true], [11, true], [12, false]]) {
    await page.getByRole('button', { name: new RegExp(`2026年10月${day}日`) }).click();
    assert.equal(await page.locator('.ph-event-card').filter({ hasText: '社區服務週末' }).count() > 0, expected);
  }
  await visit('?calendarState=error');
  await page.getByRole('alert').waitFor();
  await page.getByRole('button', { name: '重新載入', exact: true }).click();
  await page.getByRole('button', { name: '今天', exact: true }).waitFor();
  assert.equal(await page.getByRole('alert').count(), 0);
  await visit('?calendarState=loading');
  await page.getByRole('button', { name: '今天', exact: true }).waitFor();
  assert.deepEqual(errors, []);
  console.log('PASS calendar: public scope, linked filters, Rotary year, date keyboard, all-day boundary, error retry/loading, details, four widths');
} finally { await browser.close(); }
