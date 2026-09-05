import type { VercelRequest, VercelResponse } from '@vercel/node';
import { findAccountByEmail, relinkDevice, availableCredits } from '../../lib/db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, deviceId } = req.body || {};
  if (!email || !email.includes('@')) {
    return res.status(400).json({ success: false, error: 'Valid email address is required' });
  }

  const cleanEmail = email.trim().toLowerCase();

  // Read-only lookup — restore must never create a new account as a side
  // effect. An email we've never seen gets a clean 404, no phantom record.
  const existing = await findAccountByEmail(cleanEmail);
  if (!existing) {
    return res.status(404).json({
      success: false,
      error: 'No credits found for this email address.',
    });
  }

  const account = deviceId ? await relinkDevice(cleanEmail, deviceId) : existing;

  res.status(200).json({
    success: true,
    account,
    remainingTotal: availableCredits(account),
  });
}
