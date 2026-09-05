import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { VideoPreview } from './components/VideoPreview';
import { SlideManager } from './components/SlideManager';
import { AudioControls } from './components/AudioControls';
import { SubtitleStyleEditor } from './components/SubtitleStyleEditor';
import { AiAssistantModal } from './components/AiAssistantModal';
import { WelcomeLandingPage } from './components/WelcomeLandingPage';
import { PricingModal } from './components/PricingModal';
import { fetchUserCreditAccount, deductCredit, pollCheckoutSession } from './utils/creditManager';
import { saveProject, loadProject, clearProject } from './utils/projectStorage';

import {
  SlideItem,
  SubtitleConfig,
  AspectRatio,
  AudioTrackConfig,
  PropertyPreset,
  UserCreditAccount
} from './types';
import { generateUniqueId } from './data/sampleAssets';
import {
  Image as ImageIcon,
  Music,
  Play,
  Edit3,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Sparkles,
  Sliders
} from 'lucide-react';

type WorkflowStep = 1 | 2 | 3 | 4;

export default function App() {
  const [showWelcomePage, setShowWelcomePage] = useState(true);
  const [projectTitle, setProjectTitle] = useState('My Marketing Showcase Video');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
  const [brandingLogoUrl, setBrandingLogoUrl] = useState<string | null>(null);
  const [videoSpeed, setVideoSpeed] = useState<number>(1.0);

  // Credit Tracking & Pricing State
  const [currentAccount, setCurrentAccount] = useState<UserCreditAccount | null>(null);
  const [totalAvailableCredits, setTotalAvailableCredits] = useState<number>(1);
  const [isPricingModalOpen, setIsPricingModalOpen] = useState<boolean>(false);
  const [isLowBalanceNotice, setIsLowBalanceNotice] = useState<boolean>(false);

  const [checkoutNotice, setCheckoutNotice] = useState<{ type: 'pending' | 'success' | 'error'; text: string } | null>(null);

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
            text: "Payment is still processing. Your credits will appear shortly — refresh in a moment.",
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

  // Workflow Step State (1: Photos, 2: Audio, 3: Full Video Preview, 4: Edit If Necessary)
  const [currentStep, setCurrentStep] = useState<WorkflowStep>(1);

  // Slides State
  const [slides, setSlides] = useState<SlideItem[]>([]);
  const [activeSlideId, setActiveSlideId] = useState<string | null>(() => slides[0]?.id || null);

  // Audio Tracks State (Disabled by default so no unwanted sound or background noise plays)
  const [musicTrack, setMusicTrack] = useState<AudioTrackConfig>({
    enabled: false,
    sourceType: 'preset',
    fileUrl: null,
    fileName: 'No Music (Silent)',
    presetId: undefined,
    volume: 0.8,
    fadeInDuration: 1.5,
    fadeOutDuration: 2.0,
    isMuted: false,
  });

  const [voiceoverTrack, setVoiceoverTrack] = useState<AudioTrackConfig>({
    enabled: false,
    sourceType: 'custom',
    fileUrl: null,
    fileName: null,
    volume: 1.0,
    fadeInDuration: 0.5,
    fadeOutDuration: 1.0,
    isMuted: false,
  });

  // Subtitle / Caption Config State
  const [subtitleConfig, setSubtitleConfig] = useState<SubtitleConfig>({
    stylePreset: 'luxury-gold',
    animationPreset: 'slide-up',
    position: 'bottom',
    fontSize: 32,
    bgOpacity: 0.85,
    primaryColor: '#ffffff',
    accentColor: '#eab308',
    showCaptions: true,
  });

  // AI Modal
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isAiGeneratingCaptions, setIsAiGeneratingCaptions] = useState(false);

  // Restore a previously saved project on load (survives page reloads and
  // the full-page navigation round-trip to Stripe Checkout and back, which
  // otherwise wipes all in-memory React state).
  const [hasCheckedForSavedProject, setHasCheckedForSavedProject] = useState(false);
  useEffect(() => {
    loadProject().then((saved) => {
      if (saved) {
        setSlides(saved.slides);
        setSubtitleConfig(saved.subtitleConfig);
        setAspectRatio(saved.aspectRatio);
        setVideoSpeed(saved.videoSpeed);
        setBrandingLogoUrl(saved.brandingLogoUrl);
        setMusicTrack(saved.musicTrack);
        setVoiceoverTrack(saved.voiceoverTrack);
        setActiveSlideId(saved.slides[0]?.id || null);
        setShowWelcomePage(false);
      }
      setHasCheckedForSavedProject(true);
    });
  }, []);

  // Debounced auto-save: keeps a rolling snapshot so a reload, browser
  // close, or the Stripe redirect round-trip doesn't lose the user's work.
  // Waits until the initial restore-check above has finished, so this
  // can't accidentally save an empty project over a real one during the
  // brief moment before loadProject() resolves.
  useEffect(() => {
    if (!hasCheckedForSavedProject) return;

    if (slides.length === 0) {
      // Project was emptied out (e.g. "Delete All") — clear the saved copy
      // too, so a reload doesn't resurrect photos the user just deleted.
      clearProject();
      return;
    }

    const timeout = setTimeout(() => {
      saveProject({
        slides,
        subtitleConfig,
        aspectRatio,
        videoSpeed,
        brandingLogoUrl,
        musicTrack,
        voiceoverTrack,
      });
    }, 1500);

    return () => clearTimeout(timeout);
  }, [
    hasCheckedForSavedProject,
    slides,
    subtitleConfig,
    aspectRatio,
    videoSpeed,
    brandingLogoUrl,
    musicTrack,
    voiceoverTrack,
  ]);

  // Called right before redirecting to Stripe — the debounced save above
  // might not have fired yet if the user clicks "Buy" quickly after their
  // last edit, so this guarantees the latest state is captured before the
  // page navigates away.
  const handleSaveProjectNow = () => {
    if (slides.length === 0) return;
    saveProject({
      slides,
      subtitleConfig,
      aspectRatio,
      videoSpeed,
      brandingLogoUrl,
      musicTrack,
      voiceoverTrack,
    });
  };

  // Handle Preset Load
  const handleSelectPreset = (preset: PropertyPreset) => {
    setAspectRatio(preset.aspectRatio);
    setSubtitleConfig((prev) => ({
      ...prev,
      stylePreset: preset.stylePreset,
      animationPreset: preset.animationPreset,
    }));
    setMusicTrack((prev) => ({
      ...prev,
      enabled: true,
      sourceType: 'preset',
      presetId: preset.musicPresetId,
      fileName: preset.name,
      isMuted: false,
    }));
    if (preset.slides && preset.slides.length > 0) {
      const convertedSlides: SlideItem[] = preset.slides.map((s, idx) => ({
        id: generateUniqueId(`preset-${idx}`),
        url: s.imageUrl || (s as any).url || '',
        title: s.title,
        subtitle: s.subtitle,
        duration: s.duration || 4,
        transition: s.transition || 'ken-burns-in',
      }));
      setSlides(convertedSlides);
      setActiveSlideId(convertedSlides[0].id);
    }
  };

  // Quick AI Captions Generator Trigger
  const handleGenerateAiCaptions = async () => {
    setIsAiGeneratingCaptions(true);
    try {
      const res = await fetch('/api/generate-captions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyType: 'Luxury Estate',
          features: 'Spacious layout, high ceilings, gourmet kitchen, master suite, outdoor retreat',
          imageCount: slides.length,
        }),
      });
      const data = await res.json();
      if (data.captions && Array.isArray(data.captions)) {
        handleApplyCaptions(data.captions);
      }
    } catch (err) {
      console.error('Error generating AI captions:', err);
    } finally {
      setIsAiGeneratingCaptions(false);
    }
  };

  const handleApplyCaptions = (captions: string[]) => {
    const updated = slides.map((slide, idx) => {
      const captionText = captions[idx] || slide.title;
      return {
        ...slide,
        title: captionText,
      };
    });
    setSlides(updated);
  };

  const totalDuration = slides.reduce((acc, s) => acc + (s.duration || 4), 0);

  if (showWelcomePage) {
    return (
      <WelcomeLandingPage
        onSelectIndustry={(preset) => {
          handleSelectPreset(preset);
          setProjectTitle(preset.name);
          setShowWelcomePage(false);
          setCurrentStep(1);
        }}
        onStartCustomUpload={() => {
          setShowWelcomePage(false);
          setCurrentStep(1);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950 antialiased">
      {/* Top Bar Header */}
      <Header
        projectTitle={projectTitle}
        onUpdateTitle={setProjectTitle}
        onSelectPreset={handleSelectPreset}
        onOpenAiModal={() => setIsAiModalOpen(true)}
        onReturnToWelcome={() => setShowWelcomePage(true)}
        currentAccount={currentAccount}
        totalAvailable={totalAvailableCredits}
        onOpenPricing={() => handleOpenPricing(false)}
      />

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

      {/* Workflow Stepper Navigation Bar */}
      <div className="bg-slate-900/90 border-b border-slate-800 px-4 md:px-8 py-3 sticky top-[65px] z-30 shadow-md">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
            {/* STEP 1: Photos & Sequence */}
            <button
              onClick={() => setCurrentStep(1)}
              className={`p-2.5 md:p-3 rounded-xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                currentStep === 1
                  ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold shadow-lg shadow-amber-500/20 ring-2 ring-amber-400/50'
                  : currentStep > 1
                  ? 'bg-slate-800/90 text-amber-300 border-slate-700 font-semibold'
                  : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center font-extrabold text-xs shrink-0 ${
                  currentStep === 1
                    ? 'bg-slate-950 text-amber-400'
                    : currentStep > 1
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'bg-slate-800 text-slate-300'
                }`}
              >
                {currentStep > 1 ? <CheckCircle2 className="w-4 h-4 text-amber-400" /> : '1'}
              </div>
              <div className="truncate">
                <span className="text-xs font-bold block truncate">1. Photos & Sequence</span>
                <span className="text-[10px] opacity-80 block truncate">Upload & Arrange Slides</span>
              </div>
            </button>

            {/* STEP 2: Voiceover & Music */}
            <button
              onClick={() => setCurrentStep(2)}
              className={`p-2.5 md:p-3 rounded-xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                currentStep === 2
                  ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold shadow-lg shadow-amber-500/20 ring-2 ring-amber-400/50'
                  : currentStep > 2
                  ? 'bg-slate-800/90 text-amber-300 border-slate-700 font-semibold'
                  : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center font-extrabold text-xs shrink-0 ${
                  currentStep === 2
                    ? 'bg-slate-950 text-amber-400'
                    : currentStep > 2
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'bg-slate-800 text-slate-300'
                }`}
              >
                {currentStep > 2 ? <CheckCircle2 className="w-4 h-4 text-amber-400" /> : '2'}
              </div>
              <div className="truncate">
                <span className="text-xs font-bold block truncate">2. Voiceover & Music</span>
                <span className="text-[10px] opacity-80 block truncate">Upload Own or Inhouse</span>
              </div>
            </button>

            {/* STEP 3: Preview Whole Video */}
            <button
              onClick={() => setCurrentStep(3)}
              className={`p-2.5 md:p-3 rounded-xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                currentStep === 3
                  ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold shadow-lg shadow-amber-500/20 ring-2 ring-amber-400/50'
                  : currentStep > 3
                  ? 'bg-slate-800/90 text-amber-300 border-slate-700 font-semibold'
                  : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center font-extrabold text-xs shrink-0 ${
                  currentStep === 3
                    ? 'bg-slate-950 text-amber-400'
                    : currentStep > 3
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'bg-slate-800 text-slate-300'
                }`}
              >
                {currentStep > 3 ? <CheckCircle2 className="w-4 h-4 text-amber-400" /> : '3'}
              </div>
              <div className="truncate">
                <span className="text-xs font-bold block truncate">3. Preview Whole Video</span>
                <span className="text-[10px] opacity-80 block truncate">Full Video Stage</span>
              </div>
            </button>

            {/* STEP 4: Edit If Necessary */}
            <button
              onClick={() => setCurrentStep(4)}
              className={`p-2.5 md:p-3 rounded-xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                currentStep === 4
                  ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold shadow-lg shadow-amber-500/20 ring-2 ring-amber-400/50'
                  : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center font-extrabold text-xs shrink-0 ${
                  currentStep === 4 ? 'bg-slate-950 text-amber-400' : 'bg-slate-800 text-slate-300'
                }`}
              >
                4
              </div>
              <div className="truncate">
                <span className="text-xs font-bold block truncate">4. Edit If Necessary</span>
                <span className="text-[10px] opacity-80 block truncate">Captions & Styles</span>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Main Studio Body Based on Current Workflow Step */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 space-y-6">
        {/* ================= STEP 1: PHOTOS & SEQUENCE ================= */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <div className="bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-amber-400 flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-amber-400" />
                  <span>Step 1: Upload Property Photos & Arrange Sequence</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Drag and drop to reorder slides, set individual slide durations, motion transitions, and titles.
                </p>
              </div>

              <button
                onClick={() => setCurrentStep(2)}
                className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-bold text-xs px-4 py-2 rounded-xl shadow transition-all cursor-pointer"
              >
                <span>Proceed to Step 2: Voiceover & Music</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Slide Manager Controls */}
              <div className="lg:col-span-7">
                <SlideManager
                  slides={slides}
                  onUpdateSlides={setSlides}
                  activeSlideId={activeSlideId}
                  onSelectSlide={setActiveSlideId}
                />
              </div>

              {/* Live Video Monitor */}
              <div className="lg:col-span-5">
                <div className="sticky top-32">
                  <VideoPreview
                    slides={slides}
                    activeSlideId={activeSlideId}
                    onSelectSlide={setActiveSlideId}
                    subtitleConfig={subtitleConfig}
                    onUpdateSubtitleConfig={setSubtitleConfig}
                    aspectRatio={aspectRatio}
                    onUpdateAspectRatio={setAspectRatio}
                    musicTrack={musicTrack}
                    voiceoverTrack={voiceoverTrack}
                    onUpdateMusicTrack={setMusicTrack}
                    onUpdateVoiceoverTrack={setVoiceoverTrack}
                    logoUrl={brandingLogoUrl}
                    videoSpeed={videoSpeed}
                    onUpdateVideoSpeed={setVideoSpeed}
                    totalAvailableCredits={totalAvailableCredits}
                    onDeductCredit={handleDeductCredit}
                    onOpenPricing={handleOpenPricing}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= STEP 2: VOICEOVER & MUSIC ================= */}
        {currentStep === 2 && (
          <div className="space-y-4">
            <div className="bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-amber-400 flex items-center gap-2">
                  <Music className="w-4 h-4 text-amber-400" />
                  <span>Step 2: Choose Voiceover & Background Music</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Upload your own custom MP3/WAV audio files or select from our inhouse lively AI narration voices & synth music tracks.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentStep(1)}
                  className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs px-3 py-2 rounded-xl border border-slate-700 transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Photos</span>
                </button>

                <button
                  onClick={() => setCurrentStep(3)}
                  className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-bold text-xs px-4 py-2 rounded-xl shadow transition-all cursor-pointer"
                >
                  <span>Proceed to Step 3: Preview Whole Video</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Audio Controls */}
              <div className="lg:col-span-7">
                <AudioControls
                  slides={slides}
                  onUpdateSlides={setSlides}
                  musicTrack={musicTrack}
                  onUpdateMusicTrack={setMusicTrack}
                  voiceoverTrack={voiceoverTrack}
                  onUpdateVoiceoverTrack={setVoiceoverTrack}
                  logoUrl={brandingLogoUrl}
                  onUpdateLogoUrl={setBrandingLogoUrl}
                />
              </div>

              {/* Live Video Monitor */}
              <div className="lg:col-span-5">
                <div className="sticky top-32">
                  <VideoPreview
                    slides={slides}
                    activeSlideId={activeSlideId}
                    onSelectSlide={setActiveSlideId}
                    subtitleConfig={subtitleConfig}
                    onUpdateSubtitleConfig={setSubtitleConfig}
                    aspectRatio={aspectRatio}
                    onUpdateAspectRatio={setAspectRatio}
                    musicTrack={musicTrack}
                    voiceoverTrack={voiceoverTrack}
                    onUpdateMusicTrack={setMusicTrack}
                    onUpdateVoiceoverTrack={setVoiceoverTrack}
                    logoUrl={brandingLogoUrl}
                    videoSpeed={videoSpeed}
                    onUpdateVideoSpeed={setVideoSpeed}
                    totalAvailableCredits={totalAvailableCredits}
                    onDeductCredit={handleDeductCredit}
                    onOpenPricing={handleOpenPricing}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= STEP 3: PREVIEW WHOLE VIDEO ================= */}
        {currentStep === 3 && (
          <div className="space-y-4">
            <div className="bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-amber-400 flex items-center gap-2">
                  <Play className="w-4 h-4 text-amber-400 fill-current" />
                  <span>Step 3: Preview Whole Video Presentation</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Play the complete real estate showcase video with full audio synchronization, transitions, and slide timing.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentStep(2)}
                  className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs px-3 py-2 rounded-xl border border-slate-700 transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Voice & Music</span>
                </button>

                <button
                  onClick={() => setCurrentStep(4)}
                  className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-bold text-xs px-4 py-2 rounded-xl shadow transition-all cursor-pointer"
                >
                  <span>Edit Captions & Styles If Necessary</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Video Player Stage */}
            <div className="max-w-4xl mx-auto space-y-4">
              <VideoPreview
                slides={slides}
                activeSlideId={activeSlideId}
                onSelectSlide={setActiveSlideId}
                subtitleConfig={subtitleConfig}
                onUpdateSubtitleConfig={setSubtitleConfig}
                aspectRatio={aspectRatio}
                onUpdateAspectRatio={setAspectRatio}
                musicTrack={musicTrack}
                voiceoverTrack={voiceoverTrack}
                onUpdateMusicTrack={setMusicTrack}
                onUpdateVoiceoverTrack={setVoiceoverTrack}
                logoUrl={brandingLogoUrl}
                videoSpeed={videoSpeed}
                onUpdateVideoSpeed={setVideoSpeed}
                totalAvailableCredits={totalAvailableCredits}
                onDeductCredit={handleDeductCredit}
                onOpenPricing={handleOpenPricing}
              />

              {/* Video Production Summary Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800">
                <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800/80">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Photo Slides</span>
                  <span className="text-xs font-bold text-amber-400">{slides.length} Photos</span>
                </div>
                <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800/80">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Speed Selection</span>
                  <span className="text-xs font-bold text-amber-300">{videoSpeed}x Speed</span>
                </div>
                <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800/80">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Duration</span>
                  <span className="text-xs font-bold text-slate-200">{Math.round(totalDuration / videoSpeed)} Seconds</span>
                </div>
                <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800/80">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Voiceover</span>
                  <span className="text-xs font-bold text-amber-400 truncate block">
                    {voiceoverTrack.enabled ? voiceoverTrack.fileName || 'Active AI Voice' : 'Disabled'}
                  </span>
                </div>
                <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800/80">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Music Track</span>
                  <span className="text-xs font-bold text-amber-400 truncate block">
                    {musicTrack.enabled ? musicTrack.fileName || 'Inhouse Music' : 'Disabled'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= STEP 4: EDIT IF NECESSARY ================= */}
        {currentStep === 4 && (
          <div className="space-y-4">
            <div className="bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-amber-400 flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-amber-400" />
                  <span>Step 4: Edit & Refine (Captions & Visual Styles)</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Fine-tune subtitle typography, luxury presets, text animations, overlay positions, or generate AI property copy.
                </p>
              </div>

              <button
                onClick={() => setCurrentStep(3)}
                className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs px-3.5 py-2 rounded-xl border border-slate-700 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Return to Preview Video</span>
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Subtitle Style Editor */}
              <div className="lg:col-span-7">
                <SubtitleStyleEditor
                  subtitleConfig={subtitleConfig}
                  onUpdateSubtitleConfig={setSubtitleConfig}
                  onGenerateAiCaptions={handleGenerateAiCaptions}
                  isAiGenerating={isAiGeneratingCaptions}
                />
              </div>

              {/* Live Video Monitor */}
              <div className="lg:col-span-5">
                <div className="sticky top-32">
                  <VideoPreview
                    slides={slides}
                    activeSlideId={activeSlideId}
                    onSelectSlide={setActiveSlideId}
                    subtitleConfig={subtitleConfig}
                    onUpdateSubtitleConfig={setSubtitleConfig}
                    aspectRatio={aspectRatio}
                    onUpdateAspectRatio={setAspectRatio}
                    musicTrack={musicTrack}
                    voiceoverTrack={voiceoverTrack}
                    onUpdateMusicTrack={setMusicTrack}
                    onUpdateVoiceoverTrack={setVoiceoverTrack}
                    logoUrl={brandingLogoUrl}
                    videoSpeed={videoSpeed}
                    onUpdateVideoSpeed={setVideoSpeed}
                    totalAvailableCredits={totalAvailableCredits}
                    onDeductCredit={handleDeductCredit}
                    onOpenPricing={handleOpenPricing}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* AI Assistant Generator Modal */}
      <AiAssistantModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        slides={slides}
        onApplyCaptions={handleApplyCaptions}
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
    </div>
  );
}

