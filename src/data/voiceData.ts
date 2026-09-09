export interface NarrationVoice {
  id: string;
  name: string;
  gender: 'male' | 'female';
  tone: string;
  description: string;
  pitch: number;
  rate: number;
  avatarBg: string;
}

export interface NarrationLanguage {
  code: string;
  name: string;
  flag: string;
  samplePhrase: string;
}

export const MALE_VOICES: NarrationVoice[] = [
  {
    id: 'male-david',
    name: 'David',
    gender: 'male',
    tone: 'Bright High Tenor',
    description: 'Crisp, energetic, high-pitched tenor voice with upbeat delivery.',
    pitch: 1.35,
    rate: 1.10,
    avatarBg: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  },
  {
    id: 'male-marcus',
    name: 'Marcus',
    gender: 'male',
    tone: 'Warm Mid Baritone',
    description: 'Friendly, warm, and conversational mid-range baritone tone.',
    pitch: 1.00,
    rate: 1.02,
    avatarBg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  },
  {
    id: 'male-james',
    name: 'James',
    gender: 'male',
    tone: 'Deep Executive Bass',
    description: 'Deep, rich bass-baritone with powerful executive presence.',
    pitch: 0.65,
    rate: 0.90,
    avatarBg: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  },
  {
    id: 'male-ethan',
    name: 'Ethan',
    gender: 'male',
    tone: 'Punchy Animated Host',
    description: 'Rapid-fire, punchy, energetic animated presenter cadence.',
    pitch: 0.92,
    rate: 1.28,
    avatarBg: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  },
];

export const FEMALE_VOICES: NarrationVoice[] = [
  {
    id: 'female-sophia',
    name: 'Sophia',
    gender: 'female',
    tone: 'Radiant High Soprano',
    description: 'Upbeat, high-pitched, and joyful — brings sparkling enthusiasm.',
    pitch: 1.55,
    rate: 1.15,
    avatarBg: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
  },
  {
    id: 'female-emma',
    name: 'Emma',
    gender: 'female',
    tone: 'Warm Cheerful Mezzo',
    description: 'Spirited, cheerful mid-range female voice with welcoming warmth.',
    pitch: 1.15,
    rate: 1.08,
    avatarBg: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  },
  {
    id: 'female-victoria',
    name: 'Victoria',
    gender: 'female',
    tone: 'Rich Alto Luxury Host',
    description: 'Deep, sophisticated alto tone with smooth, elegant rhythm.',
    pitch: 0.78,
    rate: 0.95,
    avatarBg: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  },
];

export const ALL_NARRATION_VOICES: NarrationVoice[] = [...MALE_VOICES, ...FEMALE_VOICES];

export const NARRATION_LANGUAGES: NarrationLanguage[] = [
  {
    code: 'en-US',
    name: 'English (United States)',
    flag: '🇺🇸',
    samplePhrase: 'Welcome to this breathtaking luxury estate featuring panoramic views and gourmet kitchen.',
  },
  {
    code: 'en-GB',
    name: 'English (United Kingdom)',
    flag: '🇬🇧',
    samplePhrase: 'Welcome to this magnificent residence offering elegance, spacious grounds, and exquisite design.',
  },
  {
    code: 'es-ES',
    name: 'Spanish (Español)',
    flag: '🇪🇸',
    samplePhrase: 'Bienvenido a esta espectacular propiedad de lujo con acabados de primera calidad.',
  },
  {
    code: 'fr-FR',
    name: 'French (Français)',
    flag: '🇫🇷',
    samplePhrase: 'Bienvenue dans cette magnifique propriété offrant de grands espacios et de somptueuses prestations.',
  },
  {
    code: 'de-DE',
    name: 'German (Deutsch)',
    flag: '🇩🇪',
    samplePhrase: 'Willkommen in dieser exklusiven Luxusimmobilie mit spektakulärer Aussicht.',
  },
  {
    code: 'it-IT',
    name: 'Italian (Italiano)',
    flag: '🇮🇹',
    samplePhrase: 'Benvenuti in questa splendida residenza di lusso con finiture di pregio e piscina.',
  },
  {
    code: 'pt-BR',
    name: 'Portuguese (Brasil)',
    flag: '🇧🇷',
    samplePhrase: 'Bem-vindo a esta incrível propriedade de luxo com vista panorâmica e design moderno.',
  },
  {
    code: 'zh-CN',
    name: 'Mandarin Chinese (中文)',
    flag: '🇨🇳',
    samplePhrase: '欢迎来到这座奢华住宅，精装海景与高端配置尽显尊贵。',
  },
  {
    code: 'ja-JP',
    name: 'Japanese (日本語)',
    flag: '🇯🇵',
    samplePhrase: 'パノラマビューと最高級の設備を備えた、素晴らしいラグジュアリー邸宅へようこそ。',
  },
  {
    code: 'ko-KR',
    name: 'Korean (한국어)',
    flag: '🇰🇷',
    samplePhrase: '최고급 인테리어와 파노라마 뷰를 자랑하는 프리미엄 럭셔리 주택에 오신 것을 환영합니다.',
  },
  {
    code: 'nl-NL',
    name: 'Dutch (Nederlands)',
    flag: '🇳🇱',
    samplePhrase: 'Welkom in deze prachtige luxe villa met adembenemend uitzicht en moderne afwerking.',
  },
  {
    code: 'ar-SA',
    name: 'Arabic (العربية)',
    flag: '🇸🇦',
    samplePhrase: 'أهلاً بكم في هذا القصر الفاخر الذي يتميز بإطلالات ساحرة وتصميم عصري فريد.',
  },
];
