#!/usr/bin/env node
// Create or delete a throwaway committee for visual QA. Local dev and prod
// share one database (DATABASE_URL in .env.local) for this project, so
// this only ever touches a committee it created itself, matched by exact
// name - never anything else in that database.
//
// Usage (run from the repo root, with the dev server already up):
//   node --env-file=.env.local scripts/qa/fixture.mjs create "QA Committee" [pin] [baseUrl]
//   node --env-file=.env.local scripts/qa/fixture.mjs delete "QA Committee"
//
// `create` drives the real /new form with Playwright and prints the
// admin/member URLs, tokens, and PIN as JSON - use it, then ALWAYS follow
// up with `delete` when you're done looking.
import { neon } from "@neondatabase/serverless";

const [, , cmd, name, pinOrUrl, maybeBaseUrl] = process.argv;

if (!cmd || !name) {
  console.error(
    'Usage: fixture.mjs create "<name>" [pin] [baseUrl]\n' +
      '       fixture.mjs delete "<name>"'
  );
  process.exit(2);
}

if (!process.env.DATABASE_URL) {
  console.error(
    "DATABASE_URL not set - run with: node --env-file=.env.local scripts/qa/fixture.mjs ..."
  );
  process.exit(1);
}

if (cmd === "delete") {
  const sql = neon(process.env.DATABASE_URL);
  const deleted = await sql`delete from committees where name = ${name} returning id, name`;
  console.log(JSON.stringify({ deleted }));
  if (deleted.length === 0) {
    console.error(`No committee named "${name}" found - nothing deleted.`);
    process.exit(1);
  }
  process.exit(0);
}

if (cmd === "create") {
  const pin = pinOrUrl || "4242";
  const baseUrl = maybeBaseUrl || "http://localhost:3417";
  const setupPassphrase = process.env.SETUP_PASSPHRASE;
  if (!setupPassphrase) {
    console.error(
      "SETUP_PASSPHRASE not set - run with: node --env-file=.env.local scripts/qa/fixture.mjs ..."
    );
    process.exit(1);
  }

  const { chromium } = await import("playwright");
  const NAMES = [
    "Abhi", "Deepak", "Rohit", "Sanjay", "Neha", "Priya",
    "Karan", "Vikas", "Anita", "Suresh", "Meena", "Rahul",
  ];

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`${baseUrl}/new`);
  await page.fill('input[type="password"]', setupPassphrase);
  await page.locator('input[type="text"]').first().fill(name);
  const nums = page.locator('input[type="number"]');
  await nums.nth(0).fill("20000");
  await nums.nth(1).fill("6");
  await nums.nth(2).fill("2");
  await nums.nth(3).fill("1000");
  const pins = page.locator('input[inputMode="numeric"][type="password"]');
  await pins.nth(0).fill(pin);
  await pins.nth(1).fill(pin);
  const memberInputs = page.locator('input[placeholder^="Member"]');
  const count = await memberInputs.count();
  for (let i = 0; i < count; i++) {
    await memberInputs
      .nth(i)
      .fill(NAMES[i % NAMES.length] + (i >= NAMES.length ? ` ${i}` : ""));
  }
  await page.click('button[type="submit"]');
  await page.waitForSelector("text=Ledger opened", { timeout: 15000 });

  const adminUrl = (await page.locator("code").nth(0).innerText()).trim();
  const memberUrl = (await page.locator("code").nth(1).innerText()).trim();
  const adminToken = adminUrl.split("/admin/")[1];
  const memberToken = memberUrl.split("/c/")[1];

  await browser.close();
  console.log(
    JSON.stringify(
      { name, adminUrl, memberUrl, adminToken, memberToken, pin },
      null,
      2
    )
  );
  process.exit(0);
}

console.error(`Unknown command "${cmd}" - use "create" or "delete".`);
process.exit(2);
