# Bedrock

Bedrock is a financial platform monorepo (ledger, balances, FX, reconciliation).

## Workspace Topology

- `packages/shared` - stable shared primitives exposed as `@bedrock/shared/core`, `@bedrock/shared/money`, and `@bedrock/shared/reference-data`
- `packages/modules/*` - write-side business capabilities published as flat `@bedrock/<name>` packages
- `packages/workflows/*` - cross-module orchestration such as `@bedrock/workflow-period-close`
- `packages/platform` - technical runtime infrastructure exposed as `@bedrock/platform/persistence`, `@bedrock/platform/worker-runtime`, and related subpaths
- `packages/plugins/*` - document plugins and plugin SDK packages
- `packages/sdk/*` - downstream-consumer SDK and reusable UI packages such as `@bedrock/sdk-ui`
- `apps/*` - API/CRM/Finance/Workers/DB composition
- `ops/*` - infra entrypoints

Runtime import contract:

- Runtime packages publish flat imports such as `@bedrock/ledger` and `@bedrock/iam`, plus package subpaths such as `@bedrock/iam/schema` and `@bedrock/platform/worker-runtime`.
- Domain schemas stay with the owning package and are imported through package exports such as `@bedrock/ledger/schema` or `@bedrock/parties/schema`.
- `apps/db` owns schema aggregation, migrations, DB reset, and seed/bootstrap scripts.
- Use DB connection types from `@bedrock/platform/persistence` or `@bedrock/platform/persistence/drizzle`.

## Architecture

The repo architecture is documented in:

- [docs/adr/0001-bounded-context-explicit-architecture.md](/Users/alexey.eramasov/dev/ledger/docs/adr/0001-bounded-context-explicit-architecture.md)

The short version:

- workspace packages are organized by bounded context and package kind
- runtime packages use explicit `contracts`, `application`, `domain`, and `infra` layers
- package exports define the only supported runtime entrypoints
- apps and workflows do composition and delivery; they do not own core business logic

## Stack

- Runtime: Node.js 24.x
- Package manager: Bun
- Monorepo: Turborepo
- API: Hono
- Web: Next.js
- Storage: PostgreSQL + TigerBeetle

## Apps

- `apps/api` - API adapter (`http://localhost:3000`)
- `apps/db` - DB tooling and seed runners
- `apps/crm` - CRM app (`http://localhost:3002`)
- `apps/finance` - Finance app (`http://localhost:3001`)
- `apps/portal` - Customer portal (`http://localhost:3003`)
- `apps/workers` - Background loops (monitoring on `http://localhost:8081`)

## Local Setup

Start infrastructure:

```bash
docker compose -f infra/docker-compose.dev.yml up -d
```

Port contract:

- API: `http://localhost:3000`
- Postgres on the host: `127.0.0.1:5432`
- Finance: `http://localhost:3001`
- CRM: `http://localhost:3002`
- Portal: `http://localhost:3003`
- TigerBeetle on the host: `127.0.0.1:3555`
- TigerBeetle inside Docker Compose: `bedrock-tigerbeetle:3000`

Install dependencies:

```bash
bun install
```

## Run

Run the runtime stack (`api`, `workers`, `finance`, `crm`, `portal`):

```bash
bun run dev
```

Run every workspace watcher, including package-level `tsc --watch` processes:

```bash
bun run dev:all
```

Run a renamed frontend directly from the repo root:

```bash
bun run dev:finance
bun run dev:crm
bun run dev:portal
bun run dev:workers
```

Run workers:

```bash
bun run --cwd apps/workers worker:all
bun run --cwd apps/workers worker:ledger
bun run --cwd apps/workers worker:documents
bun run --cwd apps/workers worker:balances
bun run --cwd apps/workers worker:treasury-rates
bun run --cwd apps/workers worker:reconciliation
```

## Build and Quality

Build everything:

```bash
bun run build
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
bun run db:nuke
bun run db:migrate
bun run db:seed
```

## Documentation Source of Truth

Canonical documentation lives in:

- `README.md`
- `AGENTS.md`
- `docs/adr/**`
