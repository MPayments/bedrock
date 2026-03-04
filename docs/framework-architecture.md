# Архитектура Bedrock

Документ описывает текущую архитектуру монорепозитория Bedrock с фокусом на `packages/*` и на то, как они собираются в `apps/api` и `apps/workers`.

## Quick Navigation
- Слои и зоны ответственности
- Границы зависимостей и архитектурные контракты
- Потоки данных в рантайме
- Компонентная модель (`component-runtime`)
- Каталог воркеров
- Карта точек входа по коду

## Слои и зоны ответственности

| Слой | Пакеты | Назначение |
|---|---|---|
| Kernel | `@bedrock/kernel` | Общие примитивы: логгер, ошибки, worker loop, утилиты canonical/hash, DB-типы, контракты стран/паков |
| DB | `@bedrock/db` | Единый Drizzle-клиент, агрегированный schema registry, миграции, сиды |
| Core runtime | `@bedrock/core` | Базовые домены платформы: ledger, accounting, documents, connectors, orchestration, balances и др. |
| Application runtime | `@bedrock/application` | Прикладные use-case/воркфлоу: `fx`, `fees`, `payments`, `ifrs-documents`, `accounting-reporting` |
| Adapters | `apps/api`, `apps/workers`, `apps/web` | Транспорт/композиция: HTTP API, воркер-флит, UI |

Ключевая зависимость по слоям: `kernel -> core -> application -> apps`.

Источник:
- [`dependency-cruiser.cjs`](../dependency-cruiser.cjs)
- [`package.json`](../package.json)

## Границы зависимостей и архитектурные контракты

### 1. Контракты dependency rules
Запрещены следующие направления:
- `packages/core -> packages/application`
- `packages/{core,application} -> apps/*`
- внутренние импорты `packages/kernel/*` в обход `packages/kernel/src/*` export-surface

Источник: [`dependency-cruiser.cjs`](../dependency-cruiser.cjs)

### 2. Контракты runtime-импортов
Дополнительно enforced скриптами:
- Запрещены legacy runtime specifiers `@bedrock/foundation`, `@bedrock/platform`, `@bedrock/modules`, `@bedrock/<legacy-domain>`
- В runtime-коде (`packages/core/src/**`, `packages/application/src/**`) запрещен импорт `@bedrock/db/client`/`@bedrock/db/seeds` (разрешены только DB-типы)
- `pgTable(...)` разрешен только в schema-файлах
- В `apps/web` разрешен ограниченный импорт surface из `@bedrock/*`

Источники:
- [`scripts/check-boundaries.mjs`](../scripts/check-boundaries.mjs)
- [`scripts/check-deprecated-imports.mjs`](../scripts/check-deprecated-imports.mjs)

### 3. Контракт workspace-зависимостей
Внутренние пакеты должны подключаться через `workspace:*` (а не `"*"`).

Источник: [`scripts/check-workspace-deps.mjs`](../scripts/check-workspace-deps.mjs)

## Потоки данных в рантайме

### Базовый поток API
1. HTTP-запрос попадает в Hono route (например, `payments`, `accounting`, `documents`).
2. Route использует сервисы из `AppContext`.
3. Сервисы `@bedrock/core`/`@bedrock/application` выполняют валидацию, бизнес-логику и транзакции в Postgres через Drizzle.
4. Асинхронные этапы (ledger posting, projections, reconciliation, connectors) обрабатываются воркерами.

Источники:
- [`apps/api/src/app.ts`](../apps/api/src/app.ts)
- [`apps/api/src/context.ts`](../apps/api/src/context.ts)
- [`apps/api/src/composition/application.ts`](../apps/api/src/composition/application.ts)

### Поток ledger/documents (упрощенно)
1. Документ переводится в `post`.
2. Accounting runtime строит posting plan и intent.
3. Ledger сохраняет `ledger_operations` + `tb_transfer_plans` + outbox.
4. `ledger` worker публикует операции в TigerBeetle.
5. `documents`/`balances` workers финализируют статусы и проекции.

Источники:
- [`packages/core/src/accounting/runtime.ts`](../packages/core/src/accounting/runtime.ts)
- [`packages/core/src/ledger/engine.ts`](../packages/core/src/ledger/engine.ts)
- [`packages/core/src/ledger/worker.ts`](../packages/core/src/ledger/worker.ts)
- [`packages/core/src/documents/worker.ts`](../packages/core/src/documents/worker.ts)
- [`packages/core/src/balances/worker.ts`](../packages/core/src/balances/worker.ts)

## Компонентная модель (`component-runtime`)

Компоненты описываются манифестами и объединяются в общий каталог:
- core manifests: [`packages/core/src/component-runtime/manifests.ts`](../packages/core/src/component-runtime/manifests.ts)
- application manifests: [`packages/application/src/component-runtime/manifests.ts`](../packages/application/src/component-runtime/manifests.ts)

`ComponentManifest` определяет:
- `id`, `kind`, `mutability`, `enabledByDefault`
- `scopeSupport` (`global`, `book`)
- `capabilities` (`api`, `workers`, `documentModules`)
- `dependencies` (граф зависимостей компонентов)

`createComponentRuntimeService(...)`:
- валидирует манифесты и циклы зависимостей
- вычисляет `effective state` с учетом `default/global/book/dependency`
- ведет `stateEpoch`, `events`, preview/dry-run
- использует `LISTEN/NOTIFY` + poll fallback для синхронизации кэша

Источник: [`packages/core/src/component-runtime/service.ts`](../packages/core/src/component-runtime/service.ts)

## Каталог воркеров

Воркеры декларируются в манифестах и собираются через worker fleet:
- каталог/контракт: [`packages/core/src/worker-runtime/service.ts`](../packages/core/src/worker-runtime/service.ts)
- реализация в приложении: [`apps/workers/src/components/registry.ts`](../apps/workers/src/components/registry.ts)
- запуск флита: [`apps/workers/src/main.ts`](../apps/workers/src/main.ts)

| Worker ID | Component ID | Env key | Interval по умолчанию |
|---|---|---|---|
| `ledger` | `ledger` | `LEDGER_WORKER_INTERVAL_MS` | `5000` |
| `documents` | `documents` | `DOCUMENTS_WORKER_INTERVAL_MS` | `5000` |
| `documents-period-close` | `documents` | `DOCUMENTS_PERIOD_CLOSE_WORKER_INTERVAL_MS` | `60000` |
| `balances` | `balances` | `BALANCES_WORKER_INTERVAL_MS` | `5000` |
| `reconciliation` | `reconciliation` | `RECONCILIATION_WORKER_INTERVAL_MS` | `60000` |
| `connectors-dispatch` | `connectors` | `CONNECTORS_DISPATCH_WORKER_INTERVAL_MS` | `5000` |
| `connectors-poller` | `connectors` | `CONNECTORS_STATUS_POLLER_INTERVAL_MS` | `10000` |
| `connectors-statements` | `connectors` | `CONNECTORS_STATEMENT_INGEST_INTERVAL_MS` | `60000` |
| `orchestration-retry` | `orchestration` | `ORCHESTRATION_WORKER_INTERVAL_MS` | `5000` |
| `fx-rates` | `fx-rates` | `FX_RATES_WORKER_INTERVAL_MS` | `60000` |

## Единая диаграмма зависимостей

```mermaid
flowchart LR
  K[@bedrock/kernel] --> C[@bedrock/core]
  K --> D[@bedrock/db]
  C --> A[@bedrock/application]
  C --> D
  A --> D

  C --> API[apps/api]
  A --> API
  D --> API

  C --> W[apps/workers]
  A --> W
  D --> W

  API --> PG[(PostgreSQL)]
  W --> PG
  W --> TB[(TigerBeetle)]
```

## Карта точек входа по коду

### Пакеты
- Kernel: [`packages/kernel/src/kernel/index.ts`](../packages/kernel/src/kernel/index.ts)
- DB: [`packages/db/src/index.ts`](../packages/db/src/index.ts), [`packages/db/src/schema/index.ts`](../packages/db/src/schema/index.ts)
- Core exports: [`packages/core/package.json`](../packages/core/package.json)
- Application exports: [`packages/application/package.json`](../packages/application/package.json)

### Композиция приложений
- API context/composition: [`apps/api/src/context.ts`](../apps/api/src/context.ts), [`apps/api/src/composition/core.ts`](../apps/api/src/composition/core.ts), [`apps/api/src/composition/application.ts`](../apps/api/src/composition/application.ts)
- Workers runtime: [`apps/workers/src/main.ts`](../apps/workers/src/main.ts), [`apps/workers/src/components/registry.ts`](../apps/workers/src/components/registry.ts)

### Архитектурные проверки
- [`scripts/check-boundaries.mjs`](../scripts/check-boundaries.mjs)
- [`scripts/check-deprecated-imports.mjs`](../scripts/check-deprecated-imports.mjs)
- [`scripts/check-worker-runtime.mjs`](../scripts/check-worker-runtime.mjs)
- [`dependency-cruiser.cjs`](../dependency-cruiser.cjs)
