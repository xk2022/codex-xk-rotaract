import { chromium } from "playwright";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
const base = process.env.BASE_URL || "http://127.0.0.1:5173/";
const dir = fileURLToPath(new URL("../../docs/previews/", import.meta.url));
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  headless: true,
  args: ["--no-sandbox"],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  const noPrivateData = async () => {
    await page
      .getByRole("navigation", { name: "主要選單" })
      .waitFor({ state: "hidden" });
    assert.equal(
      await page.getByRole("navigation", { name: "主要選單" }).count(),
      0,
    );
    assert.equal(await page.getByLabel("體驗身分").count(), 0);
    assert.equal(
      await page.getByText("cora@example.test", { exact: true }).count(),
      0,
    );
  };
  const noOverflow = async () =>
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
  const skip = async (id) => {
    const previous = new URL(page.url()).hash;
    await page.getByRole("link", { name: "跳至主要內容" }).focus();
    await page.keyboard.press("Enter");
    assert.equal(new URL(page.url()).hash, previous);
    assert.equal(await page.evaluate(() => document.activeElement?.id), id);
  };
  await page.goto(base);
  await page.getByRole("heading", { level: 1 }).waitFor();
  assert.match(
    await page.getByRole("heading", { level: 1 }).innerText(),
    /玩轉/,
  );
  await noPrivateData();
  await noOverflow();
  await skip("public-main");
  await page.evaluate(() => document.activeElement?.blur());
  await page.screenshot({
    path: `${dir}/public-index-desktop.png`,
    fullPage: true,
  });
  // Direct hash links survive refresh on a repository subpath.
  for (const route of ["map", "calendar"]) {
    await page.goto(`${base}#/${route}`);
    await page.getByRole("heading", { level: 1 }).waitFor();
    await noPrivateData();
    await noOverflow();
    await page.reload();
    assert.equal(new URL(page.url()).hash, `#/${route}`);
    await noPrivateData();
    await page.screenshot({
      path: `${dir}/public-${route}-desktop.png`,
      fullPage: true,
    });
  }
  // Entry links, public filters, detail keyboard behavior and browser back.
  await page.goto(base);
  await page
    .getByRole("navigation", { name: "公開網站導覽" })
    .getByRole("button", { name: "商家地圖", exact: true })
    .click();
  await page.waitForURL("**#/map");
  await page.getByLabel("搜尋商家").fill("Sunny");
  assert.equal(await page.locator(".ph-business-card").count(), 1);
  const shop = page.getByRole("button", {
    name: "查看日常之間咖啡",
    exact: true,
  });
  await shop.click();
  await page.getByRole("dialog").waitFor();
  await page.keyboard.press("Tab");
  assert.equal(await page.evaluate(() => document.activeElement === document.body || document.querySelector("dialog")?.contains(document.activeElement)), true);
  await page.keyboard.press("Escape");
  assert.equal(await page.getByRole("dialog").count(), 0);
  assert.equal(
    await page.evaluate(() =>
      document.activeElement?.getAttribute("aria-label"),
    ),
    "查看日常之間咖啡",
  );
  await shop.click();
  await page.goBack();
  await page.getByRole("heading", { level: 1 }).waitFor();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page.goto(`${base}#/calendar`);
  await page.getByRole("button", { name: "查看 2026 年 10 月示範", exact: true }).click();
  await page.getByRole("button", { name: "下一個月", exact: true }).click();
  assert(
    await page.getByText("這一天沒有符合條件的公開活動", { exact: true }).isVisible(),
  );
  await page.getByRole("button", { name: "查看 2026 年 10 月示範" }).click();
  await page.locator(".ph-event-card").first().click();
  await page.waitForURL(/#\/event\?id=/);
  await page.getByRole("heading", { level: 1 }).waitFor();
  await noPrivateData();
  await page.reload();
  await page.getByRole("heading", { level: 1 }).waitFor();
  await noPrivateData();
  await page.goto(`${base}#/login`);
  await page.getByRole("heading", { name: "歡迎回來" }).waitFor();
  await page.screenshot({
    path: `${dir}/public-login-desktop.png`,
    fullPage: true,
  });
  await skip("auth-main");
  await page.getByLabel("Email、國碼電話或帳號代號").fill("cora@example.test");
  await page.getByLabel("示範密碼", { exact: true }).fill("DemoPass2026!");
  await page.getByRole("button", { name: "登入示範帳號" }).click();
  await page.waitForURL(/#\/workspace(?:\?view=\w+)?$/);
  assert.equal(await page.getByLabel("體驗身分").inputValue(), "member");
  await skip("main");
  await page.reload();
  await page.getByRole("heading", { name: "歡迎回來" }).waitFor();
  await noPrivateData();
  // Admin entry remains a login screen; management is explicitly a mock demo.
  await page.goto(`${base}#/admin`);
  await page.getByRole("heading", { name: "管理後台登入" }).waitFor();
  await noPrivateData();
  await page.getByRole("link", { name: /體驗管理後台/ }).click();
  await page.getByRole("heading", { name: "管理總覽." }).waitFor();
  assert.equal(await page.getByLabel("體驗身分").inputValue(), "taipei");
  await page.getByRole("link", { name: "公開首頁", exact: true }).click();
  await noPrivateData();
  await page.goBack();
  assert.match(new URL(page.url()).hash, /^#\/demo(?:\?view=overview)?$/);
  await page.getByRole("heading", { name: "管理總覽." }).waitFor();
  // Public registration keeps the existing membership application journey.
  await page.goto(`${base}#/register`);
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("姓名", { exact: true }).fill("合成首頁會員");
  await dialog.getByLabel("Call name", { exact: true }).fill("IndexNova");
  await dialog
    .getByLabel("Email", { exact: true })
    .fill("index-nova@example.test");
  await dialog.getByLabel("示範密碼", { exact: true }).fill("DemoPass2026!");
  await dialog.getByRole("button", { name: "建立示範會員" }).click();
  await page.waitForURL(/#\/workspace(?:\?view=\w+)?$/);
  assert.equal(await page.getByLabel("體驗身分").inputValue(), "member");
  assert(
    await page
      .getByRole("button", { name: "申請加入社團", exact: true })
      .first()
      .isVisible(),
  );
  await page.setViewportSize({ width: 360, height: 800 });
  for (const route of [
    "",
    "#/map",
    "#/calendar",
    "#/login",
    "#/admin",
    "#/register",
  ]) {
    await page.goto(`${base}${route}`);
    await page.getByRole("heading", { level: 1 }).waitFor();
    await noOverflow();
    if (!route)
      await page.screenshot({
        path: `${dir}/public-index-mobile.png`,
        fullPage: true,
      });
  }
  await page.keyboard.press("Escape");
  await page.goto(base);
  await page.getByRole("button", { name: "開啟導覽選單", exact: true }).click();
  await page
    .getByRole("navigation", { name: "公開網站導覽" })
    .getByRole("button", { name: "社團行事曆", exact: true })
    .click();
  await page.waitForURL("**#/calendar");
  assert.equal(
    await page
      .getByRole("button", { name: "開啟導覽選單", exact: true })
      .getAttribute("aria-expanded"),
    "false",
  );
  await page.goto(`${base}#/unknown`);
  assert.match(
    await page.getByRole("heading", { level: 1 }).innerText(),
    /玩轉/,
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: public default/anonymous DOM, direct links and refresh, skip links, member login/registration, explicit admin demo, browser back and 360px layouts.",
  );
} finally {
  await browser.close();
}
