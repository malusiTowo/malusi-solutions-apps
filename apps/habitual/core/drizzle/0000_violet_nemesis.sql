CREATE TYPE "public"."habit_color" AS ENUM('lime', 'orange', 'purple', 'blue', 'pink');--> statement-breakpoint
CREATE TABLE "habits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"color" "habit_color" NOT NULL,
	"repeat_days" integer[] DEFAULT '{}' NOT NULL,
	"reminder_at" text,
	"daily_goal" text,
	"streak" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_id" text NOT NULL,
	"display_name" text,
	"level" integer DEFAULT 1 NOT NULL,
	"xp" integer DEFAULT 0 NOT NULL,
	"coins" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "habits_user_id_idx" ON "habits" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "habits_user_id_created_at_idx" ON "habits" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "users_clerk_id_key" ON "users" USING btree ("clerk_id");