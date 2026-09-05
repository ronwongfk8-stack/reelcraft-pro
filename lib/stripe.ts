import Stripe from 'stripe';

export const CREDIT_PACK_SIZE = 30;
export const CREDIT_PACK_PRICE_USD = 30;

export function getStripeClient(): Stripe | null {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return null;
  return new Stripe(secretKey);
}

// Resolves the app's own public URL for Stripe redirect targets.
// APP_URL wins if set; otherwise falls back to Vercel's per-deployment URL.
export function getAppUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}
