/**
 * Server-only barrel. Everything reachable from here pulls in `drizzle-orm`, so it
 * is exposed as `@habitual/core/db` and never re-exported from the root barrel or
 * from `@habitual/core/models`.
 */
export {
  Database,
  DatabaseLive,
  type HabitualSchema,
  query,
  transaction,
  transactionPromise,
} from "./client";
export { createHabit, listHabits, ping } from "./habits";
export { toHabit, toUser } from "./mappers";
export {
  habitColor,
  habits,
  type HabitRow,
  type NewHabitRow,
  type NewSmsMessageRow,
  type NewUserRow,
  smsDirection,
  SmsDirections,
  smsMessages,
  type SmsMessageRow,
  smsStatus,
  users,
  type UserRow,
} from "./schema";
export {
  applyStatusEvent,
  getSmsMessage,
  listSmsMessages,
  recordSend,
  type SmsStatusUpdate,
} from "./sms";
