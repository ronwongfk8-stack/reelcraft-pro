import React, { useRef, useState, useEffect } from 'react';
import {
  Music,
  Mic,
  Volume2,
  VolumeX,
  Upload,
  Radio,
  Sliders,
  Sparkles,
  Square,
  Globe,
  User,
  Play,
  Pause,
  Wand2,
  Check,
  FileAudio,
  Trash2,
  FileText,
  AlertTriangle
} from 'lucide-react';
import { AudioTrackConfig, SlideItem } from '../types';
import { MUSIC_PRESETS } from '../data/sampleAssets';
import {
  MALE_VOICES,
  FEMALE_VOICES,
  ALL_NARRATION_VOICES,
  NARRATION_LANGUAGES,
  NarrationVoice
} from '../data/voiceData';
import { generateAiVoiceoverAudioBlob } from '../utils/speechSynthesis';
import { audioEngine } from '../utils/audioSynthesizer';

interface AudioControlsProps {
  slides?: SlideItem[];
  onUpdateSlides?: (slides: SlideItem[]) => void;
  musicTrack: AudioTrackConfig;
  onUpdateMusicTrack: (track: AudioTrackConfig) => void;
  voiceoverTrack: AudioTrackConfig;
  onUpdateVoiceoverTrack: (track: AudioTrackConfig) => void;
  logoUrl?: string | null;
  onUpdateLogoUrl?: (url: string | null) => void;
}

export const AudioControls: React.FC<AudioControlsProps> = ({
  slides = [],
  onUpdateSlides,
  musicTrack,
  onUpdateMusicTrack,
  voiceoverTrack,
  onUpdateVoiceoverTrack,
  logoUrl = null,
  onUpdateLogoUrl,
}) => {
  const [activeTab, setActiveTab] = useState<'music' | 'voiceover'>('music');
  const [voiceSubTab, setVoiceSubTab] = useState<'ai-voice' | 'upload-voice' | 'record-mic'>('ai-voice');
  const [voiceGenderFilter, setVoiceGenderFilter] = useState<'all' | 'male' | 'female'>('all');

  const musicFileInputRef = useRef<HTMLInputElement | null>(null);
  const voiceFileInputRef = useRef<HTMLInputElement | null>(null);

  // Drag state for music & voiceover upload boxes
  const [isMusicDragging, setIsMusicDragging] = useState(false);
  const [isVoiceDragging, setIsVoiceDragging] = useState(false);

  // Music Preset Live Preview State
  const [playingPresetId, setPlayingPresetId] = useState<string | null>(null);
  const sampleMusicSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const sampleMusicGainRef = useRef<GainNode | null>(null);

  // Update preset preview gain if volume changes while listening
  useEffect(() => {
    if (sampleMusicGainRef.current) {
      audioEngine.setLiveGain(
        sampleMusicGainRef.current,
        musicTrack.volume,
        musicTrack.isMuted
      );
    }
  }, [musicTrack.volume, musicTrack.isMuted]);

  const handleTogglePresetPreview = async (e: React.MouseEvent, presetId: string) => {
    e.stopPropagation();
    if (playingPresetId === presetId) {
      if (sampleMusicSourceRef.current) {
        try { sampleMusicSourceRef.current.stop(); } catch(e) {}
        sampleMusicSourceRef.current = null;
      }
      sampleMusicGainRef.current = null;
      setPlayingPresetId(null);
      return;
    }

    if (sampleMusicSourceRef.current) {
      try { sampleMusicSourceRef.current.stop(); } catch(e) {}
      sampleMusicSourceRef.current = null;
    }
    sampleMusicGainRef.current = null;

    setPlayingPresetId(presetId);
    try {
      const ctx = audioEngine.initContext();
      if (ctx.state === 'suspended') {
        await ctx.resume().catch(() => {});
      }
      const buffer = await audioEngine.resolvePresetMusicBuffer(presetId, 10);
      if (!buffer) throw new Error('Could not load preview audio for this preset.');
      const source = ctx.createBufferSource();
      const gainNode = ctx.createGain();
      
      const activeVol = musicTrack.isMuted ? 0 : Math.max(0, musicTrack.volume);
      gainNode.gain.setValueAtTime(activeVol, ctx.currentTime);
      gainNode.connect(ctx.destination);
      
      source.buffer = buffer;
      source.connect(gainNode);
      sampleMusicGainRef.current = gainNode;

      source.onended = () => {
        setPlayingPresetId((curr) => (curr === presetId ? null : curr));
        sampleMusicGainRef.current = null;
      };
      sampleMusicSourceRef.current = source;
      source.start();
    } catch (err) {
      console.error('Error previewing music preset:', err);
      setPlayingPresetId(null);
      sampleMusicGainRef.current = null;
    }
  };

  const handleToggleCustomMusicPreview = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!musicTrack.fileUrl) return;
    if (playingPresetId === 'custom-uploaded') {
      if (sampleMusicSourceRef.current) {
        try { (sampleMusicSourceRef.current as any).stop?.(); } catch(e) {}
        try { (sampleMusicSourceRef.current as any).pause?.(); } catch(e) {}
        sampleMusicSourceRef.current = null;
      }
      sampleMusicGainRef.current = null;
      setPlayingPresetId(null);
      return;
    }

    if (sampleMusicSourceRef.current) {
      try { (sampleMusicSourceRef.current as any).stop?.(); } catch(e) {}
      try { (sampleMusicSourceRef.current as any).pause?.(); } catch(e) {}
      sampleMusicSourceRef.current = null;
    }
    sampleMusicGainRef.current = null;

    setPlayingPresetId('custom-uploaded');
    try {
      const ctx = audioEngine.initContext();
      if (ctx.state === 'suspended') {
        await ctx.resume().catch(() => {});
      }
      const buffer = await audioEngine.decodeAudioUrl(musicTrack.fileUrl);
      if (buffer) {
        const source = ctx.createBufferSource();
        const gainNode = ctx.createGain();
        const activeVol = musicTrack.isMuted ? 0 : Math.max(0, musicTrack.volume);
        gainNode.gain.setValueAtTime(activeVol, ctx.currentTime);
        gainNode.connect(ctx.destination);

        source.buffer = buffer;
        source.connect(gainNode);
        sampleMusicGainRef.current = gainNode;

        source.onended = () => {
          setPlayingPresetId((curr) => (curr === 'custom-uploaded' ? null : curr));
          sampleMusicGainRef.current = null;
        };
        sampleMusicSourceRef.current = source;
        source.start(0);
        try { source.stop(ctx.currentTime + 10); } catch(e) {}
      } else {
        const audio = new Audio(musicTrack.fileUrl);
        audio.volume = musicTrack.isMuted ? 0 : Math.min(1, Math.max(0, musicTrack.volume));
        audio.play().catch(() => {});
        (sampleMusicSourceRef as any).current = audio;
        const timeout = setTimeout(() => {
          audio.pause();
          setPlayingPresetId((curr) => (curr === 'custom-uploaded' ? null : curr));
        }, 10000);
        audio.onended = () => {
          clearTimeout(timeout);
          setPlayingPresetId((curr) => (curr === 'custom-uploaded' ? null : curr));
        };
      }
    } catch (err) {
      console.error('Error previewing custom music:', err);
      setPlayingPresetId(null);
      sampleMusicGainRef.current = null;
    }
  };

  // AI Voiceover Generator State
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>('male-james');
  const [selectedLanguageCode, setSelectedLanguageCode] = useState<string>('en-US');
  const [scriptText, setScriptText] = useState<string>(
    'Welcome to this extraordinary luxury residence. Featuring high ceilings, gourmet kitchen, spacious bedrooms, and breathtaking views. Contact us today for your private viewing.'
  );
  const [playingSampleVoiceId, setPlayingSampleVoiceId] = useState<string | null>(null);
  const [loadingSampleVoiceId, setLoadingSampleVoiceId] = useState<string | null>(null);
  const [isGeneratingAiVoice, setIsGeneratingAiVoice] = useState(false);
  const [voiceGenError, setVoiceGenError] = useState<string | null>(null);

  // Property / Product Details Form State for AI Script Generation
  const [scriptForm, setScriptForm] = useState({
    industry: 'Real Estate',
    title: 'Horizon Grand Penthouse',
    location: 'Orchard Road, Prime District 09',
    area: '2,800 sqft / 260 sqm',
    price: '$3,880,000',
    completionDate: 'Q4 2026',
    furnishing: 'Fully Furnished',
    propertyType: 'Condo / Penthouse',
    website: 'www.horizonpenthouse.com',
    contact: '+1 (555) 019-2831 / agent@luxuryrealty.com',
    otherInfo: 'Private lift access, high ceilings, panoramic ocean views, infinity pool, 3 mins walk to MRT station'
  });

  // Industry Preset Helper
  const handleIndustryChange = (newIndustry: string) => {
    if (newIndustry === 'Real Estate') {
      setScriptForm({
        industry: 'Real Estate',
        title: 'Horizon Grand Penthouse',
        location: 'Orchard Road, Prime District 09',
        area: '2,800 sqft / 260 sqm',
        price: '$3,880,000',
        completionDate: 'Q4 2026',
        furnishing: 'Fully Furnished',
        propertyType: 'Condo / Penthouse',
        website: 'www.horizonpenthouse.com',
        contact: '+1 (555) 019-2831 / agent@luxuryrealty.com',
        otherInfo: 'Private lift access, high ceilings, panoramic ocean views, infinity pool, 3 mins walk to MRT'
      });
    } else if (newIndustry === 'Automobile') {
      setScriptForm({
        industry: 'Automobile',
        title: 'Apex GT V8 Supercar',
        location: 'Apex Motors Luxury Showroom',
        area: 'V8 Twin-Turbo, 710 Horsepower',
        price: '$185,000 MSRP',
        completionDate: '2026 Edition',
        furnishing: 'Italian Leather Cockpit',
        propertyType: 'Luxury Supercar',
        website: 'www.apexmotors.com',
        contact: '+1 (555) 019-8822 / sales@apexmotors.com',
        otherInfo: '0-100 km/h in 2.9 seconds, carbon fiber aerodynamics, adaptive suspension, launch control'
      });
    } else if (newIndustry === 'Hotel & Hospitality') {
      setScriptForm({
        industry: 'Hotel & Hospitality',
        title: 'Azure Oceanfront Resort & Spa',
        location: 'North Atoll, Maldives',
        area: 'Overwater Bungalow, 1,500 sqft',
        price: '$850 / night',
        completionDate: 'All Season Availability',
        furnishing: 'All-Inclusive Luxury Service',
        propertyType: '5-Star Oceanfront Resort',
        website: 'www.azureresort.com',
        contact: '+1 (555) 019-3344 / concierge@azureresort.com',
        otherInfo: 'Direct lagoon access, floating breakfast, hydrotherapy spa, private butler service'
      });
    } else if (newIndustry === 'Travel & Tourism') {
      setScriptForm({
        industry: 'Travel & Tourism',
        title: 'Swiss Alps Grand Alpine Tour',
        location: 'Interlaken & Zermatt, Switzerland',
        area: '7 Days / 6 Nights Guided Tour',
        price: '$2,499 per person',
        completionDate: 'Spring / Summer 2026',
        furnishing: 'First Class Railway & Luxury Lodging',
        propertyType: 'Private Guided Expedition',
        website: 'www.alpinemarketingtravel.com',
        contact: '+1 (555) 019-5566 / info@alpinetravel.com',
        otherInfo: 'Panoramic helicopter ride over Matterhorn, scenic train passes, gourmet dinners included'
      });
    } else if (newIndustry === 'Jewelry & Luxury') {
      setScriptForm({
        industry: 'Jewelry & Luxury',
        title: 'Celestial Diamond Solitaire',
        location: 'Maison de Luxe Flagship Store',
        area: '3.5 Carat VVS1 Clarity, 18K Gold',
        price: '$42,500',
        completionDate: 'Limited Handcrafted Edition',
        furnishing: 'Ideal Brilliant Cut with Certificate',
        propertyType: 'Fine Diamond Jewelry',
        website: 'www.maisondeluxe.com',
        contact: '+1 (555) 019-7788 / boutique@maisondeluxe.com',
        otherInfo: 'Sustainably mined conflict-free diamonds, custom velvet presentation box, lifetime warranty'
      });
    } else if (newIndustry === 'Restaurant & Dining') {
      setScriptForm({
        industry: 'Restaurant & Dining',
        title: 'Le Gourmet Fine Dining Experience',
        location: '742 Culinary Boulevard, Downtown',
        area: '7-Course Chef Tasting Menu',
        price: '$195 per person',
        completionDate: 'Tue-Sun 6:00 PM - 11:00 PM',
        furnishing: 'Sommelier Wine Pairing Available',
        propertyType: 'Michelin Star Fine Dining',
        website: 'www.legourmetdining.com',
        contact: '+1 (555) 019-9900 / reserve@legourmetdining.com',
        otherInfo: 'Artisanal A5 Wagyu beef, fresh truffle infusions, handcrafted botanical cocktails'
      });
    } else {
      setScriptForm({
        industry: 'General Retail',
        title: 'ProSound Wireless Noise-Canceling Headphones',
        location: 'Available Nationwide & Online',
        area: '40-Hour Battery Life, 40mm Drivers',
        price: '$299 Special Launch Price',
        completionDate: 'In Stock / Free Shipping',
        furnishing: 'Ergonomic Memory Foam Cushions',
        propertyType: 'Consumer Electronics',
        website: 'www.prosoundaudio.com',
        contact: '+1 (555) 019-1122 / support@prosoundaudio.com',
        otherInfo: 'Active spatial audio, ultra-fast USB-C charging, multipoint Bluetooth 5.4 connection'
      });
    }
  };
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const scriptFileInputRef = useRef<HTMLInputElement | null>(null);
  const logoFileInputRef = useRef<HTMLInputElement | null>(null);

  // Logo Image Upload Handler
  const handleLogoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl && onUpdateLogoUrl) {
        onUpdateLogoUrl(dataUrl);
      }
    };
    reader.readAsDataURL(file);
    if (logoFileInputRef.current) logoFileInputRef.current.value = '';
  };

  // Microphone Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);

  // Generate Voiceover Script via AI from User Form Inputs
  const handleGenerateScriptWithAi = async () => {
    setIsGeneratingScript(true);
    try {
      const res = await fetch('/api/generate-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scriptForm)
      });
      const data = await res.json();
      if (data.script) {
        setScriptText(data.script);
      }
    } catch (err) {
      console.error('Error generating AI voiceover script:', err);
      const fallback = `Welcome to ${scriptForm.title || 'this luxury residence'} located in ${scriptForm.location || 'a prime neighborhood'}. This ${scriptForm.furnishing.toLowerCase()} ${scriptForm.propertyType.toLowerCase()} offers ${scriptForm.area} of elegantly designed living space, listed at ${scriptForm.price} with completion in ${scriptForm.completionDate}. ${scriptForm.otherInfo ? `Key highlights include: ${scriptForm.otherInfo}.` : ''} Contact us today for an exclusive private viewing.`;
      setScriptText(fallback);
    } finally {
      setIsGeneratingScript(false);
    }
  };

  // Upload Custom Text Script File (.txt)
  const handleScriptFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setScriptText(content.trim());
      }
    };
    reader.readAsText(file);
    if (scriptFileInputRef.current) scriptFileInputRef.current.value = '';
  };

  // Upload Music Handler
  const processMusicFile = (file: File) => {
    if (!file.type.startsWith('audio/')) return;
    const url = URL.createObjectURL(file);
    onUpdateMusicTrack({
      ...musicTrack,
      enabled: true,
      sourceType: 'custom',
      fileUrl: url,
      fileName: file.name,
      isMuted: false,
    });
  };

  const handleMusicUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processMusicFile(file);
    if (musicFileInputRef.current) musicFileInputRef.current.value = '';
  };

  // Upload Voiceover Handler
  const processVoiceFile = (file: File) => {
    if (!file.type.startsWith('audio/')) return;
    const url = URL.createObjectURL(file);
    onUpdateVoiceoverTrack({
      ...voiceoverTrack,
      enabled: true,
      sourceType: 'custom',
      fileUrl: url,
      fileName: file.name,
      isMuted: false,
    });
  };

  const handleVoiceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processVoiceFile(file);
    if (voiceFileInputRef.current) voiceFileInputRef.current.value = '';
  };

  // Drag & Drop Handlers for Music
  const handleMusicDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsMusicDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processMusicFile(e.dataTransfer.files[0]);
    }
  };

  // Drag & Drop Handlers for Voice
  const handleVoiceDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsVoiceDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processVoiceFile(e.dataTransfer.files[0]);
    }
  };

  // Record Voiceover from Microphone
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);
        onUpdateVoiceoverTrack({
          ...voiceoverTrack,
          enabled: true,
          sourceType: 'recorded',
          fileUrl: audioUrl,
          fileName: `Voiceover Recording (${recordingSeconds}s)`,
          isMuted: false,
        });

        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Microphone recording error:', err);
      alert('Could not access microphone. Please grant browser microphone permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    }
  };

  // Play Sample Speech for Voice — uses the same real Google TTS as the
  // actual "apply" button, so what you hear while browsing voices matches
  // what you'll actually get. Samples are cached per voice+language so
  // browsing back and forth doesn't repeatedly hit the API.
  const handleToggleSampleVoice = async (voice: NarrationVoice) => {
    if (playingSampleVoiceId === voice.id) {
      sampleVoiceAudioRef.current?.pause();
      setPlayingSampleVoiceId(null);
      return;
    }

    sampleVoiceAudioRef.current?.pause();
    setPlayingSampleVoiceId(null);

    const currentLangObj = NARRATION_LANGUAGES.find((l) => l.code === selectedLanguageCode);
    const sampleText = currentLangObj ? currentLangObj.samplePhrase : voice.description;
    const cacheKey = `${voice.id}_${selectedLanguageCode}`;

    const playUrl = (url: string) => {
      const audio = new Audio(url);
      audio.onended = () => setPlayingSampleVoiceId((current) => (current === voice.id ? null : current));
      audio.onerror = () => setPlayingSampleVoiceId((current) => (current === voice.id ? null : current));
      sampleVoiceAudioRef.current = audio;
      audio.play().then(() => setPlayingSampleVoiceId(voice.id)).catch(() => setPlayingSampleVoiceId(null));
    };

    const cachedUrl = sampleVoiceCacheRef.current.get(cacheKey);
    if (cachedUrl) {
      playUrl(cachedUrl);
      return;
    }

    setLoadingSampleVoiceId(voice.id);
    try {
      const { url } = await generateAiVoiceoverAudioBlob(sampleText, voice, selectedLanguageCode);
      sampleVoiceCacheRef.current.set(cacheKey, url);
      playUrl(url);
    } catch (err) {
      console.error('Error generating voice sample:', err);
      setPlayingSampleVoiceId(null);
    } finally {
      setLoadingSampleVoiceId(null);
    }
  };

  // Generate & Apply Single Lively AI Voiceover Track for all slides
  const handleGenerateAiVoiceover = async () => {
    const selectedVoiceObj = ALL_NARRATION_VOICES.find((v) => v.id === selectedVoiceId) || MALE_VOICES[0];
    const textToSynthesize = scriptText.trim() || 'Welcome to this luxury property showcase. Enjoy the tour.';

    setIsGeneratingAiVoice(true);
    setVoiceGenError(null);
    try {
      const { url } = await generateAiVoiceoverAudioBlob(
        textToSynthesize,
        selectedVoiceObj,
        selectedLanguageCode
      );

      const langObj = NARRATION_LANGUAGES.find((l) => l.code === selectedLanguageCode);
      const voiceLabel = `${selectedVoiceObj.name} (${selectedVoiceObj.tone}) - ${
        langObj ? langObj.name : selectedLanguageCode
      }`;

      onUpdateVoiceoverTrack({
        ...voiceoverTrack,
        enabled: true,
        sourceType: 'ai-generated',
        fileUrl: url,
        fileName: `AI Voice: ${voiceLabel}`,
        voiceId: selectedVoiceObj.id,
        language: selectedLanguageCode,
        scriptText: textToSynthesize,
        isMuted: false,
      });

      setAppliedVoiceSuccess(true);
      setTimeout(() => {
        setAppliedVoiceSuccess(false);
      }, 8000);
    } catch (err: any) {
      console.error('Error generating AI voiceover:', err);
      setVoiceGenError(err.message || 'Unable to generate voiceover. Please try again.');
    } finally {
      setIsGeneratingAiVoice(false);
    }
  };

  // Active Applied Voice Preview State
  const [isPlayingAppliedVoice, setIsPlayingAppliedVoice] = useState(false);
  const [appliedVoiceSuccess, setAppliedVoiceSuccess] = useState(false);
  const appliedVoiceAudioRef = useRef<HTMLAudioElement | null>(null);
  const sampleVoiceAudioRef = useRef<HTMLAudioElement | null>(null);
  const sampleVoiceCacheRef = useRef<Map<string, string>>(new Map());

  const handleTogglePlayAppliedVoice = () => {
    if (!voiceoverTrack.fileUrl) return;

    if (isPlayingAppliedVoice) {
      if (appliedVoiceAudioRef.current) {
        appliedVoiceAudioRef.current.pause();
        appliedVoiceAudioRef.current = null;
      }
      setIsPlayingAppliedVoice(false);
      return;
    }

    if (appliedVoiceAudioRef.current) {
      appliedVoiceAudioRef.current.pause();
    }

    const audio = new Audio(voiceoverTrack.fileUrl);
    audio.volume = voiceoverTrack.isMuted ? 0 : voiceoverTrack.volume;
    audio.onended = () => {
      setIsPlayingAppliedVoice(false);
      appliedVoiceAudioRef.current = null;
    };
    audio.onerror = () => {
      setIsPlayingAppliedVoice(false);
      appliedVoiceAudioRef.current = null;
    };
    audio.play().then(() => {
      setIsPlayingAppliedVoice(true);
      appliedVoiceAudioRef.current = audio;
    }).catch((e) => {
      console.error('Applied voice play error:', e);
      setIsPlayingAppliedVoice(false);
    });
  };

  // Filtered Voices list
  const displayedVoices = ALL_NARRATION_VOICES.filter((v) => {
    if (voiceGenderFilter === 'male') return v.gender === 'male';
    if (voiceGenderFilter === 'female') return v.gender === 'female';
    return true;
  });

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 md:p-5 flex flex-col gap-4 shadow-xl">
      {/* Header Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab('music')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              activeTab === 'music'
                ? 'bg-amber-500 text-slate-950 shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Music className="w-3.5 h-3.5" />
            <span>Background Music</span>
          </button>

          <button
            onClick={() => setActiveTab('voiceover')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              activeTab === 'voiceover'
                ? 'bg-amber-500 text-slate-950 shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            <span>Voiceover Narration</span>
          </button>
        </div>

        <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
          Independent Volume & Audio Controls
        </span>
      </div>

      {/* ================= BACKGROUND MUSIC TAB ================= */}
      {activeTab === 'music' && (
        <div className="space-y-4">
          {/* Active Music Track Card */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg border flex items-center justify-center ${
                musicTrack.enabled && (musicTrack.presetId || musicTrack.fileUrl)
                  ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                  : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}>
                <Music className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-bold text-white block">
                  {musicTrack.enabled && (musicTrack.presetId || musicTrack.fileUrl)
                    ? (musicTrack.fileName || 'Active Background Track')
                    : 'No Music Selected (Silent Video)'}
                </span>
                <span className="text-[11px] text-slate-400">
                  {musicTrack.enabled && (musicTrack.presetId || musicTrack.fileUrl)
                    ? `Source: ${musicTrack.sourceType === 'preset' ? 'Built-in Preset' : 'Uploaded Custom Audio'}`
                    : 'Background music is completely disabled — no sound plays.'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {musicTrack.enabled && musicTrack.sourceType === 'custom' && musicTrack.fileUrl && (
                <button
                  onClick={handleToggleCustomMusicPreview}
                  className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-all ${
                    playingPresetId === 'custom-uploaded'
                      ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold shadow'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                  }`}
                  title={playingPresetId === 'custom-uploaded' ? 'Stop Audio Preview' : 'Listen / Test Play Uploaded Music'}
                >
                  {playingPresetId === 'custom-uploaded' ? (
                    <>
                      <Pause className="w-3.5 h-3.5 text-slate-950" />
                      <span>Stop Test</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                      <span>Test Play</span>
                    </>
                  )}
                </button>
              )}

              {musicTrack.enabled && (musicTrack.presetId || musicTrack.fileUrl) && (
                <button
                  onClick={() => {
                    if (sampleMusicSourceRef.current) {
                      try { (sampleMusicSourceRef.current as any).stop?.(); } catch(e) {}
                      try { (sampleMusicSourceRef.current as any).pause?.(); } catch(e) {}
                      sampleMusicSourceRef.current = null;
                    }
                    setPlayingPresetId(null);
                    onUpdateMusicTrack({
                      ...musicTrack,
                      enabled: false,
                      presetId: undefined,
                      fileUrl: null,
                      fileName: 'No Music (Silent)',
                    });
                  }}
                  className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-colors"
                  title="Remove music and make video completely silent"
                >
                  <span>Remove Music</span>
                </button>
              )}

              <button
                onClick={() => musicFileInputRef.current?.click()}
                className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-700 transition-colors"
              >
                <Upload className="w-3.5 h-3.5 text-amber-400" />
                <span>Upload Music</span>
              </button>
              <input
                ref={musicFileInputRef}
                type="file"
                accept="audio/*"
                onChange={handleMusicUpload}
                className="hidden"
              />

              <button
                onClick={() =>
                  onUpdateMusicTrack({ ...musicTrack, isMuted: !musicTrack.isMuted })
                }
                title={musicTrack.isMuted ? 'Unmute Music' : 'Mute Music'}
                className={`p-2 rounded-lg transition-colors ${
                  musicTrack.isMuted
                    ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                    : 'bg-slate-800 text-slate-300'
                }`}
              >
                {musicTrack.isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Upload Own Music Drag & Drop Box */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsMusicDragging(true);
            }}
            onDragLeave={() => setIsMusicDragging(false)}
            onDrop={handleMusicDrop}
            className={`border-2 border-dashed rounded-xl p-4 text-center transition-all cursor-pointer ${
              isMusicDragging
                ? 'border-amber-500 bg-amber-500/10'
                : 'border-slate-800 hover:border-slate-700 bg-slate-950/40'
            }`}
            onClick={() => musicFileInputRef.current?.click()}
          >
            <div className="flex flex-col items-center gap-1">
              <Upload className="w-6 h-6 text-amber-400 mb-1" />
              <p className="text-xs font-bold text-slate-200">
                Upload Own Background Music File
              </p>
              <p className="text-[11px] text-slate-400">
                Drag & drop your custom MP3, WAV, M4A, or AAC audio track here
              </p>
            </div>
          </div>

          {/* Royalty-Free Built-in Music Presets */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-300 block">
                Or Choose Built-In Property Music Preset
              </label>
              <button
                type="button"
                onClick={() => {
                  if (sampleMusicSourceRef.current) {
                    try { sampleMusicSourceRef.current.stop(); } catch(e) {}
                    sampleMusicSourceRef.current = null;
                  }
                  setPlayingPresetId(null);
                  onUpdateMusicTrack({
                    ...musicTrack,
                    enabled: false,
                    presetId: undefined,
                    fileUrl: null,
                    fileName: 'No Music (Silent)',
                  });
                }}
                className={`text-[11px] font-semibold px-2 py-0.5 rounded transition-colors ${
                  !musicTrack.enabled || (!musicTrack.presetId && !musicTrack.fileUrl)
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                No Music (Silent)
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {/* Option 0: No Music */}
              <div
                onClick={() => {
                  if (sampleMusicSourceRef.current) {
                    try { sampleMusicSourceRef.current.stop(); } catch(e) {}
                    sampleMusicSourceRef.current = null;
                  }
                  setPlayingPresetId(null);
                  onUpdateMusicTrack({
                    ...musicTrack,
                    enabled: false,
                    presetId: undefined,
                    fileUrl: null,
                    fileName: 'No Music (Silent)',
                  });
                }}
                className={`p-2.5 rounded-xl border transition-all flex items-start justify-between gap-2 cursor-pointer ${
                  !musicTrack.enabled || (!musicTrack.presetId && !musicTrack.fileUrl)
                    ? 'bg-amber-500/10 border-amber-500/50 text-amber-300'
                    : 'bg-slate-950/40 border-slate-800 hover:border-slate-700 text-slate-300'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5">
                    <Radio className={`w-4 h-4 ${!musicTrack.enabled || (!musicTrack.presetId && !musicTrack.fileUrl) ? 'text-amber-400' : 'text-slate-500'}`} />
                  </div>
                  <div>
                    <span className="text-xs font-bold block">No Background Music</span>
                    <span className="text-[10px] text-slate-400 block">Completely silent video with zero background noise</span>
                  </div>
                </div>
              </div>

              {MUSIC_PRESETS.map((preset) => {
                const isSelected =
                  musicTrack.enabled &&
                  musicTrack.sourceType === 'preset' &&
                  musicTrack.presetId === preset.id;
                const isPreviewing = playingPresetId === preset.id;
                return (
                  <div
                    key={preset.id}
                    onClick={() =>
                      onUpdateMusicTrack({
                        ...musicTrack,
                        enabled: true,
                        sourceType: 'preset',
                        presetId: preset.id,
                        fileName: preset.name,
                        isMuted: false,
                      })
                    }
                    className={`p-2.5 rounded-xl border transition-all flex items-start justify-between gap-2 cursor-pointer ${
                      isSelected
                        ? 'bg-amber-500/10 border-amber-500/50 text-amber-300'
                        : 'bg-slate-950/40 border-slate-800 hover:border-slate-700 text-slate-300'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="mt-0.5">
                        <Radio className={`w-4 h-4 ${isSelected ? 'text-amber-400' : 'text-slate-500'}`} />
                      </div>
                      <div>
                        <span className="text-xs font-bold block">{preset.name}</span>
                        <span className="text-[10px] text-slate-400 block">{preset.description}</span>
                      </div>
                    </div>

                    {/* Live Preview Button */}
                    <button
                      type="button"
                      onClick={(e) => handleTogglePresetPreview(e, preset.id)}
                      title="Preview Preset Music"
                      className="flex items-center gap-1 bg-slate-900 hover:bg-slate-800 border border-slate-700 px-2 py-1 rounded text-[10px] font-bold text-amber-400 transition-colors shrink-0"
                    >
                      {isPreviewing ? (
                        <>
                          <Pause className="w-3 h-3 text-red-400 fill-current" />
                          <span>Stop</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3 h-3 text-amber-400 fill-current" />
                          <span>Listen</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Music Volume & Fade In/Out Sliders */}
          <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-200">
              <span className="flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-amber-400" />
                <span>Music Volume</span>
              </span>
              <span className="font-mono text-amber-400 font-bold">
                {Math.round(musicTrack.volume * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={1.5}
              step={0.05}
              value={musicTrack.volume}
              onChange={(e) =>
                onUpdateMusicTrack({ ...musicTrack, volume: parseFloat(e.target.value) })
              }
              className="w-full accent-amber-500 cursor-pointer h-1.5 bg-slate-800 rounded"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div>
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-300 mb-1">
                  <span>Fade In Duration</span>
                  <span className="text-amber-400 font-mono">
                    {musicTrack.fadeInDuration}s
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={5}
                  step={0.5}
                  value={musicTrack.fadeInDuration}
                  onChange={(e) =>
                    onUpdateMusicTrack({
                      ...musicTrack,
                      fadeInDuration: parseFloat(e.target.value),
                    })
                  }
                  className="w-full accent-amber-500 cursor-pointer h-1 bg-slate-800 rounded"
                />
              </div>

              <div>
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-300 mb-1">
                  <span>Fade Out Duration</span>
                  <span className="text-amber-400 font-mono">
                    {musicTrack.fadeOutDuration}s
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={5}
                  step={0.5}
                  value={musicTrack.fadeOutDuration}
                  onChange={(e) =>
                    onUpdateMusicTrack({
                      ...musicTrack,
                      fadeOutDuration: parseFloat(e.target.value),
                    })
                  }
                  className="w-full accent-amber-500 cursor-pointer h-1 bg-slate-800 rounded"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= VOICEOVER NARRATION TAB ================= */}
      {activeTab === 'voiceover' && (
        <div className="space-y-4">
          {/* Active Voiceover Track Status Banner */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg border flex items-center justify-center ${
                voiceoverTrack.enabled && voiceoverTrack.fileUrl
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                  : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
              }`}>
                <Mic className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white block">
                    {voiceoverTrack.fileName || 'No Voiceover Recorded or Selected'}
                  </span>
                  {voiceoverTrack.fileUrl && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border ${
                      voiceoverTrack.enabled && !voiceoverTrack.isMuted
                        ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                        : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}>
                      {voiceoverTrack.enabled && !voiceoverTrack.isMuted ? '● Active' : 'Off / Muted'}
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-slate-400">
                  {voiceoverTrack.fileUrl
                    ? voiceoverTrack.enabled
                      ? 'Voiceover Track is active and synchronized in video preview'
                      : 'Voiceover is currently disabled (Turn on to enable sound)'
                    : 'Generate AI narration, upload file, or record microphone'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {voiceoverTrack.fileUrl && (
                <>
                  <button
                    type="button"
                    onClick={handleTogglePlayAppliedVoice}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                      isPlayingAppliedVoice
                        ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                    }`}
                    title={isPlayingAppliedVoice ? 'Stop Audio Preview' : 'Listen to Applied Voiceover'}
                  >
                    {isPlayingAppliedVoice ? (
                      <>
                        <Pause className="w-3.5 h-3.5 fill-current" />
                        <span>Stop</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Listen</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      onUpdateVoiceoverTrack({
                        ...voiceoverTrack,
                        enabled: !voiceoverTrack.enabled,
                      })
                    }
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors border ${
                      voiceoverTrack.enabled
                        ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30'
                        : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {voiceoverTrack.enabled ? 'Enabled' : 'Disabled'}
                  </button>
                </>
              )}

              <button
                onClick={() =>
                  onUpdateVoiceoverTrack({ ...voiceoverTrack, isMuted: !voiceoverTrack.isMuted })
                }
                title={voiceoverTrack.isMuted ? 'Unmute Voiceover' : 'Mute Voiceover'}
                className={`p-2 rounded-lg transition-colors ${
                  voiceoverTrack.isMuted
                    ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                    : 'bg-slate-800 text-slate-300'
                }`}
              >
                {voiceoverTrack.isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Success Banner Notification */}
          {appliedVoiceSuccess && (
            <div className="flex items-center justify-between gap-2 bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-xs px-3.5 py-2.5 rounded-xl shadow-lg animate-fade-in">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span className="font-semibold">
                  Voiceover narration synthesized and applied! Active in video preview.
                </span>
              </div>
              <button
                type="button"
                onClick={handleTogglePlayAppliedVoice}
                className="flex items-center gap-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-2 py-1 rounded text-[11px]"
              >
                <Play className="w-3 h-3 fill-current" />
                <span>Test Play</span>
              </button>
            </div>
          )}

          {/* Sub-tabs for Voiceover Source */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setVoiceSubTab('ai-voice')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                voiceSubTab === 'ai-voice'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 fill-current" />
              <span>AI Narration Voices</span>
            </button>

            <button
              onClick={() => setVoiceSubTab('upload-voice')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                voiceSubTab === 'upload-voice'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Own Voice</span>
            </button>

            <button
              onClick={() => setVoiceSubTab('record-mic')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                voiceSubTab === 'record-mic'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Mic className="w-3.5 h-3.5" />
              <span>Record Mic</span>
            </button>
          </div>

          {/* --- SUB-TAB 1: AI NARRATION VOICES & SCRIPT GENERATOR --- */}
          {voiceSubTab === 'ai-voice' && (
            <div className="space-y-4">
              {/* SECTION 1: AI Marketing Voiceover Script Generator Form */}
              <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400 fill-amber-400/20" />
                    <h3 className="text-xs font-bold text-white">AI Voiceover Script Generator</h3>
                  </div>

                  {/* Upload Custom Script File (.txt) */}
                  <div>
                    <button
                      type="button"
                      onClick={() => scriptFileInputRef.current?.click()}
                      className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-amber-400 text-[11px] font-bold px-2.5 py-1 rounded-lg border border-slate-700 transition-colors cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload Script (.txt)</span>
                    </button>
                    <input
                      ref={scriptFileInputRef}
                      type="file"
                      accept=".txt,text/plain"
                      onChange={handleScriptFileUpload}
                      className="hidden"
                    />
                  </div>
                </div>

                {/* Industry Selector Dropdown */}
                <div>
                  <label className="text-[10px] font-bold text-amber-400 block mb-1 uppercase tracking-wider">
                    Select Product Industry / Category
                  </label>
                  <select
                    value={scriptForm.industry}
                    onChange={(e) => handleIndustryChange(e.target.value)}
                    className="w-full bg-slate-900 text-xs font-bold text-white border border-amber-500/40 rounded-lg px-2.5 py-2 focus:outline-none focus:border-amber-400 cursor-pointer shadow-inner"
                  >
                    <option value="Real Estate">Real Estate & Properties</option>
                    <option value="Automobile">Automobile & Supercars</option>
                    <option value="Hotel & Hospitality">Hotels & Resorts</option>
                    <option value="Travel & Tourism">Travel & Tours</option>
                    <option value="Jewelry & Luxury">Jewelry & Fine Luxury</option>
                    <option value="Restaurant & Dining">Restaurants & Fine Dining</option>
                    <option value="General Retail">General Product / Retail</option>
                  </select>
                </div>

                {/* Property / Product Detail Inputs Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* Title / Name */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block mb-0.5">
                      {scriptForm.industry === 'Real Estate' ? 'Property Title / Name' :
                       scriptForm.industry === 'Automobile' ? 'Vehicle Model / Name' :
                       scriptForm.industry === 'Hotel & Hospitality' ? 'Hotel / Resort Name' :
                       scriptForm.industry === 'Travel & Tourism' ? 'Tour / Destination Title' :
                       scriptForm.industry === 'Jewelry & Luxury' ? 'Piece / Collection Name' :
                       scriptForm.industry === 'Restaurant & Dining' ? 'Restaurant / Dish Title' :
                       'Product / Item Name'}
                    </label>
                    <input
                      type="text"
                      value={scriptForm.title}
                      onChange={(e) => setScriptForm({ ...scriptForm, title: e.target.value })}
                      placeholder="e.g. Title or product name"
                      className="w-full bg-slate-900 text-xs text-slate-200 border border-slate-800 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  {/* Location / Brand */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block mb-0.5">
                      {scriptForm.industry === 'Automobile' ? 'Dealership / Showroom' :
                       scriptForm.industry === 'Jewelry & Luxury' ? 'Boutique / Brand' :
                       scriptForm.industry === 'General Retail' ? 'Brand / Store' :
                       'Location / Address'}
                    </label>
                    <input
                      type="text"
                      value={scriptForm.location}
                      onChange={(e) => setScriptForm({ ...scriptForm, location: e.target.value })}
                      placeholder="e.g. Location or brand name"
                      className="w-full bg-slate-900 text-xs text-slate-200 border border-slate-800 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  {/* Size / Specs / Features */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block mb-0.5">
                      {scriptForm.industry === 'Real Estate' ? 'Floor Area / Size' :
                       scriptForm.industry === 'Automobile' ? 'Engine / Specs' :
                       scriptForm.industry === 'Hotel & Hospitality' ? 'Suite / Room Specs' :
                       scriptForm.industry === 'Travel & Tourism' ? 'Duration / Itinerary' :
                       scriptForm.industry === 'Jewelry & Luxury' ? 'Carat / Materials' :
                       scriptForm.industry === 'Restaurant & Dining' ? 'Menu / Tasting Specs' :
                       'Product Specs / Size'}
                    </label>
                    <input
                      type="text"
                      value={scriptForm.area}
                      onChange={(e) => setScriptForm({ ...scriptForm, area: e.target.value })}
                      placeholder="e.g. Specifications or dimensions"
                      className="w-full bg-slate-900 text-xs text-slate-200 border border-slate-800 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  {/* Price */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block mb-0.5">
                      {scriptForm.industry === 'Hotel & Hospitality' ? 'Nightly Rate' :
                       scriptForm.industry === 'Restaurant & Dining' ? 'Price / Per Cover' :
                       scriptForm.industry === 'Travel & Tourism' ? 'Tour Price' :
                       'Price / Special Offer'}
                    </label>
                    <input
                      type="text"
                      value={scriptForm.price}
                      onChange={(e) => setScriptForm({ ...scriptForm, price: e.target.value })}
                      placeholder="e.g. Price or rate"
                      className="w-full bg-slate-900 text-xs text-slate-200 border border-slate-800 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  {/* Completion Date / Availability */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block mb-0.5">
                      {scriptForm.industry === 'Real Estate' ? 'Completion Date / Tenure' :
                       scriptForm.industry === 'Automobile' ? 'Model Year / Edition' :
                       scriptForm.industry === 'Restaurant & Dining' ? 'Reservation Hours' :
                       'Availability / Launch Date'}
                    </label>
                    <input
                      type="text"
                      value={scriptForm.completionDate}
                      onChange={(e) => setScriptForm({ ...scriptForm, completionDate: e.target.value })}
                      placeholder="e.g. Availability or dates"
                      className="w-full bg-slate-900 text-xs text-slate-200 border border-slate-800 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  {/* Furnishing / Craftsmanship / Service */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block mb-0.5">
                      {scriptForm.industry === 'Real Estate' ? 'Furnishing Status' :
                       scriptForm.industry === 'Automobile' ? 'Interior & Finish' :
                       scriptForm.industry === 'Hotel & Hospitality' ? 'Service Level' :
                       scriptForm.industry === 'Jewelry & Luxury' ? 'Craftsmanship & Cut' :
                       'Finish / Style'}
                    </label>
                    <input
                      type="text"
                      value={scriptForm.furnishing}
                      onChange={(e) => setScriptForm({ ...scriptForm, furnishing: e.target.value })}
                      placeholder="e.g. Finish status or materials"
                      className="w-full bg-slate-900 text-xs text-slate-200 border border-slate-800 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  {/* Website (Optional) */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block mb-0.5">
                      Website URL (Optional)
                    </label>
                    <input
                      type="text"
                      value={scriptForm.website}
                      onChange={(e) => setScriptForm({ ...scriptForm, website: e.target.value })}
                      placeholder="e.g. www.yourbrand.com"
                      className="w-full bg-slate-900 text-xs text-slate-200 border border-slate-800 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  {/* Contact Info (Optional) */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block mb-0.5">
                      Contact Info / Phone (Optional)
                    </label>
                    <input
                      type="text"
                      value={scriptForm.contact}
                      onChange={(e) => setScriptForm({ ...scriptForm, contact: e.target.value })}
                      placeholder="e.g. +1 555-0199 / sales@brand.com"
                      className="w-full bg-slate-900 text-xs text-slate-200 border border-slate-800 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  {/* Category Type */}
                  <div className="sm:col-span-2">
                    <label className="text-[10px] font-bold text-slate-400 block mb-0.5">
                      Category Type
                    </label>
                    <input
                      type="text"
                      value={scriptForm.propertyType}
                      onChange={(e) => setScriptForm({ ...scriptForm, propertyType: e.target.value })}
                      placeholder="e.g. Supercar, Luxury Condo, Fine Dining, Diamond Collection"
                      className="w-full bg-slate-900 text-xs text-slate-200 border border-slate-800 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  {/* Other Information */}
                  <div className="sm:col-span-2">
                    <label className="text-[10px] font-bold text-slate-400 block mb-0.5">
                      Other Information / Key Highlights (Optional)
                    </label>
                    <textarea
                      rows={2}
                      value={scriptForm.otherInfo}
                      onChange={(e) => setScriptForm({ ...scriptForm, otherInfo: e.target.value })}
                      placeholder="e.g. Private lift access, high ceilings, panoramic view, infinity pool, 3 mins to MRT"
                      className="w-full bg-slate-900 text-xs text-slate-200 border border-slate-800 rounded-lg p-2 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  {/* Upload Branding / Agency Logo (Optional) */}
                  <div className="sm:col-span-2 bg-slate-900/90 p-3 rounded-xl border border-slate-800/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-amber-400 flex items-center gap-1.5">
                        <Upload className="w-3.5 h-3.5" />
                        <span>Agency / Branding Logo Overlay (Optional)</span>
                      </label>
                      <span className="text-[10px] text-slate-400">PNG, JPG, SVG</span>
                    </div>

                    {logoUrl ? (
                      <div className="flex items-center justify-between bg-slate-950 p-2 rounded-lg border border-slate-800">
                        <div className="flex items-center gap-2.5">
                          <img
                            src={logoUrl}
                            alt="Agency Logo"
                            className="w-8 h-8 object-contain rounded bg-slate-900 border border-slate-800 p-0.5"
                          />
                          <div>
                            <span className="text-xs font-bold text-slate-200 block">Uploaded Brand Logo</span>
                            <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-semibold">
                              <Check className="w-3 h-3" /> Active on Video Preview & Export
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            if (onUpdateLogoUrl) onUpdateLogoUrl(null);
                          }}
                          className="flex items-center gap-1 text-red-400 hover:text-red-300 text-[11px] font-bold bg-red-500/10 hover:bg-red-500/20 px-2.5 py-1 rounded-lg border border-red-500/20 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Remove</span>
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => logoFileInputRef.current?.click()}
                          className="flex-1 flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold py-2 rounded-xl border border-slate-700 transition-colors cursor-pointer"
                        >
                          <Upload className="w-4 h-4 text-amber-400" />
                          <span>Choose Logo Image File</span>
                        </button>
                        <input
                          ref={logoFileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleLogoFileUpload}
                          className="hidden"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* AI Generate Script Action Button */}
                <button
                  type="button"
                  onClick={handleGenerateScriptWithAi}
                  disabled={isGeneratingScript}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-bold text-xs py-2 rounded-xl shadow transition-all cursor-pointer disabled:opacity-50"
                >
                  <Wand2 className="w-4 h-4 fill-current" />
                  <span>
                    {isGeneratingScript ? 'AI Writing Voiceover Script...' : 'AI Generate Voiceover Script'}
                  </span>
                </button>
              </div>

              {/* Editable Script Text Box */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-amber-400" />
                    <span>Generated / Active Voiceover Script</span>
                  </label>
                  <span className="text-[10px] text-slate-400 font-mono font-semibold">
                    {scriptText.trim() ? scriptText.trim().split(/\s+/).length : 0} words
                  </span>
                </div>
                <textarea
                  rows={3}
                  value={scriptText}
                  onChange={(e) => setScriptText(e.target.value)}
                  placeholder="Your generated property narration script will appear here. Edit or paste text freely..."
                  className="w-full bg-slate-950 text-xs text-slate-200 border border-slate-800 rounded-xl p-3 focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Language Selector */}
              <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 space-y-1.5">
                <label className="text-xs font-bold text-amber-400 flex items-center gap-2">
                  <Globe className="w-4 h-4 text-amber-400" />
                  <span>Select Narration Language</span>
                </label>
                <select
                  value={selectedLanguageCode}
                  onChange={(e) => setSelectedLanguageCode(e.target.value)}
                  className="w-full bg-slate-900 text-xs font-semibold text-slate-200 border border-slate-800 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-amber-500 cursor-pointer"
                >
                  {NARRATION_LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.flag} {lang.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Single Lively Voice Selection Grid */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <User className="w-4 h-4 text-amber-400" />
                    <span>Choose Lively AI Voice</span>
                  </span>

                  {/* Gender Filter Pills */}
                  <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800">
                    <button
                      type="button"
                      onClick={() => setVoiceGenderFilter('all')}
                      className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        voiceGenderFilter === 'all'
                          ? 'bg-amber-500 text-slate-950'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      All (7)
                    </button>
                    <button
                      type="button"
                      onClick={() => setVoiceGenderFilter('male')}
                      className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        voiceGenderFilter === 'male'
                          ? 'bg-blue-500 text-white'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Male (4)
                    </button>
                    <button
                      type="button"
                      onClick={() => setVoiceGenderFilter('female')}
                      className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        voiceGenderFilter === 'female'
                          ? 'bg-pink-500 text-white'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Female (3)
                    </button>
                  </div>
                </div>

                {/* Voice Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[220px] overflow-y-auto pr-1">
                  {displayedVoices.map((voice) => {
                    const isSelected = selectedVoiceId === voice.id;
                    return (
                      <div
                        key={voice.id}
                        onClick={() => setSelectedVoiceId(voice.id)}
                        className={`p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                          isSelected
                            ? 'bg-amber-500/10 border-amber-500 ring-1 ring-amber-500/50 shadow-md shadow-amber-500/10'
                            : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase border ${voice.avatarBg}`}
                            >
                              {voice.gender === 'male' ? '♂ Male' : '♀ Female'}
                            </span>
                            <span className="text-xs font-bold text-white">{voice.name}</span>
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleSampleVoice(voice);
                            }}
                            disabled={loadingSampleVoiceId === voice.id}
                            title="Preview Voice Sample"
                            className="flex items-center gap-1 bg-slate-900 hover:bg-slate-800 border border-slate-700 px-2 py-1 rounded text-[10px] font-bold text-amber-400 transition-colors disabled:opacity-60"
                          >
                            {loadingSampleVoiceId === voice.id ? (
                              <>
                                <div className="w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin"></div>
                                <span>Loading...</span>
                              </>
                            ) : playingSampleVoiceId === voice.id ? (
                              <>
                                <Pause className="w-3 h-3 text-red-400 fill-current" />
                                <span>Stop</span>
                              </>
                            ) : (
                              <>
                                <Play className="w-3 h-3 text-amber-400 fill-current" />
                                <span>Sample</span>
                              </>
                            )}
                          </button>
                        </div>

                        <div>
                          <span className="text-[11px] font-semibold text-slate-300 block">
                            {voice.tone}
                          </span>
                          <span className="text-[10px] text-slate-400 block leading-tight">
                            {voice.description}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Synthesize Audio Track Button */}
              <button
                type="button"
                onClick={handleGenerateAiVoiceover}
                disabled={isGeneratingAiVoice}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-bold text-xs py-2.5 rounded-xl shadow transition-colors disabled:opacity-50 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 fill-current" />
                <span>
                  {isGeneratingAiVoice
                    ? 'Synthesizing Audio Narration...'
                    : 'Synthesize & Apply Voiceover Track'}
                </span>
              </button>

              {voiceGenError && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2 text-xs text-red-300 flex items-center gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>{voiceGenError}</span>
                </div>
              )}

              {/* Active Applied Voiceover Player Card */}
              {voiceoverTrack.fileUrl && voiceoverTrack.sourceType === 'ai-generated' && (
                <div className="bg-slate-950/90 border border-emerald-500/30 rounded-xl p-3 flex items-center justify-between gap-3 shadow-md">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                      <Mic className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-200">
                          {voiceoverTrack.fileName}
                        </span>
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded font-bold">
                          Active
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 block">
                        Synchronized with video slide duration
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleTogglePlayAppliedVoice}
                      className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-emerald-400 font-bold text-xs px-3 py-1.5 rounded-lg border border-slate-700 transition-colors"
                    >
                      {isPlayingAppliedVoice ? (
                        <>
                          <Pause className="w-3.5 h-3.5 fill-current text-red-400" />
                          <span className="text-red-400">Stop</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Listen</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* --- SUB-TAB 2: UPLOAD OWN VOICEOVER --- */}
          {voiceSubTab === 'upload-voice' && (
            <div className="space-y-3">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsVoiceDragging(true);
                }}
                onDragLeave={() => setIsVoiceDragging(false)}
                onDrop={handleVoiceDrop}
                className={`border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer ${
                  isVoiceDragging
                    ? 'border-amber-500 bg-amber-500/10'
                    : 'border-slate-800 hover:border-slate-700 bg-slate-950/40'
                }`}
                onClick={() => voiceFileInputRef.current?.click()}
              >
                <div className="flex flex-col items-center gap-2">
                  <FileAudio className="w-8 h-8 text-amber-400 mb-1" />
                  <p className="text-xs font-bold text-slate-200">
                    Upload Custom Voiceover Narration File
                  </p>
                  <p className="text-[11px] text-slate-400 max-w-sm">
                    Drag & drop your pre-recorded narration MP3, WAV, AAC, M4A, or WEBM audio file here
                  </p>
                  <button
                    type="button"
                    className="mt-2 flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-4 py-2 rounded-lg border border-slate-700 transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5 text-amber-400" />
                    <span>Browse Files</span>
                  </button>
                </div>
              </div>
              <input
                ref={voiceFileInputRef}
                type="file"
                accept="audio/*"
                onChange={handleVoiceUpload}
                className="hidden"
              />
            </div>
          )}

          {/* --- SUB-TAB 3: RECORD MICROPHONE --- */}
          {voiceSubTab === 'record-mic' && (
            <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 flex flex-col items-center justify-center text-center gap-3">
              {isRecording ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-center gap-2 text-red-400 animate-pulse font-mono font-bold text-sm">
                    <span className="w-3 h-3 rounded-full bg-red-500"></span>
                    <span>Recording Microphone ({recordingSeconds}s)...</span>
                  </div>
                  <button
                    onClick={stopRecording}
                    className="flex items-center gap-2 bg-red-500 hover:bg-red-400 text-white font-bold text-xs px-5 py-2 rounded-lg shadow-lg"
                  >
                    <Square className="w-4 h-4 fill-white" />
                    <span>Stop & Save Recording</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-xs text-slate-300 font-semibold">
                    Record Property Voiceover Narration Directly
                  </p>
                  <p className="text-[11px] text-slate-400 max-w-md">
                    Speak into your microphone to add personal narration to your property tour!
                  </p>
                  <button
                    onClick={startRecording}
                    className="mt-2 flex items-center gap-2 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-bold text-xs px-4 py-2 rounded-lg shadow transition-colors mx-auto"
                  >
                    <Mic className="w-4 h-4" />
                    <span>Start Mic Recording</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Voiceover Volume & Fade Sliders */}
          <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-200">
              <span className="flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-amber-400" />
                <span>Voiceover Volume</span>
              </span>
              <span className="font-mono text-amber-400 font-bold">
                {Math.round(voiceoverTrack.volume * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={1.5}
              step={0.05}
              value={voiceoverTrack.volume}
              onChange={(e) =>
                onUpdateVoiceoverTrack({ ...voiceoverTrack, volume: parseFloat(e.target.value) })
              }
              className="w-full accent-amber-500 cursor-pointer h-1.5 bg-slate-800 rounded"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div>
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-300 mb-1">
                  <span>Fade In Duration</span>
                  <span className="text-amber-400 font-mono">
                    {voiceoverTrack.fadeInDuration}s
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={5}
                  step={0.5}
                  value={voiceoverTrack.fadeInDuration}
                  onChange={(e) =>
                    onUpdateVoiceoverTrack({
                      ...voiceoverTrack,
                      fadeInDuration: parseFloat(e.target.value),
                    })
                  }
                  className="w-full accent-amber-500 cursor-pointer h-1 bg-slate-800 rounded"
                />
              </div>

              <div>
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-300 mb-1">
                  <span>Fade Out Duration</span>
                  <span className="text-amber-400 font-mono">
                    {voiceoverTrack.fadeOutDuration}s
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={5}
                  step={0.5}
                  value={voiceoverTrack.fadeOutDuration}
                  onChange={(e) =>
                    onUpdateVoiceoverTrack({
                      ...voiceoverTrack,
                      fadeOutDuration: parseFloat(e.target.value),
                    })
                  }
                  className="w-full accent-amber-500 cursor-pointer h-1 bg-slate-800 rounded"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
