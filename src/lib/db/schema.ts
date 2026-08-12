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
