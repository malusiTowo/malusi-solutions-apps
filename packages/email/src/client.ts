import type { ReactElement } from "react";
import { Resend } from "resend";

/**
 * Generic Resend client factory + a typed `sendEmail` helper. Templates are
 * supplied by callers as React elements (see `./components`). No product copy
 * lives in this package.
 */

export interface EmailClient {
  readonly resend: Resend;
  readonly sendEmail: (message: SendEmailInput) => Promise<SendEmailResult>;
}

export interface SendEmailInput {
  readonly from: string;
  readonly to: string | string[];
  readonly subject: string;
  readonly react: ReactElement;
  readonly replyTo?: string;
}

export interface SendEmailResult {
  readonly id: string | null;
  readonly error: string | null;
}

export function createEmailClient(apiKey: string): EmailClient {
  const resend = new Resend(apiKey);
  return {
    resend,
    sendEmail: async (message) => {
      const { data, error } = await resend.emails.send({
        from: message.from,
        to: message.to,
        subject: message.subject,
        react: message.react,
        replyTo: message.replyTo,
      });
      return { id: data?.id ?? null, error: error ? error.message : null };
    },
  };
}
