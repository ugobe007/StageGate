import type { Request, Response } from "express";
import { getDb } from "../db";
import { eq } from "drizzle-orm";
import { serviceOrders, orderItems, services, users } from "../../drizzle/schema";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Stripe = require("stripe");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new Stripe(key, { apiVersion: "2025-04-30.basil" }) as any;
}

export function stripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/**
 * Create a Stripe Checkout Session for a service order.
 * Returns the hosted Checkout URL to redirect the customer to.
 */
export async function createCheckoutSession(
  orderId: number,
  successUrl: string,
  cancelUrl: string
): Promise<string> {
  const stripe = getStripe();
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const orderRows = await db.select().from(serviceOrders).where(eq(serviceOrders.id, orderId)).limit(1);
  const order = orderRows[0];
  if (!order) throw new Error(`Order ${orderId} not found`);
  if (order.stripePaymentStatus === "paid") throw new Error("Order is already paid");

  const items = await db
    .select({
      id: orderItems.id,
      qty: orderItems.quantity,
      unitPrice: orderItems.unitPrice,
      serviceId: orderItems.serviceId,
    })
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));

  // Fetch service names for line item descriptions
  const serviceIdSet = Array.from(new Set(items.map((i) => i.serviceId)));
  const svcRows = serviceIdSet.length
    ? await db.select({ id: services.id, name: services.name }).from(services)
    : [];
  const svcMap = new Map(svcRows.map((s) => [s.id, s.name]));

  const lineItems = items
    .filter((i) => i.unitPrice && Number(i.unitPrice) > 0)
    .map((i) => ({
      price_data: {
        currency: "usd",
        unit_amount: Math.round(Number(i.unitPrice) * 100),
        product_data: {
          name: svcMap.get(i.serviceId) ?? `Service #${i.serviceId}`,
        },
      },
      quantity: i.qty,
    }));

  if (lineItems.length === 0) {
    // Fallback: use order total if no itemized prices
    const total = Number(order.totalAmount ?? 0);
    if (total <= 0) throw new Error("Order has no billable amount");
    lineItems.push({
      price_data: {
        currency: "usd",
        unit_amount: Math.round(total * 100),
        product_data: { name: `StageGate Order #${orderId}` },
      },
      quantity: 1,
    });
  }

  const userRows = order.userId
    ? await db
        .select({ email: users.email, name: users.name })
        .from(users)
        .where(eq(users.id, order.userId))
        .limit(1)
    : [];
  const user = userRows[0] ?? null;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: lineItems,
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { orderId: String(orderId) },
    ...(user?.email ? { customer_email: user.email } : {}),
  });

  // Persist session ID so we can reconcile via webhook
  await db
    .update(serviceOrders)
    .set({ stripeCheckoutSessionId: session.id, updatedAt: new Date() })
    .where(eq(serviceOrders.id, orderId));

  if (!session.url) throw new Error("Stripe returned no checkout URL");
  return session.url as string;
}

/**
 * Express handler for Stripe webhook events.
 * Mount at POST /api/webhooks/stripe
 */
export async function stripeWebhookHandler(req: Request, res: Response) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const stripe = getStripe();
  const sig = req.headers["stripe-signature"] as string | undefined;
  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let event: any;

  try {
    if (webhookSecret && sig && rawBody) {
      event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    } else {
      event = req.body;
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[stripe-webhook] signature verification failed:", msg);
    return res.status(400).json({ error: "Webhook signature verification failed" });
  }

  try {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const orderId = session.metadata?.orderId ? Number(session.metadata.orderId) : null;

      if (orderId) {
        await db
          .update(serviceOrders)
          .set({
            status: "paid",
            stripePaymentStatus: "paid",
            stripePaymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : null,
            paidAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(serviceOrders.id, orderId));

        console.log(`[stripe-webhook] Order ${orderId} marked as paid`);
      }
    }

    if (event.type === "checkout.session.expired") {
      const session = event.data.object;
      const orderId = session.metadata?.orderId ? Number(session.metadata.orderId) : null;
      if (orderId) {
        await db
          .update(serviceOrders)
          .set({ stripePaymentStatus: "expired", updatedAt: new Date() })
          .where(eq(serviceOrders.id, orderId));
      }
    }

    res.json({ received: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[stripe-webhook] processing error:", msg);
    res.status(500).json({ error: msg });
  }
}
