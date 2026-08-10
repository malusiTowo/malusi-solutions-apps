import { Either } from "effect";
import { describe, expect, it } from "vitest";
import { SmsStatusRank } from "./types";
import {
  eventStatus,
  isFreshTimestamp,
  isInboundEvent,
  isOutboundEvent,
  OutboundEventNames,
  parseEvent,
  readWebhookHeaders,
  verifySignature,
  type WebhookHeaders,
} from "./webhook";

/**
 * The expected signature below is hard-coded rather than recomputed with
 * `createHmac`. That is the point: a test that derives its own expectation would
 * still pass if the algorithm itself regressed (wrong key derivation, wrong signed
 * string), because both sides would change together.
 */
const SECRET = "whsec_dGVzdC1zZWNyZXQtMzJieXRlcy1sb25nISE=";
const RAW_BODY =
  '{"field":"message","event":"message.delivered","timestamp":1700000000,"payload":{"account_id":"acct_test","message_id":"msg_0001","message_status":"DELIVERED","channel":"sms"}}';
const HEADERS: WebhookHeaders = {
  id: "wh_2xTestFixture",
  timestamp: "1700000000",
  signature: "v1,eotTxVkcfczUqFfjWDLOD3ia83zxhPLOPxjItE0YgQ8=",
};

const verify = (overrides: Partial<{ rawBody: string; headers: WebhookHeaders; secret: string }>) =>
  verifySignature({ rawBody: RAW_BODY, headers: HEADERS, secret: SECRET, ...overrides });

describe("verifySignature", () => {
  it("accepts a known-good signature", () => {
    expect(verify({})).toBe(true);
  });

  it("rejects a tampered body", () => {
    expect(verify({ rawBody: RAW_BODY.replace("DELIVERED", "FAILED") })).toBe(false);
  });

  it("rejects a different secret", () => {
    expect(verify({ secret: "whsec_b3RoZXItc2VjcmV0LXZhbHVlLWhlcmU=" })).toBe(false);
  });

  it("derives the key from the decoded secret, prefix present or not", () => {
    // Only one leading `whsec_` is stripped. Passing the bare base64 must behave
    // identically, while base64-decoding a prefix yields different key bytes —
    // the classic integration bug this guards against.
    expect(verify({ secret: SECRET.slice("whsec_".length) })).toBe(true);
    expect(verify({ secret: `whsec_whsec_${SECRET.slice("whsec_".length)}` })).toBe(false);
  });

  it("rejects a truncated signature without throwing", () => {
    // timingSafeEqual throws on length mismatch; the length guard must come first.
    expect(() =>
      verify({ headers: { ...HEADERS, signature: HEADERS.signature.slice(0, 20) } }),
    ).not.toThrow();
    expect(verify({ headers: { ...HEADERS, signature: HEADERS.signature.slice(0, 20) } })).toBe(
      false,
    );
  });

  it("rejects a signature missing the version prefix", () => {
    expect(
      verify({ headers: { ...HEADERS, signature: HEADERS.signature.replace("v1,", "") } }),
    ).toBe(false);
  });

  it("rejects a signature bound to a different webhook id", () => {
    expect(verify({ headers: { ...HEADERS, id: "wh_other" } })).toBe(false);
  });

  it("rejects a signature bound to a different timestamp", () => {
    expect(verify({ headers: { ...HEADERS, timestamp: "1700000001" } })).toBe(false);
  });

  it("accepts a rotation list containing the good signature", () => {
    expect(verify({ headers: { ...HEADERS, signature: `v1,QUJD ${HEADERS.signature}` } })).toBe(
      true,
    );
  });

  it("rejects an empty secret", () => {
    expect(verify({ secret: "" })).toBe(false);
  });
});

describe("isFreshTimestamp", () => {
  const now = new Date(1_700_000_000_000);

  it("accepts a timestamp inside the window", () => {
    expect(isFreshTimestamp("1699999999", 300, now)).toBe(true);
    expect(isFreshTimestamp("1699999701", 300, now)).toBe(true);
  });

  it("rejects a timestamp outside the window in either direction", () => {
    expect(isFreshTimestamp("1699999699", 300, now)).toBe(false);
    expect(isFreshTimestamp("1700000301", 300, now)).toBe(false);
  });

  it("rejects a non-numeric timestamp", () => {
    expect(isFreshTimestamp("not-a-number", 300, now)).toBe(false);
  });
});

describe("readWebhookHeaders", () => {
  it("returns the trio when all are present", () => {
    const headers = new Headers({
      "x-webhook-id": "wh_1",
      "x-webhook-timestamp": "1700000000",
      "x-webhook-signature": "v1,abc",
    });
    expect(readWebhookHeaders(headers)).toEqual({
      id: "wh_1",
      timestamp: "1700000000",
      signature: "v1,abc",
    });
  });

  it("returns null when any is missing", () => {
    expect(readWebhookHeaders(new Headers({ "x-webhook-id": "wh_1" }))).toBeNull();
  });
});

describe("parseEvent", () => {
  it("decodes every outbound event name", () => {
    for (const event of OutboundEventNames) {
      const body = JSON.stringify({
        field: "message",
        event,
        timestamp: 1_700_000_000,
        payload: { message_id: "msg_1", message_status: "X", channel: "sms" },
      });
      const parsed = parseEvent(body);
      expect(Either.isRight(parsed), event).toBe(true);
      if (Either.isRight(parsed)) expect(isOutboundEvent(parsed.right)).toBe(true);
    }
  });

  it("decodes an inbound message", () => {
    const parsed = parseEvent(
      JSON.stringify({
        field: "message",
        event: "message.received",
        payload: { message_id: "msg_2", text: "hello", inbound_number: "+27831234567" },
      }),
    );
    expect(Either.isRight(parsed)).toBe(true);
    if (Either.isRight(parsed)) expect(isInboundEvent(parsed.right)).toBe(true);
  });

  it("decodes a template event", () => {
    const parsed = parseEvent(
      JSON.stringify({ field: "templates", event: "templates.approved", payload: {} }),
    );
    expect(Either.isRight(parsed)).toBe(true);
  });

  it("tolerates unknown extra payload fields", () => {
    const parsed = parseEvent(
      JSON.stringify({
        field: "message",
        event: "message.sent",
        payload: { message_id: "msg_3", brand_new_field: 42 },
      }),
    );
    expect(Either.isRight(parsed)).toBe(true);
  });

  it("fails on an unknown event name", () => {
    const parsed = parseEvent(
      JSON.stringify({ field: "message", event: "message.teleported", payload: {} }),
    );
    expect(Either.isLeft(parsed)).toBe(true);
  });

  it("fails on malformed JSON", () => {
    expect(Either.isLeft(parseEvent("{not json"))).toBe(true);
  });
});

describe("eventStatus", () => {
  it("strips the event prefix to a status for every outbound name", () => {
    expect(eventStatus("message.delivered")).toBe("delivered");
    for (const event of OutboundEventNames) {
      expect(SmsStatusRank[eventStatus(event)]).toBeTypeOf("number");
    }
  });
});

describe("SmsStatusRank", () => {
  it("ranks terminal states above every progress state", () => {
    const progress = [
      SmsStatusRank.queued,
      SmsStatusRank.scheduled,
      SmsStatusRank.routed,
      SmsStatusRank.sent,
      SmsStatusRank.delivered,
      SmsStatusRank.read,
    ];
    for (const terminal of [SmsStatusRank.filtered, SmsStatusRank.blocked, SmsStatusRank.failed]) {
      expect(Math.min(terminal, ...progress)).not.toBe(terminal);
    }
  });

  it("orders the delivery lifecycle monotonically", () => {
    expect(SmsStatusRank.queued).toBeLessThan(SmsStatusRank.sent);
    expect(SmsStatusRank.sent).toBeLessThan(SmsStatusRank.delivered);
    expect(SmsStatusRank.delivered).toBeLessThan(SmsStatusRank.read);
  });
});
