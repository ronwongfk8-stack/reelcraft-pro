import React, { useState } from 'react';
import {
  X,
  CheckCircle2,
  Sparkles,
  Lock,
  Zap,
  Clock,
  ShieldCheck,
  Mail,
  RefreshCw,
  Gift,
  AlertTriangle,
  Film
} from 'lucide-react';
import { startCheckout, restoreCredits } from '../utils/creditManager';
import { UserCreditAccount } from '../types';

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentAccount: UserCreditAccount | null;
  totalAvailable: number;
  onCreditsUpdated: (account: UserCreditAccount, totalAvailable: number) => void;
  isLowBalanceNotice?: boolean;
  onBeforeCheckout?: () => void;
}

export const PricingModal: React.FC<PricingModalProps> = ({
  isOpen,
  onClose,
  currentAccount,
  totalAvailable,
  onCreditsUpdated,
  isLowBalanceNotice = false,
  onBeforeCheckout,
}) => {
  const [activeTab, setActiveTab] = useState<'buy' | 'restore'>('buy');
  const [email, setEmail] = useState(currentAccount?.email || '');

  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOpen) return null;

  const handlePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setStatusMessage({ type: 'error', text: 'Please enter a valid email address for your Stripe receipt.' });
      return;
    }

    setIsLoading(true);
    setStatusMessage(null);

    // Stripe Checkout is a full-page redirect away from this app and back
    // — that navigation wipes all in-memory React state (photos, captions,
    // styling), so save a snapshot right before leaving to make sure it's
    // there when the user returns.
    onBeforeCheckout?.();

    // This only asks the backend to create a Stripe Checkout Session and
    // hands back Stripe's own hosted payment page URL — no card details
    // ever pass through this app or this component.
    const result = await startCheckout(email);

    if (result.success && result.url) {
      window.location.href = result.url;
      return;
    }

    setIsLoading(false);
    setStatusMessage({
      type: 'error',
      text: result.error || 'Unable to start checkout. Please try again.',
    });
  };

  const handleRestore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setStatusMessage({ type: 'error', text: 'Please enter a valid email address.' });
      return;
    }

    setIsLoading(true);
    setStatusMessage(null);

    const result = await restoreCredits(email);
    setIsLoading(false);

    if (result.success && result.account && result.remainingTotal !== undefined) {
      setStatusMessage({
        type: 'success',
        text: `Success! Restored account for ${email}. Balance: ${result.remainingTotal} Video Credits.`,
      });
      onCreditsUpdated(result.account, result.remainingTotal);
      setTimeout(() => {
        onClose();
        setStatusMessage(null);
      }, 2000);
    } else {
      setStatusMessage({
        type: 'error',
        text: result.error || 'No credits found for this email address.',
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-amber-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-400 p-0.5 shadow-lg flex items-center justify-center">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Film className="w-5 h-5 text-amber-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-white">ReelCraft PRO Credits</h2>
                <span className="bg-amber-400 text-slate-950 text-[10px] px-2 py-0.5 rounded-full font-black tracking-wider uppercase">
                  No Expiration
                </span>
              </div>
              <p className="text-xs text-slate-400">
                1-Time Free Testing Download &bull; 30 Video Pack for $30
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Low Credit Warning Banner if triggered */}
        {isLowBalanceNotice && (
          <div className="bg-amber-500/10 border-b border-amber-500/30 px-5 py-3 flex items-center gap-3 text-amber-300 text-xs font-semibold">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 animate-pulse" />
            <div>
              <span className="font-bold">Low Credit Balance Notice: </span>
              <span>
                You currently have {totalAvailable} credit{totalAvailable === 1 ? '' : 's'} remaining. Top up 30 video credits for $30 anytime to keep exporting without interruption!
              </span>
            </div>
          </div>
        )}

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Main Offer Card */}
          <div className="relative bg-gradient-to-b from-slate-950 to-slate-900 border border-amber-500/40 rounded-2xl p-5 shadow-inner space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
              <div>
                <div className="inline-flex items-center gap-1.5 bg-amber-400/10 text-amber-400 text-[11px] font-bold px-2.5 py-1 rounded-full border border-amber-400/20 mb-1">
                  <Sparkles className="w-3.5 h-3.5 fill-amber-400" />
                  <span>PRO Export Pass</span>
                </div>
                <h3 className="text-xl font-black text-white">30 Commercial Video Credits</h3>
              </div>

              <div className="text-right">
                <div className="text-3xl font-black text-amber-400">$30.00</div>
                <div className="text-[11px] text-slate-400 font-semibold">$1.00 per video export</div>
              </div>
            </div>

            {/* Feature Highlights Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs text-slate-300">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                <span>30 High-Res 1080p / 4K MP4 Exports</span>
              </div>

              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="font-bold text-amber-300">NO Time Limit &bull; Never Expires</span>
              </div>

              <div className="flex items-center gap-2">
                <Gift className="w-4 h-4 text-amber-400 shrink-0" />
                <span>1 Free Trial Video included per machine</span>
              </div>

              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Unlimited AI Script & Voiceover Generation</span>
              </div>

              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
                <span>No password required (Email linked)</span>
              </div>

              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Custom Draggable Watermark Logos</span>
              </div>
            </div>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => {
                setActiveTab('buy');
                setStatusMessage(null);
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'buy'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Top Up $30 (30 Video Credits)
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('restore');
                setStatusMessage(null);
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'restore'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Already Paid? Restore Email Credits
            </button>
          </div>

          {/* Status Message Alert */}
          {statusMessage && (
            <div
              className={`p-3.5 rounded-xl border text-xs font-bold flex items-center gap-2 ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-red-500/10 border-red-500/30 text-red-300'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}

          {/* Tab 1: Buy 30 Video Pack */}
          {activeTab === 'buy' && (
            <form onSubmit={handlePurchase} className="space-y-4 bg-slate-950/80 p-4 rounded-xl border border-slate-800">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300 block">
                  Stripe Receipt & Account Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. alex@yourcompany.com"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <p className="text-[10px] text-slate-400">
                  We use your email to track your credit balance. No password or sign in needed!
                </p>
              </div>

              {/* Payment happens on Stripe's own hosted page — we redirect there next */}
              <div className="flex items-center gap-2 text-[10px] text-slate-400 pt-1 border-t border-slate-800/80">
                <Lock className="w-3 h-3 text-emerald-400 shrink-0" />
                <span>
                  You'll enter your card details on Stripe's secure checkout page. This app never sees or stores your card number.
                </span>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-sm rounded-xl shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Redirecting to Stripe Checkout...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 fill-slate-950" />
                    <span>Continue to Payment — $30.00</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* Tab 2: Restore Credits */}
          {activeTab === 'restore' && (
            <form onSubmit={handleRestore} className="space-y-4 bg-slate-950/80 p-4 rounded-xl border border-slate-800">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300 block">
                  Enter Your Stripe Purchase Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. alex@yourcompany.com"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <p className="text-[10px] text-slate-400">
                  Enter the email address you used during payment to restore your remaining video credit balance to this machine.
                </p>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold text-xs rounded-xl border border-slate-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 text-amber-400" />
                )}
                <span>Restore Credits for {email || 'Email'}</span>
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-950 p-4 border-t border-slate-800 text-center text-[10px] text-slate-400 flex items-center justify-between">
          <span>ReelCraft PRO &bull; Credits never expire</span>
          <span className="flex items-center gap-1 text-slate-400">
            <Lock className="w-3 h-3 text-emerald-400" /> Secure SSL Billing
          </span>
        </div>
      </div>
    </div>
  );
};
