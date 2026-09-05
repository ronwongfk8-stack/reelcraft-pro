import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { getStripeClient, CREDIT_PACK_SIZE } from '../../lib/stripe.js';
import { grantPaidCredits, isSessionProcessed, markSessionProcessed } from '../../lib/db.js';
import { readRawBody } from '../../lib/rawBody.js';

// Disables Vercel's automatic JSON body parsing for this route — Stripe
// signature verification needs the exact raw request bytes, not a
// re-serialized object.
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const stripe = getStripeClient();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !webhookSecret) {
    console.error('Stripe webhook received but STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET not configured');
    return res.status(500).send('Webhook not configured');
  }

  const signature = req.headers['stripe-signature'];
  const rawBody = await readRawBody(req);

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature as string, webhookSecret);
  } catch (err: any) {
    console.error('Stripe webhook signature verification failed:', err.message);
    return res.status(400).send('Webhook signature verification failed');
  }

  if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
    const session = event.data.object as Stripe.Checkout.Session;

    if (session.payment_status === 'paid') {
      const alreadyProcessed = await isSessionProcessed(session.id);
      if (alreadyProcessed) {
        // Webhook retry for a session we've already credited — ack without re-crediting.
        return res.status(200).json({ received: true, duplicate: true });
      }

      const email = session.metadata?.email || session.customer_details?.email || '';
      const deviceId = session.metadata?.deviceId;

      if (!email) {
        console.error('Stripe session completed with no email in metadata:', session.id);
      } else {
        await grantPaidCredits(email, deviceId, CREDIT_PACK_SIZE);
        await markSessionProcessed(session.id);
      }
    }
  }

  res.status(200).json({ received: true });
}
