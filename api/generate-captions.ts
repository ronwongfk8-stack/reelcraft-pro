import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Type } from '@google/genai';
import { getGeminiClient, CANDIDATE_MODELS } from '../lib/gemini.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { propertyType, features, imageCount, targetStyle } = req.body || {};
  const defaultCaptions = [
    `Welcome to ${propertyType || 'This Exquisite Residence'}`,
    'Spacious Living with Abundant Natural Light',
    'Gourmet Kitchen Featuring Chef-Grade Finishes',
    'Serene Master Suite & Spa-Style Bath',
    'Outdoor Entertainment Area & Beautiful Views',
    'Schedule Your Private Showing Today',
  ];

  try {
    const ai = getGeminiClient();
    if (!ai) {
      return res.status(200).json({ captions: defaultCaptions.slice(0, imageCount || 5) });
    }

    const prompt = `You are a top-tier marketing video copywriter. Create ${imageCount || 5} short, compelling, high-converting video captions/subtitles for a promotional product or property showcase video.
Industry / Category: ${propertyType || 'General Product / Luxury Marketing'}
Key Features & Details: ${features || 'Modern design, premium finishes, stunning quality, executive appeal'}
Target Style: ${targetStyle || 'High-end & Elegant'}

Requirements:
- Output exactly ${imageCount || 5} captions in order corresponding to video slides (1 per image).
- Each caption should be punchy, impactful, 4 to 10 words long.
- Tailor tone directly to the specified industry (e.g. speed/craftsmanship for Automobile, hospitality/luxury for Hotel/Travel, sparkle/elegance for Jewelry, taste/craft for Restaurant, architectural design for Real Estate).`;

    let responseText = '';
    for (const modelName of CANDIDATE_MODELS) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Array of short video marketing captions for each image slide',
            },
          },
        });
        if (response.text) {
          responseText = response.text;
          break;
        }
      } catch (modelErr: any) {
        const errMsg = modelErr?.message || String(modelErr);
        console.info(`Model ${modelName} unavailable (${errMsg.slice(0, 80)}), trying fallback...`);
      }
    }

    let captions: string[] = [];
    if (responseText) {
      try {
        captions = JSON.parse(responseText.trim());
      } catch {
        captions = responseText.split('\n').filter(Boolean);
      }
    }

    if (!Array.isArray(captions) || captions.length === 0) {
      captions = defaultCaptions;
    }

    res.status(200).json({ captions: captions.slice(0, imageCount || 5) });
  } catch (err: any) {
    console.error('Error generating captions, serving fallback:', err);
    res.status(200).json({ captions: defaultCaptions.slice(0, imageCount || 5) });
  }
}
