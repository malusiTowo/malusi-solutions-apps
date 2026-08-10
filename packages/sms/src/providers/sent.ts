import Sent, { APIConnectionError, APIConnectionTimeoutError, APIError } from "@sentdm/sentdm";
import { Effect, Layer } from "effect";
import {
  type MessageActivity,
  type MessageStatus,
  type NumberLookup,
  type SendInput,
  type SendResult,
  SmsError,
  SmsProvider,
  toSmsStatus,
} from "../types";

/**
 * Sent.dm adapter — one API for SMS, WhatsApp and RCS with provider routing and
 * fallback handled upstream.
 *
 * Errors are normalised at this boundary: nothing above this file sees a
 * `Sent.APIError`. The mapping switches on the HTTP status rather than on each
 * error subclass, so an SDK still at 0.x can add or rename classes without
 * silently falling through to "provider".
 */

export interface SentConfig {
  readonly apiKey: string;
  /** Milliseconds. The SDK default is 60s, which is far too long for a request path. */
  readonly timeout?: number;
  /** SDK-level retries for connection errors and 5xx. Idempotency makes these safe. */
  readonly maxRetries?: number;
  readonly baseURL?: string;
}

const toSmsError = (cause: unknown): SmsError => {
  if (cause instanceof APIConnectionTimeoutError || cause instanceof APIConnectionError) {
    return new SmsError({
      reason: "connection",
      message: cause.message || "Could not reach Sent",
      cause,
    });
  }

  if (cause instanceof APIError) {
    const status = cause.status;
    const reason =
      status === 400
        ? "invalid_request"
        : status === 401
          ? "unauthenticated"
          : status === 403
            ? "forbidden"
            : status === 404
              ? "not_found"
              : status === 409
                ? "conflict"
                : status === 422
                  ? "unprocessable"
                  : status === 429
                    ? "rate_limited"
                    : "provider";

    return new SmsError({
      reason,
      message: cause.message || `Sent request failed (${String(status)})`,
      status,
      code:
        typeof cause.error === "object" && cause.error !== null && "code" in cause.error
          ? String((cause.error as { code: unknown }).code)
          : undefined,
      cause,
    });
  }

  return new SmsError({
    reason: "provider",
    message: cause instanceof Error ? cause.message : "Sent request failed",
    cause,
  });
};

/** Translate our discriminated body union into the provider's flat params. */
const bodyParams = (body: SendInput["body"]) => {
  switch (body._tag) {
    case "Text":
      return { text: body.text };
    case "TemplateById":
      return { template: { id: body.id, parameters: body.parameters ?? null } };
    case "TemplateByName":
      return { template: { name: body.name, parameters: body.parameters ?? null } };
  }
};

/** Build an adapter from an explicit config (useful in tests / scripts). */
export const sentProvider = (config: SentConfig) => {
  const client = new Sent({
    apiKey: config.apiKey,
    timeout: config.timeout ?? 15_000,
    maxRetries: config.maxRetries ?? 2,
  });

  const call = <A>(f: () => Promise<A>) => Effect.tryPromise({ try: f, catch: toSmsError });

  const send = (input: SendInput): Effect.Effect<SendResult, SmsError> =>
    call(() =>
      client.messages.send({
        to: [...input.to],
        channel: input.channel ? [...input.channel] : null,
        sandbox: input.sandbox ?? false,
        "Idempotency-Key": input.idempotencyKey,
        ...bodyParams(input.body),
      }),
    ).pipe(
      Effect.flatMap((response) => {
        const data = response.data;
        if (!data) {
          return Effect.fail(
            new SmsError({
              reason: "decode",
              message: response.error?.message ?? "Sent returned no send data",
              cause: response,
            }),
          );
        }

        return Effect.succeed<SendResult>({
          status: toSmsStatus(data.status),
          templateId: data.template_id ?? null,
          templateName: data.template_name ?? null,
          recipients: (data.recipients ?? []).flatMap((recipient) =>
            // Without a message_id there is nothing to correlate a webhook to, so
            // such an entry is dropped rather than persisted as an untrackable row.
            recipient.message_id === undefined
              ? []
              : [
                  {
                    messageId: recipient.message_id,
                    to: recipient.to ?? "",
                    channel: recipient.channel ?? null,
                    body: recipient.body ?? null,
                  },
                ],
          ),
        });
      }),
    );

  const status = (messageId: string): Effect.Effect<MessageStatus, SmsError> =>
    call(() => client.messages.retrieveStatus(messageId)).pipe(
      Effect.flatMap((response) => {
        const data = response.data;
        if (!data) {
          return Effect.fail(
            new SmsError({
              reason: "not_found",
              message: response.error?.message ?? `No message ${messageId}`,
              cause: response,
            }),
          );
        }

        return Effect.succeed<MessageStatus>({
          messageId: data.id ?? messageId,
          status: toSmsStatus(data.status),
          channel: data.channel ?? null,
          to: data.phone_international ?? data.phone ?? null,
          direction: data.direction ?? null,
          body: data.message_body?.content ?? null,
          templateId: data.template_id ?? null,
          templateName: data.template_name ?? null,
        });
      }),
    );

  const activities = (messageId: string): Effect.Effect<ReadonlyArray<MessageActivity>, SmsError> =>
    call(() => client.messages.retrieveActivities(messageId)).pipe(
      Effect.map((response) =>
        (response.data?.activities ?? []).map((activity) => ({
          status: activity.status ?? "",
          timestamp: activity.timestamp ?? "",
          description: activity.description ?? null,
        })),
      ),
    );

  const lookup = (phoneNumber: string): Effect.Effect<NumberLookup, SmsError> =>
    call(() => client.numbers.lookup(phoneNumber)).pipe(
      Effect.map((response) => {
        const data = response.data;
        return {
          phoneNumber: data?.phone_number ?? phoneNumber,
          isValid: data?.is_valid ?? false,
          lineType: data?.line_type ?? null,
          carrierName: data?.carrier_name ?? null,
          countryCode: data?.country_code ?? null,
        };
      }),
    );

  return { send, status, activities, lookup };
};

/** Build a layer from an explicit config (useful in tests / scripts). */
export const layerFromConfig = (config: SentConfig): Layer.Layer<SmsProvider> =>
  Layer.sync(SmsProvider, () => sentProvider(config));

/**
 * Default layer, reading `SENT_DM_API_KEY` from the environment.
 *
 * Deliberately `Layer.sync` with a fallback rather than a strict `Config` read:
 * this layer is merged into the app runtime, which builds every branch on first
 * use, so a hard failure here would take down procedures that never send a
 * message. An absent key instead surfaces as an `unauthenticated` SmsError on the
 * first actual send.
 */
export const SentLive: Layer.Layer<SmsProvider> = Layer.sync(SmsProvider, () =>
  sentProvider({ apiKey: process.env["SENT_DM_API_KEY"] ?? "" }),
);
