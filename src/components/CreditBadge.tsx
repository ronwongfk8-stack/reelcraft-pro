import React from 'react';
import { Zap, Gift, PlusCircle, AlertCircle } from 'lucide-react';
import { UserCreditAccount } from '../types';

interface CreditBadgeProps {
  currentAccount: UserCreditAccount | null;
  totalAvailable: number;
  onOpenPricing: () => void;
}

export const CreditBadge: React.FC<CreditBadgeProps> = ({
  currentAccount,
  totalAvailable,
  onOpenPricing,
}) => {
  const isFreeTrial = currentAccount && !currentAccount.freeTrialUsed && currentAccount.paidCredits === 0;

  return (
    <button
      onClick={onOpenPricing}
      type="button"
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-bold text-xs transition-all hover:scale-105 ${
        totalAvailable <= 0
          ? 'bg-red-500/10 border-red-500/40 text-red-400 hover:bg-red-500/20'
          : totalAvailable <= 3
          ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 hover:bg-amber-500/30 animate-pulse'
          : 'bg-slate-900 border-amber-500/40 text-amber-400 hover:border-amber-400 hover:bg-slate-850'
      }`}
      title="Click to check or top up video credits ($30 for 30 videos - No Expiration)"
    >
      {totalAvailable <= 0 ? (
        <>
          <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
          <span>0 Credits (Top Up)</span>
        </>
      ) : isFreeTrial ? (
        <>
          <Gift className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>1 Free Testing Video</span>
        </>
      ) : (
        <>
          <Zap className="w-3.5 h-3.5 fill-amber-400 text-amber-400 shrink-0" />
          <span>{totalAvailable} Video Credit{totalAvailable === 1 ? '' : 's'}</span>
        </>
      )}

      <PlusCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 ml-0.5 opacity-80" />
    </button>
  );
};
