import Stripe from "stripe";

/**
 * Generic Stripe helpers: a client factory, a checkout-session helper, and
 * webhook signature verification. Product-specific prices/products are passed
 * in by callers — none are defined here.
 */

export function createStripeClient(secretKey: string): Stripe {
  return new Stripe(secretKey, { typescript: true });
}

export interface CheckoutSessionInput {
  readonly priceId: string;
  readonly quantity?: number;
  readonly mode?: Stripe.Checkout.SessionCreateParams.Mode;
  readonly successUrl: string;
  readonly cancelUrl: string;
  readonly customerId?: string;
  readonly clientReferenceId?: string;
  readonly metadata?: Record<string, string>;
}

export async function createCheckoutSession(
  stripe: Stripe,
  input: CheckoutSessionInput,
): Promise<{ id: string; url: string | null }> {
  const session = await stripe.checkout.sessions.create({
    mode: input.mode ?? "subscription",
    line_items: [{ price: input.priceId, quantity: input.quantity ?? 1 }],
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    customer: input.customerId,
    client_reference_id: input.clientReferenceId,
    metadata: input.metadata,
  });
  return { id: session.id, url: session.url };
}

/**
 * Verify + parse a Stripe webhook. Throws if the signature is invalid. Use the
 * raw request body (string/Buffer), not the parsed JSON.
 */
export function constructWebhookEvent(
  stripe: Stripe,
  payload: string | Buffer,
  signature: string,
  webhookSecret: string,
): Stripe.Event {
  return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
}

export { Stripe };
