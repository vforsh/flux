---
name: flux
description: Usage guide for the `flux` CLI (@vforsh/flux) to generate and edit images via Black Forest Labs (BFL) FLUX API. Use for setting up the BFL API key, choosing models, generating images, editing with references, inpaint/outpaint, waiting for results, checking credits, using --plain/--json output, and handling common API errors (402/403/429).
---

# Flux CLI (BFL / FLUX)

CLI to generate and edit images via the BFL FLUX API.

## Quick start

1) API key:

- env:
  - `export BFL_API_KEY="..."`
- or save locally (reads from stdin; avoid shell history leaks):
  - `echo "$BFL_API_KEY" | flux config set apiKey`

2) Generate:

- `flux gen "a cat astronaut" --model flux-2-pro --width 1024 --height 1024 -o out/`

3) Edit with a reference image:

- `flux edit "make it sunset lighting" --model flux-2-pro --input ./in.jpg -o out/`

## Commands

`flux gen [prompt]`
- text-to-image
- prompt can be positional, or `-` / stdin

`flux edit [prompt] --input <path|url|base64> [--input ...]`
- image editing using a prompt + 1..N input images (base + refs)

`flux fill [prompt] --image <path|url|base64> [--mask <path|url|base64>]`
- inpaint (explicit mask image, or alpha channel)

`flux expand [prompt] --image <path|url|base64> [--top/--bottom/--left/--right <px>]`
- outpaint (expand canvas by pixels on any side)

`flux result <id> [--out <path|->]`
- fetch status/result by id
- if `status=Ready` and `--out` is set, downloads the result

`flux wait <id> [--polling-url <url>] [--out <path|->]`
- wait until `Ready`/error; optionally download the result

`flux credits`
- show remaining credits

`flux models`
- list model keys supported by the CLI

`flux config path|get|set|unset`
- local config (including saving API key via stdin)

## Global flags

- `--json`: single JSON object to stdout (for scripts)
- `--plain`: stable line output (paths/ids)
- `-q, --quiet`: less logging
- `-v, --verbose`: diagnostics to stderr (no secrets)
- `--endpoint <host>`: API host (default `api.bfl.ai`)
- `--region <us|eu|global>`: endpoint shortcut
- `--timeout <ms>`: timeout
- `--retries <n>`: retries for 429/5xx
- `--out-dir <dir>`: default output directory

## Common gen/edit flags

- `--model <key>`: model key (see `flux models`)
- `--seed <n>`
- `--safety <n>`: safety_tolerance (range depends on model)
- `--format <jpeg|png>`: output_format
- `-o, --out <path|->`: file/dir or `-` for stdout
- `--no-wait`: submit only; print `id` (+ `pollingUrl` in `--json`)
- `--poll-interval <ms>`

Advanced (escape hatch):
- `--body <json|@file>`: raw request body (full control)

## Models (keys)

Official model lineup evolves; use `flux models` for the current list.

Built-in keys, when to use them, and pricing tier (rule of thumb; pricing can change):

| Model key | Best for | Pricing tier | Notes |
| --- | --- | --- | --- |
| `flux-2-klein-4b` | quick drafts; high-volume generation | cheap | MP-based |
| `flux-2-klein-9b` | better drafts; still fast iteration | cheap-to-balanced | MP-based |
| `flux-2-pro` | default pick; production workflows; general-purpose gen/edit | balanced | MP-based; edits typically cost more than T2I |
| `flux-2-flex` | maximum quality with control knobs | premium | MP-based; supports `--steps`/`--guidance`; image editing is the most expensive tier in FLUX.2 |
| `flux-2-max` | final assets; quality-first; grounding search | premium/most expensive | MP-based |
| `flux-kontext-pro` | controlled edits/variations with multiple references | balanced | credits per call |
| `flux-kontext-max` | stronger Kontext edits; quality-first | expensive | credits per call |
| `flux-pro-1.1` | FLUX 1.1 behavior; compatibility workflows | balanced | credits per call |
| `flux-pro-1.1-ultra` | Ultra mode; aspect-ratio driven generation; optional raw look | expensive | credits per call |
| `flux-pro-1.0-fill` | inpainting (mask/alpha) | expensive | credits per call (tool endpoint) |
| `flux-pro-1.0-expand` | outpainting (extend canvas) | mid-to-expensive | tool endpoint; check returned `cost`/credits |
| `flux-dev` | passthrough via `--body` when you know the exact API shape | cheap | credits per call; check returned `cost` |
| `flux-pro` | passthrough via `--body` when you know the exact API shape | varies | check returned `cost`/credits |

Footnote:
- **MP-based**: cost scales with output size in *megapixels* (width * height / 1,000,000). Larger images cost more.

## Safety / reliability notes

- **API key**: avoid passing secrets via flags; use env/config/stdin.
- **Signed URL**: `result.sample` is typically short-lived; download immediately.

## Editing best practices (Kontext)

Applies to `flux edit` with Kontext models (`flux-kontext-pro`, `flux-kontext-max`).

### Prompt structure

- **Max 512 tokens**. Be explicit but concise.
- **Be specific**: exact color names, detailed descriptions, clear verbs.
- **Preserve intentionally**: state what must stay unchanged.
  - Bad: `"Change to daytime"`
  - Good: `"Change to daytime while maintaining the same style of the painting"`
- **Name subjects directly**: use descriptive identifiers, not pronouns.
  - Bad: `"Transform her into a Viking"`
  - Good: `"Transform the woman into a viking warrior while preserving her exact facial features, eye color, and facial expression"`
- **Choose verbs carefully**: "transform" signals complete replacement; "change the clothes to…" keeps identity.
- **Control composition**: when changing backgrounds, add `"keeping the person in the exact same position, scale, and pose. Maintain identical camera angle, framing, and perspective."`

### Text editing in images

- Use quotation marks: `Replace '[original text]' with '[new text]'`
- Case formatting matters.
- Works on signs, posters, labels without full image recreation.

### Annotation boxes

Bright colored boxes drawn on the input image act as spatial references.
- The model recognizes them automatically and removes them from output.
- Useful for targeted text repositioning, resizing, or pointing at a specific region.
- Example prompt: `"Add hats in the boxes"`

### Iterative editing

- Kontext excels at character consistency across multiple sequential edits.
- Break complex transformations into steps for better control.
- Start simple; test basic edits before layering complexity.

### Style transfer

- Name specific styles or reference known artists/art movements — not generic terms.
- Detail visual characteristics when style names are insufficient.
- For dramatic style shifts, use transformative sequences (multiple passes).
- Precise descriptions preserve structure: `"Convert to pencil sketch with natural graphite lines, cross-hatching, and visible paper texture"`

### Common pitfalls

| Problem | Cause | Fix |
| --- | --- | --- |
| Identity loss | vague "transform" prompt | use targeted verbs; explicitly list features to preserve |
| Subject repositioned | background change without anchoring | add position/scale/framing preservation clause |
| Style drift | simple prompt without style anchoring | add `"while maintaining the same style"` |
| Wrong text case | case not specified | match exact casing in prompt |

## Common errors (exit codes)

- `2`: invalid args/validation
- `3`: missing key or `403`
- `4`: `402` (insufficient credits)
- `5`: `429` (rate limit)
- `6`: moderation
- `7`: other API/task errors
