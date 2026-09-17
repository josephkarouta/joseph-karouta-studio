# Heyy Studio Provider Cost Telemetry

## Purpose

This instrumentation is for the Architecture / Interior provider comparison and later provider-cost audits. It records every instrumented provider call separately so one visible Heyy action can be decomposed into its real internal work.

For example, **Refresh Plan Foundation** can now show separately:

1. Architecture Plan reasoning (`gpt-5.6-sol`)
2. Any correction reasoning pass
3. The final Plan Foundation image call (`openai`, `gemini` or `grok`)

The provider dashboard/invoice is still the billing source of truth. `estimated_cost_usd` is a local estimate calculated from the recorded API usage plus the dated rate table in `lib/ai/provider-telemetry.ts`.

## Required setup

Run this migration in Supabase before the next model test:

`supabase/migrations/202609140001_generation_provider_telemetry.sql`

No new environment variables are required.

## What is recorded

Each row in `generation_provider_calls` contains:

- generation job ID
- project / Studio / stage
- provider and served model
- call type
- success/failure
- provider-call start/end time and duration
- reference-image count
- requested quality and size
- raw provider usage JSON
- estimated USD cost
- the exact pricing assumptions used for that estimate

The normal `generation_jobs.output.provider_cost` also receives a compact summary after successful instrumented jobs.

## Architecture comparison query

After each generation, run:

```sql
select
  c.started_at,
  c.generation_job_id,
  c.stage,
  c.call_kind,
  c.provider,
  c.model,
  c.status,
  round(c.duration_ms / 1000.0, 1) as seconds,
  c.reference_count,
  c.requested_quality,
  c.requested_size,
  c.estimated_cost_usd,
  c.usage,
  c.pricing_basis
from public.generation_provider_calls c
where c.project_id = 'PASTE_PROJECT_ID_HERE'
order by c.started_at desc;
```

## One-row job totals

```sql
select *
from public.generation_provider_cost_summary
where project_id = 'PASTE_PROJECT_ID_HERE'
order by first_provider_call_at desc;
```

## Cost-rate snapshot used by this patch

Rates are dated **2026-09-14** inside every `pricing_basis` record.

- GPT-Image-2.5 Sunburst / Flare: $5/M text-input tokens, $8/M image-input tokens, $30/M image-output tokens.
- GPT-5.6 Sol: $4/M uncached input, $0.40/M cached input, $20/M output.
- Gemini 3 Pro Image: 1K/2K image output estimated at $0.134, 4K at $0.24, plus recorded input/thinking text token charges when available.
- Grok Imagine Image 2.0: output by pinned quality/resolution plus $0.01 per input reference image. Heyy's current test path uses 2K Medium = $0.08 output.

If providers change prices later, update only the estimator's dated rate table. Historical rows keep the exact `pricing_basis` used when they were recorded.

## Test rule

For a fair model comparison, do not change the project brief, selected Direction, Plan Foundation, materials, target view or quality between provider runs. Change only the provider/model routing value, restart local development, and regenerate the same target.
