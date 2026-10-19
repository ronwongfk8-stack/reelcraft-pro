import React, { useState, useEffect, useRef } from 'react';
import { Studio } from './studio/Studio';
import { WelcomeLandingPage } from './components/WelcomeLandingPage';
import { PricingModal } from './components/PricingModal';
import { HelpModal } from './components/HelpModal';
import { fetchUserCreditAccount, deductCredit, pollCheckoutSession } from './utils/creditManager';
import { hasSavedStudioProject } from './studio/utils/studioStorage';
import { PropertyPreset, UserCreditAccount } from './types';

export default function App() {
  const [showWelcomePage, setShowWelcomePage] = useState(true);

  // Incremented every time the studio is opened from the landing page, so a fresh preset always rebuilds it.
  const [studioKey, setStudioKey] = useState(0);
  const [initialPreset, setInitialPreset] = useState<PropertyPreset | null>(null);

  // Credit Tracking & Pricing State
  const [currentAccount, setCurrentAccount] = useState<UserCreditAccount | null>(null);
  const [totalAvailableCredits, setTotalAvailableCredits] = useState<number>(1);
  const [isPricingModalOpen, setIsPricingModalOpen] = useState<boolean>(false);
  const [helpModalTab, setHelpModalTab] = useState<'help' | 'terms' | 'privacy' | null>(null);
  const [isLowBalanceNotice, setIsLowBalanceNotice] = useState<boolean>(false);

  const [checkoutNotice, setCheckoutNotice] = useState<{ type: 'pending' | 'success' | 'error'; text: string } | null>(null);

  // The studio registers a "save right now" function here so we can flush the latest edit to storage
  // just before redirecting to Stripe Checkout (the page navigates away and wipes in-memory state).
  const saveNowRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    fetchUserCreditAccount().then((data) => {
      setCurrentAccount(data.account);
      setTotalAvailableCredits(data.available);
    });

    // Returning from Stripe Checkout. Credits are only granted once our
    // webhook confirms payment server-side, so we poll briefly rather than
    // trusting the redirect URL itself as proof of payment.
    const params = new URLSearchParams(window.location.search);
    const checkoutState = params.get('checkout');
    const sessionId = params.get('session_id');

    if (checkoutState === 'success' && sessionId) {
      // Skip the welcome page so the confirmation banner is actually visible.
      setShowWelcomePage(false);
      setCheckoutNotice({ type: 'pending', text: 'Confirming your payment…' });

      let attempts = 0;
      const maxAttempts = 10;
      const poll = async () => {
        attempts += 1;
        const result = await pollCheckoutSession(sessionId);
        if (result.credited) {
          const data = await fetchUserCreditAccount();
          setCurrentAccount(data.account);
          setTotalAvailableCredits(data.available);
          setCheckoutNotice({ type: 'success', text: 'Payment confirmed — 30 video credits added!' });
          setTimeout(() => setCheckoutNotice(null), 5000);
        } else if (result.paymentStatus && result.paymentStatus !== 'paid') {
          setCheckoutNotice({ type: 'error', text: 'Payment was not completed.' });
        } else if (attempts < maxAttempts) {
          setTimeout(poll, 1500);
        } else {
          setCheckoutNotice({
            type: 'error',
            text: 'Payment is still processing. Your credits will appear shortly — refresh in a moment.',
          });
        }
      };
      poll();
    } else if (checkoutState === 'cancel') {
      setCheckoutNotice(null);
    }

    if (checkoutState) {
      // Clean the query params out of the URL without a reload.
      window.history.replaceState({}, '', window.location.pathname);
    }

    // A project saved before a reload (or before the Stripe redirect) skips the landing page and reopens.
    hasSavedStudioProject().then((exists) => {
      if (exists) setShowWelcomePage(false);
    });
  }, []);

  const handleDeductCredit = async () => {
    const res = await deductCredit();
    if (res.account) {
      setCurrentAccount(res.account);
      setTotalAvailableCredits(res.remainingTotal);
    }
    return {
      success: res.success,
      remainingTotal: res.remainingTotal,
      warningLow: res.warningLow,
    };
  };

  const handleCreditsUpdated = (account: UserCreditAccount, total: number) => {
    setCurrentAccount(account);
    setTotalAvailableCredits(total);
  };

  const handleOpenPricing = (isLowNotice: boolean = false) => {
    setIsLowBalanceNotice(isLowNotice);
    setIsPricingModalOpen(true);
  };

  const handleSaveProjectNow = async () => {
    await saveNowRef.current?.();
  };

  const openStudio = (preset: PropertyPreset | null) => {
    setInitialPreset(preset);
    setStudioKey((k) => k + 1);
    setShowWelcomePage(false);
  };

  if (showWelcomePage) {
    return (
      <>
        <WelcomeLandingPage
          onSelectIndustry={(preset) => openStudio(preset)}
          onStartCustomUpload={() => openStudio(null)}
          onOpenHelp={(tab) => setHelpModalTab(tab)}
        />
        <HelpModal
          isOpen={helpModalTab !== null}
          onClose={() => setHelpModalTab(null)}
          initialTab={helpModalTab || 'help'}
        />
      </>
    );
  }

  return (
    <>
      {/* Stripe Checkout return notice */}
      {checkoutNotice && (
        <div
          className={`px-4 md:px-8 py-2 text-xs font-semibold text-center ${
            checkoutNotice.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-300 border-b border-emerald-500/30'
              : checkoutNotice.type === 'error'
              ? 'bg-red-500/10 text-red-300 border-b border-red-500/30'
              : 'bg-amber-500/10 text-amber-300 border-b border-amber-500/30'
          }`}
        >
          {checkoutNotice.text}
        </div>
      )}

      <Studio
        key={studioKey}
        initialPreset={initialPreset}
        currentAccount={currentAccount}
        totalAvailableCredits={totalAvailableCredits}
        onDeductCredit={handleDeductCredit}
        onOpenPricing={handleOpenPricing}
        onOpenHelp={(tab) => setHelpModalTab(tab)}
        onReturnToWelcome={() => setShowWelcomePage(true)}
        registerSaveNow={(fn) => {
          saveNowRef.current = fn;
        }}
      />

      {/* Pricing & Credit Top Up Modal */}
      <PricingModal
        isOpen={isPricingModalOpen}
        onClose={() => setIsPricingModalOpen(false)}
        currentAccount={currentAccount}
        totalAvailable={totalAvailableCredits}
        onCreditsUpdated={handleCreditsUpdated}
        isLowBalanceNotice={isLowBalanceNotice}
        onBeforeCheckout={handleSaveProjectNow}
      />

      {/* Help / Contact / Terms / Privacy Modal */}
      <HelpModal
        isOpen={helpModalTab !== null}
        onClose={() => setHelpModalTab(null)}
        initialTab={helpModalTab || 'help'}
      />
    </>
  );
}
