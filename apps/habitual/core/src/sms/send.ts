import { type CurrentUser, requireUserId, type UnauthorizedError } from "@repo/api";
import type { DbError } from "@repo/db";
import {
  type SendResult,
  type SmsBody,
  type SmsChannel,
  type SmsError,
  SmsProvider,
  SmsStatusRank,
  templateById,
  text as textBody,
} from "@repo/sms";
import { Effect } from "effect";
import { type Database, recordSend } from "../db";
import type { NewSmsMessageRow } from "../db/schema";

/**
 * Habitual's outbound messaging. The generic brick knows how to talk to the
 * provider; this decides who may send, what gets logged, and how a fan-out maps
 * onto rows.
 */

export interface SendSmsInput {
  /** E.164 recipient. */
  readonly to: string;
  readonly body: SmsBody;
  readonly channel?: ReadonlyArray<SmsChannel>;
  readonly sandbox?: boolean;
}

/** Convenience constructors so callers do not import `@repo/sms` directly. */
export { templateById, textBody as text };

/** One row per (recipient, channel) pair the provider fanned the request out to. */
export const toSmsRows = (
  userId: string,
  idempotencyKey: string,
  result: SendResult,
): ReadonlyArray<NewSmsMessageRow> =>
  result.recipients.map((recipient) => ({
    messageId: recipient.messageId,
    direction: "outbound" as const,
    userId,
    toNumber: recipient.to,
    channel: recipient.channel,
    status: result.status,
    statusRank: SmsStatusRank[result.status],
    templateId: result.templateId,
    templateName: result.templateName,
    body: recipient.body,
    idempotencyKey,
  }));

export const sendSms = (
  input: SendSmsInput,
): Effect.Effect<
  SendResult,
  SmsError | DbError | UnauthorizedError,
  SmsProvider | Database | CurrentUser
> =>
  Effect.gen(function* () {
    const userId = yield* requireUserId;
    const provider = yield* SmsProvider;

    // A fresh key per attempt. It protects the SDK's own retries — reusing one
    // across logically different sends would replay the first response instead.
    const idempotencyKey = crypto.randomUUID();

    const result = yield* provider.send({
      to: [input.to],
      body: input.body,
      channel: input.channel,
      sandbox: input.sandbox ?? process.env["SENT_DM_SANDBOX"] === "1",
      idempotencyKey,
    });

    yield* recordSend(toSmsRows(userId, idempotencyKey, result));
    return result;
  });
