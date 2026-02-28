# Bedrock Finance V2 Core Spec

## 1) Scope и цели

### 1.1. Что такое “V2 Core”

V2 Core — набор платформенных подсистем, на которых можно строить любые финансовые домены (treasury / PSP / casino / exchange-like), не меняя ядро:

1. **Documents Kernel** — универсальный workflow-kernel (draft/submit/approve/post/…) + audit + idempotency + graph.
2. **Accounting Runtime** — применяет **скомпилированные packs** (политику) и резолвит семантику в конкретный journal intent.
3. **Ledger Engine** — immutable journal + детерминированные IDs + outbox/TB планы + raw reads.
4. **Balances Layer** — operational balances (available/reserved/pending) + holds, отдельно от ledger.
5. **Reconciliation Layer** — immutable ingestion внешних записей + matching + exceptions + adjustments через documents.
6. **Label/Dimension Infra** — реестр dimension keys + batch label resolvers (вне ledger).

### 1.2. Негарантируемые вещи (out of scope ядра)

* Бизнес-правила PSP/casino (лимиты, KYC, payout rails).
* Конкретные docTypes и семантические template keys.
* UI.

---

## 2) Железные принципы (архитектурный закон)

1. **Modules emit semantic requests only.** Домены не знают account numbers, posting codes, clearing routing.
2. **Packs compile once, runtime only executes compiled.** Никакого “соберём из сырых таблиц в runtime”.
3. **Line-level bookId.** Каждый create-line несет `bookId`. Операция может включать линии разных книг.
4. **Intercompany — pack-resolved.** Маршрутизация и clearing определяется compiled pack.
5. **Documents kernel — бизнес-агностичный.** Только lifecycle + orchestration + audit + graph.
6. **Ledger — generic.** Никаких label resolution / reporting / доменных проекций внутри.

---

## 3) Канонические идентичности и детерминизм

### 3.1. Canonical serialization + hashing

В ядре существует один канонический сериализатор `canonicalJson(value)`:

* JSON object keys сортируются по ASCII.
* BigInt сериализуется строкой.
* Dates сериализуются ISO `toISOString()`.
* Undefined запрещён (либо удаляется, либо ошибка).
* Любые “map/dict” превращаются в объект с сортированными ключами.

Хэши:

* `sha256(canonicalJson(x))` -> hex string.
* Для 128-bit IDs (TigerBeetle): `H128(namespace, input)` где input — canonical string.

### 3.2. Deterministic identity rules

* `ledger_operation_id = H128("ledger_op", idempotencyKey)`
* `tb_transfer_id = H128("tb_transfer", operationId + ":" + lineNo + ":" + planRef)`
* `document_post_idempotency_key = module.buildPostIdempotencyKey(doc)` (строго детерминированный)
* `posting_plan_checksum = sha256(canonicalJson(plan))`
* `journal_intent_checksum = sha256(canonicalJson(intent))`
* `pack_checksum` — детерминированный checksum compiled artifact.

---

## 4) Idempotency: Action receipts

### 4.1. Зачем

Идемпотентность должна быть **проверяемой и воспроизводимой**, включая “409 conflict при другом payload”.

### 4.2. Правила

Любой side-effect action обязан иметь:

* `scope` (например `documents.create`, `documents.post`, `recon.ingest`)
* `idempotencyKey`
* `requestHash = sha256(canonicalJson(request))`

Поведение:

* если receipt отсутствует → выполнить, записать receipt со статусом `ok`, вернуть результат.
* если receipt есть и `requestHash совпал` → вернуть сохраненный результат (replay).
* если receipt есть и `requestHash не совпал` → `409 conflict` (и тоже записать/логировать как конфликт).

---

## 5) Documents Kernel

### 5.1. Универсальная модель статусов

Документ имеет **четыре независимых набора статусов**:

* `submission_status`: `draft | submitted`
* `approval_status`: `not_required | pending | approved | rejected`
* `posting_status`: `not_required | unposted | posting | posted | failed`
* `lifecycle_status`: `active | cancelled | voided | archived`

### 5.2. Универсальные правила переходов

**Edit**

* разрешен только если: `submission=draft` и `lifecycle=active`

**Submit**

* только из `draft`
* после submit: `submission=submitted`, `approval=pending` (если approval required) иначе `approval=not_required`

**Approve/Reject**

* только из `submission=submitted` и `approval=pending`
* maker-checker (если включено политикой): maker не может approve

**Post**

* только если:

  * `submission=submitted`
  * `approval in (approved, not_required)`
  * `posting=unposted`
  * `lifecycle=active`
* post создаёт `ledger_operation` и ставит `posting=posting`

**Cancel**

* разрешён только если `posting != posted` и `lifecycle=active`
* переводит lifecycle в `cancelled`

**После posted**

* никаких “отмен” ledger. Только компенсирующий документ (`compensates` link) как новая операция.

**Retry failed posting**

* отдельная команда `repost`, которая не меняет пост-idempotency ключ (чтобы операция была той же) и пытается провести снова.

### 5.3. Document graph (links)

Link types:

* `parent`
* `depends_on`
* `compensates`
* `related`

Kernel invariants:

* запрещены self-links
* запрещены дубликаты `(from,to,type,role)`
* `parent/depends_on/compensates` — должны быть acyclic
* cardinality/uniqueRole — enforced по policy

Link policy объявляется системой (в V2 core — через policy service или через pack, но enforcement внутри kernel).

---

## 6) Posting orchestration pipeline

### 6.1. Обязательный pipeline

`document -> posting plan -> journal intent -> ledger.commit -> finalize`

Роли:

* **Document module**: строит `DocumentPostingPlan` из фактов (semantics only).
* **Accounting runtime**: резолвит semantics в `JournalIntent` по compiled pack.
* **Ledger**: валидирует + пишет immutable journal + TB планы + outbox.
* **Documents finalizer worker**: синхронизирует `posting_status` документа по статусу ledger_operation.

### 6.2. DocumentPostingPlan (kernel contract)

Document module обязан вернуть:

* `operationCode`, `operationVersion`
* `payload` (для ledger operation payload — безопасная диагностическая информация)
* `requests[]` — список семантических template requests

`requests[]` содержат:

* `templateKey`
* `effectiveAt`
* `currency`
* `amountMinor`
* `bookRefs` (ключи на bookIds, например `{ sourceBookId, destBookId }` — но сами значения резолвятся до конкретных bookId на уровне модуля/ядра)
* `dimensions`
* optional `refs`, `pending`, `memo`

### 6.3. Accounting runtime resolve

`resolvePostingPlan(plan, pack)` обязано:

* проверить existence `templateKey`
* проверить required bookRefs/dimensions
* применить intercompany routing rules (если template этого требует)
* вернуть `JournalIntent` с конкретными линиями (create/post_pending/void_pending)
* вернуть applied metadata:

  * `pack_checksum`
  * `posting_plan_checksum`
  * `journal_intent_checksum`
  * applied template IDs/expansions

---

## 7) Ledger Engine

### 7.1. Цели ledger

* immutable accounting journal
* deterministic replay/idempotent commit
* TB/outbox pipeline
* raw reads без label

### 7.2. JournalIntent (core contract)

`JournalIntent`:

* `source { type, id }`
* `operationCode`, `operationVersion`
* `postingDate`
* `idempotencyKey`
* `payload?`
* `lines[]`:

  * `create` line: `bookId`, debit/credit legs, postingCode, amountMinor, etc
  * `post_pending` / `void_pending` lines

Rules:

* каждый `create` line balanced within one `bookId`
* одна operation может содержать create-lines для нескольких books
* commit идемпотентен по `idempotencyKey`

### 7.3. Immutable semantics

* postings не редактируются
* ledger_operations.status управляется воркером (pending→posted/failed)
* ошибки сохраняются

---

## 8) Balances Layer (operational)

### 8.1. Задача

Balances — это оперативный слой для предотвращения отрицательного available и поддержки holds/reservations. Он не должен быть “случайной агрегацией ledger” в UI.

### 8.2. Модель

* `balance_events` — append-only
* `balance_positions` — текущая проекция
* `balance_holds` — активные hold’ы

Баланс имеет поля:

* `ledgerBalance`
* `available`
* `reserved`
* `pending`

### 8.3. Concurrency / locking

Row-level lock по ключу:
`(book_id, subject_type, subject_id, currency)`

Reserve/consume должны:

* быть идемпотентными по `holdRef`
* запрещать `available < amount`

### 8.4. Ledger → Balances projector

Core должен поддержать один из вариантов (выбрать один и зафиксировать):

* **sync projection**: при ledger finalize писать balance events (сложно, но консистентно)
* **async exactly-once projector**: отдельный worker читает posted operations и делает balance_events с de-dup по operationId

Для general-purpose платформы лучше async projector + exactly-once (простота и масштабируемость), но строго фиксируй де-dup и cursor storage.

---

## 9) Reconciliation Layer

### 9.1. Immutable ingestion

Любой внешний факт (statement/webhook/report) сохраняется как `external_record`:

* raw payload
* normalized payload (в вашей норм. схеме)
* payload hash
* normalization version
* source id + source record id
* receivedAt + correlation ids

### 9.2. Reconciliation runs

`reconciliation_run`:

* input selection criteria (или snapshot ids)
* ruleset checksum/version
* tolerances
* deterministic results + explainability

### 9.3. Differences workflow

* никаких ручных правок в БД
* discrepancy → exception → adjustment document
* adjustment создаётся через documents pipeline

---

## 10) Dimension + Label Infrastructure

### 10.1. Dimension registry

Pack определяет допустимые dimension keys и policies. Reporting слой (не ledger) предоставляет label resolvers.

**Правила**:

* batch resolve only
* caching + negative caching
* отсутствие resolver’а не ломает ledger reads (labels optional)

---

## 11) Packs: definition → compiler → compiled artifact

### 11.1. Raw pack definition (в packs/*)

Определяет:

* accounts
* posting codes
* templates (semantic templateKey -> expansion rules)
* dimension policies
* correspondence rules
* intercompany routing rules
* allowlist: какие `templateKey` доступны каким `moduleId/docType`

### 11.2. Compiler invariants

Compile fails если:

* templateKey duplicates
* unknown references
* dimension requirements unsatisfied
* intercompany ambiguity
* correspondence conflicts
* missing bookRefs контрактов

### 11.3. Runtime rule

Accounting runtime исполняет только compiled artifact (по checksum).
Никакой “runtime compilation”.

---

## 12) Policy: RBAC/ABAC + maker-checker

### 12.1. DocumentActionPolicyService

Kernel вызывает policy сервис на каждый action:

* canCreate/canSubmit/canApprove/canReject/canPost/canCancel
* approvalMode (not_required vs maker_checker)

Policy decision обязана включать:

* `allow: boolean`
* `reasonCode: string`
* `reasonMeta?: json`

### 12.2. Audit

Любой denial тоже фиксируется как document_event (или отдельный audit event) с reasonCode.

---

## 13) Observability

### 13.1. Обязательные идентификаторы везде

* `correlationId`
* `traceId`
* `causationId`
* `requestId` (если API)
* `actorId` (если user action)

Эти поля должны быть доступны в:

* documents, document_events, snapshots
* ledger_operations payload/meta
* outbox entries
* reconciliation tables
* balance events (если применимо)

### 13.2. Dead-letter / quarantine

* unrecoverable posting failures → quarantine (document posting_status=failed + reason)
* unrecoverable reconciliation failures → exceptions queue

---

## 14) Closure-based package contract

Каждый core package экспортирует фабрику:

* `createDocumentsService(deps) -> { createDraft, updateDraft, submit, approve, reject, post, cancel, repost, get, list, getDetails }`
* `createAccountingRuntime(deps) -> { loadActiveCompiledPack, resolvePostingPlan, validatePack, compilePack }`
* `createLedgerService(deps) -> { commit, listOperations, getOperationDetails }`
* `createBalancesService(deps) -> { getBalance, reserve, release, consume }`
* `createReconciliationService(deps) -> { ingestExternalRecord, runReconciliation, listExceptions, createAdjustmentDocument }`

Deps инъектятся как plain objects; никаких классов/наследования.

---

# 15) Database Spec (ядро таблиц)

Ниже — минимальный набор таблиц V2 core. (Доменные таблицы — вне спецификации.)

## 15.1. action_receipts

**Purpose:** idempotency store для всех side-effect actions.

* `id uuid pk`
* `scope text not null`
* `idempotency_key text not null`
* `actor_id uuid null`
* `request_hash text not null`
* `status text not null` (`ok` | `conflict` | `error`)
* `result_json jsonb null`
* `error_json jsonb null`
* `created_at timestamptz not null default now()`

Indexes/constraints:

* unique `(scope, idempotency_key)`

## 15.2. documents

* `id uuid pk`

* `doc_type text not null`

* `module_id text not null`

* `module_version int not null`

* `payload_version int not null`

* `payload jsonb not null`

* `title text not null`

* `occurred_at timestamptz not null`

* statuses:

  * `submission_status text not null`
  * `approval_status text not null`
  * `posting_status text not null`
  * `lifecycle_status text not null`

* summary fields (optional but strongly recommended):

  * `amount_minor bigint null`
  * `currency text null`
  * `memo text null`
  * `counterparty_id uuid null`
  * `customer_id uuid null`
  * `operational_account_id uuid null`
  * `search_text text not null default ''`

* actor stamps:

  * `created_by uuid not null`
  * `submitted_by uuid null`
  * `approved_by uuid null`
  * `rejected_by uuid null`
  * `cancelled_by uuid null`

* timestamps:

  * `created_at timestamptz not null default now()`
  * `updated_at timestamptz not null default now()`
  * `submitted_at timestamptz null`
  * `approved_at timestamptz null`
  * `rejected_at timestamptz null`
  * `cancelled_at timestamptz null`
  * `posting_started_at timestamptz null`
  * `posted_at timestamptz null`

* posting error:

  * `posting_error text null`

* optimistic lock:

  * `version int not null default 1`

Indexes:

* `(doc_type, occurred_at desc)`
* `(posting_status, occurred_at desc)`
* `(approval_status, occurred_at desc)`
* `(submission_status, occurred_at desc)`
* `(lifecycle_status, occurred_at desc)`
* `(currency)`
* `(counterparty_id)`
* `(customer_id)`
* `(operational_account_id)`
* GIN on `payload`
* optional trigram/GiST on `search_text` (если нужен поиск)

## 15.3. document_events (append-only)

* `id uuid pk`
* `document_id uuid not null fk`
* `event_type text not null` (create/update/submit/approve/reject/post/cancel/repost/deny/…)
* `actor_id uuid null`
* `correlation_id text null`
* `trace_id text null`
* `causation_id text null`
* `reason_code text null`
* `reason_meta jsonb null`
* `before jsonb null` (минимальный снимок статусов/summary/checksums)
* `after jsonb null`
* `created_at timestamptz not null default now()`

Indexes:

* `(document_id, created_at asc)`

## 15.4. document_links

* `id uuid pk`
* `from_document_id uuid not null fk`
* `to_document_id uuid not null fk`
* `link_type text not null`
* `role text null`
* `created_at timestamptz not null default now()`

Constraints:

* unique `(from_document_id, to_document_id, link_type, role)`
* forbid self-link (check constraint)

Indexes:

* `(from_document_id, link_type)`
* `(to_document_id, link_type)`

## 15.5. document_operations

* `id uuid pk`
* `document_id uuid not null fk`
* `operation_id uuid not null fk -> ledger_operations(id)`
* `kind text not null` (v1: only `post`)
* `created_at timestamptz not null default now()`

Constraints:

* unique `(document_id, kind)`
* unique `(operation_id)`

## 15.6. document_snapshots (immutable)

* `id uuid pk`
* `document_id uuid not null fk`
* `created_at timestamptz not null default now()`

Frozen document:

* `payload jsonb not null`
* `payload_version int not null`
* `module_id text not null`
* `module_version int not null`

Accounting/ledger proof:

* `pack_checksum text not null`
* `posting_plan_checksum text not null`
* `journal_intent_checksum text not null`
* `posting_plan jsonb not null`
* `journal_intent jsonb not null`

Optional:

* `resolved_templates jsonb null`

Constraints:

* unique `(document_id)` если хотите “один snapshot на документ” (или разрешить несколько для repost истории)

## 15.7. balances (минимум)

### balance_positions

* `id uuid pk`
* `book_id uuid not null`
* `subject_type text not null`
* `subject_id text not null`
* `currency text not null`
* `ledger_balance bigint not null`
* `reserved bigint not null`
* `pending bigint not null`
* `available bigint not null`
* `updated_at timestamptz not null default now()`

Constraints:

* unique `(book_id, subject_type, subject_id, currency)`

### balance_holds

* `id uuid pk`
* `book_id uuid not null`
* `subject_type text not null`
* `subject_id text not null`
* `currency text not null`
* `hold_ref text not null`
* `amount_minor bigint not null`
* `state text not null` (`active` | `released` | `consumed`)
* `reason text null`
* `created_at timestamptz not null default now()`
* `updated_at timestamptz not null default now()`

Constraints:

* unique `(book_id, subject_type, subject_id, currency, hold_ref)`

### balance_events (append-only)

* `id uuid pk`
* `book_id uuid not null`
* `subject_type text not null`
* `subject_id text not null`
* `currency text not null`
* `event_type text not null` (`ledger_posted`|`reserve`|`release`|`consume`|…)
* `delta_ledger bigint not null default 0`
* `delta_reserved bigint not null default 0`
* `delta_pending bigint not null default 0`
* `hold_ref text null`
* `operation_id uuid null`
* `meta jsonb null`
* `correlation_id text null`
* `created_at timestamptz not null default now()`

Indexes:

* `(book_id, subject_type, subject_id, currency, created_at asc)`
* unique `(operation_id)` для `ledger_posted` событий, если projector exactly-once

## 15.8. reconciliation (минимум)

### external_records (immutable)

* `id uuid pk`
* `source text not null`
* `source_record_id text not null`
* `raw_payload jsonb not null`
* `normalized_payload jsonb not null`
* `payload_hash text not null`
* `normalization_version int not null`
* `received_at timestamptz not null default now()`
* `correlation_id text null`
* `trace_id text null`

Constraints:

* unique `(source, source_record_id)`

### reconciliation_runs

* `id uuid pk`
* `source text not null`
* `ruleset_checksum text not null`
* `input_query jsonb not null` (или список external_record_ids)
* `result_summary jsonb not null`
* `created_at timestamptz not null default now()`

### reconciliation_matches

* `id uuid pk`
* `run_id uuid not null fk`
* `external_record_id uuid not null fk`
* `matched_operation_id uuid null`
* `matched_document_id uuid null`
* `status text not null` (`matched`|`unmatched`|`ambiguous`)
* `explanation jsonb not null`
* `created_at timestamptz not null default now()`

### reconciliation_exceptions

* `id uuid pk`
* `run_id uuid not null fk`
* `external_record_id uuid not null fk`
* `reason_code text not null`
* `reason_meta jsonb null`
* `state text not null` (`open`|`resolved`|`ignored`)
* `created_at timestamptz not null default now()`
* `resolved_at timestamptz null`

---

## 16) Минимальные API-контракты ядра (внутренние)

Это не HTTP, а package-level contracts.

### documents service

* `createDraft({ docType, moduleId, input, idempotencyKey, actor, correlation }) -> { documentId }`
* `updateDraft({ documentId, input, idempotencyKey, actor })`
* `submit({ documentId, idempotencyKey, actor })`
* `approve({ documentId, idempotencyKey, actor })`
* `reject({ documentId, idempotencyKey, actor, reason })`
* `post({ documentId, idempotencyKey, actor }) -> { operationId }`
* `cancel({ documentId, idempotencyKey, actor, reason })`
* `repost({ documentId, idempotencyKey, actor }) -> { operationId }`
* `get({ documentId })`
* `list(query)`
* `getDetails({ documentId })` (doc + links + ops + raw ledger details)

### accounting runtime

* `loadActiveCompiledPackForBook({ bookId, at }) -> CompiledPack`
* `resolvePostingPlan({ plan, pack }) -> { intent, checksums, appliedTemplates }`

### ledger service

* `commit({ intent }) -> { operationId }`
* `getOperationDetails(operationId) -> { operation, postings, tbPlans }`

### balances service

* `getBalance(subject)`
* `reserve/release/consume` (idempotent by holdRef)

### reconciliation

* `ingestExternalRecord({ source, sourceRecordId, rawPayload, idempotencyKey })`
* `runReconciliation({ source, rulesetVersion, inputSelection })`
* `createAdjustmentDocument({ exceptionId, docType, input, idempotencyKey })`

---

## 17) Worker responsibilities (core)

1. **Ledger posting worker**: outbox → TB → update `ledger_operations.status`.
2. **Documents finalizer**:

   * find documents with `posting_status=posting`
   * join `document_operations` → `ledger_operations`
   * if posted → `posting_status=posted`, write event, set posted_at, write/confirm snapshot exists
   * if failed → `posting_status=failed`, set posting_error, write event
3. **Balances projector** (если async):

   * scan new posted ledger_operations
   * emit `balance_events` exactly-once
   * update `balance_positions`
4. **Reconciliation worker** (optional):

   * run scheduled runs, open exceptions

---

## 18) Набор обязательных CI-инвариантов (lint/architecture)

* Outside packs/tests: запрещены прямые ссылки на CoA account numbers и posting codes.
* documents package не импортирует домены.
* ledger не импортирует reporting/label infra.
* accounting runtime не импортирует documents/domains.
* domain modules (когда появятся) не импортируют packs напрямую (только через accounting runtime).

---

## 19) Что нужно “решить заранее” (фиксируем решения)

Чтобы V2 был “simple and straightforward”, заранее выбери и зафиксируй:

1. **Sync vs async balances projector** (я бы выбрал async + exactly-once).
2. **Где хранить compiled packs**: DB-only или DB + in-memory cache (обычно оба).
3. **Snapshot policy**: один snapshot на posted документ или “каждый successful post attempt” (обычно один).
4. **Link cycle enforcement**: recursive CTE на insert link или application check + serializable tx (лучше CTE).
5. **Idempotency scope format**: строгий enum.

Ниже — **чеклист задач по пакетам** под принятые решения (async balances projector, compiled packs DB+cache, 1 snapshot на posted, link cycles через recursive CTE, строгий enum scopes). Пишу в формате “что сделать”, без доменных модулей.

---

# 0) Repo-level (root)

### Архитектурные границы и запреты

* [ ] Обновить `dependency-cruiser` / boundary checks под V2 слои:

  * core packages ↔ core packages
  * adapters ↔ core+packs (+modules позже)
  * packs ↔ pack-schema/pack-compiler contracts only
* [ ] Добавить CI правило: **запрет hard-code CoA / posting codes** вне `packages/packs/*` и `tests/*`.
* [ ] Добавить CI правило: `@bedrock/ledger` не импортирует reporting/labels, `@bedrock/documents` не импортирует домены.
* [ ] Добавить `packages/packs/*` workspace + скрипты `pack:compile`, `pack:validate`, `pack:activate`.

### Общие утилиты

* [ ] Добавить `@bedrock/canon` (или в `kernel`) канонический JSON + `sha256` + helpers (BigInt/Date safe).
* [ ] Единый `CorrelationContext` тип + пропагация (requestId/traceId/correlationId/causationId/actorId).

---

# 1) `@bedrock/kernel`

### Canon + hashing

* [ ] `canonicalJson(value): string`
* [ ] `hashSha256Hex(input: string): string`
* [ ] `hash128(namespace: string, input: string): bigint` (или string→uint128), совместимо с TB.

### Errors + Result shape

* [ ] Базовые `DomainError`/`ConflictError`/`NotFoundError`/`ValidationError`.
* [ ] Стандарт `ErrorCode` enum.

### Idempotency scopes enum

* [ ] Строгий enum `IdempotencyScope` (например):

  * `documents.createDraft`
  * `documents.updateDraft`
  * `documents.submit`
  * `documents.approve`
  * `documents.reject`
  * `documents.post`
  * `documents.cancel`
  * `documents.repost`
  * `ledger.commit`
  * `balances.reserve`
  * `balances.release`
  * `balances.consume`
  * `recon.ingestExternalRecord`
  * `recon.run`
  * `recon.createAdjustmentDocument`

---

# 2) `@bedrock/db`

### Schema additions (V2 core)

* [ ] Таблицы:

  * [ ] `action_receipts`
  * [ ] `documents`
  * [ ] `document_events`
  * [ ] `document_links`
  * [ ] `document_operations`
  * [ ] `document_snapshots`
  * [ ] `accounting_pack_versions` (compiled artifacts)
  * [ ] `accounting_pack_assignments` (active pack by scope)
  * [ ] `books`
  * [ ] `balance_positions`
  * [ ] `balance_holds`
  * [ ] `balance_events`
  * [ ] `external_records`
  * [ ] `reconciliation_runs`
  * [ ] `reconciliation_matches`
  * [ ] `reconciliation_exceptions`
  * [ ] `outbox` (если нет единого, либо расширить текущий)
* [ ] Индексы/unique constraints по spec (особенно receipts, holds, links unique, doc_ops unique).
* [ ] Миграции + `db:bootstrap:v2-core` (только создание/seed минимальных справочников, **без runtime side effects**).

### Recursive CTE enforcement (links)

* [ ] Реализовать SQL helper для link insert с cycle check:

  * запрет циклов для `parent/depends_on/compensates`
  * вынести в `db` слой функцию/SQL snippet (Drizzle `sql`).
* [ ] Тесты на цикл/самоссылку/дубликаты.

---

# 3) `@bedrock/idempotency` (новый core пакет)

*(или внутри `kernel`, но лучше отдельный пакет для reuse)*

### Action receipts service

* [ ] `createActionReceiptTx(scope, key, requestHash, actor, meta)`:

  * insert-or-select existing (unique constraint)
  * если exists и hash mismatch → `409 Conflict`
  * если exists и ok → вернуть сохраненный result
* [ ] `completeActionReceiptTx(receiptId, { status, resultJson | errorJson })`
* [ ] `withIdempotencyTx({scope,key,request}, handler)` — wrapper для сервисов

---

# 4) `@bedrock/packs` / `@bedrock/accounting` (pack compiler + runtime)

## 4.1 `@bedrock/packs-schema` (если разделять)

* [ ] Zod схемы raw pack definition:

  * dimensions, accounts, posting codes, templates, correspondence, intercompany rules, allowlist module/template
* [ ] Canonical normalization rules для compiler input.

## 4.2 `@bedrock/accounting` (compiler + runtime)

### Compiler

* [ ] `validatePackDefinition(def) -> PackValidationResult`
* [ ] `compilePack(def) -> CompiledPack`:

  * deterministic ordering
  * compiled indexes/maps
  * checksum = sha256(canonicalJson(compiled))
* [ ] Compile-time invariant checks (дубликаты, неизвестные ссылки, dimension policy, intercompany ambiguity, correspondence conflicts).

### Storage + activation

* [ ] Табличный формат хранения compiled packs в DB (`accounting_pack_versions`):

  * `pack_key`, `version`, `checksum`, `compiled_json`, `compiled_at`
* [ ] `activatePackForScope(scopeId, packChecksum, effectiveAt?)` → пишет assignment.
* [ ] `loadActiveCompiledPackForBook(bookId, at)`:

  * resolve scope -> assignment -> packChecksum
  * загрузка из DB + in-memory cache (LRU + TTL + negative cache)

### Runtime resolver

* [ ] `resolvePostingPlan({ plan, bookIdContext?, at }) -> { intent, packChecksum, planChecksum, intentChecksum, appliedTemplates }`

  * validate template keys
  * validate required dims/bookRefs
  * apply intercompany routing
  * output `JournalIntent` (create/post_pending/void_pending)

---

# 5) `@bedrock/books`

### Books model

* [ ] CRUD/lookup минимальный:

  * `createBook`
  * `getBook`
  * `listBooksByCounterparty`
* [ ] `resolveBookForOperationalAccount(operationalAccountId, currency)` (если нужно в core), но без доменной логики.
* [ ] Таблица `operational_account_book_bindings` (если выносишь биндинг из operational-accounts).

### Book account instances

* [ ] `ensureBookAccountInstanceTx({ bookId, accountCode, currency, dimensions }) -> instanceId`

  * deterministic identity hashing
  * upsert в `book_account_instances` (если ledger хранит это)
* [ ] Кеширование identity (LRU) в worker/process (не в DB).

---

# 6) `@bedrock/ledger`

### Commit API (bookId per create line)

* [ ] Обновить типы `JournalIntent`, `CreateLine` (обязательный `bookId`).
* [ ] `commitTx(intent)`:

  * idempotency по `intent.idempotencyKey` (или через action_receipts/ledger unique)
  * валидация линий:

    * create-line balanced внутри bookId
    * валюты, amountMinor > 0
* [ ] Persistence:

  * `ledger_operations` (immutable intent + metadata)
  * `postings` (book_id per posting)
  * `tb_plans` / `outbox` записи
* [ ] Raw reads:

  * `listOperations`
  * `getOperationDetails` (без labels)
  * `listPostings`

### Worker (posting)

* [ ] `createLedgerWorker(deps)` без бизнес-импортов:

  * outbox claim
  * generate TB transfers
  * update ledger_operations status posted/failed

---

# 7) `@bedrock/documents`

### Document kernel service

* [ ] Табличная модель + optimistic version.
* [ ] Команды (все идемпотентные через action_receipts):

  * [ ] `createDraft`
  * [ ] `updateDraft`
  * [ ] `submit`
  * [ ] `approve`
  * [ ] `reject`
  * [ ] `post`
  * [ ] `cancel`
  * [ ] `repost` (для failed)
* [ ] `document_events` append-only на каждый action (+ denial events).
* [ ] `document_links` управление + enforcement:

  * insert link через recursive CTE checks (через db helper)
  * policy validation hooks (пока core-only: allowed link types + acyclic)
* [ ] `document_operations` запись после `post`.
* [ ] `document_snapshots`:

  * create exactly once when ledger op becomes `posted`
  * сохранять: frozen payload + packChecksum + planChecksum + intentChecksum + plan+intent json.

### Module registry (core-only)

Без доменов — только интерфейс:

* [ ] `DocumentModule` contract (buildPostingPlan + schemas + deriveSummary)
* [ ] `createDocumentModuleRegistry(modules[])`
* [ ] В ядре обеспечить:

  * валидировать docType registered
  * не выполнять бизнес checks кроме module hooks

### Posting pipeline в `post()`

* [ ] Lock document row `FOR UPDATE`
* [ ] Check state machine + policy service
* [ ] `module.buildPostingPlan(doc)`
* [ ] `accounting.resolvePostingPlan(plan, at)`
* [ ] `ledger.commit(intent)` в той же транзакции (или строго определенный tx boundary)
* [ ] insert `document_operations(kind='post')`
* [ ] set `posting_status='posting'`, `posting_started_at`
* [ ] write event

### Documents finalizer worker

* [ ] `createDocumentsFinalizerWorker(deps)`:

  * claim documents where `posting_status='posting'`
  * join document_operations -> ledger_operations
  * если ledger posted:

    * set `posting_status='posted'`, `posted_at`
    * write snapshot (если еще нет)
    * write event
  * если ledger failed:

    * set `posting_status='failed'`, `posting_error`
    * write event

---

# 8) `@bedrock/balances` (async projector + exactly-once)

### Core service

* [ ] `getBalance(subject)`
* [ ] `reserve({ subject, amount, holdRef, reason }, idempotencyKey)`
* [ ] `release(...)`
* [ ] `consume(...)`
* [ ] Реализация через:

  * `balance_holds` unique by (book,subject,currency,hold_ref)
  * `balance_positions` row lock
  * запись `balance_events` append-only

### Async ledger→balances projector

* [ ] Таблица cursor/offset для projector (`balance_projector_cursor` или reuse outbox cursor).
* [ ] Worker:

  * читает **posted** ledger operations по cursor
  * вычисляет deltas по postings
  * пишет `balance_events` с unique `(operation_id)` для exactly-once
  * обновляет `balance_positions`
* [ ] Invariants:

  * projector idempotent
  * пропуски/повторы безопасны

---

# 9) `@bedrock/reconciliation`

### Immutable ingestion

* [ ] `ingestExternalRecord({ source, sourceRecordId, rawPayload, normalizedPayload, normalizationVersion }, idempotencyKey)`

  * unique (source, sourceRecordId)
  * сохранять hash
  * action_receipt scope `recon.ingestExternalRecord`

### Runs + matches + exceptions

* [ ] `runReconciliation({ source, rulesetChecksum, inputQuery })`

  * deterministic output (rulesetChecksum + inputQuery фиксируются)
  * пишет `reconciliation_runs`
  * пишет `reconciliation_matches` и `reconciliation_exceptions`
* [ ] `listExceptions(filters)`
* [ ] `explainMatch(matchId)` (возвращает explanation json)
* [ ] `createAdjustmentDocument(exceptionId, adjustmentDocSpec, idempotencyKey)`

  * создает документ через `documents` (core pipeline), не пишет ledger напрямую

---

# 10) `@bedrock/labels` / `@bedrock/dimensions` (инфра)

### Dimension registry

* [ ] Типы:

  * `DimensionKey` string union (не обязательно compile-time, но registry runtime)
  * `DimensionRegistryEntry { key, type, validate, resolveLabels? }`
* [ ] `createDimensionRegistry(entries[])`
* [ ] Batch resolve API:

  * `resolveLabels(valuesByKey: Record<key, string[]>) -> Record<key, Record<id,label>>`
* [ ] Cache layer:

  * LRU + TTL
  * negative cache

---

# 11) `@bedrock/accounting-reporting` (core reporting без домена)

*(минимум, чтобы UI мог показывать “человеческое” — но без бизнес-агрегаций)*

* [ ] `createReportingService(deps)`:

  * использует ledger raw reads
  * использует dimension registry/label resolvers
  * выдает view models:

    * `getOperationDetailsWithLabels(operationId)`
    * `listOperationsWithLabels(query)`
* [ ] Никаких доменных расчетов (P&L, PSP fees, casino GGR) — это будет отдельными модулями позже.

---

# 12) `apps/workers` (adapter)

* [ ] Скомпозить core workers:

  * ledger posting worker
  * documents finalizer worker
  * balances projector worker
  * reconciliation worker (если нужен по cron)
* [ ] Общая infra: graceful shutdown, retries, metrics, health endpoints.

---

# 13) `apps/api` (adapter)

* [ ] Core routes `/v2/docs/*` (универсальные):

  * create/update/submit/approve/reject/post/cancel/repost
  * list/get/details
* [ ] Core read routes:

  * ledger raw (тех) + reporting with labels
  * balances read
  * reconciliation endpoints (ingest/run/exceptions)
* [ ] Middleware:

  * idempotency key extraction + enforcement
  * correlation context injection
  * auth policy evaluation hooks (DocumentActionPolicyService)

---

# 14) Tests (минимальный набор по core)

### Determinism + idempotency

* [ ] один и тот же action replay → тот же result
* [ ] тот же key с другим payload → 409
* [ ] `post` replay → тот же operationId

### Documents

* [ ] state machine transitions
* [ ] maker-checker deny event
* [ ] link cycle rejection (recursive CTE)
* [ ] snapshot created once on posted

### Accounting packs

* [ ] compile deterministic checksum
* [ ] runtime executes only compiled
* [ ] missing templateKey fails

### Ledger

* [ ] multi-book operation commit
* [ ] create-line requires bookId
* [ ] outbox->posted lifecycle

### Balances

* [ ] reserve prevents negative available
* [ ] holds idempotent by holdRef
* [ ] projector exactly-once by operationId

### Reconciliation

* [ ] ingestion immutable unique
* [ ] run deterministic (same ruleset+input)
* [ ] adjustment creates document (не прямой ledger write)
