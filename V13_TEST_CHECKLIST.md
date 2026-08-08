# Heyy Studio V13 Test Checklist

## Foundation

- [ ] Homepage loads in light mode and dark mode.
- [ ] Theme preference persists after refresh.
- [ ] Header, footer, user menu, buttons, cards, fields and hover states are consistent on desktop, tablet and mobile.
- [ ] Hidden Studios and legacy tools do not appear in public or workspace navigation.
- [ ] US English and USD are used in the rebuilt experience.

## Authentication

- [ ] Email sign-up, confirmation and sign-in work.
- [ ] Google account selection works.
- [ ] `next` redirects return users to the requested protected route.
- [ ] Guests cannot enter Brand, Architecture, Interior, Marketing or any AI tool.
- [ ] User menu shows name, plan, credits, Dashboard, Account, Billing, Help and Sign out.

## Dashboard and account

- [ ] Dashboard loads Brand, Architecture, Interior and Marketing projects without failing if one table is empty.
- [ ] Saved AI Briefs no longer appears.
- [ ] Production, assets and notifications show correct user-owned records.
- [ ] Profile name updates.
- [ ] Billing page shows monthly, purchased, reserved and available credit balances.
- [ ] Credit history and notifications are user-scoped.

## Credits

- [ ] A paid generation reserves credits before provider work.
- [ ] Successful work commits the reservation once.
- [ ] Failed work releases the reservation automatically.
- [ ] Insufficient balance returns a clear 402 message.
- [ ] Duplicate status polling does not charge twice.
- [ ] Stripe top-up adds purchased credits once even if the webhook retries.

## Studios

- [ ] Brand Studio creates/opens projects and its existing production applications still work.
- [ ] Architecture Studio completes each current workflow and preserves concept-only disclaimers.
- [ ] Interior Studio validates required fields, saves a project, generates structured output and creates a production request.
- [ ] Marketing Studio validates required fields, saves a campaign, generates structured output and creates a production request.
- [ ] All generation buttons show credit cost and a loading state.

## AI tools

- [ ] Text to Image generates preview and high-quality outputs, saves an asset and updates balance.
- [ ] Image to Video starts a Gemini file job, polls PROCESSING → ACTIVE, commits credits and streams the MP4.
- [ ] AI Upscaler starts the configured Topaz workflow, polls status and streams the result.
- [ ] PowerPoint Generator downloads an editable `.pptx` with the requested slide count and structure.
- [ ] Provider failures create a failed generation job and refund the reservation.

## Expert production — regression test

- [ ] Existing Packaging request creates a Studio Request.
- [ ] Admin creates a quote with editable amount, delivery days and revisions.
- [ ] Client pays through the existing quote checkout.
- [ ] The single Stripe webhook records payment and creates exactly one Production Job.
- [ ] Client returns to the correct Studio/application.
- [ ] Messages, revision requests, deliverables and completion still work.
- [ ] Repeat the same flow for at least one Brand application and one Architecture service.

## Public/Admin

- [ ] Every footer link opens a real page.
- [ ] Contact submission appears in Admin Platform → Contact.
- [ ] Admin can create and publish a career position.
- [ ] Published position appears publicly; an application appears in Admin Platform → Applications.
- [ ] Admin can create/publish Help Center and public-page records.
- [ ] Admin Users shows plan and credits; Generations shows provider job status.
- [ ] `/admin/*` and `/api/admin/*` require Admin authentication.
