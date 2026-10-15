import assert from "node:assert/strict";
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";

const base = process.env.BASE_URL || "http://127.0.0.1:5173/";
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ["--no-sandbox"],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage();
await page.emulateMedia({ reducedMotion: "reduce" });
page.setDefaultTimeout(12000);
const errors = [],
  requests = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("request", (request) => requests.push(request.url()));
const hash = async (value) => {
  await page.evaluate((value) => {
    window.location.hash = value;
  }, value);
  await page.waitForTimeout(100);
};
const overflow = async () =>
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "horizontal overflow",
  );
const preview = async (name) => {
  if (process.env.WRITE_PREVIEWS === "1")
    await page.screenshot({
      path: fileURLToPath(
        new URL(`../../docs/previews/p2-${name}.png`, import.meta.url),
      ),
      fullPage: true,
        animations: "disabled",
    });
};
try {
  await page.goto(base);
  await page.getByRole("heading", { level: 1 }).waitFor();
  assert.equal(
    requests.filter((url) =>
      /\/src\/App\.tsx|\/assets\/App-[^/]+\.js/.test(url),
    ).length,
    0,
  );
  await hash("/clubs");
  await page.getByLabel("搜尋社團", { exact: true }).fill("台北");
  assert.equal(await page.locator(".pc-club-card").count(), 1);
  await page.locator(".pc-club-card").click();
  await page
    .getByRole("heading", { level: 1, name: "台北星光扶青社" })
    .waitFor();
  await hash("/clubs");
  await preview("clubs-desktop");
  for (const value of [
    "/event?id=draft",
    "/event?id=members-only",
    "/event?id=club-only",
    "/event?id=disabled-future",
    "/club?id=disabled",
    "/club?id=unknown",
  ]) {
    await hash(value);
    await page.getByRole("heading", { name: "找不到這個公開頁面" }).waitFor();
    assert.doesNotMatch(
      await page.locator("body").innerText(),
      /服務計畫草稿|會員交流沙龍|社內工作會議/,
    );
  }
  await hash("/event?id=city-walk");
  await page
    .getByRole("heading", { name: "城市散步・一起認識在地", level: 1 })
    .waitFor();
  await hash("/event?id=cancelled");
  await page.getByRole("heading", { name: "海港交流日", level: 1 }).waitFor();
  assert.match(await page.locator("body").innerText(), /天候因素/);
  await hash("/calendar");
  await page.getByRole("button", { name: "月曆", exact: true }).click();
  assert.equal(
    await page
      .getByRole("link", { name: "10月23日 跨日服務接力", exact: true })
      .count(),
    1,
  );
  assert.equal(
    await page
      .getByRole("link", { name: "10月24日 跨日服務接力", exact: true })
      .count(),
    1,
  );
  await preview("calendar-desktop");
  await page.getByRole("button", { name: "活動列表", exact: true }).click();
  assert.match(await page.locator(".ph-event-card").first().innerText(), /社區服務週末/);
  await page.getByLabel("搜尋活動", { exact: true }).fill("不存在的活動");
  assert.equal(await page.locator(".ph-event-card").count(), 0);
  await page.getByRole("button", { name: "清除活動篩選", exact: true }).click();
  await hash("/demo?view=events");
  const workspace = page.getByRole("region", { name: "活動管理工作區" });
  await workspace.waitFor();
  assert.doesNotMatch(await workspace.innerText(), /青年的下一站・職涯分享/);
  await preview("management-desktop");
  await workspace
    .getByRole("button", { name: "新增活動草稿", exact: true })
    .click();
  const editor = page.getByLabel("活動草稿編輯器", { exact: true });
  const title = `第二階段服務日${Date.now()}`;
  await editor.getByLabel("活動標題（必填）", { exact: false }).fill(title);
  await editor
    .getByLabel("開始日期與時間", { exact: true })
    .fill("2026-10-22T10:00");
  await editor
    .getByLabel("結束日期與時間", { exact: true })
    .fill("2026-10-22T12:00");
  await editor.getByLabel("地點", { exact: true }).fill("社區交流空間");
  page.once("dialog", (dialog) => dialog.dismiss());
  await page
    .getByRole("navigation", { name: "主要選單" })
    .getByRole("button", { name: "會員名冊", exact: true })
    .click();
  assert.equal(
    await editor.getByLabel("活動標題（必填）", { exact: false }).inputValue(),
    title,
  );
  await editor.getByRole("button", { name: "儲存草稿", exact: true }).click();
  let row = workspace
    .locator(".ew-card")
    .filter({ has: page.getByRole("heading", { name: title, exact: true }) });
  await row.getByRole("button", { name: "發布", exact: true }).click();
  await page
    .getByRole("dialog", { name: "確認發布活動", exact: true })
    .getByRole("button", { name: "確認發布", exact: true })
    .click();
  await hash("/calendar");
  await page.getByRole("button", { name: "活動列表", exact: true }).click();
  await page.getByLabel("搜尋活動", { exact: true }).fill(title);
  assert.equal(
    await page.locator(".ph-event-card").count(),
    1,
    "published draft must reach public calendar without refresh",
  );
  await page.locator(".ph-event-card").click();
  await page
    .getByRole("heading", { name: title, exact: true, level: 1 })
    .waitFor();
  const eventHash = new URL(page.url()).hash;
  await hash("/demo?view=events");
  row = workspace
    .locator(".ew-card")
    .filter({ has: page.getByRole("heading", { name: title, exact: true }) });
  await row.getByRole("button", { name: "取消活動", exact: true }).click();
  const cancel = page.getByRole("dialog", {
    name: "取消活動並保留公告",
    exact: true,
  });
  await cancel
    .getByLabel("取消原因（必填）", { exact: true })
    .fill("天候調整，改期另行公告。");
  await cancel
    .getByRole("button", { name: "確認取消活動", exact: true })
    .click();
  assert.equal(
    await row.getByRole("button", { name: "發布", exact: true }).count(),
    0,
  );
  await hash(eventHash);
  assert.match(
    await page.locator("body").innerText(),
    /天候調整，改期另行公告。/,
  );
  await hash("/demo?view=events");
  await workspace
    .getByLabel("本社示範身分", { exact: true })
    .selectOption("club_manager");
  assert.equal(
    await workspace.getByRole("button", { name: "發布", exact: true }).count(),
    0,
  );
  assert.equal(
    await workspace
      .getByRole("button", { name: "新增活動草稿", exact: true })
      .count(),
    1,
  );
  await page.setViewportSize({ width: 360, height: 800 });
  await overflow();
  await preview("management-mobile");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByLabel("體驗身分").selectOption("member");
  const reader = page.getByRole("region", { name: "會員活動閱讀工作區" });
  await reader
    .getByRole("heading", { name: "會員交流沙龍", exact: true })
    .waitFor();
  await reader
    .getByRole("heading", { name: "社內工作會議", exact: true })
    .waitFor();
  assert.equal(
    await reader
      .getByRole("button", { name: "新增活動草稿", exact: true })
      .count(),
    0,
  );
  assert.equal(
    await reader.getByRole("button", { name: "複製", exact: true }).count(),
    0,
  );
  await reader.getByText("閱讀活動詳情", { exact: true }).first().click();
  await page.setViewportSize({ width: 360, height: 800 });
  await overflow();
  await preview("member-mobile");
  for (const value of [
    "/calendar",
    "/clubs",
    "/club?id=taipei",
    "/event?id=city-walk",
  ]) {
    await hash(value);
    await page.getByRole("heading", { level: 1 }).waitFor();
    await overflow();
    if (value === "/event?id=city-walk") await preview("event-mobile");
  }
  assert.deepEqual(errors, []);
  console.log(
    "PASS phase 2 UI: public scope and deep links, cross-day calendar, club search, draft guard, publish→public→cancel, manager limits, 1440/360px; synthetic data only.",
  );
} finally {
  await browser.close();
}
