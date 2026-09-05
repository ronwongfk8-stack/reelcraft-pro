import React, { useState } from 'react';
import { Sparkles, X, Wand2, Copy, Check, FileText } from 'lucide-react';
import { SlideItem } from '../types';

interface AiAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  slides: SlideItem[];
  onApplyCaptions: (captions: string[]) => void;
}

export const AiAssistantModal: React.FC<AiAssistantModalProps> = ({
  isOpen,
  onClose,
  slides,
  onApplyCaptions,
}) => {
  const [propertyType, setPropertyType] = useState('Supercar / Luxury Condo / Hotel Resort / Diamond Fine Jewelry');
  const [features, setFeatures] = useState(
    'V8 Twin-Turbo engine, Italian leather cockpit, Carbon fiber aerodynamics, Panoramic ocean views, Heated pool, Gourmet dining, 18K Rose gold handcrafted detailing'
  );
  const [address, setAddress] = useState('Downtown Showroom / Prime District');
  const [price, setPrice] = useState('$185,000 / Special Launch Offer');

  const [isLoading, setIsLoading] = useState(false);
  const [generatedScript, setGeneratedScript] = useState('');
  const [copiedScript, setCopiedScript] = useState(false);

  if (!isOpen) return null;

  const handleGenerateCaptions = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/generate-captions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyType,
          features,
          imageCount: slides.length || 5,
        }),
      });
      const data = await res.json();
      if (data.captions && Array.isArray(data.captions)) {
        onApplyCaptions(data.captions);
        onClose();
      }
    } catch (err) {
      console.error('Error generating captions:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateScript = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/generate-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyType,
          address,
          price,
          keyFeatures: features,
        }),
      });
      const data = await res.json();
      if (data.script) {
        setGeneratedScript(data.script);
      }
    } catch (err) {
      console.error('Error generating script:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl p-5 md:p-6 shadow-2xl space-y-4">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
              <Sparkles className="w-4 h-4 fill-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">AI Marketing Video Copy Assistant</h3>
              <p className="text-[11px] text-slate-400">
                Generate high-converting slide captions & voiceover scripts for any industry powered by Gemini AI
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Property / Product Input Form */}
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                Product / Industry Category
              </label>
              <input
                type="text"
                value={propertyType}
                onChange={(e) => setPropertyType(e.target.value)}
                className="w-full bg-slate-950 text-xs text-slate-200 border border-slate-800 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-amber-500"
                placeholder="e.g. Automobile, Hotel, Real Estate"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                Location / Brand / Address
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full bg-slate-950 text-xs text-slate-200 border border-slate-800 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-amber-500"
                placeholder="e.g. Showroom or Location"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                Price / Offer
              </label>
              <input
                type="text"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full bg-slate-950 text-xs text-slate-200 border border-slate-800 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-amber-500"
                placeholder="e.g. $185,000 / $2,800,000"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-300 block mb-1">
              Key Features & Selling Points
            </label>
            <textarea
              rows={3}
              value={features}
              onChange={(e) => setFeatures(e.target.value)}
              className="w-full bg-slate-950 text-xs text-slate-200 border border-slate-800 rounded-lg p-2.5 focus:outline-none focus:border-amber-500"
              placeholder="e.g. Horsepower, interior, ocean view, gourmet tasting course..."
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-800">
          <button
            onClick={handleGenerateCaptions}
            disabled={isLoading}
            className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-bold text-xs py-2.5 rounded-xl shadow transition-colors disabled:opacity-50"
          >
            <Wand2 className="w-4 h-4 fill-slate-950" />
            <span>Generate Captions for All {slides.length} Slides</span>
          </button>

          <button
            onClick={handleGenerateScript}
            disabled={isLoading}
            className="flex-1 flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs py-2.5 rounded-xl border border-slate-700 transition-colors disabled:opacity-50"
          >
            <FileText className="w-4 h-4 text-amber-400" />
            <span>Generate Voiceover Script</span>
          </button>
        </div>

        {/* Generated Script Display Box */}
        {generatedScript && (
          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-amber-400">
              <span>Generated AI Marketing Voiceover Script:</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(generatedScript);
                  setCopiedScript(true);
                  setTimeout(() => setCopiedScript(false), 2000);
                }}
                className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white"
              >
                {copiedScript ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedScript ? 'Copied!' : 'Copy Script'}</span>
              </button>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed italic bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/80">
              "{generatedScript}"
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
