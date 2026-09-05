import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getGeminiClient, CANDIDATE_MODELS } from '../lib/gemini.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    industry,
    title,
    location,
    area,
    price,
    completionDate,
    furnishing,
    propertyType,
    website,
    contact,
    otherInfo,
  } = req.body || {};

  const indName = industry || 'Marketing Video';

  const fallbackScript = `Welcome to ${title || 'our premier showcase'}${location ? ` in ${location}` : ''}. ${
    propertyType || 'This offering'
  } features ${area || 'exceptional quality'}, ${furnishing || 'exquisite design'}${
    price ? `, priced at ${price}` : ''
  }${completionDate ? ` with availability in ${completionDate}` : ''}.${
    otherInfo ? ` Key highlights include ${otherInfo}.` : ''
  }${website ? ` Visit ${website} for details.` : ''}${
    contact ? ` Contact ${contact} today for inquiries!` : ' Contact us today for an exclusive preview!'
  }`;

  try {
    const ai = getGeminiClient();
    if (!ai) {
      return res.status(200).json({ script: fallbackScript });
    }

    const prompt = `Write a compelling, natural, professional 30-45 second video voiceover script for an commercial/promotional video in the ${indName} industry based on these exact details:
- Industry / Category: ${indName}
- Title / Product Name: ${title || 'Featured Showcase'}
- Type / Category: ${propertyType || 'Premium Product / Service'}
- Location / Brand / Address: ${location || 'Prime Location'}
- Size / Specifications / Menu / Area: ${area || 'Premium Features'}
- Price / Offer / Asking: ${price || 'Competitive Pricing'}
- Availability / Launch / Tenure: ${completionDate || 'Now Available'}
- Style / Finish / Features: ${furnishing || 'Elegantly Crafted'}
- Website / Link: ${website || 'Not provided'}
- Contact / Representative: ${contact || 'Not provided'}
- Special Highlights & Key Points: ${otherInfo || 'Unmatched quality, exceptional craftsmanship, premium experience'}

Script Guidelines:
- Tone: Enthusiastic, polished, high-converting voiceover narrator appropriate for ${indName} marketing.
- Length: Approximately 60 to 90 words.
- Smooth natural narration without bullet points, brackets, or slide markers.
- If website or contact info is provided, naturally weave it into the closing call-to-action!`;

    let scriptText = '';
    for (const modelName of CANDIDATE_MODELS) {
      try {
        const response = await ai.models.generateContent({ model: modelName, contents: prompt });
        if (response.text) {
          scriptText = response.text;
          break;
        }
      } catch (modelErr: any) {
        const errMsg = modelErr?.message || String(modelErr);
        console.info(`Model ${modelName} unavailable for script (${errMsg.slice(0, 80)}), trying fallback...`);
      }
    }

    res.status(200).json({ script: scriptText || fallbackScript });
  } catch (err: any) {
    console.error('Error generating script, serving fallback:', err);
    res.status(200).json({ script: fallbackScript });
  }
}
