# Multihansa

Multihansa is a financial platform monorepo for ledger, treasury, fees, FX, documents, reporting, and identity.

## Package topology

- `apps/api` and `apps/web` are the product entrypoints.
- `apps/workers` runs the background workers.
- `packages/common` contains shared infrastructure helpers, SQL ports, worker primitives, and generic operations/register utilities.
- `packages/domains/*` contains all runtime capabilities:
  - `identity`
  - `assets`
  - `ledger`
  - `accounting`
  - `balances`
  - `reconciliation`
  - `documents`
  - `parties`
  - `treasury`
  - `reporting`
  - `multihansa-app` as the composition root
- `packages/db` aggregates schema, migrations, and seeds.
- `packages/ui` contains shared UI code.

## Dependency direction

- `@multihansa/common -> core domains -> business domains -> @multihansa/app -> apps/*`
- `@multihansa/db` aggregates schemas from `common` and domain packages only.

## Key rules

- No legacy framework import namespace or legacy framework package path remains in runtime code.
- Runtime packages must not import `@multihansa/db/client` or `@multihansa/db/seeds`.
- Schema ownership stays with the owning package under `src/schema.ts` or `src/schema/**`.
- `@multihansa/app` owns service wiring, worker registration, and document-module composition.
- After modifying `apps/api`, rebuild generated types with `bun run build --filter=multihansa-api`.

## Commands

- `bun run check:boundaries`
- `bun run check:workspace-deps`
- `bun run check-types`
- `bun run test`
- `bun run test:integration`
- `bun run build`

## Docs

- [`docs/architecture.md`](/Users/alexey.eramasov/dev/ledger/docs/architecture.md)
