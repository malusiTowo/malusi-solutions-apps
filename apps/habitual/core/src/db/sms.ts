import type { DbError } from "@repo/db";
import { desc, eq, lt, sql } from "@repo/db/orm";
import type { Effect } from "effect";
import { type Database, query } from "./client";
import { type NewSmsMessageRow, type SmsMessageRow, smsMessages } from "./schema";

/**
 * The message log.
 *
 * Two writers race for every row: the send path (which learns the message id from
 * the HTTP response) and the webhook path (which can deliver `message.queued`
 * before that response has even been read). They are written as *complementary*
 * upserts on the unique `message_id` — the send path owns the metadata columns,
 * the webhook path owns status — so they commute and neither clobbers the other.
 */

/**
 * Send-path write. Never touches `status`/`status_rank`, so a delivery webhook
 * that arrived first keeps its progress.
 */
export const recordSend = (
  rows: ReadonlyArray<NewSmsMessageRow>,
): Effect.Effect<void, DbError, Database> =>
  query("sms.recordSend", async ({ db }) => {
    if (rows.length === 0) return;
    await db
      .insert(smsMessages)
      .values([...rows])
      .onConflictDoUpdate({
        target: smsMessages.messageId,
        set: {
          userId: sql`excluded.user_id`,
          toNumber: sql`excluded.to_number`,
          channel: sql`coalesce(excluded.channel, ${smsMessages.channel})`,
          body: sql`coalesce(excluded.body, ${smsMessages.body})`,
          templateId: sql`excluded.template_id`,
          templateName: sql`excluded.template_name`,
          idempotencyKey: sql`excluded.idempotency_key`,
          updatedAt: sql`now()`,
        },
      });
  });

export interface SmsStatusUpdate extends NewSmsMessageRow {
  readonly statusRank: number;
}

/**
 * Webhook-path write. Idempotent (a redelivered event is a no-op) and
 * order-independent: the `setWhere` guard means a `sent` event arriving after
 * `delivered` changes nothing, because its rank is lower.
 */
export const applyStatusEvent = (row: SmsStatusUpdate): Effect.Effect<void, DbError, Database> =>
  query("sms.applyStatusEvent", async ({ db }) => {
    await db
      .insert(smsMessages)
      .values(row)
      .onConflictDoUpdate({
        target: smsMessages.messageId,
        set: {
          status: sql`excluded.status`,
          statusRank: sql`excluded.status_rank`,
          channel: sql`coalesce(excluded.channel, ${smsMessages.channel})`,
          fromNumber: sql`coalesce(excluded.from_number, ${smsMessages.fromNumber})`,
          errorCode: sql`coalesce(excluded.error_code, ${smsMessages.errorCode})`,
          errorMessage: sql`coalesce(excluded.error_message, ${smsMessages.errorMessage})`,
          lastEventAt: sql`excluded.last_event_at`,
          updatedAt: sql`now()`,
        },
        setWhere: lt(smsMessages.statusRank, sql`excluded.status_rank`),
      });
  });

export const getSmsMessage = (
  messageId: string,
): Effect.Effect<SmsMessageRow | undefined, DbError, Database> =>
  query("sms.get", async ({ read }) => {
    const rows = await read
      .select()
      .from(smsMessages)
      .where(eq(smsMessages.messageId, messageId))
      .limit(1);
    return rows[0];
  });

export const listSmsMessages = (
  userId: string,
  limit = 50,
): Effect.Effect<ReadonlyArray<SmsMessageRow>, DbError, Database> =>
  query("sms.list", ({ read }) =>
    read
      .select()
      .from(smsMessages)
      .where(eq(smsMessages.userId, userId))
      .orderBy(desc(smsMessages.createdAt))
      .limit(limit),
  );
