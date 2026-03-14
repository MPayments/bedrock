# AGENTS.md — Bedrock

## Project Overview

Bedrock is a financial platform (ledger, treasury, fees, FX, transfers) built as a **Turborepo monorepo**.

```
apps/        — applications (api: Hono, web: Next.js)
packages/    — shared domain and infrastructure packages
ops/         — infra and bootstrap entrypoints
```

Stack: TypeScript 5.8, Hono, Next.js, Drizzle ORM, PostgreSQL, TigerBeetle, Zod, Vitest, Pino.

## Workspace Topology

Runtime is split by package kind:

- `packages/shared/*` for stable shared primitives
- `packages/modules/*` for business capabilities, published as flat `@bedrock/<name>` packages
- `packages/workflows/*` for cross-module orchestration
- `packages/platform/*` for technical platform/runtime packages
- `packages/plugins/*` for document plugins and plugin SDKs
- `packages/sdk/*` for downstream API clients and reusable UI packages

Core dependency direction:

- `shared -> modules/workflows/platform/plugins/sdk -> apps/*`
- `@bedrock/platform-postgres` aggregates schemas from owning packages and provides the DB client/migrations.
- `@bedrock/bootstrap-db` owns DB seeds/bootstrap runners.

Hard rules:

- No legacy runtime specifiers such as `@bedrock/application/*`, `@bedrock/platform/*`, or `@bedrock/modules/*`.
- Runtime imports must go through declared package exports only. No cross-package `internal/**` imports.
- Domain schema ownership is colocated under:
  - `packages/modules/*/src/schema.ts` or `schema/**`
  - `packages/platform/*/src/schema.ts` or `schema/**` when platform packages own schema
- `@bedrock/platform-postgres` must not own domain table declarations; it only aggregates domain schemas for client/migrations.
- `@bedrock/bootstrap-db` is the only workspace package that should own shared seed/bootstrap orchestration.
- Business packages must not import `@bedrock/platform-postgres` root/client from runtime code. Only apps, approved tooling/scripts, seeds/bootstrap, and integration tests may do so.

## Package Manager and Runtime

- **Bun** is the package manager. Use `bun install`, `bun add`, `bun run`.
- **Node.js 24.x** is the runtime. Do NOT use Bun as a runtime.
- All scripts are invoked via `bun run <script>`, but the code itself executes under Node.js.
- When adding workspace dependencies, use the `workspace:*` protocol:

```jsonc
// package.json
"dependencies": {
    "@bedrock/platform-postgres": "workspace:*",     // correct
    "@bedrock/core": "workspace:*", // correct
    "@bedrock/ledger": "workspace:*"  // correct
    // NOT "@bedrock/platform-postgres": "*"
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

Dependencies are declared as a `Deps` type. A context factory in `internal/context.ts` transforms them into an internal `Context`:

```typescript
// src/internal/context.ts
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

When a service grows large, split it into **command handlers** inside a `commands/` directory. The service file becomes a thin facade that composes them.

### Directory layout

```
packages/xxx/src/
  service.ts            — facade, composes handlers
  commands/
    do-something.ts     — createDoSomethingHandler(context)
    do-other.ts         — createDoOtherHandler(context)
  internal/
    context.ts          — Deps/Context types and factory
```

### Command handler pattern

Each handler is a closure that receives the service context:

```typescript
// src/commands/do-something.ts
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
- `packages/platform/<platform>/src/**`
- `packages/plugins/<plugin>/src/**`
- `packages/sdk/<sdk>/src/**`
- package-local `tests/**`

Within each package, this is the common default layout:

| File / Directory | Purpose |
|---|---|
| `index.ts` | Public exports (service factory, types, errors, validation schemas) |
| `service.ts` | Service factory function |
| `errors.ts` | Custom error classes extending `ServiceError` from `@bedrock/core/errors` |
| `validation.ts` | Zod schemas, derived types via `z.infer`, validator helpers |
| `internal/context.ts` | `Deps` / `Context` types and context factory |
| `commands/` | Command handlers (when the service is large) |

## Code Conventions

### Naming

- Files: `kebab-case.ts`
- Functions and variables: `camelCase`
- Types and interfaces: `PascalCase`
- Constants: `UPPER_SNAKE_CASE`

### Modules

- All packages use ESM (`"type": "module"` in package.json).
- Client-reachable code must import only client-safe packages or subpaths. Safe examples include `@bedrock/money/math`, `@bedrock/core/uuid`, and `@bedrock/core/canon`. Server-only helpers live under `@bedrock/platform-observability/logger`, `@bedrock/platform-crypto`, and `@bedrock/platform-worker-runtime/worker-loop`.

### Import order

1. External packages (`drizzle-orm`, `zod`, etc.)
2. Internal `@bedrock/*` packages
3. Local relative imports (`./`, `../`)

Separate each group with a blank line.

### Error handling

- Define custom error classes extending `ServiceError` from `@bedrock/core/errors`.
- Throw errors directly; do not return error codes.

```typescript
import { ServiceError } from "@bedrock/core/errors";

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
- Runtime code imports shared database connection types from `@bedrock/platform-postgres/db/types`.
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
