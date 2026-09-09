<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# ReelCraft Pro

Turn photos into AI-narrated marketing videos. Frontend and backend live in one
Vercel project — the React app (Vite) and the API (`/api/*.ts` serverless
functions) deploy together as a single service on a single domain.

## Run Locally

**Prerequisites:** Node.js, the [Vercel CLI](https://vercel.com/docs/cli) (`npm i -g vercel`), a Vercel account.

1. Install dependencies:
   `npm install`
2. Link this folder to a Vercel project (creates `.vercel/`, not committed):
   `vercel link`
3. Create a [Supabase](https://supabase.com) project, then run `supabase/schema.sql` once against it (Dashboard -> SQL Editor -> New query -> paste -> Run). This creates the `credit_accounts` table and the atomic credit functions.
4. Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (Project Settings -> API in the Supabase dashboard) — either directly in `.env.local`, or as Vercel project env vars pulled via `vercel env pull .env.local`.
5. Run the app — this serves the frontend *and* the API on the same local port, just like production:
   `npm run dev`

For the Stripe payment flow specifically, also run `stripe listen --forward-to localhost:3000/api/webhooks/stripe` in a second terminal and put the `whsec_...` it prints into `.env.local` as `STRIPE_WEBHOOK_SECRET`. See `.env.example` for details on every variable.

## Deploy

`vercel deploy` (or connect the GitHub repo in the Vercel dashboard for auto-deploys on push). Set the same environment variables in the project's Settings, and add a second Stripe webhook endpoint pointing at your deployed `https://<your-domain>/api/webhooks/stripe`.

