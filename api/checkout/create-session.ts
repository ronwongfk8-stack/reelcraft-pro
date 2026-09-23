import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getStripeClient, getAppUrl, CREDIT_PACK_SIZE, CREDIT_PACK_PRICE_USD } from '../../lib/stripe.js';

// Creates a Stripe-hosted Checkout Session. The client is redirected to
// Stripe's own page to enter card details — this server never sees or
// handles raw card data. Credits are granted only once Stripe confirms
// payment via the webhook, not from this response.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, deviceId } = req.body || {};
  if (!email || !email.includes('@')) {
    return res.status(400).json({ success: false, error: 'A valid email address is required' });
  }

  const stripe = getStripeClient();
  if (!stripe) {
    return res.status(503).json({
      success: false,
      error: 'Payments are not configured on this server (missing STRIPE_SECRET_KEY).',
    });
  }

  const cleanEmail = email.trim().toLowerCase();
  const appUrl = getAppUrl();

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: cleanEmail,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: CREDIT_PACK_PRICE_USD * 100,
            product_data: {
              name: `${CREDIT_PACK_SIZE} Video Credits — ReelCraft PRO`,
              description: 'One-time top-up, credits never expire',
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        email: cleanEmail,
        deviceId: deviceId || '',
      },
      success_url: `${appUrl}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/?checkout=cancel`,
    });

    res.status(200).json({ success: true, url: session.url });
  } catch (err: any) {
    console.error('Stripe checkout session creation failed:', err.message);
    res.status(500).json({ success: false, error: 'Unable to start checkout. Please try again.' });
  }
}
