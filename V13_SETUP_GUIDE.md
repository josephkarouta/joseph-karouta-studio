# Heyy Studio V13 Setup Guide

## 1. Prepare the project

```bash
cp .env.example .env.local
npm ci
```

Fill all keys required for the workflows you intend to test. The site can render without every AI provider, but each provider route returns a clear configuration error until its key is present.

## 2. Supabase

Run this file once in the Supabase SQL Editor:

`supabase/migrations/20260727_heyy_v13_final_rebuild.sql`

It adds credits, Interior/Marketing projects, assets, notifications, generation monitoring, editable public content, careers, Help Center and contact records. It deliberately does not restructure the existing quote, payment or production tables.

Confirm these Storage buckets exist after the migration:

- `project-assets`
- Existing Brand/Architecture/production buckets already used by the project

## 3. Stripe

Create two recurring USD prices for Starter and Pro, then set:

- `STRIPE_STARTER_PRICE_ID_USD`
- `STRIPE_PRO_PRICE_ID_USD`

Credit packs use dynamic USD `price_data`; no additional Stripe Price IDs are required.

Use the existing single webhook:

```bash
stripe listen --forward-to localhost:3000/api/stripe-webhook
```

Copy the active listener secret into `STRIPE_WEBHOOK_SECRET`. The same webhook handles quote payments, subscriptions and credit top-ups by metadata. Do not create a second webhook route.

## 4. AI providers

### OpenAI

Set `OPENAI_API_KEY`. Image generation defaults to `gpt-image-2`. Text generation defaults to `gpt-4.1-mini`; leave the workflow override variables blank to use the same economical model across every plan and Studio.

### Google Gemini

Set `GEMINI_API_KEY`. Image-to-video defaults to `gemini-omni-flash-preview` and uses URI delivery so long processing does not block the request.

### Topaz

Set `TOPAZ_API_KEY`. Confirm the endpoints and model names available to your Topaz Developer account, then adjust `TOPAZ_IMAGE_ENDPOINT`, `TOPAZ_STATUS_ENDPOINT_TEMPLATE` and model variables as necessary.

## 5. Admin

Set a strong `ADMIN_USERNAME` and `ADMIN_PASSWORD`. Basic Auth protects both `/admin/*` and `/api/admin/*`. Before a public launch, replace development Basic Auth with Supabase role-based admin authorization.

## 6. Pricing and credits

All testing plan values and top-up values are centralized in environment variables. Change them only after provider cost testing. Credit cost per action is centralized in `lib/credits/config.ts`.

## 7. Production deployment

- Add all environment variables to Netlify.
- Set the production `NEXT_PUBLIC_SITE_URL`.
- Confirm the production Stripe webhook endpoint and secret.
- Confirm Supabase OAuth redirect URLs for `/dashboard` and protected routes.
- Run `npm run build` locally before deploying.
