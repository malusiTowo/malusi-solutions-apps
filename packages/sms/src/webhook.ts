import { createHmac, timingSafeEqual } from "node:crypto";
import { Either, Schema } from "effect";
import { SmsError, type SmsStatus } from "./types";

/**
 * Inbound webhook verification and parsing.
 *
 * Deliberately free of any provider SDK — it is pure `node:crypto` plus a schema —
 * so a route handler can import `@repo/sms/webhook` without pulling the client
 * into its bundle. Everything here is synchronous and side-effect free, matching
 * `@repo/payments`'s `constructWebhookEvent`.
 */

export interface WebhookHeaders {
  /** `x-webhook-id` */
  readonly id: string;
  /** `x-webhook-timestamp`, UNIX seconds. */
  readonly timestamp: string;
  /** `x-webhook-signature`, formatted `v1,<base64>`. */
  readonly signature: string;
}

export const SIGNATURE_VERSION = "v1";
/** Replay window. Signatures older than this are rejected even if they verify. */
export const DEFAULT_TOLERANCE_SECONDS = 300;

/** Pull the signature headers off a request, or null if any are absent. */
export const readWebhookHeaders = (headers: Headers): WebhookHeaders | null => {
  const id = headers.get("x-webhook-id");
  const timestamp = headers.get("x-webhook-timestamp");
  const signature = headers.get("x-webhook-signature");
  return id && timestamp && signature ? { id, timestamp, signature } : null;
};

/**
 * Constant-time HMAC-SHA256 check over `${id}.${timestamp}.${rawBody}`.
 *
 * The signing secret is `whsec_` followed by base64; the HMAC key is those decoded
 * bytes, not the printable string — signing with the string verifies against
 * nothing.
 */
export const verifySignature = (input: {
  readonly rawBody: string;
  readonly headers: WebhookHeaders;
  readonly secret: string;
}): boolean => {
  const key = Buffer.from(input.secret.replace(/^whsec_/, ""), "base64");
  if (key.length === 0) return false;

  const signed = `${input.headers.id}.${input.headers.timestamp}.${input.rawBody}`;
  const digest = createHmac("sha256", key).update(signed, "utf8").digest("base64");
  const expected = Buffer.from(`${SIGNATURE_VERSION},${digest}`, "utf8");

  // During a secret rotation several signatures arrive space-separated; any one
  // matching is enough.
  return input.headers.signature.split(/\s+/).some((candidate) => {
    const actual = Buffer.from(candidate, "utf8");
    // timingSafeEqual throws on a length mismatch, so compare lengths first.
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  });
};

/** Reject timestamps outside the replay window. `now` is injectable for tests. */
export const isFreshTimestamp = (
  timestamp: string,
  toleranceSeconds: number = DEFAULT_TOLERANCE_SECONDS,
  now: Date = new Date(),
): boolean => {
  const seconds = Number(timestamp);
  if (!Number.isFinite(seconds)) return false;
  return Math.abs(now.getTime() / 1000 - seconds) <= toleranceSeconds;
};

/** Outbound delivery lifecycle events. */
export const OutboundEventNames = [
  "message.queued",
  "message.scheduled",
  "message.routed",
  "message.sent",
  "message.delivered",
  "message.read",
  "message.filtered",
  "message.blocked",
  "message.failed",
] as const;
export type OutboundEventName = (typeof OutboundEventNames)[number];

// Excess properties are ignored by default, so a provider adding a field to a
// payload will not start failing our decode. That matters for a pre-1.0 API.
const OutboundPayload = Schema.Struct({
  account_id: Schema.optional(Schema.String),
  message_id: Schema.String,
  message_status: Schema.optional(Schema.String),
  channel: Schema.optional(Schema.String),
  template_id: Schema.optional(Schema.NullOr(Schema.String)),
  template_name: Schema.optional(Schema.NullOr(Schema.String)),
  outbound_number: Schema.optional(Schema.NullOr(Schema.String)),
  agent_id: Schema.optional(Schema.NullOr(Schema.String)),
  error_code: Schema.optional(Schema.NullOr(Schema.String)),
  error_message: Schema.optional(Schema.NullOr(Schema.String)),
});

const InboundPayload = Schema.Struct({
  account_id: Schema.optional(Schema.String),
  message_id: Schema.String,
  inbound_number: Schema.optional(Schema.NullOr(Schema.String)),
  outbound_number: Schema.optional(Schema.NullOr(Schema.String)),
  text: Schema.optional(Schema.NullOr(Schema.String)),
  channel: Schema.optional(Schema.String),
});

/** Timestamps arrive as UNIX seconds, but stringly-typed on some events. */
const Timestamp = Schema.Union(Schema.Number, Schema.String);

export const OutboundEvent = Schema.Struct({
  field: Schema.Literal("message"),
  event: Schema.Literal(...OutboundEventNames),
  timestamp: Schema.optional(Timestamp),
  payload: OutboundPayload,
});

export const InboundEvent = Schema.Struct({
  field: Schema.Literal("message"),
  event: Schema.Literal("message.received"),
  timestamp: Schema.optional(Timestamp),
  payload: InboundPayload,
});

export const TemplateEvent = Schema.Struct({
  field: Schema.Literal("templates"),
  event: Schema.String,
  timestamp: Schema.optional(Timestamp),
  payload: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
});

export const SmsWebhookEvent = Schema.Union(InboundEvent, OutboundEvent, TemplateEvent);
export type SmsWebhookEvent = typeof SmsWebhookEvent.Type;
export type OutboundWebhookEvent = typeof OutboundEvent.Type;
export type InboundWebhookEvent = typeof InboundEvent.Type;

const decode = Schema.decodeUnknownEither(SmsWebhookEvent);

/**
 * Parse a raw body into a typed event. Returns `Left` for anything we do not
 * model — callers should acknowledge those with a 2xx rather than a 4xx, or the
 * provider will retry an event shape that is never going to parse.
 */
export const parseEvent = (rawBody: string): Either.Either<SmsWebhookEvent, SmsError> => {
  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch (cause) {
    return Either.left(
      new SmsError({ reason: "decode", message: "Webhook body is not valid JSON", cause }),
    );
  }

  return Either.mapLeft(
    decode(json),
    (cause) => new SmsError({ reason: "decode", message: "Unrecognised webhook event", cause }),
  );
};

/** `"message.delivered"` → `"delivered"`. Total over the outbound event names. */
export const eventStatus = (event: OutboundEventName): SmsStatus =>
  event.slice("message.".length) as SmsStatus;

export const isOutboundEvent = (event: SmsWebhookEvent): event is OutboundWebhookEvent =>
  event.field === "message" && (OutboundEventNames as ReadonlyArray<string>).includes(event.event);

export const isInboundEvent = (event: SmsWebhookEvent): event is InboundWebhookEvent =>
  event.field === "message" && event.event === "message.received";
