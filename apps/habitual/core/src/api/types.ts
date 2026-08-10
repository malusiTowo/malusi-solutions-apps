import type { SendRecipient, SendResult } from "@repo/sms";
import { SmsChannels, SmsStatuses } from "@repo/sms";
import { type SmsMessageRow, SmsDirections } from "../db";
import type { Habit } from "../models/habit";
import { HabitColors } from "../models/habit";
import { builder } from "./builder";

/**
 * GraphQL types for Habitual.
 *
 * Every enum reads its members from the tuple the domain already declares, so a
 * value can never be added in one place and missed in the other. Every object type
 * is an `objectRef` over an existing TypeScript type — the schema describes the
 * domain, it does not restate it.
 */

export const HabitColorEnum = builder.enumType("HabitColor", { values: HabitColors });
export const SmsStatusEnum = builder.enumType("SmsStatus", { values: SmsStatuses });
export const SmsChannelEnum = builder.enumType("SmsChannel", { values: SmsChannels });
export const SmsDirectionEnum = builder.enumType("SmsDirection", { values: SmsDirections });

/**
 * `repeatDays` uses `t.field` rather than `t.exposeIntList`: the domain type is a
 * `ReadonlyArray<number>`, and Pothos's expose helpers require a mutable `number[]`.
 * A resolver return type is checked covariantly, so this form accepts it without
 * copying the array.
 */
export const HabitType = builder.objectRef<Habit>("Habit").implement({
  description: "A habit the signed-in user is tracking.",
  fields: (t) => ({
    id: t.exposeString("id"),
    userId: t.exposeString("userId"),
    name: t.exposeString("name"),
    color: t.field({ type: HabitColorEnum, resolve: (habit) => habit.color }),
    repeatDays: t.field({
      type: ["Int"],
      description: "Days of week this habit repeats: 0 = Sunday … 6 = Saturday.",
      resolve: (habit) => habit.repeatDays,
    }),
    reminderAt: t.exposeString("reminderAt", { nullable: true }),
    dailyGoal: t.exposeString("dailyGoal", { nullable: true }),
    streak: t.exposeInt("streak"),
    createdAt: t.field({ type: "DateTime", resolve: (habit) => habit.createdAt }),
    updatedAt: t.field({ type: "DateTime", resolve: (habit) => habit.updatedAt }),
  }),
});

/**
 * `channel` stays a plain nullable `String`, not `SmsChannel`. The column is `text`
 * rather than a pgEnum precisely because the provider may report a channel we do
 * not model; widening it to the enum would make an unknown value a serialization
 * error on read.
 */
export const SmsMessageType = builder.objectRef<SmsMessageRow>("SmsMessage").implement({
  description: "A message row as we recorded it — never a live read of the provider.",
  fields: (t) => ({
    id: t.exposeString("id"),
    messageId: t.exposeString("messageId"),
    direction: t.field({ type: SmsDirectionEnum, resolve: (row) => row.direction }),
    userId: t.exposeString("userId", { nullable: true }),
    toNumber: t.exposeString("toNumber"),
    fromNumber: t.exposeString("fromNumber", { nullable: true }),
    channel: t.exposeString("channel", { nullable: true }),
    status: t.field({ type: SmsStatusEnum, resolve: (row) => row.status }),
    statusRank: t.exposeInt("statusRank"),
    templateId: t.exposeString("templateId", { nullable: true }),
    templateName: t.exposeString("templateName", { nullable: true }),
    body: t.exposeString("body", { nullable: true }),
    errorCode: t.exposeString("errorCode", { nullable: true }),
    errorMessage: t.exposeString("errorMessage", { nullable: true }),
    idempotencyKey: t.exposeString("idempotencyKey", { nullable: true }),
    lastEventAt: t.field({
      type: "DateTime",
      nullable: true,
      resolve: (row) => row.lastEventAt,
    }),
    createdAt: t.field({ type: "DateTime", resolve: (row) => row.createdAt }),
    updatedAt: t.field({ type: "DateTime", resolve: (row) => row.updatedAt }),
  }),
});

export const SendRecipientType = builder.objectRef<SendRecipient>("SendRecipient").implement({
  fields: (t) => ({
    messageId: t.exposeString("messageId"),
    to: t.exposeString("to"),
    channel: t.exposeString("channel", { nullable: true }),
    body: t.exposeString("body", { nullable: true }),
  }),
});

export const SendResultType = builder.objectRef<SendResult>("SendResult").implement({
  fields: (t) => ({
    status: t.field({ type: SmsStatusEnum, resolve: (result) => result.status }),
    templateId: t.exposeString("templateId", { nullable: true }),
    templateName: t.exposeString("templateName", { nullable: true }),
    recipients: t.field({
      type: [SendRecipientType],
      description: "One entry per (recipient, channel) pair — each separately billed.",
      resolve: (result) => result.recipients,
    }),
  }),
});

/**
 * `ts` is `Float`, not `Int`. It carries `Date.now()`, and graphql-js rejects any
 * `Int` outside the 32-bit range — an epoch in milliseconds is three orders of
 * magnitude past it.
 */
export const HealthType = builder
  .objectRef<{ readonly ok: true; readonly service: string; readonly ts: number }>("Health")
  .implement({
    fields: (t) => ({
      ok: t.exposeBoolean("ok"),
      service: t.exposeString("service"),
      ts: t.field({ type: "Float", resolve: (health) => health.ts }),
    }),
  });

export const PingType = builder.objectRef<{ readonly ok: true }>("Ping").implement({
  fields: (t) => ({ ok: t.exposeBoolean("ok") }),
});
