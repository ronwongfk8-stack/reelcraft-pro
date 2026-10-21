export interface FormField {
  key: string;
  label: string;
  placeholder?: string;
  type?: 'text' | 'number' | 'select' | 'textarea';
  options?: string[];
  /** spans both columns */
  wide?: boolean;
  /** tucked away under "More details" */
  more?: boolean;
}

export interface IndustryForm {
  id: string;
  name: string;
  emoji: string;
  /** Short line used for the voice "Listen" samples */
  sample: string;
  fields: FormField[];
}

const COMMON_MORE: FormField[] = [
  { key: 'highlights', label: 'Highlights', placeholder: 'Anything else worth mentioning…', type: 'textarea', wide: true, more: true },
  { key: 'website', label: 'Website', placeholder: 'example.com', more: true },
  { key: 'contact', label: 'Contact', placeholder: 'Name or phone', more: true },
];

export const INDUSTRY_FORMS: IndustryForm[] = [
  {
    id: 'real-estate',
    name: 'Real Estate',
    emoji: '🏡',
    sample: 'Welcome home. Step inside and discover a space designed for modern living.',
    fields: [
      { key: 'title', label: 'Property name', placeholder: 'e.g. Skyline Residences', wide: true },
      { key: 'location', label: 'Location', placeholder: 'Area / city', wide: true },
      {
        key: 'propertyType',
        label: 'Type',
        type: 'select',
        options: ['Condo', 'Apartment', 'Terrace house', 'Semi-detached', 'Bungalow / Villa', 'Townhouse', 'Studio', 'Shop / Office', 'Land'],
      },
      { key: 'area', label: 'Built-up', placeholder: 'e.g. 1,350 sq ft' },
      { key: 'bedrooms', label: 'Bedrooms', type: 'number', placeholder: '3' },
      { key: 'bathrooms', label: 'Bathrooms', type: 'number', placeholder: '2' },
      { key: 'price', label: 'Price', placeholder: 'e.g. RM 850,000' },
      { key: 'completion', label: 'Completion / tenure', placeholder: 'e.g. Ready, freehold' },
      { key: 'furnishing', label: 'Furnishing', type: 'select', options: ['Fully furnished', 'Partly furnished', 'Unfurnished'] },
      ...COMMON_MORE,
    ],
  },
  {
    id: 'automobile',
    name: 'Automobile',
    emoji: '🚗',
    sample: 'Meet the all new model. Power, precision and style in every detail.',
    fields: [
      { key: 'title', label: 'Model', placeholder: 'e.g. Toyota Corolla Cross', wide: true },
      { key: 'location', label: 'Dealership', placeholder: 'Showroom / location', wide: true },
      { key: 'year', label: 'Year / edition', placeholder: '2026' },
      { key: 'price', label: 'Price / offer', placeholder: 'e.g. From $32,000' },
      { key: 'engine', label: 'Engine / power', placeholder: 'e.g. 2.0L, 170 hp' },
      { key: 'drive', label: 'Transmission', placeholder: 'e.g. Automatic, AWD' },
      { key: 'colour', label: 'Colour / trim', placeholder: 'e.g. Red, black roof' },
      { key: 'efficiency', label: 'Fuel / range', placeholder: 'e.g. 18 km/l' },
      ...COMMON_MORE,
    ],
  },
  {
    id: 'hotel',
    name: 'Hotel & Hospitality',
    emoji: '🏨',
    sample: 'Escape to a place where every moment is crafted for your comfort.',
    fields: [
      { key: 'title', label: 'Hotel / resort', placeholder: 'Name', wide: true },
      { key: 'location', label: 'Location', placeholder: 'City / destination', wide: true },
      { key: 'stars', label: 'Rating', type: 'select', options: ['5-star', '4-star', '3-star', 'Boutique', 'Resort', 'Villa'] },
      { key: 'roomType', label: 'Room type', placeholder: 'e.g. Ocean suite' },
      { key: 'price', label: 'Rate / night', placeholder: 'e.g. From $180' },
      { key: 'facilities', label: 'Facilities', placeholder: 'Pool, spa, dining…' },
      { key: 'offer', label: 'Offer / season', placeholder: 'e.g. Weekend deal' },
      ...COMMON_MORE,
    ],
  },
  {
    id: 'travel',
    name: 'Travel & Tourism',
    emoji: '✈️',
    sample: 'Your next adventure begins here. Let us show you the world.',
    fields: [
      { key: 'title', label: 'Tour title', placeholder: 'e.g. Swiss Alps Explorer', wide: true },
      { key: 'location', label: 'Destination', placeholder: 'Country / region', wide: true },
      { key: 'duration', label: 'Duration', placeholder: 'e.g. 7 days' },
      { key: 'price', label: 'Price', placeholder: 'e.g. $2,400 pp' },
      { key: 'inclusions', label: 'Included', placeholder: 'Flights, hotels, meals…' },
      { key: 'dates', label: 'Departures', placeholder: 'e.g. Mar – Sep' },
      { key: 'groupSize', label: 'Group size', placeholder: 'e.g. Max 12' },
      ...COMMON_MORE,
    ],
  },
  {
    id: 'jewelry',
    name: 'Jewelry & Luxury',
    emoji: '💎',
    sample: 'Timeless elegance, handcrafted to be treasured for a lifetime.',
    fields: [
      { key: 'title', label: 'Piece / collection', placeholder: 'e.g. Aurora Ring', wide: true },
      { key: 'location', label: 'Brand / boutique', placeholder: 'Name', wide: true },
      { key: 'material', label: 'Material', placeholder: 'e.g. 18K rose gold' },
      { key: 'stone', label: 'Stone', placeholder: 'e.g. 1.2 ct diamond' },
      { key: 'price', label: 'Price', placeholder: 'e.g. $4,800' },
      { key: 'edition', label: 'Edition / warranty', placeholder: 'e.g. Limited, certified' },
      ...COMMON_MORE,
    ],
  },
  {
    id: 'restaurant',
    name: 'Restaurant & Dining',
    emoji: '🍽️',
    sample: 'Fresh ingredients, bold flavours, and a table waiting just for you.',
    fields: [
      { key: 'title', label: 'Restaurant / dish', placeholder: 'Name', wide: true },
      { key: 'location', label: 'Location', placeholder: 'Address / area', wide: true },
      { key: 'cuisine', label: 'Cuisine', placeholder: 'e.g. Japanese, Italian' },
      { key: 'signature', label: 'Signature dishes', placeholder: 'Top picks' },
      { key: 'price', label: 'Price range', placeholder: 'e.g. $20 – $60' },
      { key: 'hours', label: 'Opening hours', placeholder: 'e.g. 11am – 10pm' },
      { key: 'reservations', label: 'Reservations', placeholder: 'e.g. Book online' },
      ...COMMON_MORE,
    ],
  },
  {
    id: 'retail',
    name: 'General Retail',
    emoji: '🛍️',
    sample: 'Designed to make everyday life better. See what makes it special.',
    fields: [
      { key: 'title', label: 'Product', placeholder: 'Name', wide: true },
      { key: 'location', label: 'Brand / store', placeholder: 'Name or website', wide: true },
      { key: 'price', label: 'Price / offer', placeholder: 'e.g. $59, 20% off' },
      { key: 'features', label: 'Key features', placeholder: 'Top 2–3 features' },
      { key: 'availability', label: 'Availability', placeholder: 'e.g. In stock' },
      { key: 'warranty', label: 'Warranty', placeholder: 'e.g. 2 years' },
      ...COMMON_MORE,
    ],
  },
  {
    id: 'other',
    name: 'Other',
    emoji: '✨',
    sample: 'Here is something we are proud of. Take a closer look.',
    fields: [
      { key: 'title', label: 'Name', placeholder: 'Product / business', wide: true },
      { key: 'category', label: 'Category', placeholder: 'What is it?' },
      { key: 'location', label: 'Location / brand', placeholder: 'Where / who' },
      { key: 'price', label: 'Price / offer', placeholder: 'Optional' },
      { key: 'keyPoints', label: 'Key points', placeholder: 'What should viewers know?', type: 'textarea', wide: true },
      ...COMMON_MORE.filter((f) => f.key !== 'highlights'),
    ],
  },
];

export const DEFAULT_INDUSTRY = 'Real Estate';

/** Landing-page template -> industry */
export const PRESET_INDUSTRY: Record<string, string> = {
  'luxury-mansion': 'Real Estate',
  'automobile-showcase': 'Automobile',
  'hotel-resort': 'Hotel & Hospitality',
  'jewelry-luxury': 'Jewelry & Luxury',
  'restaurant-gourmet': 'Restaurant & Dining',
};

export const getIndustryForm = (name: string): IndustryForm =>
  INDUSTRY_FORMS.find((f) => f.name === name) || INDUSTRY_FORMS[0];

/** Filled-in fields as [label, value] pairs for the AI prompt. */
export function factsToPairs(industryName: string, facts: Record<string, string>): { label: string; value: string }[] {
  const form = getIndustryForm(industryName);
  return form.fields
    .map((f) => ({ label: f.label, value: (facts[f.key] || '').trim() }))
    .filter((p) => p.value.length > 0);
}
