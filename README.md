# Bedrock

Bedrock is a financial platform monorepo (ledger, balances, FX, reconciliation).

## Workspace Topology

- `packages/foundation/*` - stable primitives such as `@bedrock/core`, `@bedrock/money`, and `@bedrock/observability`
- `packages/modules/*` - write-side business capabilities published as flat `@bedrock/<name>` packages
- `packages/workflows/*` - cross-module orchestration such as `@bedrock/workflow-period-close`
- `packages/queries/*` - read models and reporting packages such as `@bedrock/query-accounting-reporting`
- `packages/integrations/*` - external-system integrations such as `@bedrock/integration-fx-providers`
- `packages/adapters/*` - technical adapters such as `@bedrock/adapter-db-drizzle` and `@bedrock/adapter-worker-runtime`
- `packages/extensions/*` - document extensions and extension SDKs
- `packages/clients/*` - downstream-consumer client packages
- `packages/ui/*` - reusable UI packages such as `@bedrock/ui`
- `apps/*` - API/Web/Workers composition
- `ops/*` - infra and bootstrap entrypoints

Runtime import contract:

- Runtime packages publish flat imports such as `@bedrock/ledger`, `@bedrock/identity`, `@bedrock/counterparties`, and `@bedrock/adapter-worker-runtime`.
- Domain schemas stay with the owning package and are imported through package exports such as `@bedrock/ledger/schema`, `@bedrock/counterparties/schema`, or `@bedrock/requisites/schema`.
- `@bedrock/adapter-db-drizzle` aggregates schemas for the DB client and migrations.
- `@bedrock/bootstrap-db` owns DB seeding/bootstrap scripts.
- Use DB connection types from `@bedrock/adapter-db-drizzle/db/types`.

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
docker compose -f ops/infra/docker-compose.yml up -d
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
bun run --filter=@bedrock/adapter-db-drizzle db:nuke
bun run --filter=@bedrock/adapter-db-drizzle db:migrate
bun run --filter=@bedrock/bootstrap-db db:seed
```

## Documentation Source of Truth

Canonical documentation lives in:

- `apps/docs/content/docs/**`
