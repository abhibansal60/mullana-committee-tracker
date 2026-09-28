CREATE TYPE "public"."auction_status" AS ENUM('lobby', 'live', 'paused', 'closed', 'finalized', 'cancelled');--> statement-breakpoint
CREATE TABLE "auction_bids" (
	"id" uuid PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auction_reactions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"member_id" uuid,
	"emoji" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auction_sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"committee_id" uuid NOT NULL,
	"month_id" uuid NOT NULL,
	"status" "auction_status" DEFAULT 'lobby' NOT NULL,
	"opening_bid" integer NOT NULL,
	"bid_increment" integer NOT NULL,
	"round_seconds" integer NOT NULL,
	"current_bid" integer,
	"leader_member_id" uuid,
	"runner_up_member_id" uuid,
	"bid_count" integer DEFAULT 0 NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"starts_at" timestamp with time zone,
	"round_ends_at" timestamp with time zone,
	"paused_remaining_ms" integer,
	"host_last_seen_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "live_settings" (
	"committee_id" uuid PRIMARY KEY NOT NULL,
	"opening_bid" integer NOT NULL,
	"bid_increment" integer NOT NULL,
	"round_seconds" integer NOT NULL,
	"allow_phone_login" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member_profiles" (
	"member_id" uuid PRIMARY KEY NOT NULL,
	"committee_id" uuid NOT NULL,
	"phone" text,
	"login_token_hash" text,
	"session_epoch" integer DEFAULT 0 NOT NULL,
	"last_seen_at" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auction_bids" ADD CONSTRAINT "auction_bids_session_id_auction_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."auction_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auction_bids" ADD CONSTRAINT "auction_bids_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auction_reactions" ADD CONSTRAINT "auction_reactions_session_id_auction_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."auction_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auction_reactions" ADD CONSTRAINT "auction_reactions_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auction_sessions" ADD CONSTRAINT "auction_sessions_committee_id_committees_id_fk" FOREIGN KEY ("committee_id") REFERENCES "public"."committees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auction_sessions" ADD CONSTRAINT "auction_sessions_month_id_months_id_fk" FOREIGN KEY ("month_id") REFERENCES "public"."months"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auction_sessions" ADD CONSTRAINT "auction_sessions_leader_member_id_members_id_fk" FOREIGN KEY ("leader_member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auction_sessions" ADD CONSTRAINT "auction_sessions_runner_up_member_id_members_id_fk" FOREIGN KEY ("runner_up_member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_settings" ADD CONSTRAINT "live_settings_committee_id_committees_id_fk" FOREIGN KEY ("committee_id") REFERENCES "public"."committees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_profiles" ADD CONSTRAINT "member_profiles_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_profiles" ADD CONSTRAINT "member_profiles_committee_id_committees_id_fk" FOREIGN KEY ("committee_id") REFERENCES "public"."committees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "auction_bids_session_idx" ON "auction_bids" USING btree ("session_id","created_at");--> statement-breakpoint
CREATE INDEX "auction_reactions_session_idx" ON "auction_reactions" USING btree ("session_id","created_at");--> statement-breakpoint
CREATE INDEX "auction_sessions_committee_idx" ON "auction_sessions" USING btree ("committee_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "auction_sessions_one_open_idx" ON "auction_sessions" USING btree ("committee_id") WHERE "auction_sessions"."status" in ('lobby', 'live', 'paused', 'closed');--> statement-breakpoint
CREATE UNIQUE INDEX "member_profiles_login_token_idx" ON "member_profiles" USING btree ("login_token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "member_profiles_committee_phone_idx" ON "member_profiles" USING btree ("committee_id","phone");