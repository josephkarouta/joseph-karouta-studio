HEYY STUDIO — FIX 48
Business Card AI Artwork Pipeline Repair

REPLACE:
app/api/brand-studio/application-visual/route.ts

WHAT WAS ACTUALLY WRONG
The OpenAI/Gemini image result was being generated and billed, but the business-card renderer then covered or ignored it:
- the front artwork was hidden by a full white SVG rectangle;
- the back artwork was not used at all;
- both providers therefore ended with the same deterministic Sharp/SVG card template.

WHAT THIS FIX CHANGES
- Generates a separate AI artwork for the front and the back.
- Makes both generated artworks visible in the final design.
- Uses a fresh variation identifier on every regeneration.
- Keeps the exact selected logo and exact user-entered contact details composited by Heyy Studio.
- Stores three outputs: mockup, flat front, and flat back.
- Removes the unrelated Heyy Studio slogan from client email signatures.

IMPORTANT
One business-card generation now makes two image-model calls: one for the front artwork and one for the back artwork.
No SQL is required.

VALIDATION
The revised TypeScript file passed a syntax transpilation check. A full project build was not run in this environment.
