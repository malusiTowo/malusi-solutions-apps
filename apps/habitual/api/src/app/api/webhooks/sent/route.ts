import { runtime as appRuntime } from "@habitual/core";
import { handleSentEvent } from "@habitual/core/sms";
import {
  isFreshTimestamp,
  parseEvent,
  readWebhookHeaders,
  verifySignature,
} from "@repo/sms/webhook";
import { Cause, Either, Exit } from "effect";
import { env } from "~/env";

// Node runtime: signature verification uses `node:crypto`.
export const runtime = "nodejs";

/**
 * Sent.dm webhook receiver — delivery status and inbound messages.
 *
 * The status codes are load-bearing, because they decide whether the provider
 * retries: a forged or stale request is a permanent 401, an event shape we do not
 * model is acknowledged with 200 (retrying would never help), and only a genuine
 * handler failure returns 500 to ask for redelivery.
 */
export async function POST(req: Request): Promise<Response> {
  const secret = env.SENT_DM_WEBHOOK_SECRET;
  if (!secret) return new Response("Sent webhooks not configured", { status: 501 });

  const headers = readWebhookHeaders(req.headers);
  if (!headers) return new Response("Missing signature headers", { status: 400 });

  // Read the raw text before anything parses it: the body can only be consumed
  // once, and the signature covers the exact bytes sent.
  const rawBody = await req.text();

  if (!verifySignature({ rawBody, headers, secret })) {
    return new Response("Invalid signature", { status: 401 });
  }
  if (!isFreshTimestamp(headers.timestamp)) {
    return new Response("Stale webhook", { status: 401 });
  }

  const parsed = parseEvent(rawBody);
  if (Either.isLeft(parsed)) {
    // Acknowledge: a 4xx here would have the provider retry an event we are never
    // going to be able to decode.
    console.warn(`[sent] ignoring unrecognised event: ${parsed.left.message}`);
    return Response.json({ received: true, ignored: true });
  }

  const exit = await appRuntime.runPromiseExit(handleSentEvent(parsed.right));
  if (Exit.isFailure(exit)) {
    console.error(`[sent] handler failed:`, Cause.pretty(exit.cause));
    return new Response("Handler failed", { status: 500 });
  }

  return Response.json({ received: true });
}
