#!/usr/bin/env node
// End-to-end check of the live auction room against a running dev server
// and a LOCAL database (never production - it creates a committee named
// "Live E2E <timestamp>"). Covers logins, invites, lobby, the 3-2-1, a
// five-way simultaneous opening-bid race, pause/undo, the fuse running out,
// finalizing (dues checked against the formula) and access revocation.
//
//   npm run dev -- -p 3417
//   SETUP_PASSPHRASE=... node scripts/qa/live-e2e.mjs
import fs from "node:fs";
const B = process.env.BASE_URL || "http://localhost:3417";
if (!/localhost|127\.0\.0\.1/.test(B)) { console.error("Refusing to run against a non-local server"); process.exit(1); }
const NAMES = ["Shubham","Abhi","Deepak","Rohit","Sanjay","Neha","Priya","Karan","Vikas","Anita","Suresh","Rahul"];
const created = await (await fetch(B + "/api/committees", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ setupPassphrase: process.env.SETUP_PASSPHRASE, name: `Live E2E ${Date.now()}`, monthlyContribution: 10000, durationMonths: 12, reservedMonthNumber: 1, runnerUpBonus: 1000, adminPin: "4242", memberNames: NAMES, holderIndex: 0 }) })).json();
if (!created.adminToken) { console.error("Couldn't create committee", created); process.exit(1); }
const AT = created.adminToken;
const authRes = await fetch(`${B}/api/committees/${AT}/auth`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pin: "4242" }) });
const adminCookie = authRes.headers.get("set-cookie").split(";")[0];
const phoneBase = 6000000000 + Math.floor(Math.random() * 3000000000);

async function j(method, path, body, cookie) {
  const res = await fetch(B + path, { method, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined, redirect: "manual" });
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = text.slice(0, 200); }
  return { status: res.status, data, setCookie: res.headers.get("set-cookie") };
}
const admin = (m, p, b) => j(m, `/api/committees/${AT}${p}`, b, adminCookie);
const assert = (c, msg) => { if (!c) { console.error("FAIL:", msg); process.exit(1); } else console.log("ok -", msg); };

const st = await admin("GET", "/live");
assert(st.status === 200 && st.data.session === null, "host state, no session");
const players = st.data.players;
const phones = {};
let n = phoneBase;
for (const p of players) { phones[p.name] = String(n++); const r = await admin("POST", "/players", { action: "phone", memberId: p.id, phone: phones[p.name] }); assert(r.status === 200, `phone for ${p.name}`); }
// duplicate phone rejected
const dup = await admin("POST", "/players", { action: "phone", memberId: players[1].id, phone: phones[players[2].name] });
assert(dup.status === 400, "duplicate phone rejected: " + dup.data.error);
await admin("POST", "/players", { action: "phone", memberId: players[1].id, phone: phones[players[1].name] });

// Phone login is off by default
const offBy = await j("POST", "/api/login", { phone: "+91 " + phones[players[0].name] });
assert(offBy.status === 404, "phone login off by default: " + offBy.data.error);
let r = await admin("PUT", "/live/settings", { openingBid: 10000, bidIncrement: 500, roundSeconds: 10, allowPhoneLogin: true });
assert(r.status === 200, "phone login switched on for this test");

// Logins
const cookies = {};
for (const p of players) {
  const r = await j("POST", "/api/login", { phone: "+91 " + phones[p.name] });
  assert(r.status === 200 && r.setCookie, `login ${p.name}`);
  cookies[p.name] = r.setCookie.split(";")[0];
}
const bad = await j("POST", "/api/login", { phone: "9000000000" });
assert(bad.status === 404, "unknown phone 404");

// Rename
r = await admin("POST", "/players", { action: "rename", memberId: players[3].id, name: "Rohit K" });
assert(r.status === 200 && r.data.name === "Rohit K", "rename member");
r = await admin("POST", "/players", { action: "rename", memberId: players[3].id, name: "abhi" });
assert(r.status === 400, "duplicate name rejected: " + r.data.error);
await admin("POST", "/players", { action: "rename", memberId: players[3].id, name: "Rohit" });

// Shared join link
const playersHtml = await (await fetch(`${B}/admin/${AT}/players`, { headers: { cookie: adminCookie } })).text();
const code = playersHtml.match(/joinCode\\":\\"([^"\\]+)/)?.[1];
assert(code, "join code on the players page");
const joinRes = await fetch(`${B}/join/${code}`, { redirect: "manual" });
const joinHtml = await joinRes.text();
assert(joinRes.status === 200 && !joinHtml.includes("isn&#x27;t valid"), "join page renders for a genuine code");
const junk = await (await fetch(`${B}/join/${code.slice(0, -1)}x`)).text();
assert(junk.includes("t valid"), "tampered join code rejected");
r = await j("POST", "/api/join", { code, memberId: players[3].id });
assert(r.status === 401, "claiming a name needs Google sign-in: " + r.data.error);

const play = (name, m, p, b) => j(m, p, b, cookies[name]);

// No room: bid fails
r = await play("Abhi", "POST", "/api/play/bid", { expectedBid: null, amount: 10000 });
assert(r.status === 404, "bid with no room: " + r.data.error);

// Save settings, open lobby
r = await admin("PUT", "/live/settings", { openingBid: 10250, bidIncrement: 500, roundSeconds: 10, allowPhoneLogin: true });
assert(r.status === 400, "bad settings rejected: " + r.data.error);

const month2 = (await admin("GET", "/live")).data; // need month id: use dashboard? get via open with bad id first
// find auctionable month id through the host page? Use the DB-less approach: try open with reserved month id unknown -> fetch months via ledger API isn't exposed; read from HTML
const html = await (await fetch(`${B}/admin/${AT}/live`, { headers: { cookie: adminCookie } })).text();
const monthIds = [...html.matchAll(/\\"id\\":\\"([0-9a-f-]{36})\\",\\"monthNumber\\":(\d+)/g)].map(m => ({ id: m[1], n: +m[2] }));
assert(monthIds.length === 11, "11 auctionable months found in host page: " + monthIds.length);
r = await admin("POST", "/live", { action: "open", monthId: monthIds[0].id });
assert(r.status === 200 && r.data.state.session.status === "lobby", "lobby open for month " + r.data.state.session.monthNumber);
r = await admin("POST", "/live", { action: "open", monthId: monthIds[1].id });
assert(r.status === 400, "second room rejected: " + r.data.error);

// Presence
await play("Abhi", "GET", "/api/play/state");
await play("Deepak", "GET", "/api/play/state");
r = await play("Rohit", "GET", "/api/play/state");
assert(r.data.players.filter(p => p.online).length === 3, "3 online");
assert(r.data.me.eligible === true, "Rohit eligible");
const holderState = await play("Shubham", "GET", "/api/play/state");
assert(holderState.data.me.eligible === false, "holder not eligible");

r = await play("Abhi", "POST", "/api/play/bid", { expectedBid: null, amount: 10000 });
assert(r.status === 400, "bid in lobby rejected: " + r.data.error);

// Reactions
r = await play("Neha", "POST", "/api/play/react", { emoji: "🔥" });
assert(r.status === 200, "reaction");
r = await play("Neha", "POST", "/api/play/react", { emoji: "💩" });
assert(r.status === 400, "bad emoji rejected");

// Start
r = await admin("POST", "/live", { action: "start" });
assert(r.data.state.session.status === "live" && r.data.state.session.startsAt > Date.now(), "started with countdown");
r = await play("Abhi", "POST", "/api/play/bid", { expectedBid: null, amount: 10000 });
assert(r.status === 400, "bid during countdown rejected: " + r.data.error);
await new Promise(res => setTimeout(res, 3700));

// Race: 5 people bid opening simultaneously
const racers = ["Abhi", "Deepak", "Rohit", "Sanjay", "Neha"];
const results = await Promise.all(racers.map(n => play(n, "POST", "/api/play/bid", { expectedBid: null, amount: 10000 })));
const winners = results.filter(x => x.status === 200);
assert(winners.length === 1, "exactly one racer won the opening bid; others: " + results.filter(x => x.status !== 200).map(x => x.status + " " + x.data.error).join(" | "));
let s = results[0].data.state.session;
assert(s.currentBid === 10000 && s.bidCount === 1, "state after race");
const leader = racers[results.findIndex(x => x.status === 200)];
r = await play(leader, "POST", "/api/play/bid", { expectedBid: 10000, amount: 10500 });
assert(r.status === 400, "leader can't outbid self: " + r.data.error);
const other = racers.find(n => n !== leader);
r = await play(other, "POST", "/api/play/bid", { expectedBid: 10000, amount: 10250 });
assert(r.status === 400, "non-step rejected: " + r.data.error);
r = await play(other, "POST", "/api/play/bid", { expectedBid: 10000, amount: 12000 });
assert(r.status === 200 && r.data.state.session.leaderId && r.data.state.session.currentBid === 12000, "jump bid by " + other);
assert(r.data.state.session.runnerUpId === players.find(p => p.name === leader).id, "runner-up is previous leader");
r = await play("Shubham", "POST", "/api/play/bid", { expectedBid: 12000, amount: 12500 });
assert(r.status === 403, "holder can't bid: " + r.data.error);
r = await play("Karan", "POST", "/api/play/bid", { expectedBid: 11000, amount: 12500 });
assert(r.status === 409, "stale expected -> 409: " + r.data.error);
r = await play("Karan", "POST", "/api/play/bid", { expectedBid: 12000, amount: 12500 });
assert(r.status === 200, "Karan bids 12500");

// Pause/resume/extend
r = await admin("POST", "/live", { action: "pause" });
assert(r.data.state.session.status === "paused" && r.data.state.session.pausedRemainingMs > 0, "paused");
r = await play("Rahul", "POST", "/api/play/bid", { expectedBid: 12500, amount: 13000 });
assert(r.status === 400, "bid while paused: " + r.data.error);
r = await admin("POST", "/live", { action: "extend" });
r = await admin("POST", "/live", { action: "resume" });
assert(r.data.state.session.status === "live", "resumed");
r = await play("Rahul", "POST", "/api/play/bid", { expectedBid: 12500, amount: 13000 });
assert(r.status === 200, "Rahul bids 13000");
r = await admin("POST", "/live", { action: "undo" });
assert(r.data.state.session.currentBid === 12500 && r.data.state.session.leaderId === players.find(p => p.name === "Karan").id, "undo restores Karan @12500");
r = await play("Rahul", "POST", "/api/play/bid", { expectedBid: 12500, amount: 13000 });
assert(r.status === 200, "Rahul re-bids 13000");

// Let the fuse burn (10s)
console.log("waiting for fuse…");
await new Promise(res => setTimeout(res, 10500));
r = await play("Abhi", "POST", "/api/play/bid", { expectedBid: 13000, amount: 13500 });
assert(r.status === 400 && r.data.state.session.status === "closed", "after fuse: closed, bid rejected: " + r.data.error);
r = await admin("POST", "/live", { action: "finalize" });
assert(r.status === 200 && r.data.state.session.status === "finalized", "finalized");
r = await play("Neha", "GET", "/api/play/state");
console.log("Neha due:", r.data.me.dueThisMonth, "winner takes home", r.data.session.takesHome);
assert(r.data.me.dueThisMonth === 10000 - Math.floor((13000 - 1000) / 12), "Neha due correct");
r = await play("Rahul", "GET", "/api/play/state");
assert(r.data.me.dueThisMonth === 10000 - 1000, "Rahul (winner) due correct: " + r.data.me.dueThisMonth);

// Next month: Rahul no longer eligible
r = await admin("POST", "/live", { action: "open", monthId: monthIds[1].id });
assert(r.status === 200, "opened month 3 after finalize");
r = await play("Rahul", "GET", "/api/play/state");
assert(r.data.me.eligible === false && r.data.players.find(p => p.name === "Rahul").wonMonth === 2, "Rahul now watching; won month 2");
// single-bid auction requires runner-up pick
await admin("POST", "/live", { action: "start" });
await new Promise(res => setTimeout(res, 3700));
r = await play("Abhi", "POST", "/api/play/bid", { expectedBid: null, amount: 10000 });
assert(r.status === 200, "Abhi only bid");
r = await admin("POST", "/live", { action: "hammer" });
assert(r.data.state.session.status === "closed", "hammer");
r = await admin("POST", "/live", { action: "finalize" });
assert(r.status === 400, "finalize without runner-up rejected: " + r.data.error);
r = await admin("POST", "/live", { action: "finalize", runnerUpMemberId: players.find(p => p.name === "Neha").id });
assert(r.status === 200, "finalized with picked runner-up");
// Host bids for members who aren't in the room
r = await admin("POST", "/live", { action: "open", monthId: monthIds[2].id });
assert(r.status === 200, "opened month 4");
await admin("POST", "/live", { action: "start" });
await new Promise(res => setTimeout(res, 3700));
const idOf = (n) => players.find(p => p.name === n).id;
r = await admin("POST", "/live", { action: "bid", memberId: idOf("Karan"), expectedBid: null, amount: 10000 });
assert(r.status === 200 && r.data.state.session.leaderId === idOf("Karan"), "host bids for Karan");
r = await admin("POST", "/live", { action: "bid", memberId: idOf("Karan"), expectedBid: 10000, amount: 10500 });
assert(r.status === 400, "host can't outbid the member's own bid: " + r.data.error);
r = await admin("POST", "/live", { action: "bid", memberId: idOf("Shubham"), expectedBid: 10000, amount: 10500 });
assert(r.status === 403, "host can't bid for the holder: " + r.data.error);
r = await admin("POST", "/live", { action: "bid", memberId: idOf("Rahul"), expectedBid: 10000, amount: 10500 });
assert(r.status === 403, "host can't bid for a past winner: " + r.data.error);
r = await admin("POST", "/live", { action: "bid", memberId: idOf("Deepak"), expectedBid: 10000, amount: 10500 });
assert(r.status === 200 && r.data.state.session.runnerUpId === idOf("Karan"), "host bids for Deepak, Karan is runner-up");
r = await admin("POST", "/live", { action: "bid", memberId: idOf("Vikas"), expectedBid: 10000, amount: 11000 });
assert(r.status === 409, "stale host bid rejected: " + r.data.error);
await admin("POST", "/live", { action: "hammer" });
r = await admin("POST", "/live", { action: "finalize" });
assert(r.status === 200, "finalized host-bid auction");

// Revoke Abhi
await admin("POST", "/players", { action: "revoke", memberId: players.find(p => p.name === "Abhi").id });
r = await play("Abhi", "GET", "/api/play/state");
assert(r.status === 401, "revoked session rejected");
console.log("ALL GOOD");
