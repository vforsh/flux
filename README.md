# @vforsh/flux

Bun-based CLI for Black Forest Labs FLUX image generation and editing.

## Install (dev)

```bash
bun install
./bin/flux --help
```

## Auth

Preferred:

```bash
export BFL_API_KEY="..."
```

Or store locally (reads from stdin):

```bash
echo "$BFL_API_KEY" | ./bin/flux config set apiKey
```

## Examples

```bash
./bin/flux gen "a studio photo of a cat astronaut" --model flux-2-pro --width 1024 --height 1024 -o out/
./bin/flux edit "make it sunset lighting" --model flux-2-pro --input ./in.jpg -o out/
./bin/flux fill "remove the logo" --image ./img.png --mask ./mask.png -o out/
./bin/flux expand "extend background" --image ./img.jpg --top 256 --right 256 -o out/

./bin/flux gen "..." --no-wait
./bin/flux wait <id> -o out/
```

## Output modes

- default: human-friendly
- `--plain`: stable line output (paths/ids)
- `--json`: stable JSON output
