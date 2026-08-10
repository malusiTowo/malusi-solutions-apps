/**
 * Server-only barrel. Reaches the database and the provider SDK, so it is exposed
 * as `@habitual/core/sms` and never from the client-safe subpaths.
 */
export { handleSentEvent } from "./handler";
export { type SendSmsInput, sendSms, templateById, text, toSmsRows } from "./send";
