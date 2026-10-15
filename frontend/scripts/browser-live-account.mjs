import assert from "node:assert/strict";
import { chromium } from "playwright";
const base = process.env.BASE_URL || "https://localhost:5173/";
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  headless: true,
  args: ["--no-sandbox"],
});
const context = await browser.newContext({
  ignoreHTTPSErrors: true,
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const suffix = Date.now();
const email = `account-${suffix}@example.test`,
  nextEmail = `changed-${suffix}@example.test`;
const password = `Browser_${crypto.randomUUID()}!`,
  code = `a${suffix}`;
async function send(button, path, method = "POST", status = 200) {
  const pending = page.waitForResponse(
    (r) =>
      r.url().endsWith(`/api/v1${path}`) && r.request().method() === method,
  );
  await button.click();
  const response = await pending;
  if (response.status() !== status) {
    const detail = await response
      .text()
      .catch(() => "Response body unavailable");
    assert.equal(response.status(), status, `${path}: ${detail}`);
  }
  return status === 204 ? null : response.json();
}
async function login(identifier, status = 200) {
  await page.getByLabel("Email、電話或會員代號").fill(identifier);
  await page.getByLabel("密碼", { exact: true }).fill(password);
  return send(
    page.getByRole("button", { name: "登入", exact: true }),
    "/sessions",
    "POST",
    status,
  );
}
async function logout() {
  await send(
    page.getByRole("button", { name: "登出", exact: true }),
    "/sessions/current",
    "DELETE",
    204,
  );
  await page.getByRole("button", { name: "登入", exact: true }).waitFor();
}
try {
  await page.goto(`${base}#/register`);
  await page.getByLabel("姓名", { exact: true }).fill("帳號測試會員");
  await page
    .getByLabel("扶輪 call name", { exact: true })
    .fill(`Account${suffix}`);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("密碼", { exact: true }).fill(password);
  const registered = await send(
    page.getByRole("button", { name: "建立帳號", exact: true }),
    "/accounts",
    "POST",
    201,
  );
  await login(email);
  await page.getByRole("button", { name: "我的帳號", exact: true }).click();
  const account = page.getByRole("region", { name: "我的帳號" });
  assert.equal(
    await account.getByLabel("在登入會員詳情顯示電話").isChecked(),
    false,
  );
  assert.equal(
    await account.getByLabel("在登入會員詳情顯示 Email").isChecked(),
    true,
  );
  await account.getByLabel("姓名", { exact: true }).fill("改名測試會員");
  await send(
    account.getByRole("button", { name: "儲存基本資料" }),
    "/me/profile",
    "PATCH",
  );
  await account.getByLabel("在登入會員詳情顯示 Email").uncheck();
  await send(
    account.getByRole("button", { name: "儲存隱私設定" }),
    "/me/privacy",
    "PATCH",
  );
  await account.getByLabel("姓名", { exact: true }).fill("保留草稿測試");
  page.once("dialog", (d) => d.dismiss());
  await page.getByRole("button", { name: "會員名冊", exact: true }).click();
  assert.equal(
    await account.getByLabel("姓名", { exact: true }).inputValue(),
    "保留草稿測試",
  );
  page.once("dialog", (d) => d.dismiss());
  await page
    .locator(".live-header")
    .getByRole("link", { name: "返回公開首頁" })
    .click();
  await page.waitForTimeout(100);
  assert.equal(await account.isVisible(), true);
  await account.getByLabel("姓名", { exact: true }).fill("改名測試會員");
  const contact = account.locator("section").filter({
    has: page.getByRole("heading", {
      name: "變更登入電話或 Email",
      exact: true,
    }),
  });
  await contact.getByLabel("新 Email", { exact: true }).fill(nextEmail);
  await contact
    .getByLabel("目前密碼", { exact: true })
    .fill("incorrect password");
  await send(
    contact.getByRole("button", { name: "確認變更聯絡資料" }),
    "/me/contact-changes",
    "POST",
    401,
  );
  await account.getByRole("alert").waitFor();
  assert.equal(
    await contact.getByLabel("新 Email", { exact: true }).inputValue(),
    nextEmail,
  );
  await page.waitForFunction(
    () => document.querySelector('input[name="currentPassword"]')?.value === "",
  );
  assert.equal(
    await page.getByRole("button", { name: "登出", exact: true }).isVisible(),
    true,
  );
  const beforeCookie = (await context.cookies()).find(
    (c) => c.name === "__Host-session",
  ).value;
  await contact.getByLabel("目前密碼", { exact: true }).fill(password);
  const changed = await send(
    contact.getByRole("button", { name: "確認變更聯絡資料" }),
    "/me/contact-changes",
  );
  assert.equal(changed.account.email, nextEmail);
  const afterCookie = (await context.cookies()).find(
    (c) => c.name === "__Host-session",
  ).value;
  assert.notEqual(beforeCookie, afterCookie);
  assert.equal((await context.request.get(`${base}api/v1/me`)).status(), 200);
  await contact.getByLabel("變更項目").selectOption("phone");
  const phone = `+8869${String(suffix).slice(-8)}`;
  await contact.getByLabel("新電話（含國碼）").fill(phone);
  await contact.getByLabel("目前密碼", { exact: true }).fill(password);
  const phoneChanged = await send(
    contact.getByRole("button", { name: "確認變更聯絡資料" }),
    "/me/contact-changes",
  );
  assert.equal(phoneChanged.account.phone, phone);
  const codeSection = account.locator("section").filter({
    has: page.getByRole("heading", { name: "會員代號", exact: true }),
  });
  await codeSection.getByLabel("新會員代號").fill(code);
  await codeSection.getByLabel("目前密碼").fill(password);
  page.once("dialog", (d) => d.accept());
  const updated = await send(
    codeSection.getByRole("button", { name: "確認修改會員代號" }),
    "/me/account-code-changes",
  );
  assert.equal(updated.remainingCodeChanges, 0);
  await account
    .getByText("已完成唯一一次代號修改，無法再次變更。", { exact: true })
    .waitFor();
  // The server, rather than only the hidden control, rejects a second attempt.
  const second = await context.request.post(
    `${base}api/v1/me/account-code-changes`,
    {
      headers: {
        "X-CSRF-Token": updated.csrfToken,
        "Idempotency-Key": crypto.randomUUID(),
        Origin: new URL(base).origin,
      },
      data: {
        version: updated.account.version,
        newCode: `b${suffix}`,
        currentPassword: password,
      },
    },
  );
  assert.equal(second.status(), 409);
  await page.setViewportSize({ width: 360, height: 800 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
    "360px overflow",
  );
  await logout();
  await login(email, 401);
  await login(registered.accountCode, 401);
  await login(nextEmail);
  await logout();
  await login(phone);
  await logout();
  await login(code);
  await page.getByRole("button", { name: "我的帳號", exact: true }).click();
  assert.equal(
    await account.getByLabel("姓名", { exact: true }).inputValue(),
    "改名測試會員",
  );
  assert.equal(
    await account.getByLabel("在登入會員詳情顯示 Email").isChecked(),
    false,
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS real account API: profile/privacy, draft guards, password failure preserves session, email/phone rotation, old/new login identifiers, one-time code, 360px",
  );
} finally {
  await browser.close();
}
