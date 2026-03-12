# Bedrock Implementation Details

## Service Shape

Services use closure factories, not classes.

Pattern:

- dependency type in `internal/context.ts`
- context factory in `internal/context.ts`
- thin facade in `service.ts`
- command handlers under `commands/*` when the surface grows

Representative files:

- [`packages/domains/customers/src/service.ts`](/Users/alexey.eramasov/dev/ledger/packages/domains/customers/src/service.ts)
- [`packages/domains/customers/src/internal/context.ts`](/Users/alexey.eramasov/dev/ledger/packages/domains/customers/src/internal/context.ts)
- [`packages/bedrock/workers/src/fleet.ts`](/Users/alexey.eramasov/dev/ledger/packages/bedrock/workers/src/fleet.ts)

## Worker Runtime

Bedrock owns only generic worker runtime primitives:

- worker descriptors and interval resolution: [`packages/bedrock/workers/src/descriptors.ts`](/Users/alexey.eramasov/dev/ledger/packages/bedrock/workers/src/descriptors.ts)
- worker fleet startup/shutdown: [`packages/bedrock/workers/src/fleet.ts`](/Users/alexey.eramasov/dev/ledger/packages/bedrock/workers/src/fleet.ts)

Multihansa owns the product composition:

- service factory: [`packages/domains/multihansa-app/src/bundle.ts`](/Users/alexey.eramasov/dev/ledger/packages/domains/multihansa-app/src/bundle.ts)
- worker descriptors and worker factories: [`packages/domains/multihansa-app/src/workers.ts`](/Users/alexey.eramasov/dev/ledger/packages/domains/multihansa-app/src/workers.ts)

## App Composition

Entry points consume explicit Multihansa composition helpers:

- API: [`apps/api/src/runtime.ts`](/Users/alexey.eramasov/dev/ledger/apps/api/src/runtime.ts)
- Workers: [`apps/workers/src/main.ts`](/Users/alexey.eramasov/dev/ledger/apps/workers/src/main.ts)

This is the intended shape after the rename:

- Bedrock stays generic and framework-branded
- Multihansa stays product-branded

## Schema Rules

Schema must live with the owning package:

- `packages/bedrock/<package>/src/schema.ts` or `schema/**`
- `packages/domains/<package>/src/schema.ts` or `schema/**`

`@multihansa/db` is the aggregation layer:

- schema registry: [`packages/db/src/schema/index.ts`](/Users/alexey.eramasov/dev/ledger/packages/db/src/schema/index.ts)
- client/types exports: [`packages/db/package.json`](/Users/alexey.eramasov/dev/ledger/packages/db/package.json)

Forbidden runtime pattern:

- importing `@multihansa/db/client` or `@multihansa/db/seeds` from `packages/bedrock/*` or `packages/domains/*`

## Guardrail Scripts

The repository checks this split with:

- [`scripts/check-boundaries.mjs`](/Users/alexey.eramasov/dev/ledger/scripts/check-boundaries.mjs)
- [`scripts/check-workspace-deps.mjs`](/Users/alexey.eramasov/dev/ledger/scripts/check-workspace-deps.mjs)
- [`scripts/check-deprecated-imports.mjs`](/Users/alexey.eramasov/dev/ledger/scripts/check-deprecated-imports.mjs)
- [`scripts/check-worker-runtime.mjs`](/Users/alexey.eramasov/dev/ledger/scripts/check-worker-runtime.mjs)

## Naming Rules

- use `@bedrock/*` only for framework packages
- use `@multihansa/*` only for product packages, SDK, tooling, and DB
- keep Bedrock-branded exported symbols only in framework packages
- keep Multihansa-branded exported symbols in product composition packages such as `@multihansa/app`
