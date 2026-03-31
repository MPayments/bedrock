# CRM Architecture

## Overview

The CRM domain originates from the **MPayments** application (NestJS + Next.js) which was merged into Bedrock. MPayments handled operational workflows: client onboarding, payment applications, FX calculations, deal execution, document generation, and agent commissions.

The merge happened in phases (see `MERGE.md`). In **Phase 2**, all MPayments business logic was ported into a single `@bedrock/operations` module with `ops_*` prefixed tables. Then the operations module was **decomposed** into proper bounded-context modules following Bedrock's DDD architecture:

| Module | Package | Responsibility |
|---|---|---|
| **Parties** | `@bedrock/parties` | Customers, counterparties, organizations, requisites, sub-agent profiles |
| **Deals** | `@bedrock/deals` | Deal lifecycle: creation, status transitions, participants, legs, bonuses |
| **Calculations** | `@bedrock/calculations` | FX/fee calculations with versioned snapshots and line items |
| **Agreements** | `@bedrock/agreements` | Service agreements with versioned terms and fee rules |

Supporting pieces:
- **CRM Tasks** — `crm_tasks` table owned by `apps/crm`, not a module
- **Activity Log** — handled at API route level (`routes/activity.ts`)
- **Agent Profiles** — in `@bedrock/iam` (agentProfiles table, linked to `user`)
- **Customer Auth** — unified in `@bedrock/iam` via better-auth, role-based (admin/user/agent/customer)

---

## Module Map

### @bedrock/parties

**Location:** `packages/modules/parties/`

**Subdomains** (each has its own application/adapters/contracts):
- `customers/` — customer workspace records
- `counterparties/` — external/internal parties with groups and assignments
- `organizations/` — legal entities (own companies)
- `requisites/` — bank accounts, providers, organization-requisite bindings
- `sub-agent-profiles/` — sub-agent commission configurations

**Tables:**
`customers`, `counterparties`, `counterparty_groups`, `counterparty_group_memberships`, `customer_counterparty_assignments`, `organizations`, `requisites`, `requisite_providers`, `organization_requisite_bindings`, `sub_agent_profiles`

**Service interface:**
```
PartiesModule {
  customers:        { commands: { create, update, remove }, queries: { findById, list, listByIds, findByExternalRef } }
  counterparties:   { commands: { create, update, remove, createGroup, updateGroup, removeGroup }, queries: { list, findById, listGroups } }
  organizations:    { commands: { create, update, remove }, queries: { list, findById } }
  requisites:       { commands: { create, update, remove, createProvider, updateProvider, removeProvider, upsertBinding }, queries: { list, findById, listOptions, listProviders, findProviderById, getBinding, resolveBindings } }
  subAgentProfiles: { commands: { create, update, remove }, queries: { findById, list } }
}
```

**Key deps:** `@bedrock/currencies`, `@bedrock/platform/persistence`, documents read port

---

### @bedrock/deals

**Location:** `packages/modules/deals/`

**Structure:** flat DDD (application/, domain/, adapters/ at root level, not per-subdomain)

**Tables:**
`deals`, `deal_legs`, `deal_participants`, `deal_status_history`, `deal_agent_bonuses`, `deal_approvals`, `deal_calculation_links`, `deal_extensions`

**Enums:** `deal_type`, `deal_status`, `deal_leg_kind`, `deal_participant_role`, `deal_approval_type`, `deal_approval_status`

**Service interface:**
```
DealsModule {
  deals: {
    commands: { create, updateIntake, attachCalculation, transitionStatus }
    queries: { findById, list }
  }
}
```

**Key deps:** `@bedrock/agreements`, `@bedrock/calculations`, `@bedrock/parties` (via references port), `@bedrock/currencies`

---

### @bedrock/calculations

**Location:** `packages/modules/calculations/`

**Tables:**
`calculations`, `calculation_snapshots`, `calculation_lines`

**Enums:** `calculation_rate_source`, `calculation_line_kind`

**Service interface:**
```
CalculationsModule {
  calculations: {
    commands: { create, archive }
    queries: { findById, list }
  }
}
```

**Key deps:** `@bedrock/currencies`, `@bedrock/treasury` (via references port for FX quotes)

---

### @bedrock/agreements

**Location:** `packages/modules/agreements/`

**Tables:**
`agreements`, `agreement_versions`, `agreement_fee_rules`, `agreement_parties`

**Enums:** `agreement_fee_rule_kind`, `agreement_fee_rule_unit`, `agreement_party_role`

**Service interface:**
```
AgreementsModule {
  agreements: {
    commands: { create, update, archive }
    queries: { findActiveByCustomerId, findById, list }
  }
}
```

**Key deps:** `@bedrock/parties` (customers, organizations, requisites via references port), `@bedrock/currencies`

---

## Entity Transformation (MPayments -> Bedrock)

### Tables that were redesigned (not just renamed)

| MPayments entity | Bedrock tables | What changed |
|---|---|---|
| `clients` | `customers` + `counterparties` + `customer_counterparty_assignments` | Split: customer = workspace owner, counterparty = the external party. Assignments link them. Localized text (i18n), INN/KPP/OGRN moved to counterparty fields. |
| `agent_organizations` | `organizations` | Generalized to any legal entity, not just agent-specific. Added country code, party kind. |
| `agent_organization_bank_details` | `requisites` + `requisite_providers` + `organization_requisite_bindings` | Generalized: requisites can belong to organizations OR counterparties (owner_type). Providers are separate entities. Bindings link requisites to organizations with accounting metadata. |
| `sub_agents` | `sub_agent_profiles` | Renamed, now in parties module. Commission structure preserved. |
| `applications` | Part of deal intake flow | Applications concept absorbed into deal creation (`createDeal` with intake data). No separate applications table. |
| `calculations` | `calculations` + `calculation_snapshots` + `calculation_lines` | Versioned: each calculation has immutable snapshots. Line items are separate entities with kind (COMMISSION, SPREAD, etc.). |
| `deals` | `deals` + `deal_legs` + `deal_participants` + `deal_status_history` + `deal_extensions` + `deal_agent_bonuses` + `deal_approvals` + `deal_calculation_links` | Fully decomposed: legs = debit/credit movements, participants = remitter/beneficiary roles, extensions = invoice/contract/bank metadata, approvals = workflow. |
| `contracts` | `agreements` + `agreement_versions` + `agreement_fee_rules` + `agreement_parties` | Versioned: agreement has versions with effective dates. Fee rules are separate with kind/unit. Parties link customers/organizations to agreement. |
| `agent_bonus` | `deal_agent_bonuses` | Now a child table of deals, not standalone. |
| `todos` | `crm_tasks` | Moved to CRM app. New fields: assignee, assigned_by, deal link, sort order. |
| `activity_log` | No dedicated table | Handled at API route level. |

### Tables removed (auth, Telegram)

| MPayments table | Status | Notes |
|---|---|---|
| `user` (mpayments) | Replaced by bedrock `user` | Unified auth via better-auth |
| `session`, `account`, `verification` | Replaced by bedrock auth tables | `@bedrock/iam` |
| `telegraf_sessions` | Removed | Bot not yet rebuilt |

---

## Business Flows

### Deal Pipeline (primary CRM flow)

```
1. Customer/Agent creates a deal (createDeal command)
   - Links: customer, agreement, organization
   - Status: DRAFT
   - Creates deal_participants (REMITTER, BENEFICIARY)

2. Agent fills intake data (updateDealIntake)
   - Sets deal_extensions (invoice details, bank details)
   - Adds deal_legs (DEBIT/CREDIT with amounts and currencies)

3. Calculation is created and attached (attachCalculation)
   - calculation -> calculation_snapshot -> calculation_lines
   - Links to FX quote from @bedrock/treasury
   - deal_calculation_links joins deal <-> calculation

4. Deal status transitions (transitionStatus)
   - DRAFT -> EXECUTION -> SETTLED (or CANCELLED)
   - Each transition logged in deal_status_history
   - Approvals may be required (deal_approvals)

5. Documents generated (document-generation workflow)
   - Contracts, invoices, acceptance acts from DOCX templates
   - Stored via @bedrock/files + S3

6. Commission calculated (deal-commission workflow)
   - deal_agent_bonuses record created
   - Posted to ledger via @bedrock/ledger
```

### Customer Portal Flow

```
1. Customer authenticates (customer-auth routes, magic link)
2. CustomerPortalWorkflow provides scoped access:
   - View own deals, calculations, counterparties
   - Create deals (limited intake)
   - Cannot see other customers' data
```

### Agreement Flow

```
1. Create agreement for customer + organization pair
2. Add fee rules (commission %, fixed amounts)
3. Add parties (payer, payee roles)
4. Agreement versioned — updates create new version
5. Deals reference active agreement for fee calculation
```

---

## Composition (apps/api)

All modules are wired in `apps/api/src/composition/`:

```
composition/
  core.ts          — Logger, IAM, Accounting, Ledger (foundation layer)
  application.ts   — Parties, Agreements, Calculations, Deals, Files, Treasury, Documents, Workflows

context.ts         — AppContext interface combining all services
app.ts             — Route registration under /v1/*
```

**Wiring order** (respects dependency graph):
1. Core services (logger, IAM, accounting, ledger)
2. Currencies service (used by all CRM modules)
3. Parties module (no CRM module deps)
4. Agreements module (references: customers, organizations, requisites from parties)
5. Calculations module (references: FX quotes from treasury)
6. Deals module (references: agreements, calculations, parties)
7. Workflows (document-generation, customer-portal, deal-commission)

Each module receives:
- `db` — Drizzle database instance
- `persistence` — transaction/unit-of-work factory
- `logger`, `idempotency` — platform services
- `currencies` — currency validation port
- Module-specific `references` port — cross-module reads without direct dependency

---

## API Routes

### CRM-specific routes (under `/v1/`)

| Route | File | Module | Description |
|---|---|---|---|
| `/v1/customers` | `routes/customers.ts` | Parties | Customer CRUD, workspace management |
| `/v1/counterparties` | `routes/counterparties.ts` | Parties | Counterparty CRUD |
| `/v1/counterparty-groups` | `routes/counterparty-groups.ts` | Parties | Counterparty grouping |
| `/v1/organizations` | `routes/organizations.ts` | Parties | Organization CRUD |
| `/v1/requisites` | `routes/requisites.ts` | Parties | Requisite CRUD |
| `/v1/requisites/providers` | `routes/requisite-providers.ts` | Parties | Requisite provider management |
| `/v1/sub-agent-profiles` | `routes/sub-agent-profiles.ts` | Parties | Sub-agent CRUD |
| `/v1/legal-entities` | `routes/legal-entities.ts` | Parties | Legal entity lookup |
| `/v1/deals` | `routes/deals.ts` | Deals | Deal lifecycle CRUD |
| `/v1/calculations` | `routes/calculations.ts` | Calculations | Calculation CRUD |
| `/v1/agreements` | `routes/agreements.ts` | Agreements | Agreement CRUD |
| `/v1/agents` | `routes/agents.ts` | IAM | Agent profile management |
| `/v1/activity` | `routes/activity.ts` | (standalone) | Activity log feed |
| `/v1/customer` | `routes/customer.ts` | Customer Portal | Customer self-service endpoints |
| `/v1/documents` | `routes/documents.ts` | Documents | Document generation and management |
| `/v1/treasury/quotes` | `routes/treasury-quotes.ts` | Treasury | FX quote management for deals |

### Compatibility routes

| Route | File | Purpose |
|---|---|---|
| `routes/contracts-compat.ts` | Legacy contract endpoints during migration |
| `routes/files-compat.ts` | Legacy file endpoints during migration |

---

## CRM Frontend (apps/crm)

**Framework:** Next.js (App Router), React, Tailwind CSS, shadcn/ui

### Pages (`app/`)

```
(dashboard)/
  /                          — Main dashboard
  /customers/                — Customer list
  /customers/[id]/           — Customer detail
  /customers/new/            — Create customer
  /deals/                    — Deal list
  /deals/[id]/               — Deal detail
  /documents/                — Document management
  /calendar/                 — Task calendar
  /reports/customers/        — Customer analytics
  /reports/deals/            — Deal analytics

admin/
  /organizations/            — Organization list
  /organizations/[id]/       — Organization detail + requisites
  /organizations/new/        — Create organization

login/                       — Agent/admin login
signup/                      — Agent signup
```

### Server-side features

- **CRM Tasks** (`lib/server/tasks/`) — own `crm_tasks` table with Drizzle, CRUD service, calendar support
- **Activity** (`app/api/crm/activity/`) — activity feed API
- **Auth** (`lib/server/auth.ts`) — `requireCrmApiSession()` middleware, session-based

### Client libraries

- `lib/deals-query.ts` — deal list queries
- `lib/activity/` — activity feed client
- `lib/validation.ts` — input validation
- `lib/utils/` — currency formatting, table filters

---

## Workflows

### customer-portal (`packages/workflows/customer-portal/`)

Customer-facing facade over deals, calculations, counterparties. Enforces role-based access — customers only see their own data.

### deal-commission (`packages/workflows/deal-commission/`)

Calculates agent commission per deal. Creates `deal_agent_bonuses` records and posts to ledger.

### document-generation (`packages/workflows/document-generation/`)

Generates DOCX/PDF documents from templates:
- **Assemblers:** contract, application, invoice, acceptance, calculation
- **Adapters:** easy-template-x (DOCX rendering), libreoffice-convert (PDF)
- **Russian language utils:** declensions (lvovich), money-in-words, noun grammar
- **Templates:** `packages/workflows/document-generation/templates/`

### document-drafts / document-posting

Cross-cutting workflows for document lifecycle in accounting context.

### organization-bootstrap / requisite-accounting

Setup workflows: initializing organizations and binding requisites to accounting chart of accounts.

---

## Shared Dependencies

| Package | Used by CRM for |
|---|---|
| `@bedrock/shared/core` | Value objects, errors, module runtime, UUID/Clock types |
| `@bedrock/currencies` | Currency validation, all modules validate currency codes |
| `@bedrock/platform/persistence` | Unit of work, transaction factory |
| `@bedrock/platform/idempotency` | Command idempotency (all write operations) |
| `@bedrock/platform/observability` | Logger |
| `@bedrock/platform/object-storage` | S3 adapter for document storage |
| `@bedrock/platform/ai` | OpenAI adapter for document extraction |
| `@bedrock/treasury` | FX quotes, linked to calculations |
| `@bedrock/documents` | Formal document management, accounting integration |
| `@bedrock/ledger` | Commission posting |
| `@bedrock/iam` | User auth, agent profiles, roles |

---

## Module Dependency Graph

```
                 ┌──────────────┐
                 │    Deals     │
                 └──────┬───────┘
                        │
         ┌──────────────┼──────────────┐
         ▼              ▼              ▼
    ┌─────────┐  ┌─────────────┐  ┌───────────┐
    │ Parties │  │Calculations │  │Agreements │
    └────┬────┘  └──────┬──────┘  └─────┬─────┘
         │              │               │
         │              ▼               │
         │        ┌──────────┐          │
         │        │ Treasury │          │
         │        └──────────┘          │
         │                              │
         └──────────────┬───────────────┘
                        ▼
              ┌──────────────────┐
              │   Currencies     │
              │   Platform       │
              │   Shared/Core    │
              └──────────────────┘
```

Note: cross-module reads go through **references ports** (dependency inversion), not direct imports. This keeps modules decoupled at the application layer while the composition root wires concrete implementations.
