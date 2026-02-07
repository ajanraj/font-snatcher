# Repository Guidelines

## Stack Snapshot

- Runtime/build: Bun + Vite.
- App framework: TanStack Start + TanStack Router.
- UI: React 19 + Tailwind CSS v4.
- Server runtime target: Nitro (`cloudflare-module` preset).
- Testing/tooling: Vitest, Oxlint, Oxfmt, TypeScript (`tsgo` typecheck).

## Project Structure & Module Organization

- `src/routes/`: TanStack Start routes and API handlers (`api.extract.ts`, `api.match.ts`, `api.font.ts`).
- `src/server/font-extractor/`: extraction, parsing, SSRF checks, proxy signing, licensing/matching logic.
- `src/features/font-snatcher/`: page-level UI and feature components.
- `src/components/ui/`: shared UI primitives.
- `src/test/`: Vitest tests (`*.test.ts`, `*.test.tsx`) and `setup.ts`.
- `scripts/refresh-google-fonts.ts`: refreshes `src/data/google-fonts.snapshot.json`.
- `public/`: static assets.

## Build, Test, and Development Commands

- `bun install`: install dependencies.
- `bun run dev`: run local dev server on `http://localhost:3000`.
- `bun run build`: production build.
- `bun run preview`: preview built app.
- `bun run test`: run test suite in `src/test`.
- `bun run lint` / `bun run lint:fix`: type-aware linting via Oxlint.
- `bun run format` / `bun run format:check`: format/check with Oxfmt.
- `bun run typecheck`: strict TypeScript check (`tsgo`).

## Coding Style & Naming Conventions

- Language: TypeScript + React, strict mode enabled (`tsconfig.json`).
- Formatting: run Oxfmt; lint with Oxlint plugins (`typescript`, `react`, `jsx-a11y`, `vitest`).
- Imports: use alias `@/*` for `src/*`.
- Naming:
  - React components: PascalCase (`FontSnatcherPage`).
  - Utility/module files: kebab-case (`url-utils.ts`, `extract-fonts.ts`).
  - Tests: match target behavior (`api.extract.test.ts`).

## Testing Guidelines

- Framework: Vitest with `jsdom` and globals.
- Place tests under `src/test` using `*.test.ts` / `*.test.tsx`.
- Prefer behavior-driven names (`"rejects invalid payload"`).
- Add regression tests for bug fixes, especially around parsing, API payload validation, and SSRF/proxy guardrails.

## Commit & Pull Request Guidelines

- Follow Conventional Commits seen in history: `feat:`, `fix:`, `refactor:`, `build:`, `docs:`, `style:`, `test:`.
- Keep commits focused and reviewable.
- PRs should include:
  - concise summary + rationale,
  - linked issue (if applicable),
  - test evidence (`bun run test`, `bun run lint`, `bun run typecheck`),
  - screenshots/GIFs for UI changes.

## Security & Configuration Tips

- Set `FONT_PROXY_SECRET` in production (minimum 16 chars).
- Do not bypass SSRF protections or signed font proxy flow in `api.font`.
