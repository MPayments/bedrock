# AGENTS.md — Bedrock

## Project Overview

Bedrock is a financial platform (ledger, treasury, fees, FX, transfers) built as a **Turborepo monorepo**.

```
apps/        — applications (api: Hono, web: Next.js)
packages/    — shared domain and infrastructure packages
ops/         — infra entrypoints
```

Stack: TypeScript 5.8, Hono, Next.js, Drizzle ORM, PostgreSQL, TigerBeetle, Zod, Vitest, Pino.

## Workspace Topology

Runtime is split by package kind:

- `packages/shared` for stable shared primitives
- `packages/modules/*` for business capabilities, published as flat `@bedrock/<name>` packages
- `packages/workflows/*` for cross-module orchestration
- `packages/platform` for technical platform/runtime code exposed through subpaths
- `packages/plugins/*` for document plugins and plugin SDKs
- `packages/sdk/*` for downstream API clients and reusable UI packages

Core dependency direction:

- `shared -> modules/workflows/plugins/sdk -> apps/*`
- `@bedrock/platform/*` subpaths provide shared runtime infrastructure for modules, workflows, and apps.
- `apps/db` owns schema aggregation, migrations, DB reset, and shared seed/bootstrap runners.

Hard rules:

- No legacy runtime specifiers such as `@bedrock/application/*`, `@bedrock/modules/*`, or pre-merge flat names like `@bedrock/platform-postgres`, `@bedrock/core`, `@bedrock/money`, and `@bedrock/reference-data`.
- Runtime imports must go through declared package exports only. No cross-package `internal/**` imports.
- Domain schema ownership is colocated under:
  - `packages/modules/*/src/schema.ts` or `schema/**`
  - `packages/platform/src/*/schema.ts` or `schema/**` when platform domains own schema
- `apps/db` must not own domain table declarations; it only aggregates domain schemas for migrations and seed/bootstrap tooling.
- `apps/db` is the only workspace package that should own shared seed/bootstrap orchestration.
- Business packages must not instantiate DB clients directly. Only apps, approved tooling/scripts, `apps/db`, and integration tests may use `@bedrock/platform/persistence/postgres`.

## Architecture Contract

Bedrock uses bounded-context packages with explicit internal layers.

References:

- `plan.md`
- [Herberto Graca, "DDD, Hexagonal, Onion, Clean, CQRS, … How I put it all together"](https://herbertograca.com/2017/11/16/explicit-architecture-01-ddd-hexagonal-onion-clean-cqrs-how-i-put-it-all-together/)
- [docs/adr/0001-bounded-context-explicit-architecture.md](/Users/alexey.eramasov/dev/ledger/docs/adr/0001-bounded-context-explicit-architecture.md)

Repo-wide rules:

- Top-level packaging is by bounded context and package kind, not by technical layer.
- Runtime packages must prefer this internal split:
  - `contracts/`
  - `application/`
  - `domain/`
  - `infra/`
- `domain` contains pure business rules and must not depend on Drizzle, database clients, transport code, or concrete adapters.
- `application` owns use cases and ports; it coordinates domain logic and should not own tool-specific implementations.
- `infra` owns repositories, DB schema, SQL helpers, and external adapters; it implements application ports.
- Concrete adapter creation belongs in module-root composition, apps, or workflows. Do not instantiate adapters deep inside domain logic.
- Do not create new generic `internal/` folders in runtime packages.
- Use `package.json#exports` to define all supported runtime entrypoints. Non-exported deep imports are forbidden.
- Each bounded context owns its runtime schema. Shared DB packages aggregate schemas; they do not own business tables.

## Package Manager and Runtime

- **Bun** is the package manager. Use `bun install`, `bun add`, `bun run`.
- **Node.js 24.x** is the runtime. Do NOT use Bun as a runtime.
- All scripts are invoked via `bun run <script>`, but the code itself executes under Node.js.
- When adding workspace dependencies, use the `workspace:*` protocol:

```jsonc
// package.json
"dependencies": {
    "@bedrock/platform": "workspace:*", // correct
    "@bedrock/shared": "workspace:*",   // correct
    "@bedrock/ledger": "workspace:*"  // correct
    // NOT "@bedrock/platform": "*"
}
```

## Service Pattern — Closures, Not Classes

Services MUST be written as **factory closure functions**. Never use classes for services.

### Basic service

```typescript
// src/service.ts
export function createXxxService(deps: XxxServiceDeps) {
    const { db, log } = createXxxServiceContext(deps);

    async function list() { /* ... */ }
    async function findById(id: string) { /* ... */ }

    return { list, findById };
}

export type XxxService = ReturnType<typeof createXxxService>;
```

### Context and dependency injection

Dependencies are declared as a `Deps` type. A context factory in `application/shared/context.ts` transforms them into an internal `Context`:

```typescript
// src/application/shared/context.ts
export type XxxServiceDeps = {
    db: Database;
    logger?: Logger;
};

export type XxxServiceContext = {
    db: Database;
    log: Logger;
};

export function createXxxServiceContext(deps: XxxServiceDeps): XxxServiceContext {
    return {
        db: deps.db,
        log: deps.logger?.child({ svc: "xxx" }) ?? noopLogger,
    };
}
```

## Splitting Large Services

When a service grows large, split it by use-case and by layer, not into a generic catch-all helper directory. The root facade remains thin.

### Directory layout

```
packages/modules/xxx/src/
  index.ts
  service.ts                 — thin public facade when the package exposes one
  contracts/
  application/
    commands/
    queries/
    ports/
    shared/context.ts
  domain/
  infra/
    drizzle/
      schema/
      repositories/
```

### Command handler pattern

Each handler is a closure that receives the service context:

```typescript
// src/application/commands/do-something.ts
export function createDoSomethingHandler(context: XxxServiceContext) {
    const { db, log } = context;

    return async function doSomething(input: DoSomethingInput) {
        const validated = validateDoSomethingInput(input);
        // ...
    };
}
```

### Facade service

```typescript
// src/service.ts
export function createXxxService(deps: XxxServiceDeps) {
    const context = createXxxServiceContext(deps);

    const doSomething = createDoSomethingHandler(context);
    const doOther = createDoOtherHandler(context);

    return { doSomething, doOther };
}
```

## Package Structure

Runtime domain code lives under consolidated folders:

- `packages/modules/<module>/src/**`
- `packages/workflows/<workflow>/src/**`
- `packages/platform/src/<domain>/**`
- `packages/plugins/<plugin>/src/**`
- `packages/sdk/<sdk>/src/**`
- package-local `tests/**`

Within each package, this is the common default layout:

| File / Directory | Purpose |
|---|---|
| `index.ts` | Public exports for the package root |
| `contracts/` | Public DTOs and Zod schemas |
| `application/` | Use cases, handlers, ports, application context |
| `domain/` | Pure business rules and domain types |
| `infra/` | Drizzle schema, repositories, and external adapters |
| `service.ts` | Thin closure-factory facade when the package exposes one |
| `errors.ts` | Custom error classes extending `ServiceError` from `@bedrock/shared/core/errors` |
| `validation.ts` | Optional package-local validation helpers when not part of public contracts |

Additional rules:

- New and refactored packages must not introduce `internal/`.
- DB tables belong under `infra/drizzle/schema.ts` or `infra/drizzle/schema/**`.
- Repository interfaces belong in `application/ports.ts` or `application/<slice>/ports.ts`.
- Repository implementations belong in `infra/drizzle/repositories/**`.
- Query-support SQL helpers belong in `infra/**`, not in `domain/`.
- Root facades may stay in `service.ts`, `reports.ts`, or `periods.ts`, but they should delegate rather than accumulate business logic.

## Code Conventions

### Naming

- Files: `kebab-case.ts`
- Functions and variables: `camelCase`
- Types and interfaces: `PascalCase`
- Constants: `UPPER_SNAKE_CASE`

### Modules

- All packages use ESM (`"type": "module"` in package.json).
- Client-reachable code must import only client-safe packages or subpaths. Safe examples include `@bedrock/shared/money/math`, `@bedrock/shared/core/uuid`, and `@bedrock/shared/core/canon`. Server-only helpers live under `@bedrock/platform/observability/logger`, `@bedrock/platform/crypto`, and `@bedrock/platform/worker-runtime/worker-loop`.

### Import order

1. External packages (`drizzle-orm`, `zod`, etc.)
2. Internal `@bedrock/*` packages
3. Local relative imports (`./`, `../`)

Separate each group with a blank line.

### Error handling

- Define custom error classes extending `ServiceError` from `@bedrock/shared/core/errors`.
- Throw errors directly; do not return error codes.

```typescript
import { ServiceError } from "@bedrock/shared/core/errors";

export class OrderNotFoundError extends ServiceError {
    constructor(id: string) {
        super(`Order not found: ${id}`);
    }
}
```

### Validation

- Use Zod schemas for all input validation.
- Derive TypeScript types with `z.infer<typeof Schema>`.
- Create `validate*` helper functions that throw `ValidationError` on failure.

### Database

- Drizzle ORM with PostgreSQL.
- Schema uses `snake_case` column naming convention.
- Runtime table definitions must be colocated in the owning package under `src/schema.ts` or `src/schema/**`.
- Runtime code imports schemas through package exports such as `@bedrock/ledger/schema`, `@bedrock/counterparties/schema`, or `@bedrock/requisites/schema`.
- Runtime code imports shared database connection types from `@bedrock/platform/persistence` or `@bedrock/platform/persistence/drizzle`.
- In new and refactored packages, application/domain code should depend on ports and domain types; concrete Drizzle queries belong in `infra/`.
- Use transactions (`db.transaction(async (tx) => { ... })`) for multi-step mutations.
- Migration policy is baseline-only hard cutover.
  - Mandatory sequence: `db:nuke -> db:migrate -> db:seed`.
  - Legacy migration history/state is unsupported.

### Testing

- Vitest with globals enabled.
- Test utilities and fixtures from `@bedrock/test-utils`.
- Unit tests live in package-local `tests/**/*.test.ts`.
- Integration tests live in package-local `tests/integration/**/*.test.ts`.

## API Routes

- Framework: Hono with `@hono/zod-openapi`.
- Each route module is a function that receives `ctx` (app context) and returns a Hono app.
- Routes are defined via `createRoute` with Zod request/response schemas for automatic OpenAPI generation.
- Swagger UI is served at `/docs`.

## Build Requirements

- After modifying any files in `apps/api/`, you **must** rebuild the API package so that the generated type definitions (`dist/`) stay up to date (the web app imports the client types from the built output):

```bash
bun run build --filter=api
```
