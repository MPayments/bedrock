# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Bedrock is a financial platform (ledger, balances, FX, fees, reconciliation) built as a **Turborepo monorepo** with TypeScript. Package manager is **Bun**; runtime is **Node.js 24.x** (never use Bun as runtime).

## Commands

### Build & Dev

```bash
bun run build                          # Build all packages (dependency order via Turbo)
bun run build --filter=api             # Build API only (required after apps/api changes — finance imports API types from dist/)
bun run dev                            # Watch mode for all apps
```

### Testing

```bash
bun run test                           # Unit tests (all 26 projects)
bun run test:integration               # Integration tests (require running Postgres + TigerBeetle)
bun run test:all                       # Both unit and integration

# Single test file
bunx vitest run path/to/file.test.ts --config vitest.config.ts

# Single test project
bunx vitest run --config vitest.config.ts --project ledger

# Single integration test project
bunx vitest run --config vitest.integration.config.ts --project ledger:integration
```

### Quality Checks

```bash
bun run lint                           # ESLint across all packages
bun run check-types                    # TypeScript validation
bun run check:boundaries               # Architecture + manifest validation
bun run format                         # Prettier
bun run knip                           # Unused dependency detection
```

### Database

```bash
docker compose -f ops/infra/docker-compose.yml up -d   # Start Postgres + TigerBeetle
bun run db:nuke                        # Drop all tables
bun run db:migrate                     # Apply migrations
bun run db:seed                        # Run all seed scripts
bun run db:generate                    # Generate migrations from schema changes
bun run db:studio                      # Drizzle Studio GUI
```

Migration policy is **baseline-only hard cutover**: `db:nuke -> db:migrate -> db:seed`. No legacy state support.

## Architecture

### Workspace Topology

```
apps/api          — Hono API server (port 3000)
apps/crm          — Next.js CRM frontend (port 3002)
apps/finance      — Next.js finance frontend (port 3001, imports types from api/dist)
apps/portal       — Next.js customer portal (port 3003)
apps/workers      — Background job runners
apps/db           — Schema aggregation, migrations, seeds (never owns domain tables)
packages/shared   — Stable primitives (@bedrock/shared/core, /money, /reference-data, /parties, /requisites)
packages/modules/ — 13 bounded-context business packages (@bedrock/ledger, @bedrock/accounting, etc.)
packages/platform — Runtime infrastructure via subpaths (@bedrock/platform/persistence, /observability, etc.)
packages/workflows/  — Cross-module orchestration
packages/plugins/    — Document plugin extensions
packages/sdk/        — API client and UI components
packages/tooling/    — ESLint config, TS config, test utils
```

### Dependency Direction

`shared -> modules/workflows/plugins/sdk -> apps/*`. Platform subpaths provide shared infrastructure to all layers. Apps and workflows do composition; they don't own business logic.

### Internal Package Layers (DDD / Explicit Architecture)

Every runtime module follows this structure:

| Layer | Purpose | Rules |
|---|---|---|
| `contracts/` | Public DTOs, Zod schemas | Importable cross-context |
| `application/` | Use cases, command/query handlers, ports | No Drizzle, no direct DB |
| `domain/` | Pure business rules, aggregates | No Drizzle, no DB, no adapters |
| `infra/` | Drizzle schema, repositories, adapters | Implements application ports |
| `service.ts` | Thin closure-factory facade | Delegates to handlers |

Dependency flow: domain -> application -> infra. Domain must stay pure.

### Service Pattern — Closures, Not Classes

```typescript
export function createXxxService(deps: XxxServiceDeps) {
    const context = createXxxServiceContext(deps);
    const doSomething = createDoSomethingHandler(context);
    return { doSomething };
}
export type XxxService = ReturnType<typeof createXxxService>;
```

Context factory lives in `application/shared/context.ts`. Command/query handlers are closures receiving context.

### Key Conventions

- **Imports**: Only through `package.json#exports`. No cross-package deep imports. No `internal/` folders.
- **Import order**: External packages, then `@bedrock/*`, then relative — separated by blank lines.
- **Schema ownership**: Each module owns its tables under `infra/drizzle/schema/`. `apps/db` aggregates for migrations.
- **Errors**: Custom classes extending `ServiceError` from `@bedrock/shared/core/errors`. Throw directly.
- **Validation**: Zod schemas for all input. Derive types with `z.infer<>`.
- **Naming**: files `kebab-case.ts`, functions `camelCase`, types `PascalCase`, constants `UPPER_SNAKE_CASE`.
- **Modules**: All packages use ESM (`"type": "module"`).
- **DB columns**: `snake_case`.
- **Workspace deps**: Always use `"workspace:*"` protocol.

### ESLint Layer Enforcement

ESLint rules prevent:
- Domain code from importing Drizzle or persistence APIs
- Application code from importing infra or Drizzle directly
- Cross-context imports of internal layers (only `contracts/` exports are allowed)

### API Routes

Hono with `@hono/zod-openapi`. Each route module is a function receiving app context, returning a Hono app. Routes use `createRoute` with Zod schemas for automatic OpenAPI generation. Swagger at `/docs`.

## Documentation Source of Truth

- `README.md` — Setup and topology overview
- `AGENTS.md` — Detailed coding conventions and patterns
- `docs/adr/**` — Architecture Decision Records (especially ADR 0001)
