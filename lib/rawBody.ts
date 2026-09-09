import type { IncomingMessage } from 'http';

// Vercel's Node runtime parses JSON bodies into req.body by default, which
// destroys the exact byte sequence Stripe needs for signature verification.
// This route disables that (see `export const config` in webhooks/stripe.ts)
// and reads the raw stream itself instead.
export function readRawBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
