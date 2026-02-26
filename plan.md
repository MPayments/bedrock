Ниже — **конкретный план трансформации** в “platform layer / applications layer” с жёсткими границами ответственности, **без backward compatibility**, с правом переименовать/удалить сущности. Я дам целевую модель, новые контракты, новую схему хранения и пошаговый план перехода.

---

# Target Architecture vNext

## Цели

1. Убрать двусмысленность аналитик (сейчас они одновременно “в проводке” и “в сущностях”).
2. Сделать ядро масштабируемым на **banking / casino / FX** без расползания CoA и без бесконечных `analytic_*` колонок.
3. Зафиксировать: **операционная модель = Subledger (TB-first)**, финансовая модель = CoA / postings.

Ключевое решение:
**BookAccount становится “инстансом счёта + измерений (dimensions)”**, а не только `(org, account_no, currency)`.
Аналитика больше не “болтается” в `ledger_postings` как набор колонок, она живёт внутри `book_accounts.dimensions`.

---

# Layers of Responsibility

## 1) Platform Layer (инварианты, движок, политики)

Пакеты (новые/переименованные):

### `@bedrock/kernel`

* ошибки, логгер, детерминизм, canon, hash, planKey
* **никаких доменных сущностей** (orders, transfers, customers)

### `@bedrock/db`

* схемы БД (чистые таблицы), миграции

### `@bedrock/ledger`

**Единственный gate на запись финансовых фактов.**

* `ledger.commit(tx, OperationIntent)` (вместо `createOperationTx`)
* генерит:

  * `operations` (бывш. ledger_operations)
  * `postings` (дебет/кредит ссылками на BookAccountInstance)
  * `tb_plan`
  * outbox job
* строгая идемпотентность по `(idempotency_key, payload_hash)`

### `@bedrock/operational-accounts`

Управляет **инстансами BookAccount** и “привязками” внешних endpoints:

* `OperationalAccount` (OA) остаётся как внешний endpoint (single-currency)
* но **OA не “задаёт postingAccountNo напрямую”**, это переносится в policy level
* сервис отвечает за:

  * `resolveBookAccountInstance(...)`
  * `bindOperationalAccount(...)` (OA -> book_account_instance_id)

### `@bedrock/accounting`

Глобальная политика и матрица:

* Chart of Accounts (CoA) — **только глобальный**
* Posting matrix — **только глобальная**
* Но **вместо “required analytics columns”** политика описывает:

  * какие **dimensions** допустимы/обязательны для `account_no`
  * какие dimensions **обязательны** для `posting_code`
  * какие пары Дт/Кт разрешены

> Это превращает “аналитики” в типизированные измерения, а не в колонки `analytic_*`.

### `app/workers`

* ledger outbox worker (TB publish)
* общие механики lease/retry/backoff

---

## 2) Applications Layer (use-cases и доменные состояния)

Пакеты:

### `@bedrock/treasury`

* payment order lifecycle, FX execution, payout, fee-payment
* строит `OperationIntent` (но НЕ пишет напрямую в таблицы ledger)
* доменная идемпотентность + CAS статусов

### `@bedrock/transfers`

* maker/checker transfers, pending/settle/void
* строит `OperationIntent`

### `apps/api` (composition root)

* wires platform + applications
* поднимает routes и workers

---

# Core Data Model vNext

## A) OperationalAccount (OA) — остаётся, но упрощается

`operational_accounts` (single-currency endpoint):

* `id`
* `counterparty_id`
* `currency_id`
* provider fields
* `stable_key`
* **удаляем `postingAccountNo` из OA как первичный драйвер бухгалтерии** (подробнее ниже)

OA теперь отвечает только за “куда реально уходят/приходят деньги” и принадлежность/внешние реквизиты.

---

## B) BookAccount becomes “BookAccountInstance”

Заменяем текущий `book_accounts (org, account_no, currency)` на:

### `book_account_instances`

* `id`
* `book_org_id`
* `account_no`
* `currency`
* `dimensions jsonb` (строго нормализованный формат)
* `dimensions_hash` (uniq key)
* `tb_ledger`
* `tb_account_id`

Уникальность:

* `(book_org_id, account_no, currency, dimensions_hash)` unique

**Dimensions — это единственное место, где живут:**

* `operationalAccountId`
* `customerId`
* `orderId`
* `counterpartyId`
* `clearingKind`
* `roundId` (casino)
* `gameId` (casino)
* etc.

---

## C) Bindings

### `operational_account_bindings`

OA -> BookAccountInstance:

* `operational_account_id`
* `book_account_instance_id`

Уникальность: 1:1 (или 1:many, если хочешь разные “представления” OA; но начни с 1:1).

---

## D) Postings become minimal

`postings` (бывш. ledger_postings) больше **не хранит** `analytic_*` колонки.
Хранит только:

* `operation_id`
* `line_no`
* `book_org_id`
* `debit_book_account_instance_id`
* `credit_book_account_instance_id`
* `posting_code`
* `currency`
* `amount_minor`
* `memo`
* (опционально) `context jsonb` для редких “не-измерений” (например quoteId, externalRef)

**Критично:** никаких `analyticCounterpartyId`, `analyticOrderId` и т.п.
Это вытаскивается из `debit/credit book_account_instances.dimensions`.

---

# Accounting Policy vNext (однозначно)

## 1) CoA accounts define allowed/required DIMENSIONS

Вместо `chart_template_account_analytics` (колоночного) делаем:

### `chart_account_dimension_policy`

* `account_no`
* `dimension_key` (например `operationalAccountId`)
* `mode`: `required | optional | forbidden`

Пример:

* `1110 BANK`: required `operationalAccountId`
* `2110 CUSTOMER_WALLET`: required `customerId`
* `2140 ORDER_RESERVE`: required `orderId`
* `13xx CLEARING`: required `clearingKind`, + maybe required `counterpartyId` (зависит от kind)

## 2) PostingCode defines required DIMENSIONS (intent-level)

### `posting_code_dimension_policy`

* `posting_code`
* `dimension_key`
* `required bool`

Пример:

* `FX_LEG_OUT`: required `{ orderId, counterpartyId, clearingKind="treasury_fx" }`
* `TRANSFER_CROSS`: required `{ counterpartyId, clearingKind="intercompany" }`
* casino bet: required `{ customerId, roundId }`

## 3) Correspondence rules remain global

`correspondence_rules` остаётся:

* `(posting_code, debit_account_no, credit_account_no)` allowed

Но валидатор теперь проверяет:

* соответствует ли **созданный BookAccountInstance** policies по dimensions

---

# New Write Contract: OperationIntent

## `OperationIntent`

То, что доменные сервисы передают в ledger gate:

* `source { type, id }`
* `operation_code`
* `idempotency_key`
* `posting_date`
* `book_org_id` (может быть SYSTEM для treasury)
* `lines[]`

## `lines[]`

Каждая строка:

* `posting_code`
* `debit { account_no, currency, dimensions }`
* `credit { account_no, currency, dimensions }`
* `amount_minor`
* `memo`
* `tb_action` (`create | post_pending | void_pending`)

Ledger gate:

1. валидирует correspondence rule
2. валидирует dimension policies (account_no + posting_code)
3. резолвит/создаёт book_account_instances (детерминированно по hash)
4. пишет postings, tb_plan, outbox

---

# Determined Attribution Model (фиксируем навсегда)

## Treasury (SYSTEM book org)

* `book_org_id = SYSTEM`
* реальная атрибуция идёт **через dimensions**, не через org:

  * `counterpartyId`, `orderId`, `customerId`, `operationalAccountId`

## Transfers

* `book_org_id` может быть:

  * либо SYSTEM (рекомендую унифицировать и тоже сделать SYSTEM, а атрибуцию через dims)
  * либо “owner org” как сейчас

**Рекомендация для однозначности и масштабируемости:**

> **все** операции в едином ledger book-org = SYSTEM.
> “Орг-атрибуция” и отчётность строится через dimensions и справочники (counterparty/customer).

Так ты избежишь “в transfers org значит одно, в treasury другое”.

---

# Simplification: Clearing Accounts

Чтобы CoA не разрастался:

## Вместо 1310/1320/1330…

* делаем один `1300 CLEARING` (или оставляем 1310 как номер, но смысл один)
* различение по dimension:

  * `clearingKind = "intercompany" | "treasury_fx" | "casino_settlement" | ...`

Policy:

* `1300` требует `clearingKind`
* для intercompany — ещё требует `counterpartyId`
* для treasury_fx — требует `orderId + counterpartyId`
* для casino_settlement — требует `roundId` (или settlement batch id)

---

# Concrete Transformation Plan (No Backward Compatibility)

## Phase 0 — Preparation (code structure)

1. Удалить из доменных пакетов прямые обращения к:

* `book_accounts` (старое)
* `ledger_postings.analytic_*`

---

## Phase 1 — DB Hard Reset (migration wave)

**Breaking** миграция (без сохранения старого пути):

1. Таблицы:

* `book_accounts` -> DROP
* создать `book_account_instances`
* `operational_accounts_book_bindings` -> заменить на `operational_account_bindings` (OA -> instance)
* `ledger_postings` -> заменить на новую структуру без analytic колонок
* `chart_template_account_analytics` -> DROP
* создать `chart_account_dimension_policy`
* создать `posting_code_dimension_policy`

2. Перенос соответствий:

* correspondence_rules остаётся
* accounts chart остаётся, но переносим “analytics requirements” в dimension policies

3. Индексы/уникальности:

* instance uniq `(book_org_id, account_no, currency, dimensions_hash)`
* postings uniq `(operation_id, line_no)`

---

## Phase 2 — Platform Ledger Gate rewrite

Переписать `ledger.createOperationTx` → `ledger.commit`:

* вход принимает `OperationIntent` с dimensions
* обеспечивает:

  * policy validation (account_no + posting_code)
  * deterministic instance resolution
  * posting persistence
  * tb plan + outbox

TB worker почти без изменений, но:

* вместо `tbBookAccountIdFor(orgId, accountNo, currency)` будет `tbBookAccountIdFor(instance_id hash)`.

---

## Phase 3 — OperationalAccount binding rewrite

`createOperationalAccount` больше не принимает `postingAccountNo` как “ручную бухгалтерию”.

Новый контракт:

* OA создаётся как внешний endpoint
* затем вызывается `bindOperationalAccount(oaId, role)` где `role` (например `bank_settlement`, `custody`, `provider_fee`)
* policy решает какой `account_no` и dimensions использовать

Пример:

* роль `bank_settlement` => account_no=1110, dimensions={ operationalAccountId: oaId }

(Если хочешь оставить ручной override — делай это отдельным admin-процессом policy, а не полем OA.)

---

## Phase 4 — Rewrite Applications to emit dimensions

### Treasury

* funding/payout/executeFx/fee-payment теперь формируют lines так:

  * `1110 BANK` всегда через dimensions `{ operationalAccountId }`
  * `2110 CUSTOMER_WALLET` через `{ customerId }`
  * `2140 ORDER_RESERVE` через `{ orderId }`
  * `1300 CLEARING` через `{ clearingKind:"treasury_fx", orderId, counterpartyId }`
  * fees:

    * income: `{ customerId, orderId, feeBucket }` где feeBucket может быть dimension у revenue account или context (на выбор)
    * expense accrual: `{ orderId, counterpartyId, feeBucket }`

### Transfers

* переносим на те же принципы:

  * source/dest bank movement — через `{ operationalAccountId }`
  * intercompany clearing — `1300` with `{ clearingKind:"intercompany", counterpartyId }`

---

## Phase 5 — Reporting rewrite

Financial results теперь строятся:

* из postings (минимальные)
* join на book_account_instances.dimensions
* dimension extraction (jsonb operators) + справочники

Появляется единый механизм:

* отчёт “по контрагенту” = group by dimensions.counterpartyId
* отчёт “по order” = group by dimensions.orderId
* отчёт “по bank account” = group by dimensions.operationalAccountId

---

# What gets deleted / simplified immediately

1. `ledger_postings.analytic_*` — удаляем полностью.
2. `chart_template_account_analytics` — удаляем полностью.
3. “двойная проверка аналитик” → заменяется на:

   * account dimension policy
   * posting code dimension policy
4. `postingAccountNo` как внешний “рычаг бухгалтерии” из OA — убираем.
5. Clearing-сплит 1310/1320 → заменяем на single clearing + `clearingKind` dimension.

---

# Concrete example mapping (FX core)

**FX principal**

* Dr `2110` dims `{ customerId }`
* Cr `2140` dims `{ orderId }`

**FX leg out**

* Dr `2140` dims `{ orderId }`
* Cr `1300` dims `{ clearingKind:"treasury_fx", orderId, counterpartyId }`

**FX leg in**

* Dr `1300` dims `{ clearingKind:"treasury_fx", orderId, counterpartyId }`
* Cr `2140` dims `{ orderId }`

**Payout initiated**

* Dr `2130 PAYOUT_OBLIGATION` dims `{ orderId }` (или `{ orderId, counterpartyId }`)
* Cr `1110 BANK` dims `{ operationalAccountId }`

---

# Package-level ownership summary (hard boundaries)

## Platform

* **ledger**: commit + validation + persistence + tb plan + outbox
* **accounting**: global rules (correspondence + dimension policies)
* **operational-accounts**: OA lifecycle + binding to book_account_instances
* **workers**: posting workers

## Applications

* **treasury**: order state machines, invariants, builds intents
* **transfers**: transfer state machines, builds intents

## apps/api

* composition root only: wiring + routes + worker entrypoints

---

# Acceptance Criteria (binary)

1. В БД **нет** analytic колонок в postings.
2. Любая атрибуция делается через `book_account_instances.dimensions`.
3. Любая операция проходит через `ledger.commit(intent)`; домены не пишут postings напрямую.
4. CoA и matrix глобальные; required analytics заменены на dimension policies.
5. Clearing счёт один, различение через `clearingKind`.