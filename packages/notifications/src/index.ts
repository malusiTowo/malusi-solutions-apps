import { Expo, type ExpoPushMessage, type ExpoPushTicket } from "expo-server-sdk";

/**
 * Generic Expo push helpers (server-side). Products decide what to send and to
 * whom; this package just validates tokens and delivers batched messages.
 */

export function createPushClient(accessToken?: string): Expo {
  return new Expo({ accessToken });
}

export function isValidExpoPushToken(token: string): boolean {
  return Expo.isExpoPushToken(token);
}

export interface PushMessage {
  readonly to: string | string[];
  readonly title?: string;
  readonly body?: string;
  readonly data?: Record<string, unknown>;
  readonly sound?: "default" | null;
  readonly badge?: number;
}

/** Chunk + deliver push messages, returning all delivery tickets. */
export async function sendPushNotifications(
  client: Expo,
  messages: ReadonlyArray<PushMessage>,
): Promise<ExpoPushTicket[]> {
  const valid: ExpoPushMessage[] = messages
    .flatMap((m) => (Array.isArray(m.to) ? m.to.map((to) => ({ ...m, to })) : [m]))
    .filter((m) => isValidExpoPushToken(m.to as string))
    .map((m) => ({
      to: m.to as string,
      title: m.title,
      body: m.body,
      data: m.data,
      sound: m.sound === undefined ? "default" : m.sound,
      badge: m.badge,
    }));

  const chunks = client.chunkPushNotifications(valid);
  const tickets: ExpoPushTicket[] = [];
  for (const chunk of chunks) {
    const receipts = await client.sendPushNotificationsAsync(chunk);
    tickets.push(...receipts);
  }
  return tickets;
}

export { Expo, type ExpoPushMessage, type ExpoPushTicket };
