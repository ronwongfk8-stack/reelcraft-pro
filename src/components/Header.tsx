import React from 'react';
import { Film, Sparkles, Wand2, PlayCircle } from 'lucide-react';
import { PROPERTY_PRESETS } from '../data/sampleAssets';
import { PropertyPreset, UserCreditAccount } from '../types';
import { CreditBadge } from './CreditBadge';

interface HeaderProps {
  projectTitle: string;
  onUpdateTitle: (title: string) => void;
  onSelectPreset: (preset: PropertyPreset) => void;
  onOpenAiModal: () => void;
  onReturnToWelcome?: () => void;
  currentAccount: UserCreditAccount | null;
  totalAvailable: number;
  onOpenPricing: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  projectTitle,
  onUpdateTitle,
  onSelectPreset,
  onOpenAiModal,
  onReturnToWelcome,
  currentAccount,
  totalAvailable,
  onOpenPricing,
}) => {
  return (
    <header className="bg-slate-900 border-b border-slate-800 px-4 lg:px-8 py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-0 z-40 shadow-lg">
      <div className="flex items-center gap-3">
        <div
          onClick={onReturnToWelcome}
          className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-amber-400 to-yellow-300 p-0.5 shadow-md shadow-amber-500/20 flex items-center justify-center cursor-pointer hover:scale-105 transition-transform"
          title="Return to Industry Welcome Page"
        >
          <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
            <Film className="w-5 h-5 text-amber-400" />
          </div>
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              onClick={onReturnToWelcome}
              className="text-sm md:text-base font-black tracking-wide text-white flex items-center gap-1.5 bg-slate-800/90 px-2.5 py-1 rounded-lg border border-slate-700/80 shadow-sm cursor-pointer hover:border-amber-500/50 transition-colors"
              title="Return to Industry Welcome Page"
            >
              <span className="text-amber-400 font-extrabold">ReelCraft</span>
              <span className="bg-amber-400 text-slate-950 text-[10px] px-1.5 py-0.5 rounded font-black tracking-wider">PRO</span>
            </span>
            <span className="text-slate-600 font-bold hidden sm:inline">&bull;</span>
            <input
              type="text"
              value={projectTitle}
              onChange={(e) => onUpdateTitle(e.target.value)}
              className="bg-transparent text-slate-200 font-semibold text-sm md:text-base focus:outline-none focus:ring-1 focus:ring-amber-500/50 rounded px-1.5 hover:bg-slate-800/50 transition-colors max-w-[220px] md:max-w-[320px] truncate"
              placeholder="Project Name..."
            />
          </div>
          <p className="text-xs text-amber-400 font-semibold px-1 mt-0.5">
            Turn Photos into Stunning AI Marketing Videos
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 md:gap-3">
        {/* Credit Badge & Pricing Modal Trigger */}
        <CreditBadge
          currentAccount={currentAccount}
          totalAvailable={totalAvailable}
          onOpenPricing={onOpenPricing}
        />

        {/* Return to Industry Landing Page */}
        {onReturnToWelcome && (
          <button
            onClick={onReturnToWelcome}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-3 py-2 rounded-lg border border-slate-700 transition-colors"
          >
            <Wand2 className="w-3.5 h-3.5 text-amber-400" />
            <span>Select Industry</span>
          </button>
        )}
        {/* Preset Selector Dropdown */}
        <div className="relative group">
          <button className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-3 py-2 rounded-lg border border-slate-700 transition-colors">
            <PlayCircle className="w-4 h-4 text-amber-400" />
            <span>Load Preset Templates</span>
          </button>
          
          <div className="absolute right-0 top-full mt-1.5 w-72 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-2 hidden group-hover:block z-50">
            <p className="text-[11px] font-semibold text-slate-400 px-2 py-1 uppercase tracking-wider">
              Quick Property Presets
            </p>
            {PROPERTY_PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => onSelectPreset(p)}
                className="w-full text-left p-2.5 rounded-lg hover:bg-slate-800/80 text-slate-200 transition-colors flex flex-col gap-0.5"
              >
                <div className="flex items-center justify-between text-xs font-semibold text-amber-300">
                  <span>{p.name}</span>
                  <span className="text-[10px] bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/20">
                    {p.aspectRatio}
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 line-clamp-1">
                  {p.description}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* AI Assistant Generator Modal Trigger */}
        <button
          onClick={onOpenAiModal}
          className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-bold text-xs px-3.5 py-2 rounded-lg shadow-md shadow-amber-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          <Sparkles className="w-4 h-4 fill-slate-950" />
          <span>AI Caption & Voice Script</span>
        </button>
      </div>
    </header>
  );
};
