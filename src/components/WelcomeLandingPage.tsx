import React from 'react';
import {
  Film,
  Building2,
  Car,
  Hotel,
  Globe2,
  Gem,
  Utensils,
  ShoppingBag,
  Sparkles,
  ArrowRight,
  Play,
  Zap,
  Volume2,
  Sliders,
  Type,
  Image as ImageIcon
} from 'lucide-react';
import { PROPERTY_PRESETS } from '../data/sampleAssets';
import { PropertyPreset } from '../types';

interface WelcomeLandingPageProps {
  onSelectIndustry: (preset: PropertyPreset) => void;
  onStartCustomUpload: () => void;
}

export const WelcomeLandingPage: React.FC<WelcomeLandingPageProps> = ({
  onSelectIndustry,
  onStartCustomUpload,
}) => {
  // Map preset IDs or define rich industry metadata
  const industries = [
    {
      id: 'luxury-mansion',
      title: 'Real Estate & Properties',
      subtitle: 'Luxury Villas, Apartments, Penthouses & Commercials',
      preset: PROPERTY_PRESETS.find((p) => p.id === 'luxury-mansion') || PROPERTY_PRESETS[0],
      bgImage: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=800&q=80',
      icon: Building2,
      accentColor: 'from-amber-500 to-yellow-600',
      badge: '16:9 4K Tour',
      features: ['Gold Serif Subtitles', 'Ken Burns Motion', 'Ambient Lounge Audio'],
    },
    {
      id: 'automobile-showcase',
      title: 'Automobile & Supercars',
      subtitle: 'Showroom Spotlights, Test Drives & Exotic Commercials',
      preset: PROPERTY_PRESETS.find((p) => p.id === 'automobile-showcase') || PROPERTY_PRESETS[1],
      bgImage: 'https://images.unsplash.com/photo-1617814076367-b759c7d7e738?auto=format&fit=crop&w=800&q=80',
      icon: Car,
      accentColor: 'from-red-500 to-amber-600',
      badge: 'High-Energy Promo',
      features: ['Dark Badge Captions', 'Zoom-Pop Motion', 'Upbeat Synth Beats'],
    },
    {
      id: 'hotel-resort',
      title: 'Hotels & Luxury Resorts',
      subtitle: 'Tropical Villas, Boutique Stays & Wellness Retreats',
      preset: PROPERTY_PRESETS.find((p) => p.id === 'hotel-resort') || PROPERTY_PRESETS[2],
      bgImage: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=800&q=80',
      icon: Hotel,
      accentColor: 'from-cyan-500 to-blue-600',
      badge: 'Serene Experience',
      features: ['Glass Caption Styling', 'Soft Smooth Transitions', 'Relaxing Ambience'],
    },
    {
      id: 'jewelry-luxury',
      title: 'Jewelry & Fine Luxury',
      subtitle: 'Diamond Collections, Timepieces & Heritage Crafts',
      preset: PROPERTY_PRESETS.find((p) => p.id === 'jewelry-luxury') || PROPERTY_PRESETS[3],
      bgImage: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=800&q=80',
      icon: Gem,
      accentColor: 'from-amber-400 to-orange-500',
      badge: 'Luxury Showcase',
      features: ['Minimalist Gold Captions', 'Macro Zoom Pan', 'Acoustic Piano Audio'],
    },
    {
      id: 'restaurant-gourmet',
      title: 'Restaurants & Fine Dining',
      subtitle: 'Gourmet Menus, Chef Tastings & Craft Cocktails',
      preset: PROPERTY_PRESETS.find((p) => p.id === 'restaurant-gourmet') || PROPERTY_PRESETS[4],
      bgImage: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80',
      icon: Utensils,
      accentColor: 'from-emerald-500 to-teal-600',
      badge: '9:16 Social Reel',
      features: ['Kinetic Pop Captions', 'Upbeat Rhythm', 'Vertical 9:16 Format'],
    },
    {
      id: 'travel-tourism',
      title: 'Travel & Expeditions',
      subtitle: 'Guided Tours, Scenic Destinations & Adventure Travel',
      preset: {
        id: 'travel-tour',
        name: 'Travel: Alpine Expedition',
        description: 'Cinematic zoom pan with acoustic piano scores',
        aspectRatio: '16:9' as const,
        stylePreset: 'modern-minimal' as const,
        animationPreset: 'slide-up' as const,
        musicPresetId: 'piano-acoustic',
        slides: [
          {
            title: 'Swiss Alps Grand Alpine Tour',
            subtitle: '7 Days Guided Mountain Expedition',
            imageUrl: 'https://images.unsplash.com/photo-1530122037265-a5f1f91d3b99?auto=format&fit=crop&w=1600&q=80',
            duration: 4,
            transition: 'ken-burns-in' as const,
          },
          {
            title: 'Interlaken Panoramic Railway',
            subtitle: 'First Class Alpine Journey',
            imageUrl: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1600&q=80',
            duration: 4,
            transition: 'pan-right' as const,
          },
        ],
      },
      bgImage: 'https://images.unsplash.com/photo-1530122037265-a5f1f91d3b99?auto=format&fit=crop&w=800&q=80',
      icon: Globe2,
      accentColor: 'from-blue-500 to-indigo-600',
      badge: 'Expedition Reel',
      features: ['Scenic Pan Motion', 'Narration Script Ready', 'Panoramic Visuals'],
    },
    {
      id: 'ecommerce-retail',
      title: 'E-Commerce & Products',
      subtitle: 'Consumer Electronics, Fashion & Product Launches',
      preset: {
        id: 'ecom-retail',
        name: 'E-Commerce: Tech Gadget Launch',
        description: 'Vibrant punchy captions with modern upbeat beat',
        aspectRatio: '1:1' as const,
        stylePreset: 'vibrant-neon' as const,
        animationPreset: 'zoom-pop' as const,
        musicPresetId: 'uptempo-modern',
        slides: [
          {
            title: 'ProSound Noise-Canceling Headphones',
            subtitle: '40-Hour Battery Life | Active Spatial Audio',
            imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1600&q=80',
            duration: 4,
            transition: 'zoom-pop' as const,
          },
          {
            title: 'Ergonomic Memory Foam Comfort',
            subtitle: 'Ultra-Fast USB-C Charging',
            imageUrl: 'https://images.unsplash.com/photo-1484704849700-f032a568e944?auto=format&fit=crop&w=1600&q=80',
            duration: 4,
            transition: 'pan-left' as const,
          },
        ],
      },
      bgImage: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80',
      icon: ShoppingBag,
      accentColor: 'from-purple-500 to-pink-600',
      badge: 'Square / Ad Format',
      features: ['1:1 Square Canvas', 'Punchy Subtitles', 'High-Converting Copy'],
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950 antialiased">
      {/* Top Banner / Navigation */}
      <header className="border-b border-slate-800/80 bg-slate-900/80 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-amber-400 to-yellow-300 p-0.5 shadow-lg shadow-amber-500/20 flex items-center justify-center">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <Film className="w-5 h-5 text-amber-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-black tracking-wide text-white">ReelCraft</span>
              <span className="bg-amber-400 text-slate-950 text-[10px] px-1.5 py-0.5 rounded font-black tracking-wider">
                PRO
              </span>
            </div>
            <p className="text-xs text-amber-400 font-medium">Turn Photos into Stunning AI Marketing Videos</p>
          </div>
        </div>

        <button
          onClick={onStartCustomUpload}
          className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold px-4 py-2.5 rounded-xl border border-slate-700/80 transition-all hover:border-amber-500/50"
        >
          <ImageIcon className="w-4 h-4 text-amber-400" />
          <span>Upload Custom Photos</span>
        </button>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-16 space-y-12">
        <div className="text-center max-w-3xl mx-auto space-y-6">
          <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold px-3.5 py-1.5 rounded-full shadow-inner">
            <Sparkles className="w-3.5 h-3.5 fill-amber-400" />
            <span>AI-Powered Multi-Industry Video Studio</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-[1.1]">
            Turn Photos into <br />
            <span className="bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 bg-clip-text text-transparent">
              Stunning AI Marketing Videos
            </span>
          </h1>

          <p className="text-slate-300 text-base sm:text-lg leading-relaxed font-normal">
            Transform still images into studio-quality video commercials with dynamic camera motion, Gemini AI script generator, natural voiceover narration, and customizable subtitle presets.
          </p>

          <div className="pt-2 flex flex-wrap items-center justify-center gap-4">
            <a
              href="#industry-selector"
              className="inline-flex items-center gap-2.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-sm px-6 py-3.5 rounded-xl shadow-lg shadow-amber-500/25 transition-all hover:scale-105"
            >
              <span>Select Your Industry Below</span>
              <ArrowRight className="w-4 h-4" />
            </a>

            <button
              onClick={onStartCustomUpload}
              className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-slate-200 font-bold text-sm px-6 py-3.5 rounded-xl border border-slate-800 transition-all hover:border-slate-700"
            >
              <ImageIcon className="w-4 h-4 text-amber-400" />
              <span>Start Blank / Custom Photos</span>
            </button>
          </div>
        </div>

        {/* Hero Demo Video — a real, unedited export from this app, so a
            first-time visitor sees exactly what the product produces
            before uploading a single photo of their own. */}
        <div className="max-w-4xl mx-auto">
          <div className="relative rounded-2xl overflow-hidden border border-slate-800 shadow-2xl shadow-amber-500/10 bg-slate-900">
            <video
              className="w-full aspect-video object-cover"
              autoPlay
              loop
              muted
              playsInline
              controls
            >
              <source src="/videos/demo-hero.webm" type="video/webm" />
            </video>
            <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-slate-950/80 backdrop-blur px-3 py-1.5 rounded-lg text-xs font-bold text-amber-400 border border-amber-500/30">
              <Sparkles className="w-3.5 h-3.5 fill-amber-400" />
              <span>Real output, zero manual editing</span>
            </div>
          </div>
          <p className="text-center text-xs text-slate-500 mt-3">
            An actual video generated by ReelCraft PRO — AI captions, voiceover, and music, produced from stock photos in under two minutes.
          </p>
        </div>

        {/* Industry Cards Selector Section */}
        <div id="industry-selector" className="space-y-6 scroll-mt-24">
          <div className="text-center space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Select Your Industry to Begin
            </h2>
            <p className="text-slate-400 text-sm">
              Click any category below to load industry-tailored slide presets, captions, and audio styles.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {industries.map((item) => {
              const IconComp = item.icon;
              return (
                <div
                  key={item.id}
                  onClick={() => onSelectIndustry(item.preset)}
                  className="group relative bg-slate-900/90 rounded-2xl border border-slate-800/80 hover:border-amber-500/60 overflow-hidden shadow-xl transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-amber-500/10 cursor-pointer flex flex-col justify-between"
                >
                  {/* Background Image Preview Header */}
                  <div className="relative h-48 w-full overflow-hidden bg-slate-950">
                    <img
                      src={item.bgImage}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out opacity-85 group-hover:opacity-100"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />

                    {/* Top Badge */}
                    <div className="absolute top-3 right-3 bg-slate-950/80 backdrop-blur-md border border-slate-700 text-amber-400 text-[10px] font-bold px-2.5 py-1 rounded-full shadow-md">
                      {item.badge}
                    </div>

                    {/* Icon & Title Overlay */}
                    <div className="absolute bottom-3 left-4 right-4 flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-tr ${item.accentColor} p-0.5 shadow-lg flex items-center justify-center shrink-0`}>
                        <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                          <IconComp className="w-5 h-5 text-amber-400" />
                        </div>
                      </div>
                      <div>
                        <h3 className="text-lg font-extrabold text-white group-hover:text-amber-300 transition-colors leading-tight">
                          {item.title}
                        </h3>
                      </div>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                    <p className="text-xs text-slate-300 leading-relaxed font-medium">
                      {item.subtitle}
                    </p>

                    {/* Feature Chips */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        Included Workflow Features:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {item.features.map((feat, idx) => (
                          <span
                            key={idx}
                            className="text-[10px] font-semibold bg-slate-950 text-slate-300 px-2 py-1 rounded-md border border-slate-800"
                          >
                            ✓ {feat}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Action Button */}
                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs font-bold text-amber-400 group-hover:text-amber-300">
                      <span>Create {item.title.split('&')[0]} Video</span>
                      <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center group-hover:bg-amber-500 group-hover:text-slate-950 transition-all">
                        <ArrowRight className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Feature Highlights Section */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 lg:p-8 space-y-6">
          <div className="text-center max-w-xl mx-auto space-y-1">
            <h3 className="text-lg font-bold text-white">Full-Suite Production Engine</h3>
            <p className="text-xs text-slate-400">Everything you need to turn static photos into viral commercial reels</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 space-y-2">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <Zap className="w-4 h-4" />
              </div>
              <h4 className="text-xs font-bold text-white">Pan & Ken Burns Motion</h4>
              <p className="text-[11px] text-slate-400">
                Smooth cinematic camera pans and zoom motion applied automatically to still photos.
              </p>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 space-y-2">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <Type className="w-4 h-4" />
              </div>
              <h4 className="text-xs font-bold text-white">Kinetic Subtitle Styles</h4>
              <p className="text-[11px] text-slate-400">
                Luxury serif, vibrant neon, or minimal dark badge caption templates with custom typography.
              </p>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 space-y-2">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <Volume2 className="w-4 h-4" />
              </div>
              <h4 className="text-xs font-bold text-white">AI Voiceover & Audio Mix</h4>
              <p className="text-[11px] text-slate-400">
                Gemini voice script generator paired with realistic TTS narration and background music tracks.
              </p>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 space-y-2">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <Sliders className="w-4 h-4" />
              </div>
              <h4 className="text-xs font-bold text-white">Draggable Logo Overlay</h4>
              <p className="text-[11px] text-slate-400">
                Drag and place your brand watermark anywhere on the video preview canvas in real-time.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-6 text-center text-xs text-slate-400">
        <p>ReelCraft PRO &bull; Turn Photos into Stunning AI Marketing Videos</p>
      </footer>
    </div>
  );
};
