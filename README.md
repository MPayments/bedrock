# Multihansa

Multihansa is a financial platform monorepo built on the Bedrock framework layer.

## Workspace Topology

- `packages/bedrock/common` - `@bedrock/common`, shared Bedrock utilities, SQL helpers, worker primitives, and validation helpers
- `packages/bedrock/platform` - `@bedrock/platform`, operations, identity, registers, and workflows
- `packages/bedrock/finance` - `@bedrock/finance`, assets, ledger, accounting, balances, and reconciliation
- `packages/bedrock/documents` - `@bedrock/documents`, document runtime and schemas
- `packages/domains/parties` - `@multihansa/parties`
- `packages/domains/treasury` - `@multihansa/treasury`
- `packages/domains/reporting` - `@multihansa/reporting`
- `packages/domains/multihansa-app` - `@multihansa/app`, explicit product composition
- `packages/sdk/ui` - `@multihansa/ui`
- `packages/db` - `@multihansa/db`, the schema aggregator, DB client, migrations, and seeds
- `apps/api` - `multihansa-api`
- `apps/web` - `multihansa-web`
- `apps/workers` - `multihansa-workers`

Dependency direction:

- `@bedrock/common -> @bedrock/platform|@bedrock/finance|@bedrock/documents -> @multihansa/* -> apps/*`
- `@multihansa/db` aggregates Bedrock and Multihansa schemas; it does not own runtime domain tables itself.

## Stack

- Runtime: Node.js 24.x
- Package manager: Bun
- Monorepo: Turborepo
- API: Hono
- Web: Next.js
- Storage: PostgreSQL + TigerBeetle

## Local Setup

Install dependencies:

```bash
bun install
```

Start infrastructure:

```bash
docker compose -f infra/docker-compose.yml up -d
```

## Run

Start the full workspace:

```bash
bun run dev
```

Run a single app:

```bash
bun run --filter=multihansa-api dev
bun run --filter=multihansa-web dev
bun run --filter=multihansa-workers dev
```

Run workers directly:

```bash
bun run --cwd apps/workers worker:all
bun run --cwd apps/workers worker:ledger
bun run --cwd apps/workers worker:documents
bun run --cwd apps/workers worker:documents-period-close
bun run --cwd apps/workers worker:balances
bun run --cwd apps/workers worker:fx-rates
```

## Build and Quality

```bash
bun run build
bun run lint
bun run check-types
bun run test
bun run test:integration
```

App-specific builds:

```bash
bun run build --filter=multihansa-api
bun run build --filter=multihansa-web
bun run --filter=multihansa-workers build
```

## DB Baseline Flow

This repo uses a baseline-only migration chain.

```bash
bun run --filter=@multihansa/db db:nuke
bun run --filter=@multihansa/db db:migrate
bun run --filter=@multihansa/db db:seed
```

## Reference Docs

- [`docs/bedrock-architecture.md`](/Users/alexey.eramasov/dev/ledger/docs/bedrock-architecture.md)
- [`docs/bedrock-usage-guide.md`](/Users/alexey.eramasov/dev/ledger/docs/bedrock-usage-guide.md)
- [`docs/bedrock-implementation-details.md`](/Users/alexey.eramasov/dev/ledger/docs/bedrock-implementation-details.md)
