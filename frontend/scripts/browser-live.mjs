import assert from "node:assert/strict";
import { chromium } from "playwright";
const base = process.env.BASE_URL || "https://localhost:5173/";
const reviewerIdentifier = process.env.LIVE_REVIEWER_EMAIL;
const reviewerPassword = process.env.LIVE_REVIEWER_PASSWORD;
if (!reviewerIdentifier || !reviewerPassword)
  throw new Error(
    "Set LIVE_REVIEWER_EMAIL and LIVE_REVIEWER_PASSWORD for a locally seeded club reviewer.",
  );
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
const suffix = Date.now();
const email = `live-${suffix}@example.test`;
const callName = `Live${suffix}`;
const password = `Browser_${crypto.randomUUID()}!`;
const apiErrors = [];
page.on("pageerror", (error) => apiErrors.push(error.message));
const check = async () => {
  const alert = page.getByRole("alert");
  if (await alert.count()) throw new Error(await alert.innerText());
};
const submit = async (button, path) => {
  const response = page.waitForResponse(
    (r) =>
      r.url().includes(`/api/v1${path}`) && r.request().method() === "POST",
  );
  await button.click();
  const result = await response;
  assert.ok(result.ok(), `${path} returned ${result.status()}`);
  return result.json();
};
try {
  await page.goto(`${base}#/register`);
  await page.getByLabel("姓名", { exact: true }).fill("本地測試社員");
  await page.getByLabel("扶輪 call name", { exact: true }).fill(callName);
  await page.getByLabel("Email", { exact: true }).fill(email);
  // Unique E.164 phone avoids collisions across repeated local runs.
  const phone = `+8869${String(suffix).slice(-8)}`;
  await page.getByLabel("電話（選填，含國碼）").fill(phone);
  await page.getByLabel("密碼", { exact: true }).fill(password);
  const registered = await submit(
    page.getByRole("button", { name: "建立帳號", exact: true }),
    "/accounts",
  );
  assert.ok(registered.accountCode);
  const login = async (identifier, secret) => {
    await page.getByLabel("Email、電話或會員代號").fill(identifier);
    await page.getByLabel("密碼", { exact: true }).fill(secret);
    return submit(
      page.getByRole("button", { name: "登入", exact: true }),
      "/sessions",
    );
  };
  const current = await login(email, password);
  await page.getByRole("heading", { name: "申請加入社團" }).waitFor();
  await page
    .locator("select[name=clubId] option")
    .nth(1)
    .waitFor({ state: "attached" });
  const options = await page
    .locator("select[name=clubId] option")
    .evaluateAll((opts) =>
      opts
        .filter((o) => o.value)
        .map((o) => ({ id: o.value, name: o.textContent })),
    );
  const clubId = process.env.LIVE_CLUB_ID || options[0]?.id;
  assert.ok(clubId, "No active local club provided");
  await page.getByLabel("選擇社團").selectOption(clubId);
  await page.getByLabel("申請說明").fill("本地端到端入社驗證");
  const application = await submit(
    page.getByRole("button", { name: "送出入社申請" }),
    "/join-applications",
  );
  assert.equal(application.status, "pending");
  await page
    .getByText("入社申請已送出，等待社團管理者審核。", { exact: true })
    .waitFor();
  // Discovery must exclude a registered account before admission, even for self.
  const before = await context.request.get(
    `${base}api/v1/members?keyword=${callName}`,
  );
  assert.equal(before.status(), 200);
  assert.equal((await before.json()).total, 0);
  const logout = async () => {
    const response = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/v1/sessions/current") &&
        r.request().method() === "DELETE",
    );
    await page.getByRole("button", { name: "登出", exact: true }).click();
    assert.equal((await response).status(), 204);
    await page.getByRole("button", { name: "登入", exact: true }).waitFor();
  };
  await logout();
  await login(reviewerIdentifier, reviewerPassword);
  await page.getByRole("button", { name: "社團入社審核", exact: true }).click();
  await page.getByLabel("管理社團").selectOption(clubId);
  const row = page.locator(".live-row").filter({ hasText: callName });
  await row.getByLabel("實際入社日期").waitFor();
  const approved = await submit(
    row.getByRole("button", { name: "核准入社" }),
    `/join-applications/${application.id}/approve`,
  );
  assert.equal(approved.application.status, "approved");
  await page
    .getByText("已核准入社，會員名冊已更新。", { exact: true })
    .waitFor();
  await page.getByRole("button", { name: "會員名冊", exact: true }).click();
  await page.getByLabel("搜尋姓名或 call name").fill(callName);
  await page.getByRole("button", { name: "搜尋", exact: true }).click();
  const memberRow = page.locator(".live-row").filter({ hasText: callName });
  await memberRow.getByRole("button", { name: "查看詳情" }).click();
  const detail = page.getByRole("region", { name: "會員詳情" });
  await detail.waitFor();
  assert.ok((await detail.innerText()).includes(email));
  assert.ok((await detail.innerText()).includes("電話：未公開"));
  const projected = await context.request.get(
    `${base}api/v1/members/${current.member.id}`,
  );
  const data = await projected.json();
  assert.equal(data.email, email);
  assert.equal(Object.hasOwn(data, "phone"), false);
  await page.setViewportSize({ width: 360, height: 800 });
  await page.waitForTimeout(100);
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    true,
    "360px viewport overflow",
  );
  await check();
  assert.deepEqual(apiErrors, []);
  console.log(
    "PASS real HTTPS API: registration → login → hidden pending member → application → reviewer approval → discoverable directory → contact projection → 360px",
  );
} finally {
  await browser.close();
}
