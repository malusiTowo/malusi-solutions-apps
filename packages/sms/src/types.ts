import { Context, Data, type Effect } from "effect";

/**
 * Generic messaging vocabulary. Sent.dm is the default adapter (see `./providers/sent`),
 * but nothing here names it: swapping providers is a matter of supplying a different
 * `SmsProvider` layer. No product copy, template ids, or phone numbers live in this
 * package — callers pass all of that in.
 */

/**
 * `"sent"` is auto-detect with cross-channel fallback. A single concrete channel
 * pins delivery to it with no fallback; several channels broadcast, producing one
 * message per (recipient, channel) pair — each separately billed.
 *
 * A tuple rather than a bare union, like {@link SmsStatuses}: callers that need the
 * members at runtime — a GraphQL enum, a validator — read them from here instead of
 * restating the strings.
 */
export const SmsChannels = ["sent", "sms", "whatsapp", "rcs"] as const;
export type SmsChannel = (typeof SmsChannels)[number];

/** Lifecycle states, named after the provider's webhook events minus the prefix. */
export const SmsStatuses = [
  "queued",
  "scheduled",
  "routed",
  "sent",
  "delivered",
  "read",
  "received",
  "filtered",
  "blocked",
  "failed",
] as const;
export type SmsStatus = (typeof SmsStatuses)[number];

/**
 * Ordering used to reconcile out-of-order delivery webhooks. Terminal states sit
 * above every progress state so a late `sent` can never overwrite a `delivered`.
 */
export const SmsStatusRank: Record<SmsStatus, number> = {
  queued: 10,
  scheduled: 20,
  routed: 30,
  sent: 40,
  delivered: 50,
  read: 60,
  received: 70,
  filtered: 90,
  blocked: 91,
  failed: 92,
};

/**
 * A message body. Exactly one of free-form text or a template is allowed, and the
 * provider rejects a request carrying both — so this is a discriminated union
 * rather than an object with two optional fields, which would let the invalid
 * combination typecheck.
 *
 * Free-form text is only permitted inside an existing conversation (the contact
 * must have messaged in first); template sends have no such restriction.
 */
export type SmsBody =
  | { readonly _tag: "Text"; readonly text: string }
  | {
      readonly _tag: "TemplateById";
      readonly id: string;
      readonly parameters?: Readonly<Record<string, string>>;
    }
  | {
      readonly _tag: "TemplateByName";
      readonly name: string;
      readonly parameters?: Readonly<Record<string, string>>;
    };

export const text = (value: string): SmsBody => ({ _tag: "Text", text: value });

export const templateById = (
  id: string,
  parameters?: Readonly<Record<string, string>>,
): SmsBody => ({ _tag: "TemplateById", id, parameters });

export const templateByName = (
  name: string,
  parameters?: Readonly<Record<string, string>>,
): SmsBody => ({ _tag: "TemplateByName", name, parameters });

export interface SendInput {
  /** Recipients in E.164 format. The provider accepts up to 1000 per request. */
  readonly to: ReadonlyArray<string>;
  readonly body: SmsBody;
  /** Omit for auto-detect with fallback. See {@link SmsChannel}. */
  readonly channel?: ReadonlyArray<SmsChannel>;
  /** Simulate the send: accepted and echoed back, but never delivered or billed. */
  readonly sandbox?: boolean;
  /**
   * Required. Deduplicates retries provider-side for 24 hours. Must be 1–255
   * characters of `[A-Za-z0-9_-]`, and must never be reused for a different send —
   * the body is not compared on replay.
   */
  readonly idempotencyKey: string;
}

export interface SendRecipient {
  readonly messageId: string;
  readonly to: string;
  /** Null when the provider is still auto-detecting the channel. */
  readonly channel: string | null;
  /** The rendered body, when the provider resolved one. */
  readonly body: string | null;
}

export interface SendResult {
  readonly status: SmsStatus;
  readonly templateId: string | null;
  readonly templateName: string | null;
  /** One entry per (recipient, channel) pair the request fanned out to. */
  readonly recipients: ReadonlyArray<SendRecipient>;
}

export interface MessageStatus {
  readonly messageId: string;
  readonly status: SmsStatus;
  readonly channel: string | null;
  readonly to: string | null;
  readonly direction: string | null;
  readonly body: string | null;
  readonly templateId: string | null;
  readonly templateName: string | null;
}

export interface MessageActivity {
  readonly status: string;
  readonly timestamp: string;
  readonly description: string | null;
}

export interface NumberLookup {
  readonly phoneNumber: string;
  readonly isValid: boolean;
  readonly lineType: string | null;
  readonly carrierName: string | null;
  readonly countryCode: string | null;
}

/**
 * Raised by every provider operation. `reason` is the transport-independent
 * classification; `status`/`code` carry the provider's own detail for logs.
 */
export class SmsError extends Data.TaggedError("SmsError")<{
  readonly reason:
    | "invalid_request"
    | "unauthenticated"
    | "forbidden"
    | "not_found"
    | "conflict"
    | "unprocessable"
    | "rate_limited"
    | "provider"
    | "connection"
    /** Accepted with 202, then reported failed asynchronously. */
    | "delivery_failed"
    /** A response or webhook payload did not match the expected shape. */
    | "decode";
  readonly message: string;
  readonly status?: number;
  readonly code?: string;
  readonly cause?: unknown;
}> {}

/**
 * Provider adapter. The service shape *is* the adapter interface — there is no
 * registry or router here, unlike `@repo/ai`, because a product sends through one
 * provider at a time.
 */
export class SmsProvider extends Context.Tag("@repo/sms/SmsProvider")<
  SmsProvider,
  {
    readonly send: (input: SendInput) => Effect.Effect<SendResult, SmsError>;
    readonly status: (messageId: string) => Effect.Effect<MessageStatus, SmsError>;
    readonly activities: (
      messageId: string,
    ) => Effect.Effect<ReadonlyArray<MessageActivity>, SmsError>;
    readonly lookup: (phoneNumber: string) => Effect.Effect<NumberLookup, SmsError>;
  }
>() {}

/** Normalise a provider status string (`"DELIVERED"`, `"PROCESSED"`) to an SmsStatus. */
export const toSmsStatus = (raw: string | undefined): SmsStatus => {
  const value = (raw ?? "").toLowerCase();
  // `processed` is the activity-log name for what the webhooks call `routed`.
  if (value === "processed") return "routed";
  return (SmsStatuses as ReadonlyArray<string>).includes(value) ? (value as SmsStatus) : "queued";
};
