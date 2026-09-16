import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getOrInitAccount, availableCredits } from '../../lib/db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const email = typeof req.query.email === 'string' ? req.query.email : undefined;
  const deviceId = typeof req.query.deviceId === 'string' ? req.query.deviceId : undefined;

  const account = await getOrInitAccount(email, deviceId);
  res.status(200).json({ ...account, available: availableCredits(account) });
}
