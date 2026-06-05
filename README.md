# BDD SQL Revision

A local web app to practice SQL exercises from the Databases (BDD) module at the Higher National School of Computer Science (ESI), Algiers — 2025/2026 season.

Based on the exercises given by Prof. BERKANI N., FADLOUN S., and KHOURI S. in class, with official solutions and alternative accepted answers. The database models a fictional Algerian mobile operator, **DZTelecom** (8 tables, ~30 rows of seed data).

## Features

- **26 SQL exercises** across 5 parts — DDL table creation and DQL queries
- **Syntax-highlighted editor** (CodeMirror 6) with SQL autocompletion
- **Run & Submit** — test queries and validate against expected output (result comparison, not text matching)
- **Detailed feedback** — column mismatches, row count diffs, data diffs, MySQL errors
- **Progressive hints** (2–3 per exercise) and locked solutions
- **ER diagram** — interactive SVG with table relationships, column types, PK/FK markers
- **Table browser** — explore schema columns, types, and data previews
- **Sandbox mode** — free-form SQL execution against the live database
- **Progress tracking** — persisted in localStorage with completion marks and a progress bar
- **Keyboard shortcuts** — ⌘+Enter to submit, ⌘+Shift+Enter to run (Ctrl on Windows/Linux)
- **Dark theme** with IBM Plex Mono font

## Tech Stack

| Layer | Technology |
|---|---|
| **Monorepo** | Turborepo with Bun workspaces |
| **Frontend** | React 19, TanStack Router, tRPC client, TanStack Query, Tailwind CSS v4 |
| **Editor** | CodeMirror 6 (`@uiw/react-codemirror`) |
| **Backend** | Standalone tRPC server (Node HTTP) |
| **Database** | MySQL 8 via Docker, Drizzle ORM, mysql2 |
| **Tooling** | TypeScript, Biome (lint + format) |

## Requirements

- [Bun](https://bun.sh) ≥ 1.2
- [Docker](https://www.docker.com/) (for MySQL)
- Node.js ≥ 20 (optional, Bun handles everything)

## Getting Started

### 1. Start the database

```bash
docker compose up -d db
```

This starts MySQL on `localhost:3308` with database `DZTelecom`, user `root`, password `root`.

### 2. Install dependencies

```bash
bun install
```

### 3. Seed the database

```bash
bun run db:seed
```

Global database reseeding is a developer/admin maintenance action. Normal app
users cannot trigger it from the learner-facing API; use this command when you
need to reset local development data.

### 4. Start the app

```bash
bun run dev
```

- **Web app:** http://localhost:3000
- **API server:** http://localhost:3001

## Project Structure

```
td-bdd/
├── apps/
│   └── web/                  # React frontend (Vite)
│       └── src/
│           ├── components/   # UI components
│           │   ├── ui/       # shadcn-style primitives
│           │   ├── er-diagram.tsx
│           │   ├── exercise-panel.tsx
│           │   ├── exercise-workspace.tsx
│           │   ├── schema-viewer.tsx
│           │   ├── sql-editor.tsx
│           │   └── ...
│           ├── hooks/        # useProgress, useTour
│           ├── lib/          # trpc client, validation types, platform utils
│           └── routes/       # TanStack Router routes
├── packages/
│   ├── api/                  # tRPC server
│   │   └── src/
│   │       ├── router.ts     # All API procedures
│   │       └── exercises.ts  # 26 exercise definitions
│   └── db/                   # Database package
│       └── src/
│           ├── index.ts      # Drizzle instance + mysql2 pool
│           ├── schema.ts     # Drizzle table definitions
│           └── seed.ts       # Database seeder
├── docker-compose.yaml       # MySQL container
├── TelecomDZ_schema_data.sql # Raw SQL schema + seed data
├── turbo.json
└── package.json
```

## Available Commands

| Command | Description |
|---|---|
| `bun run dev` | Start web (port 3000) + API (port 3001) via Turborepo |
| `bun run build` | Type-check and build all packages |
| `bun run typecheck` | TypeScript check all packages |
| `bun run lint` | Biome lint check |
| `bun run format` | Biome format all files |
| `bun run db:seed` | Drop and re-seed the DZTelecom database for local development/admin maintenance |

## Exercises

The 26 exercises are organized across Exercise 1 (DDL) and Exercise 2 (Parts 1–4):

| Section | Count | Topic |
|---|---|---|
| Exercise 1 | 9 | DDL — create all 8 tables + full script |
| Exercise 2, Part 1 | 5 | Basic DQL — SELECT, JOIN, filtering |
| Exercise 2, Part 2 | 4 | Aggregation — GROUP BY, HAVING, calculations |
| Exercise 2, Part 3 | 5 | Advanced — division, subqueries, CTEs |
| Exercise 2, Part 4 | 3 | DDL modifications — ALTER, CREATE VIEW, UNIQUE constraint |

Each exercise includes 2–3 progressive hints and one or more accepted solution queries. LIMIT clauses are not used in solutions, per the course restriction.

## Database Schema

**DZTelecom** — a fictional Algerian mobile operator with 8 tables:

- **CUSTOMER** — person who owns mobile lines
- **SUBSCRIBER** — mobile line (SIM card) identified by phone number
- **RECHARGE** — prepaid credit top-up events
- **SERVICE** — available services (calls, SMS, internet, etc.)
- **USES** — usage events (calls made, data consumed)
- **PLAN** — mobile plans with monthly rates
- **FEATURE** — features included in each plan
- **SIGNUP** — subscriber plan signups

Relationships: CUSTOMER → SUBSCRIBER, SUBSCRIBER → RECHARGE/USES/SIGNUP, SERVICE → USES, PLAN → FEATURE/SIGNUP.

## License

Educational project — ESI Algiers, 1CS-BDD module, 2025/2026.
