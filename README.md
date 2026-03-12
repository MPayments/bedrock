# Bedrock

Bedrock is a financial platform monorepo (ledger, balances, FX, reconciliation).

## Workspace Topology

- `packages/modules/*` - business capabilities published as flat `@bedrock/<name>` packages
- `packages/platform/*` - shared technical capabilities such as auth and idempotency
- `packages/runtime/*` - execution hosts such as `@bedrock/worker-runtime`
- `packages/plugins/*` - document add-ons published as flat `@bedrock/<name>` packages
- `packages/integrations/*` - narrow cross-domain glue packages
- `@bedrock/common` - shared primitives and infrastructure helpers
- `@bedrock/db` - Drizzle client, schema aggregation, migrations, seeds, and DB types
- `apps/*` - API/Web/Workers composition
- `@bedrock/sdk/*` - API client + UI kit

Runtime import contract:

- Runtime packages publish flat imports such as `@bedrock/ledger`, `@bedrock/auth`, `@bedrock/worker-runtime`, and `@bedrock/parties/<subdomain>`.
- Domain schemas stay with the owning package and are imported through package exports such as `@bedrock/ledger/schema` or `@bedrock/parties/requisites/schema`.
- `@bedrock/db` aggregates schemas; business packages do not own migrations and do not import `@bedrock/db`.
- Use DB connection types from `@bedrock/common/db/types`.

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
