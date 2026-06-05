# BDD SQL Revision App — Agent Instructions

## Project Overview

Local-only web app for practicing SQL exercises from the BDD (Databases) module. 26 exercises across 5 parts covering DDL and DQL against the DZTelecom telecom database.

## Tech Stack

- **Monorepo:** Turborepo with Bun workspaces
- **Frontend:** `/apps/web` — React 19, TanStack Router (code-based), tRPC client, TanStack Query, Tailwind CSS v4, CodeMirror 6, IBM Plex Mono
- **Backend:** `/packages/api` — standalone tRPC server (Node HTTP), CORS for localhost:3000
- **Database:** `/packages/db` — Drizzle ORM + mysql2 pool, MySQL on localhost:3308 (Docker)
- **Tooling:** Biome (lint + format), TypeScript, Bun

## Always-Active Skills

When writing or reviewing React/TypeScript code in this project, **always** load and apply:

- `no-use-effect` — avoid `useEffect`; use the five replacement patterns from that skill instead
- `vercel-react-best-practices` — follow Vercel performance and patterns for React/Next.js

## Commands

| Command | What it does |
|---|---|
| `bun run dev` | Start web (3000) + api (3001) via Turborepo |
| `bun run build` | Type-check and build all packages |
| `bun run typecheck` | TypeScript check all packages |
| `bun run lint` | Biome lint check |
| `bun run format` | Biome format all files |
| `bun run db:seed` | Drop and re-seed DZTelecom database |
| `docker compose up -d db` | Start MySQL on port 3308 |

## Architecture Rules

- All DB access goes through `@bdd-revision/db` (pool, Drizzle instance, seed helpers). Never create a second mysql2 connection.
- The usage-events table is named USES, so students do not need backticks for it.
- API procedures are in `packages/api/src/router.ts`. Validate user SQL with `classifySql()` and `runQuery()`.
- Exercise definitions in `packages/api/src/exercises.ts` — 26 entries with hints, solutions, DDL verification queries.
- Frontend state shared via React Context (`ProgressProvider` in `use-progress.ts`). Do not duplicate localStorage reads.
- TanStack Router uses code-based routing — routes defined manually, tree assembled in `routeTree.gen.ts`.

## UI Patterns

- Dark theme: CSS custom properties defined in `@theme` block in `index.css`.
- shadcn-style components in `apps/web/src/components/ui/` (Button, Separator, Badge, Dialog).
- CodeMirror 6 via `@uiw/react-codemirror` in `SqlEditor` — use `ref` to access the editor view.
- `SchemaViewer` renders both ER diagram (SVG) and table browser; accepts optional `onClose` callback.
- `ExercisePanel` handles hint reveal, solution reveal, and DB schema button; all callbacks bubble up.
- Keyboard shortcuts adapt to OS via `modKey()` from `lib/platform.ts` (⌘ on macOS, Ctrl otherwise).

## Validation Flow

- `validation.submit({ exerciseId, userSql })` compares query output (not SQL text).
- DQL: runs user query, runs solution queries, compares resultsets (columns, rows, data — order-independent).
- DDL: re-seeds DB, runs user DDL, executes verification queries from exercise definition.
- Numeric values are normalized for comparison; leading-zero strings like phone numbers are not treated as numbers.
- LIMIT clauses are not used in solution queries (course restriction).

## Git Workflow

- Commits reference the issue number: `Implement X (#N)`.
- Run full verification before committing: `bun run typecheck && bun run build && bun run db:seed`.
- Never commit `dist/` or generated files.
