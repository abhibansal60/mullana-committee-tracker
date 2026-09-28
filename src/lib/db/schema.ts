import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

export const paymentModeEnum = pgEnum("payment_mode", ["cash", "upi"]);

export const committees = pgTable(
  "committees",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text("name").notNull(),
    memberCount: integer("member_count").notNull(),
    monthlyContribution: integer("monthly_contribution").notNull(), // rupees
    durationMonths: integer("duration_months").notNull(),
    reservedMonthNumber: integer("reserved_month_number").notNull(),
    runnerUpBonus: integer("runner_up_bonus").notNull().default(1000), // rupees
    showProfitLoss: boolean("show_profit_loss").notNull().default(true),
    adminTokenHash: text("admin_token_hash").notNull(),
    memberTokenHash: text("member_token_hash").notNull(),
    adminPinHash: text("admin_pin_hash").notNull(),
    pinFailedAttempts: integer("pin_failed_attempts").notNull().default(0),
    pinLockedUntil: timestamp("pin_locked_until", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("committees_admin_token_hash_idx").on(t.adminTokenHash),
    uniqueIndex("committees_member_token_hash_idx").on(t.memberTokenHash),
  ]
);

export const members = pgTable(
  "members",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    committeeId: uuid("committee_id")
      .notNull()
      .references(() => committees.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    isHolder: boolean("is_holder").notNull().default(false),
    sortOrder: integer("sort_order").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("members_committee_idx").on(t.committeeId),
    // At most one holder per committee.
    uniqueIndex("members_one_holder_idx")
      .on(t.committeeId)
      .where(sql`${t.isHolder} = true`),
  ]
);

export const months = pgTable(
  "months",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    committeeId: uuid("committee_id")
      .notNull()
      .references(() => committees.id, { onDelete: "cascade" }),
    monthNumber: integer("month_number").notNull(), // 1..durationMonths
    winnerMemberId: uuid("winner_member_id").references(() => members.id),
    winningBid: integer("winning_bid"), // null until recorded; unused for reserved month
    runnerUpMemberId: uuid("runner_up_member_id").references(() => members.id),
    auctionRecordedAt: timestamp("auction_recorded_at", {
      withTimezone: true,
    }), // null = step 1 not done yet
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("months_committee_month_idx").on(t.committeeId, t.monthNumber),
  ]
);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    monthId: uuid("month_id")
      .notNull()
      .references(() => months.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    amount: integer("amount").notNull(), // rupees, > 0
    mode: paymentModeEnum("mode").notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("payments_month_member_idx").on(t.monthId, t.memberId)]
);

// --- Live auction ("Committee Day") ---------------------------------------
//
// Everything the live auction room needs lives in its own tables, so the
// existing committees/members/months/payments queries never select a column
// that might not exist yet on a database that hasn't been migrated.

/** Per-member login identity: WhatsApp number + a personal magic-link token. */
export const memberProfiles = pgTable(
  "member_profiles",
  {
    memberId: uuid("member_id")
      .primaryKey()
      .references(() => members.id, { onDelete: "cascade" }),
    committeeId: uuid("committee_id")
      .notNull()
      .references(() => committees.id, { onDelete: "cascade" }),
    phone: text("phone"), // normalized 10-digit Indian mobile number
    loginTokenHash: text("login_token_hash"),
    // Bumped whenever the holder resets this member's access - every login
    // cookie carries the epoch it was issued under, so old ones stop working.
    sessionEpoch: integer("session_epoch").notNull().default(0),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("member_profiles_login_token_idx").on(t.loginTokenHash),
    uniqueIndex("member_profiles_committee_phone_idx").on(t.committeeId, t.phone),
  ]
);

/**
 * A member's linked Google account, matched on Google's stable `sub` (never
 * the email). Its own table, like the rest of the live-room data, so nothing
 * breaks on a database that doesn't have it yet.
 */
export const memberGoogleAccounts = pgTable(
  "member_google_accounts",
  {
    memberId: uuid("member_id")
      .primaryKey()
      .references(() => members.id, { onDelete: "cascade" }),
    committeeId: uuid("committee_id")
      .notNull()
      .references(() => committees.id, { onDelete: "cascade" }),
    googleSub: text("google_sub").notNull(),
    email: text("email"), // shown to the holder only; never used to log in
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("member_google_accounts_committee_sub_idx").on(t.committeeId, t.googleSub),
    index("member_google_accounts_sub_idx").on(t.googleSub),
  ]
);

/** Holder-controlled defaults for the live auction room. */
export const liveSettings = pgTable("live_settings", {
  committeeId: uuid("committee_id")
    .primaryKey()
    .references(() => committees.id, { onDelete: "cascade" }),
  openingBid: integer("opening_bid").notNull(), // rupees, multiple of 500
  bidIncrement: integer("bid_increment").notNull(), // rupees, multiple of 500
  roundSeconds: integer("round_seconds").notNull(), // countdown after each bid
  allowPhoneLogin: boolean("allow_phone_login").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const auctionStatusEnum = pgEnum("auction_status", [
  "lobby", // room open, people joining, no bidding yet
  "live", // bidding open
  "paused", // holder froze the clock
  "closed", // hammer down - waiting for the holder to confirm
  "finalized", // result written to the month
  "cancelled",
]);

export const auctionSessions = pgTable(
  "auction_sessions",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    committeeId: uuid("committee_id")
      .notNull()
      .references(() => committees.id, { onDelete: "cascade" }),
    monthId: uuid("month_id")
      .notNull()
      .references(() => months.id, { onDelete: "cascade" }),
    status: auctionStatusEnum("status").notNull().default("lobby"),
    openingBid: integer("opening_bid").notNull(),
    bidIncrement: integer("bid_increment").notNull(),
    roundSeconds: integer("round_seconds").notNull(),
    currentBid: integer("current_bid"),
    leaderMemberId: uuid("leader_member_id").references(() => members.id),
    runnerUpMemberId: uuid("runner_up_member_id").references(() => members.id),
    bidCount: integer("bid_count").notNull().default(0),
    version: integer("version").notNull().default(0),
    startsAt: timestamp("starts_at", { withTimezone: true }), // end of the 3-2-1
    roundEndsAt: timestamp("round_ends_at", { withTimezone: true }),
    pausedRemainingMs: integer("paused_remaining_ms"),
    hostLastSeenAt: timestamp("host_last_seen_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("auction_sessions_committee_idx").on(t.committeeId, t.createdAt),
    // At most one open room per committee.
    uniqueIndex("auction_sessions_one_open_idx")
      .on(t.committeeId)
      .where(sql`${t.status} in ('lobby', 'live', 'paused', 'closed')`),
  ]
);

export const auctionBids = pgTable(
  "auction_bids",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => auctionSessions.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    amount: integer("amount").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("auction_bids_session_idx").on(t.sessionId, t.createdAt)]
);

export const auctionReactions = pgTable(
  "auction_reactions",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => auctionSessions.id, { onDelete: "cascade" }),
    memberId: uuid("member_id").references(() => members.id, {
      onDelete: "cascade",
    }), // null = the holder
    emoji: text("emoji").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("auction_reactions_session_idx").on(t.sessionId, t.createdAt)]
);

export const committeesRelations = relations(committees, ({ many }) => ({
  members: many(members),
  months: many(months),
}));

export const membersRelations = relations(members, ({ one, many }) => ({
  committee: one(committees, {
    fields: [members.committeeId],
    references: [committees.id],
  }),
  payments: many(payments),
}));

export const monthsRelations = relations(months, ({ one, many }) => ({
  committee: one(committees, {
    fields: [months.committeeId],
    references: [committees.id],
  }),
  winner: one(members, {
    fields: [months.winnerMemberId],
    references: [members.id],
  }),
  runnerUp: one(members, {
    fields: [months.runnerUpMemberId],
    references: [members.id],
  }),
  payments: many(payments),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  month: one(months, { fields: [payments.monthId], references: [months.id] }),
  member: one(members, {
    fields: [payments.memberId],
    references: [members.id],
  }),
}));
