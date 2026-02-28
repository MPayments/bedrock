# @bedrock/db

Drizzle-based database package for the financial core.

## What it provides

- Shared `db` client (`packages/platform/db/src/client.ts`)
- Shared `Database` type
- Canonical schema export (`packages/platform/db/src/schema/index.ts`)

## Schema domains

- Ledger:
  - `ledger_operations`
  - `postings`
  - `tb_transfer_plans`
  - `outbox`
  - `book_account_instances`
- Treasury:
  - `counterparties`
  - `counterparty_groups`
  - `counterparty_group_memberships`
  - `customers`
  - `operational_accounts`
  - `operational_account_providers`
  - `payment_orders`
  - `settlements`
  - `fee_payment_orders`
  - `reconciliation_exceptions`
- FX:
  - `fx_rates`
  - `fx_rate_sources`
  - `fx_quotes`
  - `fx_quote_legs`
- Transfers:
  - `transfer_orders`
  - `transfer_events`

## Key design notes

- Financial IDs for TB integration use a custom `uint128` type (`numeric(39,0)` in Postgres).
- Idempotency is enforced with unique indexes in ledger, orders, transfers, and quotes.
- `fx_quotes` canonical definition lives in `packages/platform/db/src/schema/fx/quotes.ts`.

## Scripts

- `bun run build`
- `bun run dev`
- `bun run check-types`
- `bun run db:generate`
- `bun run db:migrate`
- `bun run db:nuke`
- `bun run db:push`
- `bun run db:studio`
