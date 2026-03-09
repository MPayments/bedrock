# Bedrock Architecture

## Summary

The repo is intentionally split into two identities:

- `Bedrock` is the reusable framework layer under `packages/bedrock/*`
- `Multihansa` is the product layer under `packages/domains/*`, `packages/sdk/*`, `packages/tooling/*`, `packages/db`, and `apps/*`

This keeps framework primitives portable while the product packages own business workflows, UI, tooling, and data seeding.

## Layer Map

| Layer | Examples | Responsibility |
|---|---|---|
| Bedrock kernel | `@bedrock/kernel`, `@bedrock/zod`, `@bedrock/sql` | Low-level primitives, schema helpers, runtime utilities |
| Bedrock primitives | `@bedrock/modules`, `@bedrock/ledger`, `@bedrock/documents` | Reusable framework runtimes, ports, adapters, definitions |
| Multihansa domains | `@multihansa/payments`, `@multihansa/fx`, `@multihansa/app` | Business services, module bundles, documents, reporting |
| Multihansa SDK/tooling | `@multihansa/ui`, `@multihansa/api-client`, `@multihansa/eslint-config` | Product-facing SDK and repo tooling |
| Composition | `multihansa-api`, `multihansa-web`, `multihansa-workers` | Runtime adapters and deployment entrypoints |
| DB aggregation | `@multihansa/db` | Aggregated schema, client, migrations, seeds |

Dependency direction:

```text
@bedrock/kernel|zod|sql
  -> other @bedrock/* packages
  -> @multihansa/* packages
  -> apps/*
```

Hard rules:

- `packages/bedrock/*` must not import `@multihansa/*`
- `@multihansa/db` aggregates schema; it does not define product runtime tables directly
- `apps/web` is restricted to contracts, validation surfaces, `@multihansa/ui`, and `@multihansa/api-client`

## Runtime Composition

The product composition source of truth is [`packages/domains/multihansa-app/src/bundle.ts`](/Users/alexey.eramasov/dev/ledger/packages/domains/multihansa-app/src/bundle.ts).

- Bedrock module graph/runtime lives in [`packages/bedrock/modules/src/app.ts`](/Users/alexey.eramasov/dev/ledger/packages/bedrock/modules/src/app.ts)
- API composes the app in [`apps/api/src/runtime.ts`](/Users/alexey.eramasov/dev/ledger/apps/api/src/runtime.ts)
- Workers compose the same bundle in [`apps/workers/src/main.ts`](/Users/alexey.eramasov/dev/ledger/apps/workers/src/main.ts)

The result is one Bedrock runtime model with a separate Multihansa product bundle layered on top.

## Schema Ownership

Framework schema lives with the owning Bedrock package, for example:

- [`packages/bedrock/ledger/src/schema.ts`](/Users/alexey.eramasov/dev/ledger/packages/bedrock/ledger/src/schema.ts)
- [`packages/bedrock/documents/src/schema.ts`](/Users/alexey.eramasov/dev/ledger/packages/bedrock/documents/src/schema.ts)

Product schema lives with the owning Multihansa package, for example:

- [`packages/domains/fx/src/schema/quotes.ts`](/Users/alexey.eramasov/dev/ledger/packages/domains/fx/src/schema/quotes.ts)
- [`packages/domains/requisites/src/schema.ts`](/Users/alexey.eramasov/dev/ledger/packages/domains/requisites/src/schema.ts)

Aggregation happens in [`packages/db/src/schema/index.ts`](/Users/alexey.eramasov/dev/ledger/packages/db/src/schema/index.ts).

## Guardrails

The rename is enforced by repo checks:

- [`dependency-cruiser.cjs`](/Users/alexey.eramasov/dev/ledger/dependency-cruiser.cjs)
- [`scripts/check-boundaries.mjs`](/Users/alexey.eramasov/dev/ledger/scripts/check-boundaries.mjs)
- [`scripts/check-deprecated-imports.mjs`](/Users/alexey.eramasov/dev/ledger/scripts/check-deprecated-imports.mjs)
- [`scripts/check-worker-runtime.mjs`](/Users/alexey.eramasov/dev/ledger/scripts/check-worker-runtime.mjs)

These checks reject:

- framework-to-product runtime imports
- old pre-split runtime specifiers
- old non-framework `@bedrock/*` product specifiers
- DB client/seeds imports from runtime packages
