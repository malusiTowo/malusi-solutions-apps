CREATE TYPE "public"."sms_direction" AS ENUM('outbound', 'inbound');--> statement-breakpoint
CREATE TYPE "public"."sms_status" AS ENUM('queued', 'scheduled', 'routed', 'sent', 'delivered', 'read', 'received', 'filtered', 'blocked', 'failed');--> statement-breakpoint
CREATE TABLE "sms_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" text NOT NULL,
	"direction" "sms_direction" DEFAULT 'outbound' NOT NULL,
	"user_id" text,
	"to_number" text NOT NULL,
	"from_number" text,
	"channel" text,
	"status" "sms_status" DEFAULT 'queued' NOT NULL,
	"status_rank" integer DEFAULT 0 NOT NULL,
	"template_id" text,
	"template_name" text,
	"body" text,
	"error_code" text,
	"error_message" text,
	"idempotency_key" text,
	"last_event_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "sms_messages_message_id_key" ON "sms_messages" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "sms_messages_user_id_created_at_idx" ON "sms_messages" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "sms_messages_idempotency_key_idx" ON "sms_messages" USING btree ("idempotency_key");