import { chromium } from "playwright";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  headless: true,
  args: ["--no-sandbox"],
});
const base = process.env.BASE_URL || "http://127.0.0.1:5173/";
const dir = fileURLToPath(new URL("../../docs/previews/", import.meta.url));
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
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
  const respond = async (action, accept) => {
    const handled = page.waitForEvent("dialog").then(async (d) => {
      assert.equal(d.type(), "confirm");
      await (accept ? d.accept() : d.dismiss());
    });
    await action();
    await handled;
  };
  await page.goto(`${base}#/demo?view=annual`);
  await page.getByRole("heading", { name: "年度名冊.", exact: true }).waitFor();
  await nav("管理總覽");
  assert(
    await page.getByRole("heading", { name: "現在需要你處理" }).isVisible(),
  );
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement)
      document.activeElement.blur();
  });
  await page.screenshot({
    path: `${dir}/v04-tasks-desktop.png`,
    fullPage: true,
  });
  await page.getByLabel("體驗身分").selectOption("member");
  await nav("帳號設定");
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement)
      document.activeElement.blur();
  });
  await page.screenshot({
    path: `${dir}/v04-account-desktop.png`,
    fullPage: true,
  });
  const accountURL = page.url();
  await page.getByLabel("姓名", { exact: true }).fill("草稿保留驗證");
  await page.getByRole("tab", { name: "登入聯絡資料", exact: true }).click();
  await page
    .getByRole("tabpanel")
    .getByLabel("輸入目前示範密碼，確認本人", { exact: true })
    .fill("DemoPass2026!");
  await page.getByRole("tab", { name: "帳號代號", exact: true }).click();
  await page.getByRole("tab", { name: "登入聯絡資料", exact: true }).click();
  assert.equal(
    await page
      .getByRole("tabpanel")
      .getByLabel("輸入目前示範密碼，確認本人", { exact: true })
      .inputValue(),
    "",
  );
  await page.getByLabel("新的電話（含國碼）").fill("+886912009988");
  await respond(
    () => page.getByLabel("本次變更項目").selectOption("email"),
    false,
  );
  assert.equal(
    await page.getByLabel("新的電話（含國碼）").inputValue(),
    "+886912009988",
  );
  await respond(
    () => page.getByLabel("本次變更項目").selectOption("email"),
    true,
  );
  assert.equal(
    await page.getByLabel("新的Email", { exact: true }).inputValue(),
    "",
  );
  await page.getByRole("tab", { name: /基本資料/ }).click();
  assert.equal(
    await page.getByLabel("姓名", { exact: true }).inputValue(),
    "草稿保留驗證",
  );
  await respond(() => nav("個人資料"), false);
  assert.equal(page.url(), accountURL);
  assert.equal(
    await page.getByLabel("姓名", { exact: true }).inputValue(),
    "草稿保留驗證",
  );
  await respond(() => page.goBack(), false);
  await page.waitForURL(accountURL);
  assert.equal(page.url(), accountURL);
  await respond(
    () => page.getByLabel("體驗身分").selectOption("district"),
    false,
  );
  assert.equal(await page.getByLabel("體驗身分").inputValue(), "member");
  await page.getByRole("button", { name: "放棄變更", exact: true }).click();
  await nav("個人資料");
  assert.equal(await page.getByLabel("姓名", { exact: true }).count(), 0);
  await page.getByRole("button", { name: "編輯帳號與基本資料" }).click();
  assert.match(page.url(), /view=account$/);
  await page.getByLabel("體驗身分").selectOption("district");
  await page.getByRole("heading", { name: "地區管理.", exact: true }).waitFor();
  assert.match(page.url(), /view=district$/);
  await page.getByLabel("本次操作原因").fill("示範停用確認");
  await page.getByRole("button", { name: "確認停用", exact: true }).click();
  let dialog = page.getByRole("dialog");
  await dialog.waitFor();
  assert((await dialog.getByText(/台北/).count()) > 0);
  await dialog.getByRole("button", { name: "返回檢查" }).click();
  assert(
    await page
      .getByRole("button", { name: "確認停用", exact: true })
      .isVisible(),
  );
  await page.getByRole("button", { name: "確認停用", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "確認執行" })
    .click();
  assert(
    await page
      .getByRole("button", { name: "確認恢復", exact: true })
      .isVisible(),
  );
  await nav("異動紀錄");
  await page.getByLabel("搜尋異動紀錄").fill("完全不存在的搜尋");
  assert(await page.getByText(/找不到符合.*的紀錄/).isVisible());
  await page.getByRole("button", { name: "清除搜尋與排序" }).click();
  await page.getByLabel("體驗身分").selectOption("taipei");
  await nav("社團資料");
  await page.getByLabel("社團簡介", { exact: true }).fill("尚未儲存社團介紹");
  await respond(
    () => page.getByLabel("本社示範職務").selectOption("manager"),
    false,
  );
  assert.equal(
    await page.getByLabel("社團簡介", { exact: true }).inputValue(),
    "尚未儲存社團介紹",
  );
  await respond(() => nav("會員名冊"), false);
  assert.match(page.url(), /view=club$/);
  await respond(() => nav("會員名冊"), true);
  assert.match(page.url(), /view=members$/);
  // Deep links must not expand the current persona's navigation permissions.
  await page.getByLabel("體驗身分").selectOption("member");
  await page.evaluate(() => {
    location.hash = "/demo?view=roles";
  });
  await page.getByRole("heading", { name: "管理總覽.", exact: true }).waitFor();
  assert.match(page.url(), /view=overview$/);
  await page.getByRole("link", { name: "公開首頁", exact: true }).click();
  await page.getByRole("heading", { level: 1 }).waitFor();
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement)
      document.activeElement.blur();
  });
  await page.screenshot({
    path: `${dir}/v04-home-desktop.png`,
    fullPage: true,
  });
  for (const width of [320, 360, 768, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ["home", "map", "calendar", "admin", "demo"]) {
      await page.goto(`${base}#/${route}`);
      await page.getByRole("heading", { level: 1 }).waitFor();
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${route} overflow ${width}`,
      );
    }
    await page.getByLabel("體驗身分").selectOption("member");
    await nav("帳號設定");
    for (const tab of ["基本資料", "登入聯絡資料", "帳號代號"]) {
      await page.getByRole("tab", { name: tab, exact: true }).click();
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `account/${tab} overflow ${width}`,
      );
    }
    if (width === 360) {
      await page.evaluate(() => {
        if (document.activeElement instanceof HTMLElement)
          document.activeElement.blur();
        window.scrollTo(0, 0);
      });
      await page.screenshot({
        path: `${dir}/v04-account-mobile.png`,
        fullPage: true,
      });
    }
  }
  assert.deepEqual(errors, []);
  console.log(
    "PASS: task-first overview, deep links/fallback, account tabs/drafts/password clearing, canceled navigation/back/persona, unique editor, two-step disable/restore, scoped audit search and 320–1024px reflow.",
  );
} finally {
  await browser.close();
}
