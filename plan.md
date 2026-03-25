# Phase 2: Перенос бизнес-логики MPayments в Bedrock DDD

## Context

Phase 1 завершена: `@bedrock/operations` содержит 17 ops_* Drizzle-схем и FK-мосты к bedrock-сущностям. MPayments NestJS продолжает работать с теми же таблицами. Цель Phase 2 — перенести бизнес-логику из NestJS-сервисов в DDD-модуль `@bedrock/operations` по архитектуре bedrock (contracts/domain/application/adapters). API-роуты и Telegram-бот будут в Phase 3.

> **Замечание:** Сервисы обменных курсов MPayments (CBR, Investing.com) полностью заменены модулем `@bedrock/treasury`. Миграция не требуется. Telegram-бот будет переписан с нуля в Phase 3 — переносить текущую реализацию не планируется.

---

## Архитектурные решения

### 1. Всё в `@bedrock/operations` как субдомены

Applications, calculations, deals — один bounded context (тесный lifecycle: application → calculation → deal). Паттерн аналогичен `@bedrock/parties` (4 субдомена в одном модуле).

```
packages/modules/operations/src/
  agents/              -- профиль агента (расширение bedrock user)
  clients/             -- тонкий адаптер над @bedrock/parties counterparties
  contracts/           -- контракты (агент-орг ↔ клиент)
  applications/        -- lifecycle заявок
  calculations/        -- расчёты (интеграция с @bedrock/treasury)
  deals/               -- lifecycle сделок (ядро)
  activity-log/        -- аудит
  shared/              -- общий UoW type, порты
  infra/drizzle/schema/  -- [СУЩЕСТВУЕТ] все 17 таблиц централизованно
  module.ts            -- module factory
  index.ts             -- [СУЩЕСТВУЕТ] обновить: re-export module factory + schema
  schema.ts            -- [СУЩЕСТВУЕТ] re-export схем
  contracts.ts         -- [СУЩЕСТВУЕТ] public DTOs placeholder → заполнить
  adapters/drizzle.ts  -- [СУЩЕСТВУЕТ] adapter exports placeholder → заполнить
```

### 2. Схемы: централизованные (отличие от parties)

В parties каждый субдомен владеет `adapters/drizzle/schema.ts`. В operations все 17 таблиц уже в `infra/drizzle/schema/`. **Оставляем централизованными.** Субдомен-адаптеры импортируют из `../../infra/drizzle/schema/`. Причины:
- Таблицы стабильны (Phase 1 завершена)
- Перенос → ненужный churn + сломает импорты в `apps/db`
- Таблицы тесно связаны FK внутри одного контекста

### 3. Command/query handler — class-based (по образцу parties)

```typescript
// Команда — класс с execute()
export class CreateApplicationCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly unitOfWork: ApplicationsCommandUnitOfWork,
  ) {}
  async execute(input: CreateApplicationInput) { ... }
}

// Сервис-фабрика — инстанцирует классы, экспортирует bound-методы
export function createApplicationsService(deps: ApplicationsServiceDeps) {
  const create = new CreateApplicationCommand(deps.runtime, deps.commandUow);
  return {
    commands: { create: create.execute.bind(create) },
    queries: { list: listApps.execute.bind(listApps) },
  };
}
```

### 4. ops_* таблицы остаются как extension tables

НЕ добавляем mpayments-колонки в bedrock-таблицы (counterparties, organizations, requisites). ops_clients — это operations-specific проекция counterparty с i18n, INN/KPP, sub-agent привязкой. FK-мосты связывают.

### 5. MPayments NestJS продолжает работать параллельно

Phase 2 создаёт бизнес-логику в bedrock без HTTP-роутов. NestJS пишет в те же ops_* таблицы. Hono API endpoints — Phase 3.

---

## Порядок миграции

### Step 0: DDD-скелет (~0.5 дня) [DONE]

Создать структуру директорий и shared-слой в `@bedrock/operations`.

**Файлы:**
- `src/shared/application/unit-of-work.ts` — общий UoW type (по образцу `parties/shared/application/unit-of-work.ts`)
- `src/shared/application/notification.port.ts` — порт для email-нотификаций
- `src/module.ts` — `createOperationsModule(deps)` с `createModuleRuntime` из `@bedrock/shared/core`
- Обновить `src/index.ts` — re-export module factory + schema
- Обновить `package.json` exports

**Паттерн (`parties/module.ts:49-87`):**
```typescript
export function createOperationsModule(deps: OperationsModuleDeps) {
  const createRuntime = (service: string) =>
    createModuleRuntime({ logger: deps.logger, now: deps.now, generateUuid: deps.generateUuid, service });
  return {
    activityLog: createActivityLogService({ runtime: createRuntime("operations.activity-log"), ... }),
    // добавляются по мере портирования
  };
}
```

---

### Step 1: Activity Log (~1 день) [DONE]

Чистый CQRS без domain-логики. Нужен всем доменам.

**Файлы:**
- `src/activity-log/application/contracts/` — Zod: `LogActivityInput`, `ListActivitiesQuery`, `ActivityLogDto`
- `src/activity-log/application/commands/log-activity.ts` — `LogActivityCommand` class
- `src/activity-log/application/queries/list-activities.ts` — `ListActivitiesQuery` class с пагинацией
- `src/activity-log/application/ports/activity-log.repository.ts` — port interface
- `src/activity-log/application/index.ts` — `createActivityLogService()`
- `src/activity-log/adapters/drizzle/activity-log.repository.ts` — реализация через `opsActivityLog`

**Источник:** `/mnt/disks/sata240/work/mpayments-web/apps/backend/src/activity-log/activity-log.service.ts`

---

### Step 2: Contracts (~1-2 дня) [DONE]

Контракт связывает клиента с банк. реквизитами агент-организации + условия комиссии.

**Domain:**
- `src/contracts/domain/contract.ts` — entity с инвариантами (банк принадлежит организации, уникальность номера)

**Application:**
- `src/contracts/application/commands/` — `CreateContractCommand`, `UpdateContractCommand`
- `src/contracts/application/queries/` — `FindContractsByClientQuery`
- `src/contracts/application/ports/` — repository, reads
- `src/contracts/application/contracts/` — Zod schemas, DTOs
- `src/contracts/application/index.ts` — `createContractsService()`

**Adapters:**
- `src/contracts/adapters/drizzle/` — реализация через `opsContracts`

**Источник:** `/mnt/disks/sata240/work/mpayments-web/apps/backend/src/client/contract.service.ts`

---

### Step 3: Auth — расширение ролей (~2 дня) [DONE]

**Ключевое:** `user.role` — колонка типа `text` (не pgEnum), определена в `@bedrock/platform/auth-model/schema.ts`. Валидация — только TypeScript. **DB-миграция не нужна.**

**Изменения в `@bedrock/users`:**
- `packages/modules/users/src/domain/user-role.ts` — расширить `USER_ROLE_VALUES` до `["admin", "user", "agent", "customer", "finance"]`

**Новое в `@bedrock/operations` (используем существующую `opsAgents`, не создаём `ops_agent_profiles`):**
- `src/agents/application/ports/agent-profile.reads.ts` — порт
- `src/agents/application/contracts/` — Zod schemas, DTOs
- `src/agents/application/queries/` — class-based query handlers
- `src/agents/application/index.ts` — `createAgentsService()`
- `src/agents/adapters/drizzle/agent-profile.reads.ts` — реализация через `opsAgents`
- Seed-скрипт: сопоставление `opsAgents` ↔ `user` по email (заполнение `bedrockUserId`)

**Источник:** `/mnt/disks/sata240/work/mpayments-web/packages/auth/src/auth.ts`, `/mnt/disks/sata240/work/mpayments-web/apps/backend/src/agent/agent.service.ts`

---

### Step 4: Applications (~2-3 дня) [DONE] [параллельно с Step 5]

State machine: `forming → created → rejected | finished`

**Domain:**
- `src/applications/domain/application.ts` — aggregate с state machine
- `src/applications/domain/application-status.ts` — enum + матрица переходов

**Application:**
- `commands/` — `CreateApplicationCommand`, `UpdateApplicationStatusCommand`, `RejectApplicationCommand`, `AssignAgentCommand`
- `queries/` — `FindApplicationByIdQuery`, `ListApplicationsQuery` (пагинация, фильтры по статусу/периоду)
- `ports/` — repository, reads, UoW
- `contracts/` — Zod schemas, DTOs
- `index.ts` — `createApplicationsService()`

**Бизнес-правила:**
- Агент создаёт заявку со статусом `created` + agentId
- Клиент создаёт со статусом `forming`, agentId = null
- `rejected` требует reason
- `finished` устанавливается только при создании deal

**Источник:** `/mnt/disks/sata240/work/mpayments-web/apps/backend/src/application/application.service.ts`

---

### Step 5: Calculations (~2-3 дня) [DONE] [параллельно с Step 4]

Расчёт: курс + комиссия + доп. расходы → итого в базовой валюте (RUB).

**Domain:**
- `src/calculations/domain/calculation.ts` — immutable entity (snapshot на момент создания)

**Application:**
- `commands/` — `CreateCalculationCommand`, `DeleteCalculationCommand`
- `queries/` — `FindCalculationByIdQuery`, `ListCalculationsByApplicationQuery`
- `ports/` — repository, reads, `treasury-rates.port.ts` (делегирует в @bedrock/treasury), notification port
- `contracts/` — Zod schemas, DTOs
- `index.ts` — `createCalculationsService()`

**Интеграция с Treasury:**
- Вместо прямых вызовов investing.com/CBR → использовать `treasury.rates.getCrossRate()`
- При создании calculation можно опционально создать `fx_quote` через treasury и записать `fx_quote_id`

**Источник:** `/mnt/disks/sata240/work/mpayments-web/apps/backend/src/calculation/calculation.service.ts`

---

### Step 6: Deals (~3-4 дня) [DONE] [зависит от Steps 4+5]

Ядро системы. State machine: `preparing_documents → awaiting_funds → awaiting_payment → closing_documents → done | cancelled`

**Domain:**
- `src/deals/domain/deal.ts` — aggregate с state machine
- `src/deals/domain/deal-status.ts` — enum + transition matrix
- `src/deals/domain/deal-document.ts` — child entity

**Application:**
- `commands/` — `CreateDealCommand`, `UpdateDealStatusCommand`, `CancelDealCommand`, `UploadDocumentCommand`, `DeleteDocumentCommand`, `UpdateDealDetailsCommand`
- `queries/` — `FindDealByIdQuery`, `ListDealsQuery` (сложная фильтрация: по клиенту, валюте, статусу, периоду, агенту + пагинация + сортировка)
- `ports/` — repository, reads, UoW, `s3.port.ts`, notification port, reporting port
- `contracts/` — Zod schemas, DTOs
- `index.ts` — `createDealsService()`

**Инварианты:**
- Один deal на application
- Sequential status progression (кроме done/cancelled — из любого)
- `awaiting_funds` требует наличие contractNumber

**Источник:** `/mnt/disks/sata240/work/mpayments-web/apps/backend/src/deal/deal.service.ts`

---

### Step 7: Agent Bonus → Ledger (~1-2 дня) [DONE] [параллельно с Step 8]

Заменить `ops_agent_bonus` на ledger postings.

**Статус:**
- [x] `SetAgentBonusCommand` — реализован в `deals/application/commands/set-agent-bonus.ts`
- [x] `opsAgentBonus` схема — есть в `infra/drizzle/schema/commissions.ts`
- [x] `DealStore.insertAgentBonus()` — реализован
- [x] Workflow `packages/workflows/deal-commission/` — СОЗДАН (`createDealCommissionWorkflow`)

**Источник:** `DealService.setNewAgentBonus()` в `/mnt/disks/sata240/work/mpayments-web/apps/backend/src/deal/deal.service.ts`

---

### Step 8: Clients — адаптер над @bedrock/parties (~1-2 дня) [DONE] [параллельно с Step 7]

Тонкий адаптер: при создании клиента в operations создаётся counterparty в parties + ops_client запись в одной транзакции.

**Статус:**
- [x] Clients субдомен ПОЛНОСТЬЮ реализован (create, update, soft-delete, list, find-by-id)
- [x] `counterpartyId` поле в Client DTO и схеме
- [x] `integration-mpayments` workflow показывает паттерн (maps clients → counterparties)
- [x] Порт `CounterpartiesPort` в `clients/application/ports/counterparties.port.ts` — СОЗДАН
- [x] `CreateClientCommand` обновлён — вызывает counterparties port при создании

**Оставшаяся работа:**
1. Добавить `CounterpartiesPort` interface в `clients/application/ports/counterparties.port.ts`
   - `findOrCreateCounterparty(clientData): Promise<string>` (returns counterparty UUID)
2. Обновить `CreateClientCommand` — вызывать counterparties port, записывать `counterpartyId`
3. Реализовать adapter, делегирующий в `@bedrock/parties` counterparties service
4. Прокинуть в `apps/api/src/composition/operations-module.ts`

**Отложено:**
- `ImportFromExcelCommand` — перенос позже
- `SearchDadataQuery` — см. Step 11 (DaData порт)

**Источник:** `/mnt/disks/sata240/work/mpayments-web/apps/backend/src/client/client.service.ts`

---

### Step 9: Sub-Agents (~1 день) [DONE] [параллельно с Steps 7-8]

Управление суб-агентами с отслеживанием комиссий. Таблица `ops_sub_agents` уже существует в схеме.

**Application:**
- `src/agents/application/commands/create-sub-agent.ts` — `CreateSubAgentCommand`
- `src/agents/application/commands/update-sub-agent.ts` — `UpdateSubAgentCommand`
- `src/agents/application/commands/delete-sub-agent.ts` — `DeleteSubAgentCommand`
- `src/agents/application/queries/list-sub-agents.ts` — `ListSubAgentsQuery`
- `src/agents/application/ports/sub-agent.store.ts` — port interface
- `src/agents/application/ports/sub-agent.reads.ts` — port interface
- `src/agents/application/contracts/sub-agent-commands.ts` — Zod schemas
- `src/agents/application/contracts/sub-agent-dto.ts` — DTO

**Adapters:**
- `src/agents/adapters/drizzle/sub-agent.store.ts` — через `opsSubAgents`
- `src/agents/adapters/drizzle/sub-agent.reads.ts` — через `opsSubAgents`

**Обновить:**
- `src/agents/application/index.ts` — добавить sub-agent commands/queries в `createAgentsService()`
- `src/module.ts` — добавить sub-agent deps
- `src/adapters/drizzle.ts` — экспортировать новые адаптеры
- `src/contracts.ts` — экспортировать sub-agent contracts

**Источник:** `/mnt/disks/sata240/work/mpayments-web/apps/backend/src/client/sub-agent.service.ts`

---

### Step 10: Object Storage порт (~1 день) [DONE] [Phase 2 порт, Phase 3 реализация]

Port interface для object storage. Deals и clients ссылаются на `s3Key` в документах.

**Port (в operations module):**
- `src/shared/application/ports/object-storage.port.ts`
  ```typescript
  export interface ObjectStoragePort {
    upload(key: string, data: Buffer, contentType: string): Promise<string>;
    download(key: string): Promise<Buffer>;
    getSignedUrl(key: string, expiresInSeconds?: number): Promise<string>;
    delete(key: string): Promise<void>;
    queueForDeletion(key: string): Promise<void>;
  }
  ```

**Phase 2:** no-op/stub реализация в composition.
**Phase 3:** `packages/platform/src/object-storage/` с S3 adapter (`@aws-sdk/client-s3`).

**Существующие схемы:** `ops_s3_cleanup_queue`, `ops_deal_documents`, `ops_client_documents` — все уже в bedrock.

---

### Step 11: DaData порт (~0.5 дня) [DONE] [параллельно с Step 10]

Поиск компании по ИНН через Tbank DaData API.

**Port:**
- `src/clients/application/ports/company-lookup.port.ts`
  ```typescript
  export interface CompanyLookupPort {
    searchByInn(inn: string): Promise<CompanyLookupResult | null>;
  }
  ```
- `src/clients/application/contracts/company-lookup-dto.ts` — Zod: `CompanyLookupResult`

**Query:**
- `src/clients/application/queries/search-company.ts` — `SearchCompanyQuery` class

**Phase 3 adapter:**
- `src/clients/adapters/dadata/company-lookup.adapter.ts` — HTTP fetch to Tbank API

**Обновить:**
- `src/clients/application/index.ts` — добавить `searchCompany` query
- `src/module.ts` — добавить `companyLookup` dep (optional)

**Источник:** `/mnt/disks/sata240/work/mpayments-web/apps/backend/src/client/dadata.service.ts`

---

### Step 12: Notification порт (~0.5 дня) [DONE] [Phase 2 порт, Phase 3 реализация]

Port для email-уведомлений (смена статусов, новые расчёты).

**Port:**
- `src/shared/application/ports/notification.port.ts`
  ```typescript
  export interface NotificationPort {
    notifyDealStatusChanged(dealId: number, status: string, agentId: number): Promise<void>;
    notifyNewCalculation(calculationId: number, agentId: number): Promise<void>;
    notifyApplicationCreated(applicationId: number): Promise<void>;
  }
  ```

**Phase 2:** no-op/console-log реализация.
**Phase 3:** `packages/platform/src/notifications/` с Resend adapter.

**Прокинуть в:**
- `deals/application/commands/update-deal-status.ts` — вызов notification при смене статуса
- `calculations/application/commands/create-calculation.ts` — вызов notification при создании

**Источник:** `/mnt/disks/sata240/work/mpayments-web/apps/backend/src/notification/notification.service.ts`

---

### Step 13: Customer субдомен (~2-3 дня) [DONE] [зависит от Steps 4, 5, 6, 8]

Портал клиента: клиент создаёт заявки/сделки, запрашивает расчёты. Роль `customer` уже добавлена в Step 3.

**NOTE:** Customer — это НЕ отдельный модуль. Это facade/workflow поверх существующих субдоменов operations с ролевыми ограничениями.

**Варианты реализации:**

**Вариант A — порт в operations:**
- `src/shared/application/ports/customer.port.ts` — `getClientIdForUser()`, `assertCustomerOwnsApplication()`

**Вариант B — workflow (если кросс-модульная оркестрация):**
- `packages/workflows/customer-portal/src/service.ts` — `createCustomerPortalWorkflow(deps)`
  - deps: `operations.applications`, `operations.calculations`, `operations.deals`, `operations.clients`
  - Methods: `createApplication()`, `requestCalculation()`, `listMyDeals()`
  - Enforces: customer видит только свои данные, ограниченные state transitions

**API routes (Phase 3):**
- `apps/api/src/routes/customer/` — customer-facing Hono routes с auth middleware

**Источник:** `/mnt/disks/sata240/work/mpayments-web/apps/backend/src/customer/customer.service.ts`

---

### Step 14: AI модуль (~2-3 дня) [DONE — порты] [независимый]

Отдельный platform subpath для AI-powered document data extraction.

**Расположение:** `packages/platform/src/ai/` (platform subpath — инфраструктура, не бизнес-модуль)

**Файлы:**
- `packages/platform/src/ai/extraction.port.ts` — `DocumentExtractionPort`
  ```typescript
  export interface DocumentExtractionPort {
    extractFromPdf(buffer: Buffer): Promise<ExtractedDocumentData>;
    extractFromDocx(buffer: Buffer): Promise<ExtractedDocumentData>;
    extractFromXlsx(buffer: Buffer): Promise<ExtractedDocumentData>;
    translateFields(data: Record<string, string>, fromLang: string, toLang: string): Promise<Record<string, string>>;
  }
  ```
- `packages/platform/src/ai/contracts.ts` — Zod: `ExtractedDocumentData`
- `packages/platform/src/ai/openai.adapter.ts` — OpenAI gpt-4o adapter

**Зависимости (npm):** `@ai-sdk/openai`, `mammoth`, `xlsx`

**Wire в operations:**
- `clients/application/ports/document-extraction.port.ts` — operations-side порт, делегирует в platform AI

**Обновить:**
- `packages/platform/package.json` — добавить `"./ai"` subpath export + dependencies

**Источник:** `/mnt/disks/sata240/work/mpayments-web/apps/backend/src/ai/ai.service.ts`

---

### Step 15: Document Generation workflow (~2-3 дня) [DONE — скелет] [зависит от Steps 10, 14]

Генерация DOCX/PDF документов из шаблонов с i18n.

**Расположение:** `packages/workflows/document-generation/`

**Файлы:**
- `src/service.ts` — `createDocumentGenerationWorkflow(deps)`
- `src/templates/` — определения шаблонов по типам документов
- `src/contracts.ts` — Zod schemas для input/output
- `src/adapters/template-renderer.ts` — `easy-template-x` для DOCX templating
- `src/adapters/pdf-converter.ts` — `libreoffice-convert` для DOCX→PDF
- `src/adapters/excel-generator.ts` — `exceljs` для Excel export

**Типы шаблонов (из MPayments):**
- Контракт (contract)
- Счёт (invoice)
- Заявка (application)
- Расчёт (calculation)
- Акт (acceptance)

**Зависимости (npm):** `easy-template-x`, `libreoffice-convert`, `exceljs`, `lvovich`, `russian-nouns-js`

**Интеграция:**
- Вызывается из deals workflow при смене статусов → авто-генерация документов
- Использует ObjectStoragePort (Step 10) для сохранения файлов

**Источник:** `/mnt/disks/sata240/work/mpayments-web/apps/backend/src/document/document.service.ts`

---

### Step 16: Scheduled Tasks (~1 день) [DONE] [зависит от Steps 10, 12]

Перенос cron-задач из MPayments в bedrock workers.

**Новые worker entries в `apps/workers/src/catalog.ts`:**

1. **`ops-s3-cleanup`** — ежедневное удаление файлов из `ops_s3_cleanup_queue`
   - Interval: 86_400_000 (24 часа)
   - Зависит от: ObjectStoragePort (Step 10)

2. **`ops-activity-log-cleanup`** — очистка логов старше 180 дней
   - Interval: 86_400_000 (24 часа)
   - Uses: `opsActivityLog` table, DELETE WHERE created_at < now() - 180 days

**НЕ переносим:**
- `reports-scheduler` — часть Telegram бота (SKIP, будет перестроен в Phase 3)

**Источники:**
- `/mnt/disks/sata240/work/mpayments-web/apps/backend/src/s3/s3-cleanup.service.ts`
- `/mnt/disks/sata240/work/mpayments-web/apps/backend/src/activity-log/activity-log-cleanup.service.ts`

---

## Граф зависимостей

```
Steps 0-16: [ALL DONE]

Phase 2 завершена. Все шаги реализованы:
- Steps 0-6: ядро DDD (activity-log, contracts, auth, applications, calculations, deals)
- Steps 7-8: deal-commission workflow, counterparties port
- Step 9: sub-agents CRUD
- Steps 10-12: object-storage, dadata, notification ports
- Step 13: customer portal workflow
- Step 14: AI extraction port (platform)
- Step 15: document generation workflow skeleton
- Step 16: worker catalog entries
```

---

## Миграции БД

Политика: **baseline-only hard cutover** (`db:nuke → db:migrate → db:seed`).

| Step | Миграция |
|------|----------|
| Step 3 | **Нет DB-миграции.** `user.role` = `text`, не pgEnum. Только TypeScript. Seed для `bedrockUserId`. |
| Steps 1-2, 4-6 | Без миграций — существующие ops_* схемы |
| Step 7 | Опционально: новый ledger account type для agent commissions |
| Steps 9-16 | Без миграций — все таблицы (`ops_sub_agents`, `ops_s3_cleanup_queue`, `ops_client_documents`, `ops_deal_documents`) уже существуют |

---

## Тестирование

Каждый step включает:
- **Unit tests** — domain logic (state machines, invariants) с мок-портами
- **Unit tests** — command/query handlers (class instances) с мок-репозиториями
- **Integration tests** — Drizzle repositories с реальной PostgreSQL

Запуск:
```bash
bunx vitest run --config vitest.config.ts --project operations
bunx vitest run --config vitest.integration.config.ts --project operations:integration
```

---

## Ключевые файлы для reference

| Паттерн | Файл |
|---------|------|
| Module factory | `packages/modules/parties/src/module.ts` (строки 49-87) |
| Service factory (subdomain) | `packages/modules/parties/src/customers/application/index.ts` |
| Command handler (class) | `packages/modules/parties/src/customers/application/commands/create-customer.ts` |
| Query handler (class) | `packages/modules/parties/src/customers/application/queries/list-customers.ts` |
| Port interface (store) | `packages/modules/parties/src/customers/application/ports/customer.store.ts` |
| Port interface (reads) | `packages/modules/parties/src/customers/application/ports/customer.reads.ts` |
| UoW interface | `packages/modules/parties/src/shared/application/unit-of-work.ts` |
| Drizzle adapter | `packages/modules/parties/src/customers/adapters/drizzle/customer.store.ts` |
| Operations schema | `packages/modules/operations/src/infra/drizzle/schema/` |
| Operations composition | `apps/api/src/composition/operations-module.ts` |
| User roles (TS only) | `packages/modules/users/src/domain/user-role.ts` |
| User table (role=text) | `packages/platform/src/auth-model/schema.ts` |
| Integration workflow | `packages/workflows/integration-mpayments/src/service.ts` |
| Workflow factory (паттерн) | `packages/workflows/document-drafts/src/service.ts` |
| Worker catalog | `apps/workers/src/catalog.ts` |
| Platform subpath (паттерн) | `packages/platform/src/persistence/` |
| Composition wiring | `apps/api/src/composition/parties-module.ts` |
