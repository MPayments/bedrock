# Руководство по использованию framework-слоя Bedrock

Документ для нового backend-инженера: как поднять среду, как использовать сервисы из `packages/*` в приложениях, как добавлять новые домены и безопасно вносить изменения.

## Quick Navigation
- Быстрый старт (infra/install/dev)
- Проверка качества (lint/types/tests)
- Как собирается API из package-сервисов
- Как запускаются и выбираются воркеры
- Как добавить новый домен в `packages`
- Как делать DB-изменения безопасно
- Частые проблемы и диагностика

## 1. Быстрый старт

### Требования
- Node.js `24.x`
- Bun как package manager
- Docker (для Postgres/TigerBeetle)

Источники:
- [`package.json`](../package.json)
- [`README.md`](../README.md)

### Поднять инфраструктуру
```bash
docker compose -f infra/docker-compose.yml up -d
```

### Установить зависимости
```bash
bun install
```

### Запустить все приложения
```bash
bun run dev
```

### Точечный запуск
```bash
bun run --filter=api dev
bun run --filter=workers dev
```

## 2. Проверка качества

### Базовые проверки
```bash
bun run lint
bun run check-types
bun run test
bun run test:integration
```

### Архитектурные проверки
```bash
bun run check:boundaries
bun run check:worker-runtime
bun run check:workspace-deps
```

Источник:
- [`package.json`](../package.json)

## 3. Как собирается API из package-сервисов

Композиция идет в два шага:
1. Core-сервисы (`accounting`, `ledger`, `balances`) — [`apps/api/src/composition/core.ts`](../apps/api/src/composition/core.ts)
2. Application/core домены верхнего уровня (`fx`, `fees`, `payments`, `documents`, `connectors`, `orchestration` и т.д.) — [`apps/api/src/composition/application.ts`](../apps/api/src/composition/application.ts)

Главный контекст API:
- [`apps/api/src/context.ts`](../apps/api/src/context.ts)

Пример wiring (упрощенно):
```ts
const accountingService = createAccountingService({ db, logger, defaultPackDefinition });
const currenciesService = createCurrenciesService({ db, logger });
const feesService = createFeesService({ db, logger, currenciesService });
const fxService = createFxService({ db, logger, feesService, currenciesService });
```

### Модульный guard на API-роутах
`module-runtime` проверяет, включен ли модуль перед исполнением route:
- [`apps/api/src/middleware/module-guard.ts`](../apps/api/src/middleware/module-guard.ts)
- [`apps/api/src/routes/system-modules.ts`](../apps/api/src/routes/system-modules.ts)

## 4. Как запускаются и выбираются воркеры

Точка входа:
- [`apps/workers/src/main.ts`](../apps/workers/src/main.ts)

Где создаются реализации:
- [`apps/workers/src/modules/registry.ts`](../apps/workers/src/modules/registry.ts)

Где выбираются worker ids:
- [`apps/workers/src/selection.ts`](../apps/workers/src/selection.ts)

### Запуск всего флита
```bash
bun run --cwd apps/workers worker:all
```

### Запуск конкретного воркера
```bash
bun run --cwd apps/workers worker:ledger
bun run --cwd apps/workers worker:documents
bun run --cwd apps/workers worker:balances
bun run --cwd apps/workers worker:fx-rates
bun run --cwd apps/workers worker:reconciliation
bun run --cwd apps/workers worker:connectors-dispatch
bun run --cwd apps/workers worker:connectors-poller
bun run --cwd apps/workers worker:connectors-statements
bun run --cwd apps/workers worker:orchestration-retry
```

### Как настраиваются интервалы
Значения берутся из env-переменных capability-манифестов (`WORKER_INTERVALS`):
- [`apps/workers/src/env.ts`](../apps/workers/src/env.ts)
- [`packages/core/src/module-runtime/manifests.ts`](../packages/core/src/module-runtime/manifests.ts)
- [`packages/application/src/module-runtime/manifests.ts`](../packages/application/src/module-runtime/manifests.ts)

## 5. Как добавить новый домен в `packages`

Ниже decision-complete чеклист для нового runtime-домена.

### Шаг 1. Выбрать слой
- `packages/core/src/<domain>` — базовый домен платформы
- `packages/application/src/<domain>` — прикладной workflow/use-case

Ограничение: `core` не зависит от `application`.

### Шаг 2. Создать структуру домена
Рекомендуемый минимум:
- `index.ts` (public exports)
- `service.ts` (factory)
- `validation.ts`
- `errors.ts`
- `internal/context.ts`
- `commands/*` (если сервис уже не тривиален)
- `schema.ts` или `schema/*` (если домен владеет таблицами)

### Шаг 3. Реализовать сервисный контракт
- Только closure/factory паттерн
- DI через `Deps` и `create*Context`
- Мутации через `db.transaction(...)`

Ориентиры:
- [`packages/core/src/customers/service.ts`](../packages/core/src/customers/service.ts)
- [`packages/core/src/customers/internal/context.ts`](../packages/core/src/customers/internal/context.ts)
- [`packages/application/src/fx/service.ts`](../packages/application/src/fx/service.ts)

### Шаг 4. Экспортировать домен из package
Добавить subpath exports в соответствующий `package.json`:
- [`packages/core/package.json`](../packages/core/package.json)
- [`packages/application/package.json`](../packages/application/package.json)

### Шаг 5. Подключить schema в `@bedrock/db`
Если домен создает таблицы:
1. экспортировать `schema` из домена
2. добавить в агрегатор [`packages/db/src/schema/index.ts`](../packages/db/src/schema/index.ts)

### Шаг 6. Подключить домен в app composition
- API composition: [`apps/api/src/composition/application.ts`](../apps/api/src/composition/application.ts)
- Workers composition (если нужен фон): [`apps/workers/src/modules/registry.ts`](../apps/workers/src/modules/registry.ts)

### Шаг 7. Добавить проверки и тесты
- unit: `packages/{core,application}/tests/<domain>/**/*.test.ts`
- integration: `packages/{core,application}/tests/<domain>/integration/**/*.test.ts`
- убедиться, что проект подключен в Vitest-конфигах

Источники:
- [`packages/core/vitest.config.ts`](../packages/core/vitest.config.ts)
- [`packages/core/vitest.integration.config.ts`](../packages/core/vitest.integration.config.ts)
- [`packages/application/vitest.config.ts`](../packages/application/vitest.config.ts)
- [`packages/application/vitest.integration.config.ts`](../packages/application/vitest.integration.config.ts)

## 6. Безопасные DB-изменения

В репозитории действует baseline-only миграционный контур. Поддерживаемая последовательность:

```bash
bun run --filter=@bedrock/db db:nuke
bun run --filter=@bedrock/db db:migrate
bun run --filter=@bedrock/db db:seed
```

Источники:
- [`README.md`](../README.md)
- [`packages/db/package.json`](../packages/db/package.json)

Практика:
- любые новые таблицы определяются в domain schema (`core`/`application`), а не в `@bedrock/db`
- `@bedrock/db` агрегирует schema и управляет инфраструктурой миграций/сидов

## 7. Обязательное правило после изменений в API

Если вы меняли файлы в `apps/api/`, нужно пересобрать API, чтобы `dist/`-типы были актуальны для потребителей:

```bash
bun run build --filter=api
```

## 8. Частые проблемы и диагностика

### Симптом: boundary check падает
Проверьте:
- нет ли runtime-импорта `@bedrock/db/client` внутри `packages/core/src/**` или `packages/application/src/**`
- нет ли legacy specifier-ов
- нет ли запрещенного направления зависимости

Команда:
```bash
bun run check:boundaries
```

Источники:
- [`scripts/check-boundaries.mjs`](../scripts/check-boundaries.mjs)
- [`dependency-cruiser.cjs`](../dependency-cruiser.cjs)

### Симптом: worker не стартует / неизвестный worker id
Проверьте согласованность:
- manifests (`capabilities.workers`)
- implementations registry
- worker scripts (`apps/workers/package.json`)

Команда:
```bash
bun run check:worker-runtime
```

Источник:
- [`scripts/check-worker-runtime.mjs`](../scripts/check-worker-runtime.mjs)

### Симптом: web/api подтягивает некорректные внутренние версии пакетов
Проверьте, что внутренние зависимости заданы как `workspace:*`.

Команда:
```bash
bun run check:workspace-deps
```

Источник:
- [`scripts/check-workspace-deps.mjs`](../scripts/check-workspace-deps.mjs)
