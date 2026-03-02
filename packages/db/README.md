# @bedrock/db

Drizzle-based database package for the financial core.

## What it provides

- Shared `db` client (`packages/db/src/client.ts`)
- Shared `Database` type
- Canonical schema aggregator (`packages/db/src/schema/index.ts`)
- Centralized migrations (`packages/db/migrations`)

## Schema ownership

Table definitions are colocated in domain packages and imported via
`@bedrock/<domain>/schema` into the central aggregator.

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
