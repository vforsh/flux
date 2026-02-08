## General Rules

- **Style**: telegraph; noun-phrases ok; drop filler.
- **Runtime**: Bun + TypeScript (ESM). Prefer Bun-native patterns.
- **Secrets**: never print API keys or tokens. No secrets in argv flags. Prefer env/config.
- **Small files**: keep files under ~500 LOC; split before adding more branches.
- **Errors**: no stack traces by default; actionable messages; correct exit codes.

---

## Build / Test

- **Install**: `bun install`
- **Typecheck**: `bun run typecheck`
- **Tests**: `bun test`
- **CLI smoke**: `./bin/flux --help`

Before handoff: `bun run typecheck && bun test`.

---

## Git

- **Commits**: Conventional Commits (`feat|fix|refactor|build|ci|chore|docs|style|perf|test`).
- **No destructive resets**: avoid `git reset --hard` unless explicitly requested.

---

## Repo Tour

- **Entry**: `bin/flux` (shebang Bun) -> `src/index.ts` -> `src/cli/program.ts`
- **Commands**: `src/cli/commands/*`
- **API client**: `src/api/bfl.ts`
- **Model catalog/builders**: `src/models/catalog.ts`, `src/models/builders.ts`
- **I/O helpers**: `src/io/image.ts`, `src/io/output.ts`
- **Config**: `src/config/config.ts` (XDG `~/.config/flux/config.json`)
- **Docs**: `docs/IMPLEMENTATION_PLAN.md`

---

## Golden Paths

- **Add a model**:
  - Update `src/models/catalog.ts` (key, apiPath, family).
  - Add/adjust builder in `src/models/builders.ts` (constraints + field mapping).
  - Wire flags in `src/cli/commands/gen.ts` or a new command.
  - Add unit tests in `src/models/*.test.ts`.

- **Add a command**:
  - Implement `src/cli/commands/<cmd>.ts`.
  - Register in `src/cli/program.ts`.
  - Keep stdout contract stable (`--plain`, `--json`).

---

## Contracts / Invariants

- **Auth precedence**: `BFL_API_KEY` env > config file `apiKey`.
- **Output modes**: human default; `--plain` stable line output; `--json` stable JSON.
- **Polling**: always use the server-provided `polling_url` when available.
- **Result URLs**: `result.sample` is a short-lived signed URL; download promptly.
