import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getStripeClient } from '../../lib/stripe.js';
import { isSessionProcessed } from '../../lib/db.js';

// Webhook delivery is async, usually near-instant but not guaranteed to
// beat the browser's redirect back to the app — this lets the client poll
// rather than trusting the redirect URL itself as proof of payment.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sessionId = typeof req.query.session_id === 'string' ? req.query.session_id : undefined;
  if (!sessionId) {
    return res.status(400).json({ success: false, error: 'session_id is required' });
  }

  const stripe = getStripeClient();
  if (!stripe) {
    return res.status(503).json({ success: false, error: 'Payments are not configured on this server.' });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const credited = await isSessionProcessed(session.id);
    res.status(200).json({
      success: true,
      paymentStatus: session.payment_status,
      credited,
    });
  } catch (err) {
    res.status(404).json({ success: false, error: 'Session not found.' });
  }
}
