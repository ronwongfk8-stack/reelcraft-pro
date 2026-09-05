import { PropertyPreset, SlideItem } from '../types';

export const generateUniqueId = (prefix = 'slide'): string => {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

export const SAMPLE_REAL_ESTATE_PHOTOS = [
  {
    id: 'photo-template-1',
    url: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1600&q=80',
    title: 'Grand Facade & Exterior',
    subtitle: 'Modern Luxury Estate | Prime Location',
    duration: 4,
    transition: 'slide' as const,
    animation: 'zoom-in' as const,
  },
  {
    id: 'photo-template-2',
    url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1600&q=80',
    title: 'Sunlit Living Space',
    subtitle: 'Soaring Ceilings & Panoramic Glass',
    duration: 4,
    transition: 'flip-book' as const,
    animation: 'pan-left-to-right' as const,
  },
  {
    id: 'photo-template-3',
    url: 'https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?auto=format&fit=crop&w=1600&q=80',
    title: "Gourmet Chef's Kitchen",
    subtitle: 'Custom Quartz Island & Wine Cellar',
    duration: 4,
    transition: 'open-pic' as const,
    animation: 'zoom-out' as const,
  },
  {
    id: 'photo-template-4',
    url: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1600&q=80',
    title: 'Primary Sanctuary Suite',
    subtitle: 'Spacious Private Balcony & En-Suite',
    duration: 4,
    transition: 'corner-flip' as const,
    animation: 'pan-up' as const,
  },
  {
    id: 'photo-template-5',
    url: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1600&q=80',
    title: 'Resort-Style Oasis & Pool',
    subtitle: 'Heated Infinity Pool & Outdoor Kitchen',
    duration: 4,
    transition: 'twist-flip' as const,
    animation: 'bird-eye-view' as const,
  },
];

export const getSamplePhotosWithUniqueIds = (): SlideItem[] => {
  return SAMPLE_REAL_ESTATE_PHOTOS.map((photo, idx) => ({
    ...photo,
    id: generateUniqueId(`photo-${idx + 1}`),
  }));
};

export const MUSIC_PRESETS = [
  {
    id: 'lively-upbeat',
    name: '1. Rhythmic Drive',
    genre: 'Upbeat',
    description: 'The most driving, rhythmic track of the set — good for energetic showcases',
    type: 'lively-upbeat',
    fileUrl: '/music/rhythmic-drive.mp3',
  },
  {
    id: 'blues-session',
    name: '2. Sweet Melody',
    genre: 'Melodic',
    description: 'Warm, gentle melodic instrumental with a relaxed feel',
    type: 'blues-session',
    fileUrl: '/music/sweet-melody.mp3',
  },
  {
    id: 'piano-solo',
    name: '3. Soft Piano Keys',
    genre: 'Piano',
    description: 'Real piano recording, soft and elegant — longest track, good for longer videos',
    type: 'piano-solo',
    fileUrl: '/music/soft-piano-keys.mp3',
  },
  {
    id: 'acoustic-guitar',
    name: '4. Easy Listening',
    genre: 'Easy Listening',
    description: 'Slow, relaxed instrumental with a light, unobtrusive feel',
    type: 'acoustic-guitar',
    fileUrl: '/music/easy-listening.mp3',
  },
  {
    id: 'cafe-music',
    name: '5. Home Window Light',
    genre: 'Warm & Cozy',
    description: 'Warm, inviting instrumental — a natural fit for real estate and lifestyle videos',
    type: 'cafe-music',
    fileUrl: '/music/home-window-light.mp3',
  },
  {
    id: 'moonlit-ambient',
    name: '6. Moonlit River',
    genre: 'Ambient',
    description: 'Calm, atmospheric instrumental with a gentle flowing feel',
    type: 'moonlit-ambient',
    fileUrl: '/music/moonlit-river.mp3',
  },
  {
    id: 'soft-corners',
    name: '7. Soft Corners',
    genre: 'Mellow',
    description: 'Soft, mellow instrumental with a warm, understated tone',
    type: 'soft-corners',
    fileUrl: '/music/soft-corners.mp3',
  },
];

export const PROPERTY_PRESETS: PropertyPreset[] = [
  {
    id: 'luxury-mansion',
    name: 'Real Estate: Luxury Villa Tour',
    description: 'Gold serif subtitles with slow Ken Burns pan motion & ambient lounge track',
    aspectRatio: '16:9',
    stylePreset: 'luxury-gold',
    animationPreset: 'slide-up',
    musicPresetId: 'cafe-music',
    slides: SAMPLE_REAL_ESTATE_PHOTOS.map((p) => ({
      title: p.title,
      subtitle: p.subtitle,
      imageUrl: p.url,
      duration: p.duration,
      transition: p.transition,
      animation: p.animation,
    })),
  },
  {
    id: 'automobile-showcase',
    name: 'Automobile: Supercar Commercial',
    description: 'Sleek dark badge captions with high-energy pan motion & lively upbeat rhythm',
    aspectRatio: '16:9',
    stylePreset: 'modern-minimal',
    animationPreset: 'zoom-pop',
    musicPresetId: 'lively-upbeat',
    slides: [
      {
        title: 'Aerodynamic Performance Silhouette',
        subtitle: 'V8 Twin-Turbo | 710 Horsepower',
        imageUrl: 'https://images.unsplash.com/photo-1617814076367-b759c7d7e738?auto=format&fit=crop&w=1600&q=80',
        duration: 4,
        transition: 'ken-burns-in' as const,
      },
      {
        title: 'Handcrafted Italian Leather Cockpit',
        subtitle: 'Carbon Fiber Detailing & Dual Digital Display',
        imageUrl: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1600&q=80',
        duration: 4,
        transition: 'pan-right' as const,
      },
      {
        title: 'Unmatched Handling & Speed',
        subtitle: '0 to 100 km/h in 2.9 Seconds',
        imageUrl: 'https://images.unsplash.com/photo-1542282088-72c9c27ed0cd?auto=format&fit=crop&w=1600&q=80',
        duration: 4,
        transition: 'ken-burns-out' as const,
      },
    ],
  },
  {
    id: 'hotel-resort',
    name: 'Hotel & Resort: Tropical Sanctuary',
    description: 'Cinematic layout with warm acoustic guitar & smooth fade transitions',
    aspectRatio: '16:9',
    stylePreset: 'cinematic-glass',
    animationPreset: 'bar-reveal',
    musicPresetId: 'acoustic-guitar',
    slides: [
      {
        title: 'Private Oceanfront Villa',
        subtitle: 'Direct Lagoon Access & Floating Breakfast',
        imageUrl: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1600&q=80',
        duration: 4,
        transition: 'ken-burns-in' as const,
      },
      {
        title: 'Holistic Spa & Wellness Retreat',
        subtitle: 'Hydrotherapy Pools & Signature Massages',
        imageUrl: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1600&q=80',
        duration: 4,
        transition: 'pan-up' as const,
      },
    ],
  },
  {
    id: 'jewelry-luxury',
    name: 'Jewelry: Diamond Collection',
    description: 'Luxury gold typography with slow elegant zoom & minimalist grand piano',
    aspectRatio: '16:9',
    stylePreset: 'luxury-gold',
    animationPreset: 'slide-up',
    musicPresetId: 'piano-solo',
    slides: [
      {
        title: 'The Solitaire Diamond Ring',
        subtitle: 'Hand-Cut 3.5 Carat VVS1 Clarity',
        imageUrl: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=1600&q=80',
        duration: 4,
        transition: 'ken-burns-in' as const,
      },
      {
        title: '18K Rose Gold Heritage Necklace',
        subtitle: 'Timeless Elegance | Limited Edition',
        imageUrl: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=1600&q=80',
        duration: 4,
        transition: 'pan-right' as const,
      },
    ],
  },
  {
    id: 'restaurant-gourmet',
    name: 'Restaurant: Fine Dining Experience',
    description: 'Vibrant punchy captions with cozy cafe bossa background rhythm',
    aspectRatio: '9:16',
    stylePreset: 'vibrant-neon',
    animationPreset: 'zoom-pop',
    musicPresetId: 'cafe-music',
    slides: [
      {
        title: 'Artisanal Wagyu Steak',
        subtitle: 'Truffle Glaze & Roasted Seasonal Vegetables',
        imageUrl: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=1600&q=80',
        duration: 4,
        transition: 'ken-burns-out' as const,
      },
      {
        title: 'Handcrafted Mixology Cocktails',
        subtitle: 'Smoked Botanical Infusions & Fine Spirits',
        imageUrl: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=1600&q=80',
        duration: 4,
        transition: 'pan-up' as const,
      },
    ],
  },
];
