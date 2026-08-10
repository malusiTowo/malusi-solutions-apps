import { CurrentUser } from "@repo/api";
import { type SendResult, SmsError, SmsProvider } from "@repo/sms";
import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";
import { Database } from "../db/client";
import { sendSms, text, toSmsRows } from "./send";

const result: SendResult = {
  status: "queued",
  templateId: "tpl_1",
  templateName: "otp",
  recipients: [
    { messageId: "msg_1", to: "+27831234567", channel: "sms", body: "Your code is 4291" },
    { messageId: "msg_2", to: "+27831234567", channel: "whatsapp", body: "Your code is 4291" },
  ],
};

describe("toSmsRows", () => {
  it("writes one row per (recipient, channel) pair the send fanned out to", () => {
    const rows = toSmsRows("user_2abc", "key-1", result);
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.messageId)).toEqual(["msg_1", "msg_2"]);
    expect(rows.map((row) => row.channel)).toEqual(["sms", "whatsapp"]);
  });

  it("stamps the rank matching the status so webhooks can only move it forward", () => {
    const [row] = toSmsRows("user_2abc", "key-1", result);
    expect(row?.status).toBe("queued");
    expect(row?.statusRank).toBe(10);
  });

  it("carries the idempotency key and sender onto every row", () => {
    const rows = toSmsRows("user_2abc", "key-1", result);
    expect(rows.every((row) => row.idempotencyKey === "key-1")).toBe(true);
    expect(rows.every((row) => row.userId === "user_2abc")).toBe(true);
  });
});

/** Records the rows a program tries to insert, without a database. */
const recordingDatabase = () => {
  const inserted: unknown[] = [];
  const chain = {
    values: (rows: unknown) => {
      inserted.push(rows);
      return chain;
    },
    onConflictDoUpdate: () => Promise.resolve(),
  };
  const handle = { db: { insert: () => chain }, read: { select: () => chain } };
  // The fake only implements the surface `query` reaches through; typing it fully
  // would mean reproducing drizzle's builder types for no added confidence.
  // oxlint-disable-next-line typescript/no-explicit-any
  return { layer: Layer.succeed(Database, handle as any), inserted };
};

const fakeProvider = (send: () => Effect.Effect<SendResult, SmsError>) =>
  Layer.succeed(SmsProvider, {
    send,
    status: () => Effect.fail(new SmsError({ reason: "not_found", message: "no" })),
    activities: () => Effect.succeed([]),
    lookup: () =>
      Effect.succeed({
        phoneNumber: "+27831234567",
        isValid: true,
        lineType: "mobile",
        carrierName: null,
        countryCode: "ZA",
      }),
  });

const asUser = Layer.succeed(CurrentUser, { userId: "user_2abc", sessionId: "sess_1" });

describe("sendSms", () => {
  it("logs a row per recipient after a successful send", async () => {
    const db = recordingDatabase();
    const program = sendSms({ to: "+27831234567", body: text("hi"), sandbox: true });

    await Effect.runPromise(
      Effect.provide(
        program,
        Layer.mergeAll(
          db.layer,
          fakeProvider(() => Effect.succeed(result)),
          asUser,
        ),
      ),
    );

    expect(db.inserted).toHaveLength(1);
    expect(db.inserted[0]).toHaveLength(2);
  });

  it("does not write anything when the provider rejects the send", async () => {
    const db = recordingDatabase();
    const program = sendSms({ to: "+27831234567", body: text("hi") });

    const exit = await Effect.runPromiseExit(
      Effect.provide(
        program,
        Layer.mergeAll(
          db.layer,
          fakeProvider(() =>
            Effect.fail(new SmsError({ reason: "rate_limited", message: "slow" })),
          ),
          asUser,
        ),
      ),
    );

    expect(exit._tag).toBe("Failure");
    expect(db.inserted).toHaveLength(0);
  });

  it("fails without writing when there is no signed-in user", async () => {
    const db = recordingDatabase();
    const program = sendSms({ to: "+27831234567", body: text("hi") });

    const exit = await Effect.runPromiseExit(
      Effect.provide(
        program,
        Layer.mergeAll(
          db.layer,
          fakeProvider(() => Effect.succeed(result)),
          Layer.succeed(CurrentUser, { userId: null, sessionId: null }),
        ),
      ),
    );

    expect(exit._tag).toBe("Failure");
    expect(db.inserted).toHaveLength(0);
  });
});
