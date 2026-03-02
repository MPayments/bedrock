# AGENTS.md — Bedrock

## Project Overview

Bedrock is a financial platform (ledger, treasury, fees, FX, transfers) built as a **Turborepo monorepo**.

```
apps/        — applications (api: Hono, web: Next.js)
packages/    — shared domain and infrastructure packages
infra/       — Docker Compose (PostgreSQL, TigerBeetle)
```

Stack: TypeScript 5.8, Hono, Next.js, Drizzle ORM, PostgreSQL, TigerBeetle, Zod, Vitest, Pino.

## Workspace Topology

Runtime is consolidated into two workspace packages:

- `@bedrock/platform` (core domains)
- `@bedrock/modules` (business modules)

Core dependency direction:

- `@bedrock/foundation -> @bedrock/db -> @bedrock/platform -> @bedrock/modules -> apps/*`

Hard rules:

- No legacy runtime specifiers (`@bedrock/<domain>`) in runtime code.
- No runtime schema exports from platform/modules.
- DB schema ownership is only `packages/db/src/schema/**`.

## Package Manager and Runtime

- **Bun** is the package manager. Use `bun install`, `bun add`, `bun run`.
- **Node.js 24.x** is the runtime. Do NOT use Bun as a runtime.
- All scripts are invoked via `bun run <script>`, but the code itself executes under Node.js.
- When adding workspace dependencies, use the `workspace:*` protocol:

```jsonc
// package.json
"dependencies": {
    "@bedrock/db": "workspace:*",    // correct
    "@bedrock/kernel": "workspace:*" // correct
    // NOT "@bedrock/db": "*"
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

- `packages/platform/src/<domain>/**`
- `packages/modules/src/<domain>/**`
- `packages/platform/tests/<domain>/**`
- `packages/modules/tests/<domain>/**`

Within each domain folder, follow this layout:

| File / Directory | Purpose |
|---|---|
| `index.ts` | Public exports (service factory, types, errors, validation schemas) |
| `service.ts` | Service factory function |
| `errors.ts` | Custom error classes extending `ServiceError` from `@bedrock/kernel/errors` |
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

### Import order

1. External packages (`drizzle-orm`, `zod`, etc.)
2. Internal `@bedrock/*` packages
3. Local relative imports (`./`, `../`)

Separate each group with a blank line.

### Error handling

- Define custom error classes extending `ServiceError` from `@bedrock/kernel/errors`.
- Throw errors directly; do not return error codes.

```typescript
import { ServiceError } from "@bedrock/kernel/errors";

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
- All schema/table definitions must be in `packages/db/src/schema/**` only.
- Runtime code imports schema/types from `@bedrock/db/schema*` and `@bedrock/db/types`.
- Use transactions (`db.transaction(async (tx) => { ... })`) for multi-step mutations.
- Migration policy is baseline-only hard cutover.
  - Mandatory sequence: `db:nuke -> db:migrate -> db:seed`.
  - Legacy migration history/state is unsupported.

### Testing

- Vitest with globals enabled.
- Test utilities and fixtures from `@bedrock/test-utils`.
- Unit tests in `packages/{platform,modules}/tests/<domain>/*.test.ts`.
- Integration tests in `packages/{platform,modules}/tests/<domain>/integration/*.test.ts`.

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
