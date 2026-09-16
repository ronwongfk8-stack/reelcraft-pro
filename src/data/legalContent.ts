export const LAST_UPDATED = 'September 2026';

export const TERMS_OF_SERVICE = `
Last updated: ${LAST_UPDATED}

These Terms of Service ("Terms") govern your use of ReelCraft PRO (the "Service"), operated at reelcraftpro.com. By using the Service, you agree to these Terms.

1. What ReelCraft PRO Does
ReelCraft PRO lets you turn your own photos into marketing videos, using AI-generated captions and scripts, AI-generated voiceover narration, and background music. You upload photos, arrange and style them, and export a finished video.

2. Free Trial and Credits
Each new device receives one free video export, with no signup or login required. Additional exports are purchased as credits (currently 30 credits for $30), which do not expire. One credit is spent each time you export a video. Credits are tied to the device and/or email address used to purchase them.

3. Payments
All payments are processed by Stripe. We never see, receive, or store your card details — Stripe handles this directly on their own secure checkout page. Purchases are generally final; if you believe you were charged in error, contact us using the details in the Help section and we'll look into it.

4. Your Content
You retain all rights to the photos you upload and the videos you create. We do not claim any ownership over your content. You're responsible for making sure you have the rights to any photos you upload and that your use of the Service complies with applicable law.

5. AI-Generated Content
Captions, scripts, and voiceover narration are generated using third-party AI services (including Google's Gemini and Cloud Text-to-Speech). AI-generated content may occasionally be inaccurate or require editing — review it before publishing your video.

6. Acceptable Use
You agree not to use the Service to create content that is illegal, infringes on others' rights, or is intended to deceive or defraud. We reserve the right to suspend access for accounts that abuse the Service, including attempts to circumvent the credit system.

7. Service Availability
We aim to keep the Service available and reliable, but we don't guarantee uninterrupted access. Features, pricing, and availability may change over time.

8. Limitation of Liability
The Service is provided "as is." To the extent permitted by law, we are not liable for indirect, incidental, or consequential damages arising from your use of the Service.

9. Changes to These Terms
We may update these Terms from time to time. Continued use of the Service after changes take effect constitutes acceptance of the updated Terms.

10. Contact
Questions about these Terms? Reach out using the details in the Help section of the app.
`;

export const PRIVACY_POLICY = `
Last updated: ${LAST_UPDATED}

This Privacy Policy explains what information ReelCraft PRO ("we", "us") collects and how it's used.

1. Your Photos Stay on Your Device
Your uploaded photos are processed entirely in your browser and are never uploaded to our servers. When you export a video, it's rendered directly on your device and downloaded straight to your computer — at no point do your photos or finished videos pass through our infrastructure.

2. What We Do Collect
- A randomly generated device identifier, stored in your browser, used to track your free trial and credit balance.
- If you make a purchase or restore credits, the email address you provide, so we can link your paid credits to your account.
- Basic payment records (via Stripe) — we receive confirmation that a payment succeeded, but never your card number or billing details directly.
- Text you type into caption, script, or property-detail fields, which may be sent to AI providers (see below) to generate content.

3. Third-Party Services We Use
- Stripe — payment processing. Stripe's own privacy policy governs how they handle your payment information.
- Supabase — stores your credit balance and account email in a secure database.
- Google (Gemini API and Cloud Text-to-Speech) — generates AI captions, scripts, and voiceover audio from text you provide. Only text is sent — never your photos.
- Vercel — hosts the application and its backend functions.

4. Local Storage
We use your browser's local storage and IndexedDB to remember your device ID, your current project (photos, captions, styling), and your credit balance across sessions, so your work isn't lost if you close the tab or reload the page. This data stays on your device and isn't transmitted to us except where described above.

5. Data Retention
Your account record (email, device ID, credit balance) is retained as long as your account is active. You can request deletion of your data at any time by contacting us.

6. Your Rights
You can request a copy of the data we hold about you, or request that it be deleted, by reaching out using the details in the Help section.

7. Children's Privacy
The Service is not directed at children under 13, and we do not knowingly collect information from children under 13.

8. Changes to This Policy
We may update this Privacy Policy from time to time. Material changes will be reflected by updating the "Last updated" date above.

9. Contact
Questions about this Privacy Policy? Reach out using the details in the Help section of the app.
`;
