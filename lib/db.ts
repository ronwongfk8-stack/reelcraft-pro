import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface AccountRecord {
  email: string;
  deviceId: string;
  freeTrialUsed: boolean;
  paidCredits: number;
  lastUpdated: string;
}

// Row shape as returned by Postgres/PostgREST (snake_case).
interface AccountRow {
  id: string;
  email: string | null;
  device_id: string | null;
  free_trial_used: boolean;
  paid_credits: number;
  updated_at: string;
}

let client: SupabaseClient | null = null;

// Uses the service_role key — this must ONLY ever be imported from files
// under /api. It bypasses Row Level Security by design, which is exactly
// why it must never be shipped to the browser (no VITE_ / NEXT_PUBLIC_
// prefix on the corresponding env var).
function getClient(): SupabaseClient {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not configured.');
  }
  client = createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });
  return client;
}

function toAccountRecord(row: AccountRow): AccountRecord {
  return {
    email: row.email || '',
    deviceId: row.device_id || '',
    freeTrialUsed: row.free_trial_used,
    paidCredits: row.paid_credits,
    lastUpdated: row.updated_at,
  };
}

export async function getOrInitAccount(email?: string, deviceId?: string): Promise<AccountRecord> {
  const { data, error } = await getClient().rpc('get_or_create_account', {
    p_email: email || null,
    p_device_id: deviceId || null,
  });
  if (error) throw new Error(`get_or_create_account failed: ${error.message}`);
  return toAccountRecord(data as AccountRow);
}

// Read-only lookup — used by /api/credits/restore, which must never create
// a new account as a side effect of checking whether one exists.
export async function findAccountByEmail(email: string): Promise<AccountRecord | null> {
  const cleanEmail = email.trim().toLowerCase();
  const { data, error } = await getClient()
    .from('credit_accounts')
    .select('*')
    .eq('email', cleanEmail)
    .maybeSingle();
  if (error) throw new Error(`findAccountByEmail failed: ${error.message}`);
  return data ? toAccountRecord(data as AccountRow) : null;
}

// Reattaches an existing account to a new device (used by restore, after
// findAccountByEmail has already confirmed the account exists).
export async function relinkDevice(email: string, deviceId: string): Promise<AccountRecord> {
  return getOrInitAccount(email, deviceId);
}

// Atomically spends one credit (free trial, then paid). Row-locked in
// Postgres so two concurrent export requests can't both succeed on the
// account's last credit.
export async function deductCredit(
  email: string | undefined,
  deviceId: string | undefined
): Promise<{ account: AccountRecord; deducted: boolean }> {
  const { data, error } = await getClient().rpc('deduct_credit', {
    p_email: email || null,
    p_device_id: deviceId || null,
  });
  if (error) throw new Error(`deduct_credit failed: ${error.message}`);
  const row = Array.isArray(data) ? data[0] : data;
  return {
    account: {
      email: row.email || '',
      deviceId: row.device_id || '',
      freeTrialUsed: row.free_trial_used,
      paidCredits: row.paid_credits,
      lastUpdated: new Date().toISOString(),
    },
    deducted: row.deducted,
  };
}

// Server-side-only credit grant. Called exclusively from the verified
// Stripe webhook handler, never from a client-facing route.
export async function grantPaidCredits(
  email: string,
  deviceId: string | undefined,
  amount: number
): Promise<AccountRecord> {
  const { data, error } = await getClient().rpc('increment_paid_credits', {
    p_email: email,
    p_device_id: deviceId || null,
    p_amount: amount,
  });
  if (error) throw new Error(`increment_paid_credits failed: ${error.message}`);
  return toAccountRecord(data as AccountRow);
}

export function availableCredits(account: AccountRecord): number {
  return (account.freeTrialUsed ? 0 : 1) + account.paidCredits;
}

// Idempotency guard so a Stripe webhook retry can never grant credits twice.
export async function isSessionProcessed(sessionId: string): Promise<boolean> {
  const { data, error } = await getClient()
    .from('stripe_processed_sessions')
    .select('session_id')
    .eq('session_id', sessionId)
    .maybeSingle();
  if (error) throw new Error(`isSessionProcessed failed: ${error.message}`);
  return data != null;
}

export async function markSessionProcessed(sessionId: string): Promise<void> {
  const { error } = await getClient().from('stripe_processed_sessions').insert({ session_id: sessionId });
  // A unique-violation here means a concurrent webhook delivery already
  // marked this session — that's fine, it's exactly what the guard is for.
  if (error && error.code !== '23505') {
    throw new Error(`markSessionProcessed failed: ${error.message}`);
  }
}
