CREATE TYPE "public"."payment_mode" AS ENUM('cash', 'upi');--> statement-breakpoint
CREATE TABLE "committees" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"member_count" integer NOT NULL,
	"monthly_contribution" integer NOT NULL,
	"duration_months" integer NOT NULL,
	"reserved_month_number" integer NOT NULL,
	"runner_up_bonus" integer DEFAULT 1000 NOT NULL,
	"show_profit_loss" boolean DEFAULT true NOT NULL,
	"admin_token_hash" text NOT NULL,
	"member_token_hash" text NOT NULL,
	"admin_pin_hash" text NOT NULL,
	"pin_failed_attempts" integer DEFAULT 0 NOT NULL,
	"pin_locked_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" uuid PRIMARY KEY NOT NULL,
	"committee_id" uuid NOT NULL,
	"name" text NOT NULL,
	"is_holder" boolean DEFAULT false NOT NULL,
	"sort_order" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "months" (
	"id" uuid PRIMARY KEY NOT NULL,
	"committee_id" uuid NOT NULL,
	"month_number" integer NOT NULL,
	"winner_member_id" uuid,
	"winning_bid" integer,
	"runner_up_member_id" uuid,
	"auction_recorded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"month_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"mode" "payment_mode" NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_committee_id_committees_id_fk" FOREIGN KEY ("committee_id") REFERENCES "public"."committees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "months" ADD CONSTRAINT "months_committee_id_committees_id_fk" FOREIGN KEY ("committee_id") REFERENCES "public"."committees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "months" ADD CONSTRAINT "months_winner_member_id_members_id_fk" FOREIGN KEY ("winner_member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "months" ADD CONSTRAINT "months_runner_up_member_id_members_id_fk" FOREIGN KEY ("runner_up_member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_month_id_months_id_fk" FOREIGN KEY ("month_id") REFERENCES "public"."months"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "committees_admin_token_hash_idx" ON "committees" USING btree ("admin_token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "committees_member_token_hash_idx" ON "committees" USING btree ("member_token_hash");--> statement-breakpoint
CREATE INDEX "members_committee_idx" ON "members" USING btree ("committee_id");--> statement-breakpoint
CREATE UNIQUE INDEX "members_one_holder_idx" ON "members" USING btree ("committee_id") WHERE "members"."is_holder" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "months_committee_month_idx" ON "months" USING btree ("committee_id","month_number");--> statement-breakpoint
CREATE INDEX "payments_month_member_idx" ON "payments" USING btree ("month_id","member_id");