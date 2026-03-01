# Bedrock

Bedrock is a financial platform monorepo (ledger, orchestration, connectors, balances, FX, reconciliation).

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

## Documentation Source of Truth

Canonical documentation lives in:

- `apps/docs/content/docs/**`
