# Heyy Studio — Architecture & Interior image-provider test

This patch keeps Brand, Marketing and normal image workflows on the shared `OPENAI_IMAGE_MODEL` baseline, while Architecture and Interior can be switched independently between OpenAI, Gemini and Grok.

## Environment variables

```env
# Global default (Brand, Marketing, tools, other shared OpenAI image workflows)
OPENAI_IMAGE_MODEL=gpt-image-2.5-sunburst
OPENAI_PREVIEW_IMAGE_QUALITY=medium
OPENAI_FINAL_IMAGE_QUALITY=high

# Architecture
ARCHITECTURE_IMAGE_PROVIDER=openai
ARCHITECTURE_IMAGE_MODEL=gpt-image-2.5-sunburst
ARCHITECTURE_GEMINI_IMAGE_MODEL=gemini-3-pro-image
ARCHITECTURE_GEMINI_IMAGE_SIZE=2K
ARCHITECTURE_GROK_IMAGE_MODEL=grok-imagine-image-2.0
ARCHITECTURE_GROK_IMAGE_QUALITY=medium

# Interior
INTERIOR_IMAGE_PROVIDER=openai
INTERIOR_IMAGE_MODEL=gpt-image-2.5-sunburst
INTERIOR_GEMINI_IMAGE_MODEL=gemini-3-pro-image
INTERIOR_GEMINI_IMAGE_SIZE=2K
INTERIOR_GROK_IMAGE_MODEL=grok-imagine-image-2.0
INTERIOR_GROK_IMAGE_QUALITY=medium

# Shared provider credentials
GEMINI_API_KEY=
GEMINI_IMAGE_MODEL=gemini-3-pro-image
GEMINI_IMAGE_SIZE=2K
XAI_API_KEY=
```

`ARCHITECTURE_GEMINI_IMAGE_SIZE` and `INTERIOR_GEMINI_IMAGE_SIZE` are optional. If omitted, `GEMINI_IMAGE_SIZE` is used, then `2K`.

## Fair first-round test

Keep the exact same saved project, selected Direction, plan/context, materials, prompts and output target. Only change the provider variable and restart the local server.

Architecture:

```env
ARCHITECTURE_IMAGE_PROVIDER=openai
```

then:

```env
ARCHITECTURE_IMAGE_PROVIDER=gemini
```

then:

```env
ARCHITECTURE_IMAGE_PROVIDER=grok
```

Interior uses the same pattern with `INTERIOR_IMAGE_PROVIDER`.

The patch records the actual provider, model, reference count, method and provider usage/cost metadata where returned. This makes later comparison possible without guessing which provider produced an asset.

## Provider behavior in this patch

- OpenAI: existing Images API generation/edit behavior, up to 6 references.
- Gemini: same Heyy prompt/context, inline multi-reference generation, up to 14 references, output ratio matched to Heyy's requested canvas.
- Grok: same Heyy prompt/context, up to 5 image references, 2K output and configured low/medium/auto quality.

This is intentionally Round 1: the Heyy workflow/prompt structure stays the same so the provider itself is the main variable. Provider-specific prompt tuning should only happen after the first comparison.
