# ADR 0002: Party Registry Consolidation

- Status: Accepted
- Date: 2026-03-22
- References:
  - [docs/adr/0001-bounded-context-explicit-architecture.md](/Users/alexey.eramasov/dev/ledger/docs/adr/0001-bounded-context-explicit-architecture.md)

## Context

Bedrock previously split party-related behavior across three runtime packages:

- `@bedrock/parties` for customers, counterparties, and counterparty groups
- `@bedrock/organizations` for organizations
- `@bedrock/requisites` for requisites, bindings, and provider CRUD

That split created duplicated composition work in apps and workflows, plus unstable cross-package query surfaces. The replacement implementation now lives in a single consolidated party registry module.

## Decision

Bedrock uses `@bedrock/parties` as the canonical runtime package for:

- customers
- counterparties and counterparty groups
- organizations
- requisites and organization requisite bindings
- requisite provider CRUD

The package exposes:

- root module composition through `createPartiesModule`
- shared contracts through `@bedrock/parties/contracts`
- shared schema through `@bedrock/parties/schema`
- public Drizzle adapters through `@bedrock/parties/adapters/drizzle`

There are no dedicated runtime packages for `@bedrock/organizations` or
`@bedrock/requisites`.

## Consequences

- Apps and workflows compose one parties module and use its slice APIs instead of separate organization or requisite services.
- Read-only/reporting consumers that need direct DB readers build local composition from `@bedrock/parties/adapters/drizzle` instead of importing shared `*/queries` package entrypoints.
- `apps/db` aggregates organization and requisite tables from `@bedrock/parties/schema`.
- External HTTP routes may stay split by resource (`/organizations`, `/requisites`, `/requisite-providers`), but those routes are backed by the canonical parties module.
