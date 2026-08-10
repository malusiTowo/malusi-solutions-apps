import { index, integer, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "@repo/db/pg";
import { SmsStatuses } from "@repo/sms";
import { HabitColors } from "../models/habit";

/**
 * Habitual's Postgres schema.
 *
 * Server-only: it pulls in `drizzle-orm/pg-core`, so nothing here may ever be
 * re-exported from `@habitual/core/models` — that subpath is bundled by Metro.
 * The dependency runs one way, `db/schema.ts -> models/habit.ts`, never back.
 */

/** Reuses the tuple the mobile app already imports, so the two can never drift. */
export const habitColor = pgEnum("habit_color", HabitColors);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Raw Clerk user id (`user_2abc…`). Clerk owns identity; this is the join key. */
    clerkId: text("clerk_id").notNull(),
    displayName: text("display_name"),
    level: integer("level").notNull().default(1),
    xp: integer("xp").notNull().default(0),
    coins: integer("coins").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex("users_clerk_id_key").on(t.clerkId)],
);

export const habits = pgTable(
  "habits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Deliberately no foreign key: a habit may be created before the `users` row
    // exists, and Clerk — not this database — is the source of truth for identity.
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    color: habitColor("color").notNull(),
    /** Days of week this habit repeats: 0 = Sunday … 6 = Saturday. */
    repeatDays: integer("repeat_days").array().notNull().default([]),
    /** Free-form local time as the client already sends it, e.g. "7:00 AM". */
    reminderAt: text("reminder_at"),
    dailyGoal: text("daily_goal"),
    streak: integer("streak").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("habits_user_id_idx").on(t.userId),
    index("habits_user_id_created_at_idx").on(t.userId, t.createdAt.desc()),
  ],
);

/** Mirrors `@repo/sms`'s status vocabulary, so the two can never disagree. */
export const smsStatus = pgEnum("sms_status", SmsStatuses);

/** Named tuple so the GraphQL enum reads the members rather than restating them. */
export const SmsDirections = ["outbound", "inbound"] as const;
export const smsDirection = pgEnum("sms_direction", SmsDirections);

export const smsMessages = pgTable(
  "sms_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /**
     * The provider's per-recipient message id. Unique, and the anchor that makes
     * the send path and the webhook path converge on one row whichever arrives
     * first.
     */
    messageId: text("message_id").notNull(),
    direction: smsDirection("direction").notNull().default("outbound"),
    /** Raw Clerk id of the sender. Null for inbound messages with no matched user. */
    userId: text("user_id"),
    toNumber: text("to_number").notNull(),
    fromNumber: text("from_number"),
    channel: text("channel"),
    status: smsStatus("status").notNull().default("queued"),
    /**
     * Monotonic guard, from `SmsStatusRank`. Delivery webhooks are not ordered,
     * so status is only advanced when the incoming rank is strictly higher.
     */
    statusRank: integer("status_rank").notNull().default(0),
    templateId: text("template_id"),
    templateName: text("template_name"),
    body: text("body"),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    idempotencyKey: text("idempotency_key"),
    lastEventAt: timestamp("last_event_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("sms_messages_message_id_key").on(t.messageId),
    index("sms_messages_user_id_created_at_idx").on(t.userId, t.createdAt.desc()),
    index("sms_messages_idempotency_key_idx").on(t.idempotencyKey),
  ],
);

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
export type HabitRow = typeof habits.$inferSelect;
export type NewHabitRow = typeof habits.$inferInsert;
export type SmsMessageRow = typeof smsMessages.$inferSelect;
export type NewSmsMessageRow = typeof smsMessages.$inferInsert;
