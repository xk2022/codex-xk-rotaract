import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || undefined,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:320,height:640}});
const base=process.env.BASE_URL || 'http://127.0.0.1:5173/';
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(12000);
const visit=async route=>{await page.goto(`${base}#/${route}`);await page.getByRole('heading',{level:1}).waitFor();};
const fits=async label=>assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`overflow: ${label}`);
try {
  await visit('');
  await page.getByRole('button',{name:'開啟導覽選單',exact:true}).click();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('button',{name:'開啟導覽選單',exact:true}).getAttribute('aria-expanded'),'false');
  assert.equal(await page.locator(':focus').getAttribute('aria-label'),'開啟導覽選單');
  await page.setViewportSize({width:568,height:320});
  await page.getByRole('button',{name:'開啟導覽選單',exact:true}).click();
  const nav=page.getByRole('navigation',{name:'公開網站導覽'});
  assert.ok(await nav.evaluate(el=>el.scrollHeight>el.clientHeight),'short-screen navigation must scroll');
  await nav.getByRole('button',{name:'加入生活圈',exact:false}).scrollIntoViewIfNeeded();
  await page.keyboard.press('Escape');
  await visit('map');
  const trigger=page.getByRole('button',{name:'查看日常之間咖啡',exact:true});
  await trigger.click();
  const dialog=page.getByRole('dialog');await dialog.waitFor();
  assert.equal(await dialog.evaluate(el=>el.matches(':modal')),true);
  await page.evaluate(()=>document.querySelector('.ph-brand')?.focus());
  assert.equal(await page.evaluate(()=>document.querySelector('dialog')?.contains(document.activeElement)),true);
  for(const key of ['Tab','Shift+Tab']) {
    await page.keyboard.press(key);
    assert.equal(await page.evaluate(()=>document.activeElement === document.body || document.querySelector('dialog')?.contains(document.activeElement)),true);
  }
  await page.keyboard.press('Escape');
  await dialog.waitFor({state:'hidden'});
  assert.equal(await page.locator(':focus').getAttribute('aria-label'),'查看日常之間咖啡');
  assert.equal(await page.evaluate(()=>document.body.style.overflow),'');
  for(const width of [320,640]) {
    await page.setViewportSize({width,height:900});
    for(const route of ['', 'map', 'calendar','clubs','club?id=taipei','event?id=city-walk']) {
      await visit(route);await fits(`${route} ${width}`);
      // Double every computed font size, rather than only changing the root rem size.
      await page.evaluate(()=>{
        const sizes=[...document.querySelectorAll('body *')].filter(el=>el instanceof HTMLElement && !['SCRIPT','STYLE'].includes(el.tagName)).map(el=>[el,parseFloat(getComputedStyle(el).fontSize)]);
        for(const [el,size] of sizes) el.style.fontSize=`${size*2}px`;
      });
      await fits(`${route} ${width} with actual doubled fonts`);
    }
  }
  await visit('calendar?calendarState=error');
  await page.getByRole('button',{name:'重新載入',exact:true}).click();
  await page.getByRole('button',{name:'今天',exact:true}).waitFor();
  assert.equal(await page.locator(':focus').evaluate(el=>el.matches('.lc-month-heading h2')),true);
  await visit('calendar?calendarState=loading');
  await page.getByRole('button',{name:'今天',exact:true}).waitFor();
  assert.equal(await page.locator(':focus').getAttribute('id'),'public-main');
  await page.setViewportSize({width:320,height:800});
  for(const name of ['上一個月','下一個月','上一個扶輪年度','下一個扶輪年度','月曆','活動列表']) {
    const box=await page.getByRole('button',{name,exact:true}).boundingBox();
    assert.ok(box && box.height>=44 && box.width>=44, `small control: ${name}`);
  }
  assert.deepEqual(errors,[]);
  console.log('PASS public accessibility: mobile menu Escape/short-screen scroll, native modal containment/focus return, six routes at 320/640px with doubled computed fonts; not a full WCAG audit');
} finally {await browser.close();}
