# @bedrock/platform

Runtime infrastructure shared by apps, modules, and workflows.

## What it provides

- Persistence primitives and Postgres connection helpers
- Idempotency, observability, notifications, crypto, and AI adapters
- Object storage and worker-runtime infrastructure
- Shared runtime types used by apps and bounded-context packages

## Schema ownership

Table definitions are colocated with runtime domains:

- `packages/modules/*/src/schema.ts` or `schema/**`
- `packages/platform/src/*/schema.ts` when platform domains own schema

`apps/db` aggregates these domain schemas for migrations and seed tooling.

## Key design notes

- Financial IDs for TB integration use a custom `uint128` type (`numeric(39,0)` in Postgres).
- Idempotency is enforced with unique indexes in the owning bounded contexts.
- Platform does not own auth or business-domain runtime schemas.

## Scripts

- `bun run build`
- `bun run dev`
- `bun run check-types`
