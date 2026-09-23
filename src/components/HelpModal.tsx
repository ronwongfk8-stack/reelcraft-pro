import React, { useState } from 'react';
import { X, LifeBuoy, Mail, FileText, ShieldCheck, ExternalLink } from 'lucide-react';
import { TERMS_OF_SERVICE, PRIVACY_POLICY } from '../data/legalContent';

export const SUPPORT_EMAIL = 'support@reelcraftpro.com';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'help' | 'terms' | 'privacy';
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose, initialTab = 'help' }) => {
  const [activeTab, setActiveTab] = useState<'help' | 'terms' | 'privacy'>(initialTab);

  if (!isOpen) return null;

  const mailtoHref = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
    'ReelCraft PRO — Support Request'
  )}&body=${encodeURIComponent(
    'Describe your issue here...\n\n---\nPlease keep the details below, they help us help you faster:\nBrowser: \nWhat you were trying to do: \nWhat happened instead: \n'
  )}`;

  const tabs: { id: 'help' | 'terms' | 'privacy'; label: string; icon: React.ReactNode }[] = [
    { id: 'help', label: 'Help & Contact', icon: <LifeBuoy className="w-3.5 h-3.5" /> },
    { id: 'terms', label: 'Terms of Service', icon: <FileText className="w-3.5 h-3.5" /> },
    { id: 'privacy', label: 'Privacy Policy', icon: <ShieldCheck className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-950 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <LifeBuoy className="w-5 h-5 text-amber-400" />
            <h2 className="text-slate-100 font-bold text-sm">Help & Legal</h2>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-2 border-b border-slate-800/80">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === tab.id
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {activeTab === 'help' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-slate-100 font-bold text-sm mb-2">Need assistance?</h3>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Whether it's a billing question, a bug you've run into, or something not working as expected —
                  send us a message and we'll get back to you.
                </p>
              </div>

              <a
                href={mailtoHref}
                className="flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-bold text-sm py-3 rounded-xl shadow-md shadow-amber-500/20 transition-all"
              >
                <Mail className="w-4 h-4" />
                <span>Email {SUPPORT_EMAIL}</span>
              </a>

              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-3">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Before you write in, quick things to check
                </p>
                <ul className="space-y-2 text-xs text-slate-400">
                  <li className="flex gap-2">
                    <span className="text-amber-400">•</span>
                    <span>
                      Credit balance looks wrong? Try the <strong className="text-slate-300">"Already Paid? Restore Email Credits"</strong> option
                      in the pricing panel with the email you purchased with.
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-amber-400">•</span>
                    <span>Export not starting? Make sure all your photos have finished uploading first.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-amber-400">•</span>
                    <span>Include your browser and what you were doing when the issue happened — it helps us fix it faster.</span>
                  </li>
                </ul>
              </div>
            </div>
          )}

          {activeTab === 'terms' && (
            <pre className="whitespace-pre-wrap font-sans text-xs text-slate-400 leading-relaxed">
              {TERMS_OF_SERVICE}
            </pre>
          )}

          {activeTab === 'privacy' && (
            <pre className="whitespace-pre-wrap font-sans text-xs text-slate-400 leading-relaxed">
              {PRIVACY_POLICY}
            </pre>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
          <span>ReelCraft PRO</span>
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="flex items-center gap-1 text-amber-400 hover:text-amber-300 transition-colors"
          >
            <span>{SUPPORT_EMAIL}</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
};
