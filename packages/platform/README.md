# @bedrock/platform

Merged platform package for runtime infrastructure.

## What it provides

- Shared `db` client (`packages/platform/src/postgres/client.ts`)
- Shared `Database` type
- Aggregated schema registry (`packages/platform/src/postgres/schema/index.ts`)
- Centralized migrations (`packages/platform/migrations`)
- DB bootstrap/seeding now lives in `@bedrock/bootstrap-db`

## Schema ownership

Table definitions are colocated with runtime domains:

- `packages/modules/*/src/schema.ts` or `schema/**`
- `packages/platform/src/*/schema.ts` when platform domains own schema

`@bedrock/platform/postgres` aggregates these domain schemas for client construction and
migrations.

## Key design notes

- Financial IDs for TB integration use a custom `uint128` type (`numeric(39,0)` in Postgres).
- Idempotency is enforced with unique indexes in ledger, orders, transfers, and quotes.
- `fx_quotes` canonical definition lives in `packages/modules/fx/src/schema/quotes.ts`.

## Scripts

- `bun run build`
- `bun run dev`
- `bun run check-types`
- `bun run db:generate`
- `bun run db:migrate`
- `bun run db:nuke`
- `bun run db:push`
- `bun run db:studio`
