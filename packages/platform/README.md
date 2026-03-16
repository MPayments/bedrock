# @bedrock/platform

Merged platform package for runtime infrastructure.

## What it provides

- Shared `Database` and `Transaction` types
- Generic Postgres connection helpers (`packages/platform/src/persistence/postgres.ts`)
- Auth and idempotency infrastructure
- Worker runtime, crypto, and observability helpers

## Schema ownership

Table definitions are colocated with runtime domains:

- `packages/modules/*/src/schema.ts` or `schema/**`
- `packages/platform/src/*/schema.ts` when platform domains own schema

`apps/db` aggregates these domain schemas for migrations and seed tooling.

## Key design notes

- Financial IDs for TB integration use a custom `uint128` type (`numeric(39,0)` in Postgres).
- Idempotency is enforced with unique indexes in ledger, orders, transfers, and quotes.
- `fx_quotes` canonical definition lives in `packages/modules/fx/src/schema/quotes.ts`.

## Scripts

- `bun run build`
- `bun run dev`
- `bun run check-types`
