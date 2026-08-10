import type { DbError } from "@repo/db";
import {
  eventStatus,
  isInboundEvent,
  isOutboundEvent,
  type SmsWebhookEvent,
  SmsStatusRank,
} from "@repo/sms";
import { Effect } from "effect";
import { applyStatusEvent, type Database } from "../db";

/**
 * Webhook ingestion. Every event funnels into the rank-guarded upsert in
 * `db/sms.ts`, which is what makes redelivered and out-of-order events safe —
 * there is deliberately no read-then-write here to race against.
 */
export const handleSentEvent = (event: SmsWebhookEvent): Effect.Effect<void, DbError, Database> => {
  if (isInboundEvent(event)) {
    const { payload } = event;
    return applyStatusEvent({
      messageId: payload.message_id,
      direction: "inbound",
      // Inbound has no sender of ours; the number that messaged in is `from`.
      toNumber: payload.outbound_number ?? "",
      fromNumber: payload.inbound_number ?? null,
      channel: payload.channel ?? null,
      status: "received",
      statusRank: SmsStatusRank.received,
      body: payload.text ?? null,
      lastEventAt: new Date(),
    });
  }

  if (isOutboundEvent(event)) {
    const { payload } = event;
    const status = eventStatus(event.event);
    return applyStatusEvent({
      messageId: payload.message_id,
      direction: "outbound",
      // Unknown on a status event; the send path fills it in on its own upsert.
      toNumber: "",
      fromNumber: payload.outbound_number ?? null,
      channel: payload.channel ?? null,
      status,
      statusRank: SmsStatusRank[status],
      templateId: payload.template_id ?? null,
      templateName: payload.template_name ?? null,
      errorCode: payload.error_code ?? null,
      errorMessage: payload.error_message ?? null,
      lastEventAt: new Date(),
    });
  }

  // Template approval events carry no message to reconcile. Acknowledged, not stored.
  return Effect.void;
};
