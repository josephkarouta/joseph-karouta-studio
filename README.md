# Heyy Studio V13 Final Rebuild

Heyy Studio is a connected creative operating system: **Create with AI. Build with Experts.**

This consolidated V13 package keeps the proven Brand/Architecture quote, Stripe webhook, payment and production chain, then adds the shared platform around it: a global design system, light/dark modes, four visible Studios, four AI tools, credits, account pages, public pages, content/careers administration and the intelligent Heyy AI router.

## First local run

1. Copy `.env.example` to `.env.local` and fill the required keys.
2. Run `npm ci`.
3. Apply `supabase/migrations/20260727_heyy_v13_final_rebuild.sql` in the Supabase SQL Editor.
4. Run `npm run dev`.
5. Open `http://localhost:3000`.

Do not put `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, provider keys or Admin credentials in client code.

## Important deployment order

1. Back up the Supabase database.
2. Apply the V13 migration once.
3. Configure OpenAI, Gemini, Topaz, Stripe and Resend environment variables.
4. Create USD Stripe recurring prices and add their IDs.
5. Start the Stripe webhook against `/api/stripe-webhook`.
6. Deploy and complete the test checklist in `V13_TEST_CHECKLIST.md`.

## Architecture rules preserved

- Supabase remains the source of truth.
- The existing quote checkout and single Stripe webhook remain in place.
- Quote payments, subscriptions and credit top-ups branch by Stripe metadata.
- Production Jobs are created only through the proven paid-production flow.
- New Studios use shared project, asset, credit and production-request contracts.
- Hidden legacy Studios remain in code but do not appear in visible navigation.

## Provider choices

- Text to Image: OpenAI GPT Image 2.
- Image to Video: Google Gemini Omni Flash through the Interactions API.
- AI Upscaler: Topaz Developer API, with endpoints/models configurable because Topaz accounts can expose different workflows.
- PowerPoint: AI-structured content plus native editable `.pptx` generation through PptxGenJS.

See `V13_RELEASE_NOTES.md`, `V13_SETUP_GUIDE.md`, `V13_TEST_CHECKLIST.md` and `V13_VALIDATION_REPORT.md`.
