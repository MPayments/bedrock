# Architecture

## Layers

- `@multihansa/common`
  - shared infra helpers
  - worker runtime primitives
  - SQL ports and helpers
  - generic idempotency/outbox operations
  - generic register and dimension utilities
- Core domains
  - `@multihansa/identity`
  - `@multihansa/assets`
  - `@multihansa/ledger`
  - `@multihansa/accounting`
  - `@multihansa/balances`
  - `@multihansa/reconciliation`
  - `@multihansa/documents`
- Business domains
  - `@multihansa/parties`
  - `@multihansa/treasury`
  - `@multihansa/reporting`
- Composition
  - `@multihansa/app`
  - `apps/api`
  - `apps/web`
  - `apps/workers`

## Ownership

- `packages/common` owns only shared, product-wide infrastructure code.
- `packages/domains/*` own runtime behavior and schema for their capability.
- `packages/db` owns aggregation, migrations, and seeds, but not runtime table declarations.

## Boundary rules

- `identity`, `assets`, `ledger` depend on `common` only.
- `accounting` depends on `common` and `ledger`.
- `balances` depends on `common` and `ledger`.
- `documents` depends on `common`, `accounting`, and `ledger`.
- `reconciliation` depends on `common`, `documents`, and `ledger`.
- `parties` depends on `common`, `assets`, and `ledger`.
- `treasury` depends on `common`, `assets`, `accounting`, `documents`, `ledger`, and `parties`.
- `reporting` depends on `common`, `accounting`, `balances`, `documents`, `identity`, `ledger`, and `parties`.
- `@multihansa/app` is the only package that composes the full product graph.

## Operational naming

- Worker API types are `Worker`, `WorkerDescriptor`, `WorkerRunContext`, and `WorkerRunResult`.
- Worker metrics use the `multihansa_worker_*` and `multihansa_workers_health` names.
