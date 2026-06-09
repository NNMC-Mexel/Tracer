const { test } = require("@playwright/test");

test.use({ channel: "chrome" });

test("qa smoke", async ({ page }) => {
  page.on("console", (msg) => console.log("BROWSER_CONSOLE", msg.type(), msg.text()));
  page.on("pageerror", (err) => console.log("PAGE_ERROR", err.message));

  await page.goto("http://localhost:3100/login", { waitUntil: "networkidle" });
  console.log("LOGIN_TEXT_START");
  console.log((await page.locator("body").innerText()).slice(0, 1500));
  console.log("LOGIN_TEXT_END");

  await page.locator('input[autocomplete="username"]').fill("qa_auditor");
  await page.locator('input[autocomplete="current-password"]').fill("QaTest12345!");
  await page.locator('button[type="submit"]').click();
  await page.waitForURL("**/dashboard", { timeout: 15000 });
  await page.waitForLoadState("networkidle");
  console.log("DASHBOARD_TEXT_START");
  console.log((await page.locator("body").innerText()).slice(0, 3000));
  console.log("DASHBOARD_TEXT_END");

  await page.goto("http://localhost:3100/dashboard/tracers", { waitUntil: "networkidle" });
  console.log("TRACERS_TEXT_START");
  console.log((await page.locator("body").innerText()).slice(0, 3000));
  console.log("TRACERS_TEXT_END");

  await page.goto("http://localhost:3100/dashboard/reports", { waitUntil: "networkidle" });
  console.log("REPORTS_TEXT_START");
  console.log((await page.locator("body").innerText()).slice(0, 3000));
  console.log("REPORTS_TEXT_END");
});
