# ADR 0002: Requisites Topology and Provider Ownership

- Status: Accepted
- Date: 2026-03-15
- References:
  - [PLAN1.md](/Users/alexey.eramasov/dev/ledger/PLAN1.md)
  - [docs/architecture/module-context-matrix.md](/Users/alexey.eramasov/dev/ledger/docs/architecture/module-context-matrix.md)
  - [docs/adr/0001-bounded-context-explicit-architecture.md](/Users/alexey.eramasov/dev/ledger/docs/adr/0001-bounded-context-explicit-architecture.md)

## Context

The legacy `@bedrock/requisites` module mixed three different responsibilities:

- owner-attached organization requisites
- owner-attached counterparty requisites
- provider catalog CRUD

That packaging violates the ownership rules from ADR 0001. Requisites are attached state owned by the party they belong to, while provider catalog CRUD is shared reference data with its own stable public surface.

Bedrock still needs a unified requisites UX and HTTP surface, but that composition belongs at the app boundary rather than in a dedicated runtime module.

## Decision

Bedrock uses the following topology:

- `@bedrock/ledger` remains a reusable business kernel in `packages/modules/ledger`
- `@bedrock/requisite-providers` owns the provider catalog, provider validation, provider schema, and provider CRUD
- organization-owned requisites belong to `@bedrock/organizations`
- counterparty-owned requisites belong to `@bedrock/parties`
- shared validation and labeling helpers live in `@bedrock/shared/requisites`
- the unified `/requisites` surface is app composition only; `@bedrock/requisites` does not exist

## Consequences

- The dedicated provider route stays `/requisite-providers` and is backed directly by `@bedrock/requisite-providers`.
- The temporary unified `/requisites` surface is composed at the app boundary and delegates by owner semantics instead of treating requisites as a permanent standalone domain.
- Organization and counterparty runtime code import their own requisite contracts and repositories from their owning packages.
- Shared read-only helpers for requisite kinds, owner types, field validation, and display labeling come from `@bedrock/shared/requisites`.
