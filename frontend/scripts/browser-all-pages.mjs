import { chromium } from "playwright";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
const base = process.env.BASE_URL || "http://127.0.0.1:5173/";
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  headless: true,
  args: ["--no-sandbox"],
});
const dir = fileURLToPath(new URL("../../docs/previews/", import.meta.url));
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  page.setDefaultTimeout(10000);
  const errors = [],
    requests = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => requests.push(r.url()));
  await page.emulateMedia({ reducedMotion: "reduce" });
  const screenshot = async (name) => {
    await page.evaluate(() => {
      document.activeElement?.blur();
      window.scrollTo(0, 0);
    });
    await page.screenshot({ path: `${dir}/v05-${name}.png`, fullPage: true });
  };
  const noOverflow = async (label) =>
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `overflow: ${label}`,
    );
  const nav = async (name) => {
    if (
      await page
        .getByRole("button", { name: "開啟選單", exact: true })
        .isVisible()
    )
      await page.getByRole("button", { name: "開啟選單", exact: true }).click();
    await page
      .getByRole("navigation", { name: "主要選單" })
      .getByRole("button", { name, exact: true })
      .click();
  };
  // Root entry must mount only the public page, without requesting the App module.
  await page.goto(base);
  await page.locator(".ph-site").waitFor();
  assert.equal(await page.locator(".app-shell").count(), 0);
  assert.equal(await page.getByLabel("體驗身分").count(), 0);
  assert.equal(
    requests.filter((u) => /\/src\/App\.tsx|\/assets\/App-[^/]+\.js/.test(u))
      .length,
    0,
  );
  assert.match(
    await page.getByRole("heading", { level: 1 }).innerText(),
    /玩轉/,
  );
  for (const target of [
    `${base}#/`,
    `${base}#/unknown`,
    base.replace(/\/$/, ""),
  ]) {
    await page.goto(target);
    await page.locator(".ph-site").waitFor();
    assert.equal(await page.locator(".app-shell").count(), 0);
  }
  assert.equal(
    requests.filter((u) => /\/src\/App\.tsx|\/assets\/App-[^/]+\.js/.test(u))
      .length,
    0,
  );
  const footerContrast = await page
    .locator(".ph-footer-main p")
    .evaluate((element) => {
      const lum = (color) => {
        const parts = color
          .match(/[\d.]+/g)
          .slice(0, 3)
          .map(Number)
          .map((value) => {
            const v = value / 255;
            return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
          });
        return parts[0] * 0.2126 + parts[1] * 0.7152 + parts[2] * 0.0722;
      };
      const a = lum(getComputedStyle(element).color),
        b = lum(
          getComputedStyle(element.closest(".ph-footer")).backgroundColor,
        );
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    });
  assert(
    footerContrast >= 4.5,
    "Public footer supporting text must remain readable on its dark background.",
  );
  await screenshot("home-desktop");
  await page
    .getByRole("navigation", { name: "公開網站導覽" })
    .getByRole("button", { name: "商家地圖", exact: true })
    .click();
  await page
    .getByLabel("產業", { exact: true })
    .selectOption({ label: "專業服務" });
  assert.equal(await page.locator(".ph-business-card").count(), 3);
  await page.getByRole("button", { name: "清除商家篩選" }).click();
  assert.equal(await page.locator(".ph-business-card").count(), 5);
  await screenshot("map-desktop");
  await page
    .getByRole("navigation", { name: "公開網站導覽" })
    .getByRole("button", { name: "社團行事曆", exact: true })
    .click();
  await page.getByRole("button", { name: "活動列表", exact: true }).click();
  await page.getByRole("button", { name: "查看 2026 年 10 月示範", exact: true }).click();
  await page.getByLabel("扶輪地區").selectOption("d3462");
  assert.equal(await page.locator(".ph-event-card").count(), 2);
  assert.match(await page.locator(".ph-event-list").innerText(), /社區服務週末/);
  assert.match(await page.locator(".ph-event-list").innerText(), /青年的下一站/);
  await page.getByRole("button", { name: "重設篩選" }).click();
  await screenshot("calendar-desktop");
  await page
    .getByRole("navigation", { name: "公開網站導覽" })
    .getByRole("button", { name: "加入生活圈", exact: false })
    .click();
  let dialog = page.getByRole("dialog");
  await dialog.waitFor();
  await dialog.getByLabel("姓名", { exact: true }).fill("首頁流程合成會員");
  await dialog.getByLabel("Call name", { exact: true }).fill("PublicNova");
  await dialog
    .getByLabel("Email", { exact: true })
    .fill("public-nova@example.test");
  await dialog.getByLabel("示範密碼", { exact: true }).fill("DemoPass2026!");
  await dialog.getByRole("button", { name: "建立示範會員" }).click();
  await page.getByLabel("體驗身分").waitFor();
  assert.equal(await page.getByLabel("體驗身分").inputValue(), "member");
  await page.getByRole("link", { name: "公開首頁", exact: true }).click();
  await page.locator(".ph-site").waitFor();
  assert.equal(await page.locator(".app-shell").count(), 0);
  assert.equal(await page.locator("main").count(), 1);
  await page
    .getByRole("navigation", { name: "公開網站導覽" })
    .getByRole("button", { name: "會員登入", exact: true })
    .click();
  await page.getByRole("heading", { name: "歡迎回來" }).waitFor();
  await page
    .getByLabel("Email、國碼電話或帳號代號")
    .fill("public-nova@example.test");
  await page.getByLabel("示範密碼", { exact: true }).fill("DemoPass2026!");
  await page.getByRole("button", { name: "顯示密碼內容" }).click();
  assert.equal(
    await page.getByLabel("示範密碼", { exact: true }).getAttribute("type"),
    "text",
  );
  await page.getByRole("button", { name: "隱藏密碼內容" }).click();
  assert.equal(
    await page.getByLabel("示範密碼", { exact: true }).getAttribute("type"),
    "password",
  );
  await screenshot("login-desktop");
  await page.getByRole("button", { name: "登入示範帳號" }).click();
  await page.getByLabel("體驗身分").waitFor();
  assert.equal(await page.getByLabel("體驗身分").inputValue(), "member");
  await nav("帳號設定");
  await page.getByLabel("姓名", { exact: true }).fill("不可丟失的草稿");
  const url = page.url();
  const handled = page.waitForEvent("dialog").then((d) => d.dismiss());
  await page.getByRole("link", { name: "公開首頁", exact: true }).click();
  await handled;
  await page.waitForURL(url);
  assert.equal(
    await page.getByLabel("姓名", { exact: true }).inputValue(),
    "不可丟失的草稿",
  );
  await page.getByRole("button", { name: "放棄變更", exact: true }).click();
  // Start seed data for systematic role/page coverage.
  await page.goto(`${base}#/demo`);
  await page.getByRole("heading", { name: "管理總覽.", exact: true }).waitFor();
  const visited = new Set();
  for (const width of [1440, 360]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const actor of ["taipei", "member", "district", "platform"]) {
      await page.getByLabel("體驗身分").selectOption(actor);
      if (
        await page
          .getByRole("button", { name: "開啟選單", exact: true })
          .isVisible()
      )
        await page
          .getByRole("button", { name: "開啟選單", exact: true })
          .click();
      const names = await page
        .getByRole("navigation", { name: "主要選單" })
        .getByRole("button")
        .evaluateAll((bs) => bs.map((b) => b.getAttribute("aria-label")));
      if (
        await page
          .getByRole("button", { name: "關閉導覽選單", exact: true })
          .isVisible()
      )
        await page
          .getByRole("button", { name: "關閉導覽選單", exact: true })
          .click();
      for (const name of names) {
        await nav(name);
        await page.getByRole("heading", { level: 1 }).waitFor();
        await noOverflow(`${actor}/${name}/${width}`);
        visited.add(`${actor}/${name}`);
        if (
          width === 1440 &&
          ((actor === "taipei" &&
            ["管理總覽", "會員名冊", "年度名冊", "角色與交接"].includes(
              name,
            )) ||
            (actor === "member" && ["帳號設定", "歷史與同意"].includes(name)) ||
            (actor === "platform" && name === "帳號協助"))
        )
          await screenshot(`${actor}-${name}`);
      }
    }
  }
  await page.getByRole("link", { name: "公開首頁", exact: true }).click();
  await page.locator(".ph-site").waitFor();
  await screenshot("home-mobile");
  await noOverflow("public home 360");
  assert.equal(await page.locator(".app-shell").count(), 0);
  assert.deepEqual(errors, []);
  const fault = await browser.newPage();
  await fault.route(
    /\/(?:src\/App\.tsx|assets\/App-[^/]+\.js)(?:\?.*)?$/,
    (route) => route.abort(),
  );
  await fault.goto(base);
  await fault.locator(".ph-site").waitFor();
  await fault
    .getByRole("navigation", { name: "公開網站導覽" })
    .getByRole("button", { name: "會員登入", exact: true })
    .click();
  await fault
    .getByRole("heading", { name: "畫面尚未載入完成", exact: true })
    .waitFor();
  await fault.getByRole("link", { name: "返回公開首頁", exact: true }).click();
  await fault.locator(".ph-site").waitFor();
  assert.equal(await fault.locator(".app-shell").count(), 0);
  await fault.close();
  console.log(
    `PASS: public root without App request, public filters, signup→home→login preserved, password visibility, canceled public navigation, ${visited.size} role/page combinations at 1440/360px; no browser exceptions.`,
  );
} finally {
  await browser.close();
}
