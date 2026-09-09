import type { VercelRequest, VercelResponse } from '@vercel/node';
import { deductCredit, availableCredits } from '../../lib/db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, deviceId } = req.body || {};

  // Atomic in Postgres: reads and spends the credit within one row-locked
  // transaction, so two concurrent export requests can't both succeed on
  // the same last credit.
  const { account, deducted } = await deductCredit(email, deviceId);

  if (!deducted) {
    return res.status(402).json({
      success: false,
      reason: 'NO_CREDITS',
      account,
      available: 0,
    });
  }

  const remainingTotal = availableCredits(account);
  res.status(200).json({
    success: true,
    account,
    remainingTotal,
    warningLow: remainingTotal <= 3,
  });
}
