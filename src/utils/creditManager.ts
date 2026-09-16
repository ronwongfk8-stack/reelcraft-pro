import { UserCreditAccount } from '../types';

const DEVICE_ID_KEY = 'reelcraft_device_id';
const EMAIL_KEY = 'reelcraft_user_email';

export function getOrCreateDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = `mac_${Math.random().toString(36).substring(2, 11)}_${Date.now().toString(36)}`;
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

export function getStoredEmail(): string {
  return localStorage.getItem(EMAIL_KEY) || '';
}

export function setStoredEmail(email: string) {
  if (email) {
    localStorage.setItem(EMAIL_KEY, email.trim().toLowerCase());
  }
}

export async function fetchUserCreditAccount(): Promise<{
  account: UserCreditAccount;
  available: number;
}> {
  const deviceId = getOrCreateDeviceId();
  const email = getStoredEmail();

  try {
    const query = new URLSearchParams();
    if (email) query.set('email', email);
    if (deviceId) query.set('deviceId', deviceId);

    const res = await fetch(`/api/credits?${query.toString()}`);
    if (res.ok) {
      const data = await res.json();
      return {
        account: {
          email: data.email || email,
          deviceId: data.deviceId || deviceId,
          freeTrialUsed: data.freeTrialUsed,
          paidCredits: data.paidCredits,
        },
        available: data.available,
      };
    }
  } catch (err) {
    console.warn('Unable to sync credits with server, fallback to local', err);
  }

  // Fallback to local default
  return {
    account: {
      email,
      deviceId,
      freeTrialUsed: false,
      paidCredits: 0,
    },
    available: 1, // 1 free trial default
  };
}

export async function deductCredit(): Promise<{
  success: boolean;
  account: UserCreditAccount;
  remainingTotal: number;
  warningLow: boolean;
  reason?: string;
}> {
  const deviceId = getOrCreateDeviceId();
  const email = getStoredEmail();

  try {
    const res = await fetch('/api/credits/deduct', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, deviceId }),
    });

    const data = await res.json();
    if (res.ok && data.success) {
      return {
        success: true,
        account: data.account,
        remainingTotal: data.remainingTotal,
        warningLow: data.remainingTotal <= 3,
      };
    } else {
      return {
        success: false,
        account: data.account || { email, deviceId, freeTrialUsed: true, paidCredits: 0 },
        remainingTotal: data.available || 0,
        warningLow: false,
        reason: data.reason || 'NO_CREDITS',
      };
    }
  } catch (err) {
    console.error('Deduct credit error:', err);
    return {
      success: false,
      account: { email, deviceId, freeTrialUsed: true, paidCredits: 0 },
      remainingTotal: 0,
      warningLow: false,
      reason: 'NETWORK_ERROR',
    };
  }
}

// Starts a real Stripe Checkout flow: the backend creates a hosted Checkout
// Session and returns its URL. We redirect the browser there — this app
// never collects or transmits raw card details itself. Credits are granted
// server-side only after Stripe's webhook confirms payment; this call does
// not add credits by itself.
export async function startCheckout(userEmail: string): Promise<{
  success: boolean;
  url?: string;
  error?: string;
}> {
  const deviceId = getOrCreateDeviceId();
  setStoredEmail(userEmail);

  try {
    const res = await fetch('/api/checkout/create-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userEmail, deviceId }),
    });

    const data = await res.json();
    if (res.ok && data.success && data.url) {
      return { success: true, url: data.url };
    }
    return {
      success: false,
      error: data.error || 'Unable to start checkout. Please try again.',
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Checkout network error.',
    };
  }
}

// Polls whether a completed Stripe Checkout session has been credited yet.
// Used right after the user is redirected back from Stripe, since webhook
// delivery is asynchronous and may lag a second or two behind the redirect.
export async function pollCheckoutSession(sessionId: string): Promise<{
  paymentStatus?: string;
  credited: boolean;
}> {
  try {
    const res = await fetch(`/api/checkout/session-status?session_id=${encodeURIComponent(sessionId)}`);
    const data = await res.json();
    if (res.ok && data.success) {
      return { paymentStatus: data.paymentStatus, credited: data.credited };
    }
  } catch (err) {
    console.warn('Unable to poll checkout session status', err);
  }
  return { credited: false };
}

export async function restoreCredits(userEmail: string): Promise<{
  success: boolean;
  account?: UserCreditAccount;
  remainingTotal?: number;
  error?: string;
}> {
  const deviceId = getOrCreateDeviceId();
  setStoredEmail(userEmail);

  try {
    const res = await fetch('/api/credits/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userEmail, deviceId }),
    });

    const data = await res.json();
    if (res.ok && data.success) {
      return {
        success: true,
        account: data.account,
        remainingTotal: data.remainingTotal,
      };
    } else {
      return {
        success: false,
        error: data.error || 'No account found with this email.',
      };
    }
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Restore network error.',
    };
  }
}
