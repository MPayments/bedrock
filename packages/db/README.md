# @bedrock/db

Drizzle-based database package for the financial core.

## What it provides

- Shared `db` client (`packages/db/src/client.ts`)
- Shared `Database` type
- Canonical schema export (`packages/db/src/schema/index.ts`)

## Schema domains

- Ledger:
  - `journal_entries`
  - `journal_lines`
  - `tb_transfer_plans`
  - `outbox`
  - `ledger_accounts`
- Treasury:
  - `organizations`
  - `customers`
  - `bank_accounts`
  - `payment_orders`
  - `settlements`
- FX:
  - `fx_rates`
  - `fx_quotes`
- Transfers:
  - `internal_transfers`

## Key design notes

- Financial IDs for TB integration use a custom `uint128` type (`numeric(39,0)` in Postgres).
- Idempotency is enforced with unique indexes in journal/orders/transfers/quotes.
- `fx_quotes` canonical definition lives in `packages/db/src/schema/fx/quotes.ts`.

## Scripts

- `npm run build`
- `npm run dev`
- `npm run check-types`
- `npm run db:generate`
- `npm run db:migrate`
- `npm run db:push`
- `npm run db:studio`
