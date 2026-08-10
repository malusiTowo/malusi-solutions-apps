import { requireUserId } from "@repo/api";
import { type SmsBody, SmsChannels, templateById, templateByName, text } from "@repo/sms";
import { Effect, Schema } from "effect";
import { getSmsMessage, listSmsMessages } from "../db";
import { sendSms } from "../sms/send";
import { builder, decodeInput, runEffect } from "./builder";
import { SendResultType, SmsChannelEnum, SmsMessageType } from "./types";

const TemplateParameters = Schema.Record({ key: Schema.String, value: Schema.String });

const SendSmsTemplateByIdInput = builder.inputType("SendSmsTemplateByIdInput", {
  fields: (t) => ({
    id: t.string({ required: true }),
    parameters: t.field({ type: "JSONObject" }),
  }),
});

const SendSmsTemplateByNameInput = builder.inputType("SendSmsTemplateByNameInput", {
  fields: (t) => ({
    name: t.string({ required: true }),
    parameters: t.field({ type: "JSONObject" }),
  }),
});

/**
 * A body is free-form text XOR a template reference, never both — the provider
 * rejects a request carrying both, so the impossible request should not be
 * encodable in the first place.
 *
 * GraphQL has no input unions, so this is a `@oneOf` input object: the field *name*
 * is the discriminant, and the server rejects anything but exactly one key during
 * variable coercion. That check lives in graphql-js itself, which is why the guard
 * survives regardless of what a client sends.
 */
const SendSmsBodyInput = builder.inputType("SendSmsBodyInput", {
  isOneOf: true,
  fields: (t) => ({
    text: t.string(),
    templateById: t.field({ type: SendSmsTemplateByIdInput }),
    templateByName: t.field({ type: SendSmsTemplateByNameInput }),
  }),
});

const SendSmsInput = builder.inputType("SendSmsInput", {
  fields: (t) => ({
    to: t.string({ required: true }),
    body: t.field({ type: SendSmsBodyInput, required: true }),
    channel: t.field({ type: [SmsChannelEnum] }),
    sandbox: t.boolean(),
  }),
});

/**
 * The refinements GraphQL cannot express: an E.164 number, a non-empty body. The
 * shape is asserted against the GraphQL input below, so the two cannot drift.
 */
const SendSmsSchema = Schema.Struct({
  to: Schema.String.pipe(Schema.pattern(/^\+[1-9]\d{6,14}$/)),
  body: Schema.Union(
    Schema.Struct({ text: Schema.String.pipe(Schema.minLength(1)) }),
    Schema.Struct({
      templateById: Schema.Struct({
        id: Schema.String.pipe(Schema.minLength(1)),
        parameters: Schema.optional(Schema.NullOr(TemplateParameters)),
      }),
    }),
    Schema.Struct({
      templateByName: Schema.Struct({
        name: Schema.String.pipe(Schema.minLength(1)),
        parameters: Schema.optional(Schema.NullOr(TemplateParameters)),
      }),
    }),
  ),
  channel: Schema.optional(Schema.NullOr(Schema.Array(Schema.Literal(...SmsChannels)))),
  sandbox: Schema.optional(Schema.NullOr(Schema.Boolean)),
});

type SendSmsPayload = typeof SendSmsSchema.Type;
const _sendSmsShapesAgree: (input: typeof SendSmsInput.$inferInput) => SendSmsPayload = (input) =>
  input;

const parseSendSms = decodeInput(SendSmsSchema);

/**
 * Maps the GraphQL discriminant (field name) onto the domain's (`_tag`). Kept as a
 * standalone function rather than inlined: if `@oneOf` ever has to be traded for
 * three separate mutations, this is the piece that makes the change mechanical.
 */
export const toBody = (body: SendSmsPayload["body"]): SmsBody => {
  if ("text" in body) return text(body.text);
  if ("templateById" in body) {
    return templateById(body.templateById.id, body.templateById.parameters ?? undefined);
  }
  return templateByName(body.templateByName.name, body.templateByName.parameters ?? undefined);
};

builder.mutationField("sendSms", (t) =>
  t.withAuth({ authenticated: true }).field({
    type: SendResultType,
    args: { input: t.arg({ type: SendSmsInput, required: true }) },
    resolve: (_parent, args, ctx) => {
      const input = parseSendSms(args.input);
      return runEffect(
        ctx,
        sendSms({
          to: input.to,
          body: toBody(input.body),
          channel: input.channel ?? undefined,
          sandbox: input.sandbox ?? undefined,
        }),
      );
    },
  }),
);

/**
 * Reads our own row rather than polling the provider: the webhook already keeps it
 * current, and this spends none of the provider's rate limit.
 */
builder.queryField("smsMessage", (t) =>
  t.withAuth({ authenticated: true }).field({
    type: SmsMessageType,
    nullable: true,
    args: { messageId: t.arg.string({ required: true }) },
    resolve: async (_parent, args, ctx) =>
      (await runEffect(ctx, getSmsMessage(args.messageId))) ?? null,
  }),
);

builder.queryField("smsMessages", (t) =>
  t.withAuth({ authenticated: true }).field({
    type: [SmsMessageType],
    resolve: (_parent, _args, ctx) =>
      runEffect(
        ctx,
        Effect.flatMap(requireUserId, (userId) => listSmsMessages(userId)),
      ),
  }),
);
