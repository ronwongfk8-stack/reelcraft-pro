// Narration languages. One list shared by the browser (the picker, the voice samples) and the server
// (what the AI writes in, what the voice speaks). Anything not in this list is ignored on the server.

export interface NarrationLanguage {
  code: string;
  /** shown in the picker */
  name: string;
  native: string;
  /** how the AI and the voice are told which language / script to use */
  ai: string;
  rtl?: boolean;
  /** short neutral line for the "Listen" voice samples */
  sample: string;
}

export const DEFAULT_LANGUAGE = 'en-US';

export const NARRATION_LANGUAGES: NarrationLanguage[] = [
  { code: 'en-US', name: 'English (US)', native: 'English', ai: 'English', sample: 'Welcome. Let us show you something special.' },
  { code: 'en-GB', name: 'English (UK)', native: 'English', ai: 'British English', sample: 'Welcome. Let us show you something special.' },
  { code: 'zh-CN', name: 'Chinese (Simplified)', native: '简体中文', ai: 'Simplified Chinese (Mandarin, simplified characters)', sample: '欢迎光临，让我们带您欣赏与众不同的精彩。' },
  { code: 'zh-TW', name: 'Chinese (Traditional)', native: '繁體中文', ai: 'Traditional Chinese (Mandarin, traditional characters)', sample: '歡迎光臨，讓我們帶您欣賞與眾不同的精彩。' },
  { code: 'ms-MY', name: 'Malay', native: 'Bahasa Melayu', ai: 'Malay (Bahasa Melayu)', sample: 'Selamat datang. Biar kami tunjukkan sesuatu yang istimewa.' },
  { code: 'id-ID', name: 'Indonesian', native: 'Bahasa Indonesia', ai: 'Indonesian (Bahasa Indonesia)', sample: 'Selamat datang. Izinkan kami menunjukkan sesuatu yang istimewa.' },
  { code: 'es-ES', name: 'Spanish', native: 'Español', ai: 'Spanish', sample: 'Bienvenido. Permítanos mostrarle algo especial.' },
  { code: 'fr-FR', name: 'French', native: 'Français', ai: 'French', sample: 'Bienvenue. Laissez-nous vous montrer quelque chose de spécial.' },
  { code: 'de-DE', name: 'German', native: 'Deutsch', ai: 'German', sample: 'Willkommen. Lassen Sie uns Ihnen etwas Besonderes zeigen.' },
  { code: 'it-IT', name: 'Italian', native: 'Italiano', ai: 'Italian', sample: 'Benvenuti. Lasciate che vi mostriamo qualcosa di speciale.' },
  { code: 'pt-BR', name: 'Portuguese (Brazil)', native: 'Português', ai: 'Brazilian Portuguese', sample: 'Bem-vindo. Deixe-nos mostrar algo especial para você.' },
  { code: 'nl-NL', name: 'Dutch', native: 'Nederlands', ai: 'Dutch', sample: 'Welkom. Laat ons u iets bijzonders laten zien.' },
  { code: 'ja-JP', name: 'Japanese', native: '日本語', ai: 'Japanese', sample: 'ようこそ。特別なものをご紹介します。' },
  { code: 'ko-KR', name: 'Korean', native: '한국어', ai: 'Korean', sample: '환영합니다. 특별한 것을 보여드리겠습니다.' },
  { code: 'ar-SA', name: 'Arabic', native: 'العربية', ai: 'Modern Standard Arabic', rtl: true, sample: 'أهلاً بكم. دعونا نُريكم شيئاً مميزاً.' },
  { code: 'hi-IN', name: 'Hindi', native: 'हिन्दी', ai: 'Hindi', sample: 'आपका स्वागत है। आइए, हम आपको कुछ खास दिखाते हैं।' },
  { code: 'ta-IN', name: 'Tamil', native: 'தமிழ்', ai: 'Tamil', sample: 'வரவேற்கிறோம். உங்களுக்கு ஒரு சிறப்பான விஷயத்தைக் காட்டுகிறோம்.' },
  { code: 'th-TH', name: 'Thai', native: 'ไทย', ai: 'Thai', sample: 'ยินดีต้อนรับ ให้เราแสดงสิ่งพิเศษให้คุณดู' },
  { code: 'vi-VN', name: 'Vietnamese', native: 'Tiếng Việt', ai: 'Vietnamese', sample: 'Chào mừng bạn. Hãy để chúng tôi cho bạn thấy điều đặc biệt.' },
  { code: 'ru-RU', name: 'Russian', native: 'Русский', ai: 'Russian', sample: 'Добро пожаловать. Позвольте показать вам нечто особенное.' },
  { code: 'tr-TR', name: 'Turkish', native: 'Türkçe', ai: 'Turkish', sample: 'Hoş geldiniz. Size özel bir şey göstermemize izin verin.' },
  { code: 'pl-PL', name: 'Polish', native: 'Polski', ai: 'Polish', sample: 'Witamy. Pozwól, że pokażemy Ci coś wyjątkowego.' },
];

/** Unknown / missing codes fall back to English, so nothing user-supplied is ever put into a prompt. */
export function getLanguage(code?: string | null): NarrationLanguage {
  return NARRATION_LANGUAGES.find((l) => l.code === code) || NARRATION_LANGUAGES[0];
}

export const isEnglish = (code?: string | null) => getLanguage(code).code.startsWith('en');
