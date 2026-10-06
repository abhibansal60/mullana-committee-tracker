# UX review: admin and member dashboards

Reviewed on 2026-10-06, before the first real committee day. Screenshots come
from a throwaway local committee (12 members, months 1-3 recorded, some payments,
7 of 12 joined with Google) captured by `scripts/qa/ux-shots.mjs` at 390px
(phone) and 1280px (desktop). Before shots: `docs/ux/before/`. After shots:
`docs/ux/after/`.

Page heights at 390px, in phone screens (844px):

| Page | Before |
| --- | --- |
| Admin dashboard (mid-season) | 2.8 |
| Admin dashboard (fresh committee) | 2.3 |
| Players | 2.8 |
| Month (payments) | 2.2 |
| Live host console, lobby | 1.7 |
| Member passbook | 1.5 |

## Who uses what, on committee day

**Shubham (holder), on a phone.** In the first screen he needs:

1. Who has joined the app, and the names of who hasn't, with one tap to send
   the link again on WhatsApp.
2. The next action: open the auction room (or go back into it), and before
   that, record the holder's reserved month if it is still open.
3. Money still to collect, per month, with a way straight into that month.

**A member, on a phone from a WhatsApp link.** In the first screen they need:

1. What they owe right now (or "all paid").
2. Their status: still in the race, or already won.
3. A way into the auction room when it is open.

## Findings

### Admin dashboard (`admin-dashboard-phone.png`)

- **Too long, and the order doesn't match the day.** The page stacks: committee
  day card, pot card, a 12-row members list, a 12-row monthly log, profit and
  loss (running total plus a row per month), and the practice card. On a phone
  that is 2.8 screens, and it grows with each month.
- **Joined status is missing.** "7/12 joined" and the not-joined names live
  only on Players, two taps away. That is the main question before the room
  opens.
- **Money to collect is buried.** It shows only as a small "1/12" at the right
  of each month row, with no rupee amount and no total.
- **The members list repeats information.** "Won month 2" is already in the
  monthly log, and names are managed on Players.
- **The monthly log shows every future month** with a "Record auction" stamp.
  Nine identical rows push the useful content down, and they invite recording a
  result by hand on a day when the live room should record it.
- **Reserved month 1 is easy to miss.** On a fresh committee, the card says
  "Ready for Month 2?" while month 1 (holder's month) still needs recording.
  The only hint is one stamp in the log.
- **Profit and loss is permanently expanded.** It is useful, but it isn't a
  committee-day task.
- **Navigation is small text links in the header** (Live, Players, Settings,
  Log out), about 20px tall, with "Log out" next to them and the same weight.
  No item shows the current page.

### Players (`admin-players-phone.png`)

- Every member is a full card with an always-visible name input and phone input:
  2.8 screens for 12 people.
- Joined and not-joined people are mixed alphabetically, so "who's missing"
  needs a scan of every row.
- "Reset" (a destructive action) sits on every joined row at the same weight as
  Save.

### Month payments (`admin-month-phone.png`)

- Every member row shows an amount input, a mode select and an Add button, even
  for people who have paid. 2.2 screens of near-identical forms, under time
  pressure.
- There is no total: how much is collected, and how much is still out.
- Paid and unpaid people are mixed alphabetically.

### Live host console (`admin-live-lobby-phone.png`, `practice-live-phone.png`)

- **Host controls are at the bottom.** In the lobby, "Start bidding" is 1.2
  screens down, under the roster, the lobby grid and the rules. With no room
  open in practice, the practice card sits between "No room open" and the
  "Open the auction room" button.
- The live stage itself works well, and members see the same stage. That part
  doesn't change.

### Settings (`admin-settings-phone.png`)

- Fine for a page used once. Small fixes only: the checkbox is 16px, and there
  is no log-out on the page.

### Member passbook (`member-passbook-phone.png`)

- The hero (greeting plus season track) is good and on-brand.
- **What I owe comes second, and the headline is the wrong number.** The big
  figure is the month's contribution (₹9,125); the amount still owed (₹241) is
  a small figure lower down.
- "Winners so far" and "My passbook" will each grow to 12 rows.
- When the room is open, the live banner is at the top. That works.

### Practice room

- The admin practice banner wraps to three lines on a phone, with two buttons
  of different heights.
- Exit and Reset work, and stay where they are.

### Cross-cutting

- Several touch targets are under 44px: header links, "Copy link" and "Share
  on WhatsApp" as underlined text in host controls, the payment "Remove" link,
  and checkboxes.
- Typography and colour are consistent and good (passbook paper, cloth green,
  brass, stamp red, dark arena). The problem is hierarchy and density, not the
  brand.

## Changes

1. **Admin shell.** A slim header (committee name, log out). On phones, a
   sticky bottom nav (Home, Players, Live, Settings) with 56px targets and an
   active state. On desktop, the same four items as tabs in the header.
2. **Admin dashboard, ordered for the day.**
   - Next action first: the live room card (open, or go back in).
   - A to-do list under it, only when there is something to do: record the
     reserved month, and collect payments (month, rupees outstanding, unpaid
     count).
   - A joined card: "7 of 12 joined", a progress bar, the not-joined names, and
     a one-tap WhatsApp share. It shrinks to one line when everyone has joined.
   - Months: recorded months and the next one. Later months fold into one
     "Months 5-12" row.
   - Pot, profit and loss, and the practice room move into compact, collapsed
     sections at the bottom.
   - The members list goes. Players covers it, and the season list shows
     winners.
3. **Players.** Not-joined people first, under their own heading. Compact rows
   (avatar, name, status). Rename, phone number and Reset sit behind an Edit
   button on each row.
4. **Month payments.** A summary (collected out of total, a progress bar,
   unpaid count). Two groups: "To collect" and "Paid". Unpaid rows show a
   "Collect ₹x" button that opens the existing amount, mode and Add form. Paid
   rows are one line, with Remove still there. Bulk "mark selected paid" stays.
5. **Host console.** Host controls go straight under the stage (or the lobby
   header), so the next button is on the first screen. The practice card moves
   below the host controls.
6. **Member passbook.** A dues card first: "You owe ₹x" or "All paid", with
   this month's contribution under it. Then the hero and season track. "My
   passbook" folds into a collapsed section.
7. **Touch targets** of at least 44px on everything changed above.

Out of scope on purpose: money logic, auth, routes, cookies, link formats, the
member live room stage, and the `/c/[memberToken]` read-only pages.
