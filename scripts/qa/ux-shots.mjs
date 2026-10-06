#!/usr/bin/env node
// Seeds throwaway committees on a LOCAL dev server + database and screenshots
// every admin, member and practice surface at phone and desktop width.
//
//   npx next dev -p 3417
//   node --env-file=.env.local scripts/qa/ux-shots.mjs seed
//   node --env-file=.env.local scripts/qa/ux-shots.mjs shoot docs/ux/before
//   node --env-file=.env.local scripts/qa/ux-shots.mjs cleanup
//
// Committees are named "UX QA …"; cleanup deletes only those (and their
// practice copies).
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const B = process.env.BASE_URL || "http://localhost:3417";
const DB = process.env.DATABASE_URL || "";
if (!/localhost|127\.0\.0\.1/.test(B) || !/@(localhost|127\.0\.0\.1)[:/]/.test(DB)) {
  console.error("Refusing: BASE_URL and DATABASE_URL must both be local");
  process.exit(1);
}
const STATE = "/tmp/ux-qa.json";
const PIN = "4242";
const NAMES = ["Shubham", "Abhi", "Deepak", "Rohit", "Sanjay", "Neha", "Priya", "Karan", "Vikas", "Anita", "Suresh", "Rahul"];
const [, , cmd, outArg] = process.argv;

async function j(method, p, body, cookie) {
  const res = await fetch(B + p, {
    method,
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text.slice(0, 200);
  }
  if (res.status >= 400) throw new Error(`${method} ${p} -> ${res.status} ${JSON.stringify(data)}`);
  return { data, setCookie: res.headers.get("set-cookie") };
}
const cookieOf = (setCookie) => setCookie.split(";")[0];

async function withDb(fn) {
  const client = new pg.Client({ connectionString: DB });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

async function createCommittee(name) {
  const { data } = await j("POST", "/api/committees", {
    setupPassphrase: process.env.SETUP_PASSPHRASE,
    name,
    monthlyContribution: 10000,
    durationMonths: 12,
    reservedMonthNumber: 1,
    runnerUpBonus: 1000,
    adminPin: PIN,
    memberNames: NAMES,
    holderIndex: 0,
  });
  const auth = await j("POST", `/api/committees/${data.adminToken}/auth`, { pin: PIN });
  const adminCookie = cookieOf(auth.setCookie);
  const ids = await withDb(async (c) => {
    const committee = (await c.query("select id from committees where name = $1", [name])).rows[0];
    const members = (await c.query("select id, name from members where committee_id = $1", [committee.id])).rows;
    const months = (await c.query("select id, month_number from months where committee_id = $1 order by month_number", [committee.id])).rows;
    return { committeeId: committee.id, member: Object.fromEntries(members.map((m) => [m.name, m.id])), month: months.map((m) => m.id) };
  });
  return { name, adminToken: data.adminToken, adminCookie, ...ids };
}

async function seed() {
  const stamp = Date.now();
  const fresh = await createCommittee(`UX QA Fresh ${stamp}`);
  const c = await createCommittee(`UX QA ${stamp}`);
  const admin = (m, p, b) => j(m, `/api/committees/${c.adminToken}${p}`, b, c.adminCookie);
  const pay = (monthIdx, name, amount, mode = "upi") =>
    j("POST", `/api/months/${c.month[monthIdx]}/payments`, { memberId: c.member[name], amount, mode }, c.adminCookie);

  // Abhi logs in by phone so the member pages can be screenshot.
  const phone = String(6000000000 + Math.floor(Math.random() * 3000000000));
  await admin("POST", "/players", { action: "phone", memberId: c.member.Abhi, phone });
  await admin("PUT", "/live/settings", { openingBid: 10000, bidIncrement: 500, roundSeconds: 20, allowPhoneLogin: true });
  const login = await j("POST", "/api/login", { phone: "+91 " + phone });
  const memberCookie = cookieOf(login.setCookie);

  // Seven people have joined with Google.
  await withDb(async (db) => {
    for (const n of ["Abhi", "Deepak", "Rohit", "Neha", "Priya", "Karan", "Anita"]) {
      await db.query(
        "insert into member_google_accounts (member_id, committee_id, google_sub, email) values ($1, $2, $3, $4)",
        [c.member[n], c.committeeId, `qa-${n}-${stamp}`, `${n.toLowerCase()}.qa@gmail.com`]
      );
    }
  });

  // Months 1-3 recorded; month 1 fully collected, 2 mostly, 3 just started.
  await j("POST", `/api/months/${c.month[0]}/auction`, { isReserved: true }, c.adminCookie);
  await j("POST", `/api/months/${c.month[1]}/auction`, { isReserved: false, winnerMemberId: c.member.Deepak, winningBid: 14000, runnerUpMemberId: c.member.Rohit }, c.adminCookie);
  await j("POST", `/api/months/${c.month[2]}/auction`, { isReserved: false, winnerMemberId: c.member.Neha, winningBid: 11500, runnerUpMemberId: c.member.Priya }, c.adminCookie);
  for (const n of NAMES) await pay(0, n, 10000, n.length % 2 ? "cash" : "upi");
  for (const n of NAMES.slice(0, 9)) await pay(1, n, 8800);
  for (const n of ["Shubham", "Abhi", "Rohit"]) await pay(2, n, 9000);

  fs.writeFileSync(STATE, JSON.stringify({ fresh, c, memberCookie }, null, 2));
  console.log("seeded", c.name, "and", fresh.name);
}

async function shoot(outDir) {
  const { fresh, c, memberCookie } = JSON.parse(fs.readFileSync(STATE, "utf8"));
  fs.mkdirSync(outDir, { recursive: true });
  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  const host = new URL(B).hostname;
  const ck = (s) => {
    const [name, ...v] = s.split("=");
    return { name, value: v.join("="), domain: host, path: "/" };
  };
  const viewports = { phone: { width: 390, height: 844 }, desktop: { width: 1280, height: 900 } };

  async function snap(label, cookies, url, { only, scheme = "light" } = {}) {
    for (const [vp, size] of Object.entries(viewports)) {
      if (only && only !== vp) continue;
      const ctx = await browser.newContext({ viewport: size, deviceScaleFactor: vp === "phone" ? 2 : 1, colorScheme: scheme, reducedMotion: "reduce" });
      await ctx.addCookies(cookies.map(ck));
      const page = await ctx.newPage();
      await page.goto(B + url, { waitUntil: "load" });
      await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
      await page.waitForTimeout(1200);
      const file = path.join(outDir, `${label}-${vp}${scheme === "dark" ? "-dark" : ""}.png`);
      await page.screenshot({ path: file, fullPage: true });
      console.log("shot", file);
      await ctx.close();
    }
  }

  const A = [c.adminCookie];
  const M = [memberCookie];
  const base = `/admin/${c.adminToken}`;
  await snap("admin-fresh-dashboard", [fresh.adminCookie], `/admin/${fresh.adminToken}`);
  await snap("admin-dashboard", A, base);
  await snap("admin-dashboard", A, base, { only: "phone", scheme: "dark" });
  await snap("admin-players", A, `${base}/players`);
  await snap("admin-settings", A, `${base}/settings`);
  await snap("admin-month", A, `${base}/months/${c.month[2]}`);
  await snap("admin-live", A, `${base}/live`);
  await snap("member-passbook", M, "/play");
  await snap("member-passbook", M, "/play", { only: "phone", scheme: "dark" });
  await snap("member-live", M, "/play/live");

  // Committee day: the room is open, people are in the lobby.
  await j("POST", `/api/committees/${c.adminToken}/live`, { action: "open", monthId: c.month[3] }, c.adminCookie);
  await j("GET", "/api/play/state", null, memberCookie);
  try {
    await snap("admin-dashboard-lobby", A, base);
    await snap("admin-live-lobby", A, `${base}/live`);
    await snap("member-passbook-lobby", M, "/play");
    await snap("member-live-lobby", M, "/play/live");
  } finally {
    await j("POST", `/api/committees/${c.adminToken}/live`, { action: "cancel" }, c.adminCookie);
  }

  // Practice room: the holder opens it from the real dashboard.
  const ctx = await browser.newContext({ viewport: viewports.phone });
  await ctx.addCookies(A.map(ck));
  const page = await ctx.newPage();
  await page.goto(`${B}${base}/practice`, { waitUntil: "load" });
  const practiceToken = new URL(page.url()).pathname.split("/")[2];
  const practiceCookies = (await ctx.cookies()).map((x) => `${x.name}=${x.value}`);
  await ctx.close();
  await snap("practice-live", practiceCookies, `/admin/${practiceToken}/live?parent=${c.adminToken}`);
  await snap("practice-dashboard", practiceCookies, `/admin/${practiceToken}`);
  await snap("admin-dashboard-with-practice", A, base, { only: "phone" });
  await j("GET", `${base}/practice?delete=1`, null, c.adminCookie).catch(() => {});

  await browser.close();
}

async function cleanup() {
  const deleted = await withDb(async (db) =>
    (await db.query("delete from committees where name like 'UX QA %' or name like 'Practice · UX QA %' returning name")).rows
  );
  console.log("deleted", deleted.map((r) => r.name));
}

if (cmd === "seed") await seed();
else if (cmd === "shoot") await shoot(outArg || "docs/ux/shots");
else if (cmd === "cleanup") await cleanup();
else {
  console.error("usage: ux-shots.mjs seed | shoot <dir> | cleanup");
  process.exit(2);
}
