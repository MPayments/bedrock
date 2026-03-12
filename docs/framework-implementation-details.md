# Детали реализации framework-слоя Bedrock

Документ описывает технические паттерны реализации в `packages/*`, чтобы новый инженер мог безопасно расширять код без нарушения архитектурных контрактов.

## Quick Navigation
- Паттерн сервисов (factory closures)
- Контекст и DI
- Паттерн `commands/` и фасадов
- Транзакционные паттерны
- Валидация и ошибки
- Владение схемами БД и агрегация
- Внутренности `module-runtime`
- Контракт worker fleet
- Anti-patterns и ограничения

## Паттерн сервисов: factory closures, не классы

Базовый стиль в core/application: фабрика возвращает набор функций, а не экземпляр класса.

Примеры:
- [`packages/core/src/customers/service.ts`](../packages/core/src/customers/service.ts)
- [`packages/core/src/counterparties/service.ts`](../packages/core/src/counterparties/service.ts)
- [`packages/application/src/fx/service.ts`](../packages/application/src/fx/service.ts)
- [`packages/application/src/fees/service.ts`](../packages/application/src/fees/service.ts)

Характерные признаки:
- `export function createXxxService(deps: XxxServiceDeps)`
- внутри создается context
- публичный surface сервиса — plain object из handler-функций

## Контекст и dependency injection

Зависимости объявляются в `Deps` и нормализуются в `internal/context.ts`:
- [`packages/core/src/customers/internal/context.ts`](../packages/core/src/customers/internal/context.ts)
- [`packages/core/src/accounting/internal/context.ts`](../packages/core/src/accounting/internal/context.ts)
- [`packages/application/src/fx/internal/context.ts`](../packages/application/src/fx/internal/context.ts)

Что обычно помещается в context:
- `db: Database`
- `log: Logger` (или `noopLogger` по умолчанию)
- связанные сервисы/адаптеры (например, `feesService`, `currenciesService` в FX)

Практический эффект:
- минимальный public API
- предсказуемая тестируемость
- отсутствие скрытого mutable state

## Паттерн `commands/` и фасадов

Крупные домены выносят операции в `commands/*`, а `service.ts` играет роль фасада-компоновщика.

Примеры:
- Customers: фасад [`packages/core/src/customers/service.ts`](../packages/core/src/customers/service.ts), handler [`packages/core/src/customers/commands/create-customer.ts`](../packages/core/src/customers/commands/create-customer.ts)
- Connectors: фасад [`packages/core/src/connectors/service.ts`](../packages/core/src/connectors/service.ts), handlers в `commands/*`
- Documents: фасад [`packages/core/src/documents/service.ts`](../packages/core/src/documents/service.ts), handlers `commands/*`, queries `queries/*`

Нюанс: некоторые домены имеют специализированные entrypoints вместо одного `service.ts` (например, ledger engine/read-service):
- [`packages/core/src/ledger/engine.ts`](../packages/core/src/ledger/engine.ts)
- [`packages/core/src/ledger/read-service.ts`](../packages/core/src/ledger/read-service.ts)

## Транзакционные паттерны

### 1. Атомарные изменения
Многошаговые мутации оборачиваются в `db.transaction(async (tx) => ...)`.

Примеры:
- [`packages/core/src/customers/commands/create-customer.ts`](../packages/core/src/customers/commands/create-customer.ts)
- [`packages/core/src/accounting/service.ts`](../packages/core/src/accounting/service.ts)
- [`packages/core/src/ledger/engine.ts`](../packages/core/src/ledger/engine.ts)

### 2. Worker-атомарность
Воркеры обновляют статус очереди/операций транзакционно (успех/ошибка/retry) для консистентности.

Примеры:
- [`packages/core/src/ledger/worker.ts`](../packages/core/src/ledger/worker.ts)
- [`packages/core/src/documents/worker.ts`](../packages/core/src/documents/worker.ts)
- [`packages/core/src/connectors/workers/attempt-dispatch.ts`](../packages/core/src/connectors/workers/attempt-dispatch.ts)

### 3. Идемпотентность на уровне ключей
Важные операции (ledger/connectors/documents) строятся вокруг deterministic idempotency keys.

Примеры:
- [`packages/core/src/ledger/schema/journal.ts`](../packages/core/src/ledger/schema/journal.ts)
- [`packages/application/src/payments/service.ts`](../packages/application/src/payments/service.ts)

## Валидация и ошибки

### Валидация
- Основа: Zod-схемы и `z.infer`.
- Входные payload/query схемы лежат в `validation.ts` или `validation/*`.

Примеры:
- [`packages/core/src/accounting/validation.ts`](../packages/core/src/accounting/validation.ts)
- [`packages/application/src/fx/validation.ts`](../packages/application/src/fx/validation.ts)

### Ошибки
- Базовый класс: `ServiceError` из kernel.
- Домены определяют специализированные ошибки (not found/conflict/validation/invariant).

Примеры:
- [`packages/kernel/src/kernel/errors.ts`](../packages/kernel/src/kernel/errors.ts)
- [`packages/core/src/accounting/errors.ts`](../packages/core/src/accounting/errors.ts)
- [`packages/core/src/module-runtime/errors.ts`](../packages/core/src/module-runtime/errors.ts)

## Владение схемами БД и агрегация

### Где живут таблицы
Runtime-таблицы принадлежат доменам:
- `packages/core/src/<domain>/schema.ts` или `schema/**`
- `packages/application/src/<domain>/schema.ts` или `schema/**`

### Что делает `@bedrock/db`
`@bedrock/db` агрегирует schema-объекты для Drizzle-клиента/миграций/сидов.

Источник:
- [`packages/db/src/schema/index.ts`](../packages/db/src/schema/index.ts)
- [`packages/db/src/client.ts`](../packages/db/src/client.ts)

Это разделяет ответственность:
- домен владеет моделью таблиц
- db-пакет владеет инфраструктурой подключения и миграционным контуром

## Внутренности `module-runtime`

Главный сервис: [`packages/core/src/module-runtime/service.ts`](../packages/core/src/module-runtime/service.ts)

### 1. Валидация графа манифестов
При старте:
- проверка уникальности `module.id`
- проверка worker capability IDs/env keys
- проверка, что все dependencies существуют
- детекция dependency cycles

### 2. Вычисление effective state
Алгоритм для модуля в scope:
1. берется requested state (`book override` -> `global override` -> `default`)
2. проверяются зависимости рекурсивно
3. если зависимость `disabled`, модуль получает `source: "dependency"`

Поддерживаемые scope:
- `global`
- `book`

### 3. Оптимистичная конкуренция + сериализация обновлений
`updateModuleState(...)` использует:
- `expectedVersion` check (optimistic lock)
- `pg_advisory_xact_lock(...)` для сериализации state-change транзакций
- запись event + увеличение `state_epoch`

### 4. Кэш и синхронизация
- in-memory кэши effective/scope state
- invalidation по `state_epoch`
- `LISTEN/NOTIFY` канал + poll fallback

Это обеспечивает согласованность API и worker-решений по включенности модулей.

## Контракт worker fleet

Ключевой контракт в `@bedrock/core/worker-runtime`:
- типы: [`packages/core/src/worker-runtime/types.ts`](../packages/core/src/worker-runtime/types.ts)
- логика: [`packages/core/src/worker-runtime/service.ts`](../packages/core/src/worker-runtime/service.ts)

`createWorkerFleet(...)` гарантирует:
- у каждого worker id есть capability в manifests
- у каждого capability есть implementation
- нет «лишних» implementation без capability
- выбранные worker ids валидны

`startWorkerFleet(...)`:
- запускает циклы через `runWorkerLoop` из kernel
- перед каждым pass проверяет `moduleRuntime.isModuleEnabled(...)`
- поддерживает graceful stop через `AbortController`

## Anti-patterns и ограничения

### Архитектурные anti-patterns
- Импорт из `@bedrock/db/client` внутри runtime-доменов core/application
- Введение `pgTable(...)` вне schema-файлов
- Использование legacy import specifiers (`@bedrock/foundation`, `@bedrock/<legacy-domain>`)
- Зависимость `core -> application` и `runtime -> apps`

### Где проверяется автоматически
- [`scripts/check-boundaries.mjs`](../scripts/check-boundaries.mjs)
- [`scripts/check-deprecated-imports.mjs`](../scripts/check-deprecated-imports.mjs)
- [`dependency-cruiser.cjs`](../dependency-cruiser.cjs)

### Контракт worker/runtime-совместимости
- [`scripts/check-worker-runtime.mjs`](../scripts/check-worker-runtime.mjs)

### Контракт workspace dependencies
- [`scripts/check-workspace-deps.mjs`](../scripts/check-workspace-deps.mjs)
