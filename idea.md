I’d build this as a kernel plus layers system, not a giant “finance ORM.”

The hard split should be:

* **value plane**: balances, postings, holds, reversals, settlement movements → **TigerBeetle**
* **control plane**: identity, registers, documents, workflows, policy, idempotency log, projections, reporting metadata → **Postgres via Drizzle**

That split matches the actual tools. TigerBeetle is centered on accounts, transfers, and ledgers; direct transfers are same-ledger, more complex flows use linked events and two-phase transfers, and its docs explicitly suggest storing richer metadata in a separate control-plane database. Zod 4 now gives you registries/metadata plus JSON Schema conversion, and Drizzle has official Zod helpers plus migration tooling, so the clean balance is: **Zod for contracts/definitions, Drizzle for physical SQL schemas, TigerBeetle for monetary truth**. ([TigerBeetle][1])

For DX, I would copy the shape of viem, Nuxt, and shadcn very literally: a small `createFinApp()` kernel, explicit adapters/transports, optional extension points, tree-shakable standalone actions, Nuxt-style layers/presets, and a shadcn-style registry for source-installable recipes. Viem explicitly supports a base client plus `.extend()` and direct action imports for tree-shaking; Nuxt layers are meant for sharing partial applications; shadcn registries are a general code distribution system and the CLI can install items from them. ([Viem][2])

I’ll use `@bedrock/*` below as a placeholder namespace.

## 1. Public package surface

Keep the **public** package surface small:

Kernel packages:

* `@bedrock/core`
* `@bedrock/zod`
* `@bedrock/sql` with `@bedrock/sql/drizzle`
* `@bedrock/cli`

Primitive domain packages:

* `@bedrock/assets`
* `@bedrock/ledger` with `@bedrock/ledger/tigerbeetle`
* `@bedrock/accounting`
* `@bedrock/identity`
* `@bedrock/registers`
* `@bedrock/documents`
* `@bedrock/workflows`
* `@bedrock/reconciliation`

Every domain package should follow the same export convention:

```txt
@bedrock/<module>
@bedrock/<module>/actions
@bedrock/<module>/schema
@bedrock/<module>/drizzle
@bedrock/<module>/memory
```

That gives you the viem-like split between a decorated client API and standalone imports. ([Viem][2])

The CLI should do only four things:

```bash
pnpm dlx bedrock init
pnpm dlx bedrock add psp/chargebacks
pnpm dlx bedrock add treasury/camt053
pnpm bedrock generate
pnpm bedrock check
```

Core primitives stay versioned npm packages. Opinionated business flows, connectors, and templates ship as source-installed registry items.

## 2. Public app API

Design rules:

* `extends` is for prebuilt layers/presets.
* `modules` is for local or third-party modules.
* `adapters` is always explicit. No hidden globals.
* Every command/query is also importable from `@bedrock/<module>/actions`.

Example of the action style:

```ts
import { authorizePayment, capturePayment } from '@bedrock/payments/actions'

await authorizePayment(app, input)
await capturePayment(app, input)
```

## 3. Public definition APIs

### Assets

```ts
import { defineAsset } from '@bedrock/assets'

export const EUR = defineAsset('EUR', {
  kind: 'fiat',
  scale: 2,
  ledger: 100,
})

export const BTC = defineAsset('BTC', {
  kind: 'crypto',
  scale: 8,
  ledger: 200,
})

export const CHIP = defineAsset('CHIP', {
  kind: 'internal',
  scale: 0,
  ledger: 900,
})
```

Internally, amounts should be `bigint` in minor units, never `number`. TigerBeetle models amounts as unsigned 128-bit integers and recommends mapping fractional currencies to the smallest useful unit; its Node client docs also call out BigInt handling in JS. So the framework should parse decimal strings at the boundary and carry `bigint` inside. ([TigerBeetle][1])

### Registers

Use registers for versioned master-data entities: merchants, customers, vendors, bank accounts, players, payout methods, game tables, liquidity pools.

```ts
import { defineRegister, project } from '@bedrock/registers'
import { z } from 'zod'
import { fz } from '@bedrock/zod'

export const Merchant = defineRegister('merchant', {
  schema: z.object({
    id: fz.id('merchant'),
    legalName: z.string().min(1),
    email: fz.email(),
    country: fz.countryCode(),
    settlementAsset: z.enum(['EUR', 'USD']),
  }),
  state: ['draft', 'active', 'suspended'],
  storage: {
    projections: {
      email: project.text('email', (m) => m.email).unique(),
      country: project.text('country', (m) => m.country).index(),
      settlementAsset: project.text('settlement_asset', (m) => m.settlementAsset).index(),
    },
  },
})
```

Important design choice: a register definition should **not** create a new SQL table by default. It should write into shared module tables like `register_records` and `register_versions` with typed JSONB payloads, then materialize indexed projections explicitly. Otherwise the framework turns into a migration factory with unbounded table growth.

### Documents

Use documents for invoices, payment intents, statements, receipts, journal memos, bank statements, settlement files, KYC bundles.

```ts
import { defineDocument } from '@bedrock/documents'
import { z } from 'zod'
import { fz } from '@bedrock/zod'

export const PaymentIntent = defineDocument('payment_intent', {
  schema: z.object({
    id: fz.id('pi'),
    merchantId: Merchant.ref(),
    asset: z.enum(['EUR', 'USD']),
    amount: fz.money(),
    captureMode: z.enum(['automatic', 'manual']),
    metadata: z.record(z.string(), z.unknown()).default({}),
  }),
  states: [
    'requires_payment_method',
    'authorized',
    'captured',
    'refunded',
    'failed',
  ],
  links: ['merchant', 'customer', 'authorization', 'settlement'],
})
```

### Workflows

Workflows should be durable state machines, not in-memory callbacks.

```ts
import { defineWorkflow, transition } from '@bedrock/workflows'

export const paymentLifecycle = defineWorkflow('payment_lifecycle', {
  input: PaymentIntent.ref(),
  states: [
    'requires_payment_method',
    'authorized',
    'captured',
    'refunded',
    'failed',
  ],
  transitions: [
    transition('authorize')
      .from('requires_payment_method')
      .to('authorized')
      .effect('payments.authorize'),

    transition('capture')
      .from('authorized')
      .to('captured')
      .effect('payments.capture'),

    transition('refund')
      .from('captured')
      .to('refunded')
      .effect('payments.refund'),
  ],
})
```

### Ledger

Ledger should expose **two levels**:

1. a high-level semantic posting DSL
2. a low-level raw adapter surface for advanced users

High-level:

```ts
import { defineAccount, definePosting } from '@bedrock/ledger'
import { z } from 'zod'
import { fz } from '@bedrock/zod'

export const customerAvailable = defineAccount('customer.available', {
  code: 1100,
  normal: 'credit',
  asset: ['EUR', 'USD'],
  scope: z.object({
    tenantId: fz.id('tenant'),
    customerId: fz.id('customer'),
    asset: z.enum(['EUR', 'USD']),
  }),
  limits: { min: 0n },
})

export const merchantPending = defineAccount('merchant.pending', {
  code: 2100,
  normal: 'credit',
  asset: ['EUR', 'USD'],
  scope: z.object({
    tenantId: fz.id('tenant'),
    merchantId: Merchant.ref(),
    asset: z.enum(['EUR', 'USD']),
  }),
})

export const authorizePayment = definePosting('authorizePayment', {
  params: z.object({
    paymentId: PaymentIntent.ref(),
    tenantId: fz.id('tenant'),
    customerId: fz.id('customer'),
    merchantId: Merchant.ref(),
    asset: z.enum(['EUR', 'USD']),
    amount: fz.minor(),
  }),
  mode: 'pending',
  build({ hold, ref }, p) {
    return hold({
      id: p.paymentId,
      from: ref(customerAvailable, {
        tenantId: p.tenantId,
        customerId: p.customerId,
        asset: p.asset,
      }),
      to: ref(merchantPending, {
        tenantId: p.tenantId,
        merchantId: p.merchantId,
        asset: p.asset,
      }),
      amount: p.amount,
      refs: { paymentId: p.paymentId },
    })
  },
})
```

Low-level:

```ts
await app.ledger.raw.createAccounts([...])
await app.ledger.raw.createTransfers([...])
await app.ledger.raw.lookupAccounts([...])
```

Keep the raw API adapter-specific and fenced behind `raw` or the `/tigerbeetle` subpath. Most app code should live on semantic postings, not raw transfers.

That matters because TigerBeetle’s primitive is a same-ledger single-debit/single-credit transfer; multi-leg postings and cross-asset exchange should compile into linked transfer batches, and authorizations/holds should compile into two-phase transfers. TigerBeetle documents both patterns directly. ([TigerBeetle][3])

### Accounting

Accounting is a separate module on top of the ledger, not a synonym for the ledger.

```ts
import { defineChart, defineJournal } from '@bedrock/accounting'

export const defaultChart = defineChart('default', {
  accounts: [
    { code: '1000', name: 'Cash', normal: 'debit' },
    { code: '2100', name: 'Merchant Payables', normal: 'credit' },
    { code: '4100', name: 'Fee Revenue', normal: 'credit' },
  ],
})

export const merchantSettlementJournal = defineJournal('merchant_settlement', {
  source: 'payments.capture',
  chart: defaultChart,
  map({ amount, fee }) {
    return [
      { account: '2100', side: 'credit', amount: amount - fee },
      { account: '4100', side: 'credit', amount: fee },
      { account: '1000', side: 'debit', amount },
    ]
  },
})
```

That split lets PSP and casino apps lean hard on ledger primitives, while ERP apps lean harder on chart, journal, period, and reporting primitives.

## 4. Module API

Every real business capability should be a module that declares its resources and side effects in one place.

```ts
import { defineModule } from '@bedrock/core'

export const paymentsModule = defineModule({
  name: 'payments',
  dependsOn: ['assets', 'identity', 'documents', 'workflows', 'ledger'],
  assets: [EUR],
  registers: [Merchant],
  documents: [PaymentIntent],
  workflows: [paymentLifecycle],
  accounts: [customerAvailable, merchantPending],
  postings: [authorizePayment],
})
```

That should be the public module authoring surface. Nothing more magical than that.

## 5. Internal API draft

The key internal decision: public definitions compile into a small internal AST, and adapters consume the AST. Do **not** let Drizzle tables or TigerBeetle structs leak all the way back into public module definitions.

```ts
export interface ModuleManifest {
  name: string
  version?: string
  dependsOn?: string[]
  resources: DefinitionNode[]
  commands?: Record<string, CommandHandler<any, any>>
  queries?: Record<string, QueryHandler<any, any>>
  events?: Record<string, EventHandler<any>>
  adapters?: {
    sql?: SqlContributionFactory
    ledger?: LedgerContributionFactory
  }
}

export type DefinitionNode =
  | AssetNode
  | RegisterNode
  | DocumentNode
  | WorkflowNode
  | AccountNode
  | PostingNode
  | JournalNode

export interface SqlContribution {
  tables: Record<string, AnyTable>
  relations?: Record<string, unknown>
  migrations?: SqlMigration[]
  repositories?: RepositoryFactory[]
  projections?: ProjectionFactory[]
}

export interface LedgerContribution {
  accountTemplates: CompiledAccountTemplate[]
  postingCompilers: CompiledPostingCompiler[]
}

export interface SqlAdapter {
  kind: 'sql'
  install(contrib: SqlContribution): void
  tx<T>(fn: (tx: SqlUnitOfWork) => Promise<T>): Promise<T>
}

export interface LedgerAdapter {
  kind: 'ledger'
  install(contrib: LedgerContribution): void
  ensureAccounts(input: EnsureAccountInput[]): Promise<EnsureAccountResult[]>
  submit(batch: CompiledPostingBatch): Promise<LedgerReceipt>
  lookup(input: LookupRequest): Promise<LookupResult>
}
```

The runtime should have these internal subsystems:

* definition registry
* compiler pipeline: `definitions -> AST -> sql / ledger / openapi artifacts`
* operation coordinator
* projection engine
* recovery worker

## 6. The most important internal subsystem: operation coordination

Never pretend you have a distributed transaction across Postgres and TigerBeetle. You do not.

Make this the canonical flow for anything that touches money:

1. validate input with Zod
2. derive deterministic ids
3. write an `operations` row in SQL with `pending` status inside a Drizzle transaction
4. persist any control-plane state changes that can be made before submission
5. compile and submit the TigerBeetle batch
6. update the operation to `applied` and write projections
7. if step 5 or 6 breaks, a recovery worker reconciles by operation id and transfer ids

TigerBeetle explicitly treats account and transfer ids as idempotency keys, recommends client-side generation and reuse of ids for reliable retries, and documents that linked events are atomic and two-phase transfers are the right primitive for reserve/post/void flows. ([TigerBeetle][4])

Suggested core SQL tables:

* `operations`
* `operation_attempts`
* `idempotency_keys`
* `outbox`
* `inbox`
* `audit_log`

Without this, the framework will look elegant in demos and fail in real money movement.

## 7. Drizzle schema shape by module

I would standardize the SQL side like this:

* `@bedrock/core/drizzle`

  * `operations`
  * `operation_attempts`
  * `idempotency_keys`
  * `outbox`
  * `inbox`
  * `audit_log`

* `@bedrock/assets/drizzle`

  * `assets`
  * `asset_pairs`
  * `quotes`
  * `rates`
  * `valuations`

* `@bedrock/identity/drizzle`

  * `parties`
  * `party_versions`
  * `organizations`
  * `memberships`
  * `roles`
  * `grants`
  * `credentials`

* `@bedrock/registers/drizzle`

  * `register_records`
  * `register_versions`
  * `register_links`
  * `register_projection_*`

* `@bedrock/documents/drizzle`

  * `documents`
  * `document_versions`
  * `document_events`
  * `document_links`
  * `attachments`

* `@bedrock/workflows/drizzle`

  * `workflow_instances`
  * `workflow_tasks`
  * `workflow_events`
  * `workflow_locks`

* `@bedrock/ledger/drizzle`

  * `ledger_accounts`
  * `posting_batches`
  * `posting_legs`
  * `posting_receipts`
  * `balance_snapshots` as an optional cache only

* `@bedrock/accounting/drizzle`

  * `charts`
  * `chart_accounts`
  * `periods`
  * `journal_batches`
  * `journal_entries`
  * `reconciliation_sets`
  * `close_runs`

Every `/drizzle` export should give you:

```ts
export const tables
export const relations
export const migrations
export const zod = {
  insert,
  select,
  update,
}
```

That lines up cleanly with Drizzle’s own migration model and Zod integration. ([Drizzle ORM][5])

## 9. What I would not do

* I would not try to make arbitrary Zod objects auto-generate perfect normalized SQL schemas.
* I would not create one SQL table per register, document, or workflow definition by default.
* I would not expose TigerBeetle transfer structs as the main app API.
* I would not collapse ledger and accounting into one package.
* I would not use JS `number` for money.
* I would not do app-level “check balance, then transfer” logic. TigerBeetle explicitly warns that balance lookup before transfer is not atomic and recommends limits or balance-conditional patterns instead. ([TigerBeetle][7])

## 10. Internal workspace packages

Internally, I’d keep more packages than the public surface:

* `packages/internal-definitions`
* `packages/internal-ast`
* `packages/internal-runtime`
* `packages/internal-sql-compiler`
* `packages/internal-ledger-compiler`
* `packages/internal-operation-log`
* `packages/internal-projections`
* `packages/internal-testing`

Externally, that complexity disappears behind the public `@bedrock/*` packages.

## 11. Recommended build order

1. `core`, `zod`, `sql/drizzle`, `ledger/tigerbeetle`
2. generic `registers`, `documents`, `identity`
3. operation coordinator plus outbox/inbox plus recovery
4. `workflows`
5. `accounting`

That order gets the hard invariants in first: money movement, idempotency, control-plane durability, then business layers.

The next useful step is turning this into a pnpm monorepo skeleton with concrete `package.json` exports, TypeScript interfaces, and stubbed `drizzle` and `tigerbeetle` adapters.

[1]: https://docs.tigerbeetle.com/coding/data-modeling/ "https://docs.tigerbeetle.com/coding/data-modeling/"
[2]: https://v1.viem.sh/docs/clients/custom.html "https://v1.viem.sh/docs/clients/custom.html"
[3]: https://docs.tigerbeetle.com/reference/transfer/ "https://docs.tigerbeetle.com/reference/transfer/"
[4]: https://docs.tigerbeetle.com/coding/reliable-transaction-submission/ "https://docs.tigerbeetle.com/coding/reliable-transaction-submission/"
[5]: https://orm.drizzle.team/docs/migrations "https://orm.drizzle.team/docs/migrations"
[6]: https://docs.tigerbeetle.com/coding/two-phase-transfers/ "https://docs.tigerbeetle.com/coding/two-phase-transfers/"
[7]: https://docs.tigerbeetle.com/reference/requests/lookup_accounts/ "https://docs.tigerbeetle.com/reference/requests/lookup_accounts/"
