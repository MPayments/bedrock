# Bedrock

Bedrock is a financial platform monorepo (ledger, orchestration, connectors, balances, FX, reconciliation).

## Workspace Topology

- `@bedrock/kernel` - shared kernel/primitives/packs/countries
- `@bedrock/db` - Drizzle client, all DB schema/migrations/seeds/types
- `@bedrock/core` - core runtime domains (`@bedrock/core/<domain>`)
- `@bedrock/application` - application workflows/use-cases (`@bedrock/application/<domain>`)
- `apps/*` - API/Web/Workers composition
- `@bedrock/sdk/*` - API client + UI kit

Runtime import contract:

- Legacy `@bedrock/<domain>` runtime specifiers are removed.
- Domain schemas are colocated under `@bedrock/core/<domain>/schema` and `@bedrock/application/<domain>/schema`.
- Use DB connection types from `@bedrock/kernel/db/types`.

## Stack

- Runtime: Node.js 24.x
- Package manager: Bun
- Monorepo: Turborepo
- API: Hono
- Web: Next.js
- Docs: Nextra + Next.js (`apps/docs`)
- Storage: PostgreSQL + TigerBeetle

## Apps

- `apps/api` - API adapter (`http://localhost:3002`)
- `apps/web` - Web app (`http://localhost:3001`)
- `apps/workers` - Background loops (monitoring on `http://localhost:8081`)
- `apps/docs` - Documentation app (`http://localhost:3003`)

## Local Setup

Start infrastructure:

```bash
docker compose -f infra/docker-compose.yml up -d
```

Install dependencies:

```bash
bun install
```

## Run

Run all apps:

```bash
bun run dev
```

Run docs app only:

```bash
bun run --cwd apps/docs dev
```

Run workers:

```bash
bun run --cwd apps/workers worker:all
bun run --cwd apps/workers worker:ledger
bun run --cwd apps/workers worker:documents
bun run --cwd apps/workers worker:balances
bun run --cwd apps/workers worker:fx-rates
bun run --cwd apps/workers worker:reconciliation
bun run --cwd apps/workers worker:connectors-dispatch
bun run --cwd apps/workers worker:connectors-poller
bun run --cwd apps/workers worker:connectors-statements
bun run --cwd apps/workers worker:orchestration-retry
```

## Build and Quality

Build everything:

```bash
bun run build
```

Build docs app only:

```bash
bun run build --filter=docs
```

Checks:

```bash
bun run lint
bun run check-types
bun run test
bun run test:integration
```

## DB Cutover Sequence

This repo now uses a baseline-only migration chain. Legacy DB states are unsupported.

```bash
bun run --filter=@bedrock/db db:nuke
bun run --filter=@bedrock/db db:migrate
bun run --filter=@bedrock/db db:seed
```

## Documentation Source of Truth

Canonical documentation lives in:

- `apps/docs/content/docs/**`
