# ADR 0001: Bounded-Context Packages with Explicit Internal Architecture

- Status: Accepted
- Date: 2026-03-14
- References:
  - [ADR 0002: Party Registry Consolidation](./0002-requisites-topology.md)
  - [`scripts/check-architecture.mjs`](../../scripts/check-architecture.mjs)
  - [`scripts/check-manifests.mjs`](../../scripts/check-manifests.mjs)
  - [Herberto Graca, "DDD, Hexagonal, Onion, Clean, CQRS, … How I put it all together"](https://herbertograca.com/2017/11/16/explicit-architecture-01-ddd-hexagonal-onion-clean-cqrs-how-i-put-it-all-together/)

## Context

The repo is being reshaped into a modular monolith with extractable bounded-context packages. The top-level package taxonomy is already moving toward:

- `packages/shared/*`
- `packages/platform/*`
- `packages/modules/*`
- `packages/workflows/*`
- `packages/plugins/*`
- `packages/sdk/*`
- `packages/tooling/*`

This ADR codifies the next level of architecture inside those packages. The repo's executable reference now lives in the architecture and manifest guardrails, which enforce package boundaries and export discipline directly in CI.

The architectural reference is Herberto Graca's Explicit Architecture article, which separates:

- the application core from tools and delivery mechanisms
- ports from adapters
- fine-grained layers inside the application core
- coarse-grained components or bounded contexts as the primary packaging axis

## Decision

Bedrock uses:

1. package by bounded context at the workspace level
2. explicit `contracts`, `application`, `domain`, and `infra` layers inside runtime packages
3. ports defined by the application core and implemented by adapters in `infra`
4. thin apps and workflows that compose and trigger use cases instead of owning business logic

This is a repo-specific adaptation of Explicit Architecture, not a literal framework import. Bedrock keeps closure-based service factories and thin root facade entrypoints where that is the established package API.

## Package Kinds

The repo-wide package kinds are:

- `shared`: tiny shared kernel primitives only
- `platform`: technical runtime/tooling packages reused across contexts
- `modules`: bounded-context business packages
- `workflows`: cross-context orchestration
- `plugins`: extensions of a host context
- `sdk`: downstream-facing clients and reusable consumer packages
- `tooling`: repo-only build/lint/test/generator packages
- `apps`: delivery and composition entrypoints
- `ops`: infra/bootstrap entrypoints

The top-level packaging axis must remain business ownership, not technical layers.

## Runtime Package Shape

Current Bedrock packages use two approved shapes.

Slice-first layout, which is the dominant current shape across modules such as accounting, parties, treasury, and ledger:

```text
src/
  index.ts
  module.ts | service.ts | worker.ts
  [slice]/
    application/
      commands/
      queries/
      ports/
      contracts/   # optional when the slice exports DTOs directly
    domain/
    adapters/
      drizzle/
        schema.ts
```

Root-layered layout, which is used by packages such as documents:

```text
src/
  index.ts
  service.ts
  contracts/
  application/
    shared/
      context.ts
  domain/
  infra/
    drizzle/
      schema.ts
      repos/
```

Both shapes are valid. The rules in this ADR are about dependency direction and ownership, not about forcing taxonomy-only renames. Preserve a package's existing shape unless the change is explicitly migrating that package.

In root-layered packages, `application/shared/context.ts` is the default place for package-local dependency normalization and logger/context setup. In slice-first packages, keep context, contracts, ports, and adapters inside the owning slice.

Additional package-local folders are allowed when they are part of the public model or package assets, for example `packs/` in accounting.

### Layer Responsibilities

- `contracts/`
  - public DTOs
  - Zod schemas for inputs, outputs, and public contracts
  - public command/query payload types
- `application/`
  - use cases
  - application services
  - commands/queries
  - application ports
  - shared service context and dependency normalization
  - orchestration of domain logic
- `domain/`
  - business concepts, aggregates, policies, and domain types
  - pure business rules
  - domain services
  - domain-only types
- `infra/` or slice-local `adapters/`
  - Drizzle tables and repositories
  - external integration adapters
  - query-support SQL
  - implementations of application ports

## Dependency Direction

Dependencies point inward.

- `domain` may depend on:
  - other `domain` files in the same package
  - `shared`
- `contracts` may depend on:
  - `domain`
  - `shared`
- `domain` must not depend on `contracts`.
If a type is both public and domain-native, it belongs in `domain` or `shared`, not `contracts`.
- `application` may depend on:
  - `domain`
  - `contracts`
  - application `ports`
  - `shared`
- `infra` may depend on:
  - `application`
  - `domain`
  - `contracts`
  - `shared`
  - `platform`
  - concrete external libraries and tool APIs
- `apps` and `workflows` may depend on:
  - public package exports only
  - `shared`
  - `platform`

Within a package:

- `domain` must not depend on Drizzle, database clients, transport code, or concrete adapters
- `application` must not define tables or embed tool-specific APIs as part of its core model
- `infra` implements ports; it does not define business rules that belong in `domain`

## Composition Rules

Ports belong to the application core and are shaped by the core's needs.

- Primary or driving adapters:
  - HTTP routes
  - workers
  - CLI commands
  - workflow triggers
- Secondary or driven adapters:
  - repositories
  - database adapters
  - messaging adapters
  - external API adapters

Concrete adapters should be instantiated in:

- module-root composition
- apps
- workflows

They should not be instantiated deep inside use-case code unless the package is still in migration and has not yet been brought up to this standard.

## Public API Rules

Every runtime package must expose only intentional entrypoints via `package.json#exports`.

Default runtime exports are:

- `"."`
- `"./contracts"`

Common additional exports that are already part of the Bedrock module surface include:

- `"./schema"` for runtime-owned Drizzle schema fragments
- `"./queries"` for stable read/query entrypoints
- `"./worker"` for worker definitions or worker adapter factories
- `"./model"` or `"./read-model"` for intentional host/read-model types
- `"./plugins"` for host module plugin APIs
- `"./repository"` for narrow integration points intentionally consumed by apps/workflows
- domain-specific stable subpaths such as `"./providers"`, `"./ids"`, `"./constants"`, or `"./packs/*"`

Additional exports are allowed only when they represent a stable, intentional public surface with a clear owner and consumers.

Deep imports into non-exported files are forbidden.

## Naming Rules

- Do not create new generic `internal/` directories in runtime packages.
- Do not place public DTO/Zod schemas under DB schema folders.
- Root facade entrypoints such as `ledger.ts`, `documents.ts`, `organizations.ts`, `reports.ts`, or `periods.ts` are public facade/composition helpers.
- Internal package code must not route through root facade entrypoints.
- Root facade entrypoints must not contain business rules, raw SQL, or tool-specific logic that belongs in `infra`.

## Ownership Rules

- A context owns its write model and runtime table definitions.
- `apps/db` is the schema aggregator for migrations, reset, and seed/bootstrap orchestration; it composes schema exported by owning packages and must not become the owner of domain tables.
- Cross-context reads are allowed only through exported query contracts, projections/read models,
or narrowly scoped infra-level migration queries documented by the owning package.
- `infra/drizzle/schema` or `<slice>/adapters/drizzle/schema` may import another package's exported `./schema` surface when needed for foreign keys, references, or relational integrity.
- Cross-context schema references are an infra concern only. They must not leak into `application/` or `domain/`.
- Domain code must not read foreign-owned data directly.
- Application write paths must not join or mutate foreign-owned tables.

## Cross-Context Dependency Rules

- A module must not import another module's `application`, `domain`, `infra`, or non-exported files.
- Direct module-to-module imports, when allowed, are limited to stable exported contract surfaces.
- Multi-context orchestration belongs in `workflows` or app composition.
- Cross-context mutation is forbidden.

## Reference Set

No single module captures every approved pattern. Use this reference set instead:

Examples:

- root-layered context/service composition:
  - `/Users/alexey.eramasov/dev/ledger/packages/modules/documents/src/service.ts`
  - `/Users/alexey.eramasov/dev/ledger/packages/modules/documents/src/application/shared/context.ts`
- thin service facade exported from the application root:
  - `/Users/alexey.eramasov/dev/ledger/packages/modules/iam/src/service.ts`
  - `/Users/alexey.eramasov/dev/ledger/packages/modules/iam/src/application/index.ts`
- slice-first domain and package-local assets:
  - `/Users/alexey.eramasov/dev/ledger/packages/modules/accounting/src/packs/domain/compile-pack.ts`
  - `/Users/alexey.eramasov/dev/ledger/packages/modules/accounting/src/packs/domain/resolve-posting-plan.ts`
  - `/Users/alexey.eramasov/dev/ledger/packages/modules/accounting/src/packs/schema.ts`
- slice-local application ports:
  - `/Users/alexey.eramasov/dev/ledger/packages/modules/accounting/src/chart/application/ports/chart.store.ts`
  - `/Users/alexey.eramasov/dev/ledger/packages/modules/accounting/src/packs/application/ports/pack.repository.ts`
  - `/Users/alexey.eramasov/dev/ledger/packages/modules/accounting/src/periods/application/ports/period.repository.ts`
- host module surfaces and intentional extra exports:
  - `/Users/alexey.eramasov/dev/ledger/packages/modules/documents/package.json`
  - `/Users/alexey.eramasov/dev/ledger/packages/modules/documents/src/index.ts`
- adapter implementations and schema cross-context references:
  - `/Users/alexey.eramasov/dev/ledger/packages/modules/accounting/src/chart/adapters/drizzle/chart.store.ts`
  - `/Users/alexey.eramasov/dev/ledger/packages/modules/documents/src/infra/drizzle/schema.ts`
  - `/Users/alexey.eramasov/dev/ledger/packages/modules/parties/src/organizations/adapters/drizzle/schema.ts`

Together these show the intended target architecture. New and refactored packages should align with these patterns without forcing every module into the exact same folder taxonomy.

## Consequences

This ADR sets the standard for all new and refactored packages.

Immediate consequences:

- repo docs and agent instructions must reflect this structure
- future refactors should move `internal/` code into named layer folders
- future boundary checks should validate layer-level imports, not only package-level imports
- module generators should produce this structure by default

This ADR defines the allowed current shapes and the target dependency rules for migrations and new work. Existing slice-first `adapters/` packages are valid; migration to root-layered `infra/` should be deliberate rather than churn for its own sake.
