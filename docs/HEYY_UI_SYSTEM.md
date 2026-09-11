# Heyy Studio UI & Experience System v1

Status: Foundation for the pre-launch look-and-feel phase.

## 1. Product design principle

Heyy Studio should feel like one product across the public site, Workspace, Studios, Admin, Client production and Expert Portal. Surfaces can have different density and Studio accents, but they must share the same typography, spacing, controls, states, motion, feedback and responsive behaviour.

The system is responsive by default. Desktop and mobile are designed together as each surface is migrated. The later mobile/accessibility/performance phase becomes a final hardening and regression pass, not the first time mobile is considered.

## 2. Visual language

- Clean, light, premium and creative rather than dense or enterprise-heavy.
- Soft depth, restrained glass, subtle gradients and generous whitespace.
- Use Heyy purple as the platform accent; Studio colours may tint local states and artwork.
- Avoid multiple competing accents on the same screen.
- Use imagery to carry emotion; UI chrome should stay calm.
- Rounded surfaces are part of the brand, but do not turn every line of text into a card.

## 3. Typography hierarchy

Use a small fixed hierarchy instead of inventing a new headline per page.

- Display: public hero only.
- Page title: primary title for a screen.
- Section title: major section within a page.
- Card title: card or panel heading.
- Eyebrow: short uppercase context label.
- Body: normal explanatory copy.
- Helper/caption: secondary state, metadata or instruction.

Copy rules:

- Prefer heading + one short supporting sentence + action.
- Remove repeated explanations and duplicated summaries.
- One paragraph should normally be no more than 2–3 short lines on desktop.
- Use status chips, labels, icons and progressive disclosure instead of repeating state in prose.
- Keep safety/product-boundary messages prominent when they materially affect user expectations.

## 4. Spacing and layout

- Use one consistent page container and one consistent section rhythm.
- Prefer 8 px-based spacing increments.
- Major public sections should breathe; operational screens can be denser.
- Avoid arbitrary one-off margins when a shared spacing token or component can express the same relationship.
- Mobile spacing should become tighter, not simply scale desktop down.

## 5. Buttons and controls

Four button variants only:

- Primary: one dominant next action.
- Secondary: important alternative.
- Ghost: low-priority utility/navigation.
- Danger: destructive action.

Rules:

- Do not place several same-weight primary actions together.
- Minimum touch target: 44 px.
- Buttons stay physically still on hover. Use color, border, shadow and icon changes for feedback; do not translate the button up/down.
- Hover is enhancement only; the interface must remain understandable on touch devices.
- Selected, loading, disabled and destructive states must be visually distinct.
- Icon-only controls require an accessible name and tooltip when meaning is not universally obvious.

## 6. Cards and surfaces

Use three main surface roles:

- Base surface: page/background grouping.
- Card: normal information or action group.
- Elevated/interactive card: clickable or temporarily important content.

Interactive cards stay in place. Pointer hover may strengthen border/shadow and subtly zoom contained artwork, but the card itself should not jump vertically. Static information cards should not animate like buttons.

## 7. Motion

Motion should make Heyy feel responsive, not busy.

- Fast: ~140–160 ms for press, icon, hover and small colour changes.
- Standard: ~200–240 ms for controls, tabs and small panels.
- Emphasized: ~320–420 ms for dialogs, drawers and major section transitions.
- Prefer opacity, color, shadow and subtle icon/image changes. Avoid translating primary controls such as buttons.
- Small translation/scale can still be used selectively for imagery or cards where it adds meaning.
- Avoid large bouncing, spinning or decorative movement in operational screens.
- Respect `prefers-reduced-motion` everywhere.

## 8. Feedback and messages

Do not use native browser `alert()` or `confirm()` in the final system.

- Success: non-blocking Heyy toast.
- Recoverable error: inline error near the affected control, optionally reinforced with a toast.
- Destructive action: Heyy confirmation dialog.
- Blocking failure: clear error panel in the affected workflow.
- Loading: button-level loading for small actions; skeleton/progress state for content or generation.
- Empty state: explain what is empty and provide one clear next action where relevant.

## 9. Selection and navigation

- Tabs, segmented controls and selected cards use one shared selected-state pattern.
- The selected state must not rely on colour alone.
- Page refresh should return users to the same meaningful workflow state wherever practical.
- Scrolling carousels on mobile must use snap behaviour, visible partial next items or another clear affordance that more content exists.

## 10. Light and dark mode

- Use semantic tokens rather than hard-coded white/black surfaces.
- Preserve hierarchy in both themes: background < surface < elevated/interactive.
- Studio accent colours may adjust for contrast in dark mode.
- Decorative artwork can remain bright, but surrounding UI must frame it so it does not feel glaring.
- Every new component must be reviewed in both modes before rollout.

## 11. Responsive rules

Responsive design is part of the component, not a later patch.

- Mobile: one dominant column; compact spacing; 44 px controls; bottom-safe interactions; swipe only when it improves browsing.
- Tablet: 2-column opportunities where content remains readable.
- Desktop: use width for hierarchy and scanability, not simply more text.
- Dense Admin tables may become stacked rows/cards or horizontally scroll only when the table relationship must be preserved.
- Hover-only information is not allowed.
- Important actions should remain visible without precision pointer input.

## 12. Homepage visual direction

The new AI Tool artwork establishes a useful part of the Heyy visual language: soft 3D UI objects, pastel Studio/tool-specific colour fields, white/glass surfaces, rounded depth and clear single-purpose storytelling.

Use that language for marketing artwork and thumbnails. Do not make core application controls as decorative as the artwork; product UI should remain simpler so the creative output stays the focus.

Homepage tool cards:

- Use the supplied artwork as the primary thumbnail.
- Keep the actual tool name and credit information as live HTML below the image for accessibility and clarity.
- Desktop: visual card grid rather than seven tiny icon tiles.
- Mobile/tablet: horizontal snap cards so artwork remains legible instead of shrinking into unreadable thumbnails.
- Hover: card stays fixed; use border/shadow emphasis and a restrained image zoom only.

## 13. Content-density rule

For each migrated page, review copy at the same time as styling.

Remove or shorten text when it:

- repeats a heading,
- repeats state already visible elsewhere,
- explains an obvious control,
- duplicates another card,
- contains implementation detail the user does not need.

Keep text when it:

- changes the user's decision,
- prevents a costly or destructive mistake,
- explains a non-obvious workflow,
- communicates legal/safety/product limitations,
- sets an important expectation.

## 14. Rollout order

1. Foundation tokens/components/behaviour rules.
2. Homepage as public-site pilot, including the new Tool thumbnails.
3. One Studio workspace pilot.
4. Admin operational pilot.
5. Apply the proven system across the remaining public/Workspace/Studio/Admin/Client/Expert surfaces.
6. Site-wide responsive, light/dark, content-density and interaction consistency audit.
7. Final mobile/accessibility/performance hardening and regression.

## 15. Rollout method: page review + system promotion

Heyy Studio will be reviewed page by page, starting with the Homepage and continuing through Projects, Studios, Tools, Client/Expert production and Admin.

The page review does not replace the design system. It feeds it:

1. Review the real page in desktop, tablet/mobile, light and dark mode.
2. Fix page-specific hierarchy, density, copy and usability.
3. When a pattern is approved, promote it into a shared token/component/rule instead of copying one-off CSS.
4. Reuse that approved pattern on later pages.
5. Finish with a source-wide consistency audit for legacy buttons, headings, cards, states and browser-native feedback.

Admin is allowed to be denser than the public site, but must use the same Heyy typography, controls, status language, feedback, motion and spacing logic. Admin requires a dedicated operational redesign rather than a cosmetic skin.


## 16. Homepage review decisions — 11 September 2026

The first real homepage review established these approved rules:

- Do not animate entire sections into view while scrolling. Homepage content should already be present; avoid reveal-on-scroll and decorative scroll parallax.
- Studio thumbnails do not need additional floating corner icons when the artwork already communicates the Studio.
- Do not add redundant navigation CTAs such as “Explore all tools” when every launch tool is already visible in the section.
- The How It Works steps should not be joined by a decorative horizontal line.
- Featured pricing must be unmistakable, but without making every plan card oversized. Use one clear Most Popular treatment and keep Current Plan as a secondary status.
- Mobile pricing must be substantially denser than desktop: reduce fixed card heights, compact account context and make top-up packs short transactional rows/cards.
- Mobile footer navigation uses a compact 2-column structure rather than four long stacked link groups.
- The primary mobile menu CTA may use the Heyy accent; account/plan context should use a quieter neutral/accent surface so two large purple blocks do not compete.
- Same-page mobile navigation must close the menu immediately after selecting Studios, Tools, How It Works or Pricing.
- Popovers/dropdowns must remain fully inside the mobile viewport. Header notification panels should use viewport-safe positioning on small screens.
- Desktop header/footer can retain their overall structure, but interaction and density should be refined toward a restrained, premium product style.


## 17. Homepage review decisions — Patch 1.3

- The four launch Studios are a primary product category and must read more prominently than utility tools. Their card content panels use the Studio accent color with white copy.
- Studio cards use one compact arrow action only; do not repeat “Open Studio” as visible CTA text when the entire card is already clickable.
- Tool cards remain lighter and more neutral so they do not compete with the four core Studios.
- Homepage sections may use restrained tonal background changes to create chapter-like rhythm. Avoid random unrelated colors; backgrounds should remain within the Heyy neutral/accent family.
- How It Works should feel contained and grounded. Use one coherent panel and individual step surfaces rather than visually floating icons and numbers.
- Homepage credit top-ups are secondary to subscriptions. Do not show every pack on the homepage. Use one compact Buy Credits row linking to the dedicated Credits page.
- Do not repeat “Prices are in US dollars” inside the Buy Credits row. Keep currency context once near pricing/credit-cost navigation and in the footer.


## Homepage review decisions — Patch 1.4

- **Studio cards:** Do not use flat solid accent blocks. Studio identity should use a dark premium tonal surface with the Studio accent as a controlled glow/highlight. White copy remains readable; the accent supports hierarchy rather than filling the whole surface.
- **Mobile process sections:** Multi-step explanations must collapse into compact scan-friendly rows on small screens. Do not stack oversized desktop cards vertically when a concise mobile list communicates the same journey.
- **Credit pricing containment:** Price/currency notes, cost-guide actions and pack information must visually belong to the credit/purchase container they describe. Avoid detached helper rows that look unrelated to the transaction panel.
- **Alignment and spacing:** Related content shares one container edge, one spacing rhythm and one visual group. Nested cards should not create accidental gaps or floating orphan labels.

## Homepage review decisions — Patch 1.5
- Homepage sections share one alignment grid; hero, Studios, Tools and How It Works use a 1320px content frame, with pricing intentionally centered inside a slightly narrower 1240px frame.
- Studio cards are one continuous shell: image on top, content below. The source thumbnails contain rounded corners, so homepage rendering crops/zooms them inside the shell so the image/content join reads square and seamless. Only the card's outside corners should be rounded.
- Studio colour is an accent light/glow, never a flat full-colour slab. All four Studio footers use the same dark premium material treatment.
- Equal-height card grids must use flex structure so shorter copy cannot expose the parent surface underneath.
- On small screens, pricing plans may use a horizontal snap rail to keep the homepage compact; desktop remains a three-column comparison.
- Header account dropdown may use a strong branded purple identity panel, but navigation rows below stay neutral and functional.
- Section changes should create rhythm through subtle surface and light shifts, not hard decorative stripes or unrelated background colours.
