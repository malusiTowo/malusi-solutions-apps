import { constructWebhookEvent, createStripeClient } from "@repo/payments";
import { env } from "~/env";

export const runtime = "nodejs";

/** Stripe webhook receiver (stub). Verifies the signature, then logs the event.
 *  Product-specific handling (grant coins, upgrade tier) is a follow-up. */
export async function POST(req: Request): Promise<Response> {
  const secretKey = env.STRIPE_SECRET_KEY;
  const webhookSecret = env.STRIPE_WEBHOOK_SECRET;
  if (!secretKey || !webhookSecret) {
    return new Response("Stripe not configured", { status: 501 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) return new Response("Missing signature", { status: 400 });

  const payload = await req.text();
  try {
    const stripe = createStripeClient(secretKey);
    const event = constructWebhookEvent(stripe, payload, signature, webhookSecret);
    console.log(`[stripe] received ${event.type}`);
    // TODO(habitual): handle checkout.session.completed, customer.subscription.*
    return Response.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid payload";
    return new Response(`Webhook error: ${message}`, { status: 400 });
  }
}
