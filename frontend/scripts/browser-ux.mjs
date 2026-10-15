import { chromium } from "playwright";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  headless: true,
  args: ["--no-sandbox"],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const base = process.env.BASE_URL || "http://127.0.0.1:5173/";
  await page.goto(`${base}#/demo`);
  const nav = async (name) =>
    page
      .getByRole("navigation", { name: "主要選單" })
      .getByRole("button", { name, exact: true })
      .click();
  await page.getByLabel("體驗身分").selectOption("member");
  await nav("帳號設定");
  const name = page.getByLabel("姓名", { exact: true });
  await name.fill("未儲存的合成草稿");
  await page.getByLabel("畫面情境").selectOption("conflict");
  await page.getByRole("button", { name: "重新取得資料", exact: true }).click();
  const preserved = (await name.inputValue()) === "未儲存的合成草稿";
  await page.getByLabel("體驗身分").selectOption("taipei");
  await nav("退社與 OB");
  const select = page.getByLabel("辦理社員");
  const first = await select.inputValue();
  await page.getByLabel("辦理原因").fill("合成連續辦理一");
  await page.getByRole("checkbox", { name: /我已確認資料及影響/ }).check();
  await page.getByRole("button", { name: "確認直接辦理", exact: true }).click();
  const second = await select.inputValue();
  assert.notEqual(first, second);
  await page.getByLabel("辦理原因").fill("合成連續辦理二");
  await page.getByRole("checkbox", { name: /我已確認資料及影響/ }).check();
  await page.getByRole("button", { name: "確認直接辦理", exact: true }).click();
  // Each successful direct operation removes its member from the active selector.
  const remaining = await select
    .locator("option")
    .evaluateAll((os) => os.map((o) => o.value));
  const secondRemoved = !remaining.includes(second);
  console.log({
    draftPreserved: preserved,
    secondMemberCompleted: secondRemoved,
  });
  assert(preserved, "Conflict/retry must preserve an unsaved account draft.");
  assert(
    secondRemoved,
    "The second OB operation must submit the currently displayed member.",
  );
  for (const width of [360, 768, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ["home", "map", "calendar", "admin", "demo"]) {
      await page.goto(`${base}#/${route}`);
      await page.getByRole("heading", { level: 1 }).waitFor();
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${route} overflows at ${width}px`,
      );
    }
  }
  assert.deepEqual(errors, []);
  console.log(
    "PASS: unsaved draft survives conflict/retry; consecutive OB operations use the displayed member.",
  );
} finally {
  await browser.close();
}
