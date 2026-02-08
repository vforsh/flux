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

## Common errors (exit codes)

- `2`: invalid args/validation
- `3`: missing key or `403`
- `4`: `402` (insufficient credits)
- `5`: `429` (rate limit)
- `6`: moderation
- `7`: other API/task errors
