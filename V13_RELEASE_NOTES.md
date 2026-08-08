# Heyy Studio V13 — Consolidated Release Notes

## Platform design

- One global light/dark design system with Apple-style glass surfaces, shared buttons, cards, fields, status pills, loading states, hover states and responsive spacing.
- New multi-color homepage with a shorter, clearer user journey.
- Rebuilt Site Header, user menu, Workspace Shell, Workspace Sidebar and Site Footer.
- US English and USD labels across the new platform experience.
- New 404 and global error experiences.

## Workspace and account

- Rebuilt dashboard focused on active work, production, assets, credits, notifications and next actions.
- Removed the obsolete Saved AI Briefs section.
- Added Account, Billing, Credit History and Notifications pages.
- Added Free, Starter and Pro testing configuration plus configurable credit top-ups.
- Guests are blocked from all visible Studio/tool workspaces and routed to sign in or sign up.

## Studios

- Preserved the working Brand Studio and Architecture Studio structures.
- Added complete guided Interior Design Studio and Marketing Studio workflows.
- New Studio outputs are saved to Supabase and can create shared production requests.
- Concept-only language remains visible for architecture/interior and other professional-risk outputs.

## AI tools

- Text to Image with GPT Image 2 and saved project assets.
- Image to Video with Gemini Omni Flash, asynchronous file status, secure download and credits.
- AI Upscaler with configurable Topaz async workflows.
- PowerPoint Generator with structured AI content and editable PptxGenJS output.

## Credits

- Transactional wallet, reservation, commit and refund functions.
- Monthly, purchased and reserved balances.
- Usage history, provider-generation jobs and low-balance visibility.
- Automatic release after a failed paid action.
- Idempotent Stripe top-up application.

## Heyy AI

- Replaced the old questionnaire concept with a platform router that starts with “What would you like to create today?”
- Routes to the four visible Studios, four tools, expert production, Help Center and pricing.
- Applies sign-in routing automatically for private workspaces.

## Public and Admin

- Added About, Careers, Contact, Help Center, Terms, Privacy, Refund, Responsible AI, Security and Content Policy pages.
- Added admin management for career positions/applications, public pages, help articles, contact submissions, users/credits and generation jobs.
- Added career applications as a dedicated workflow instead of using a generic contact message.

## Preserved systems

The release does not replace the working quote/payment/production architecture. The current quote checkout endpoint, single Stripe webhook and Production Job creation path remain the foundation.
