# Merge Plan: Bedrock + MPayments

## Overview

**Bedrock** (финансовая платформа: леджер, бухгалтерия, FX, fees, reconciliation) и **MPayments** (операционка: заявки, сделки, агенты, клиенты, Telegram-бот) объединяются в единую систему.

**Текущая интеграция:** BullMQ + HTTP (fire-and-forget, потеря событий, eventual consistency).
**Целевое состояние:** Единая PostgreSQL, единый монорепо, единый auth.

---

## Phase 1: Общая БД [DONE]

**Цель:** Оба приложения работают с одной PostgreSQL. Bedrock владеет миграциями. Код обоих приложений не меняется (кроме connection string в mpayments).

### Что делается

1. **Модуль `@bedrock/operations`** — Drizzle-схемы всех mpayments-таблиц, перенесённые в bedrock с префиксом `ops_`
2. **Единый пайплайн миграций** — `apps/db` генерирует миграции для всех таблиц (bedrock + operations)
3. **FK-мосты** — nullable foreign keys между operations-таблицами и bedrock-сущностями
4. **Auth-мост** — `ops_agents.bedrock_user_id` → bedrock `user.id`

### Переименование таблиц (ops_ префикс)

| MPayments (было) | Bedrock (стало) | Причина |
|---|---|---|
| `user` | `ops_agents` | Конфликт с bedrock `user` |
| `session` | `ops_sessions` | Конфликт с bedrock `session` |
| `account` | `ops_accounts` | Конфликт с bedrock `account` |
| `verification` | `ops_verifications` | Конфликт с bedrock `verification` |
| `applications` | `ops_applications` | Namespace consistency |
| `deals` | `ops_deals` | Namespace consistency |
| `clients` | `ops_clients` | Namespace consistency |
| `calculations` | `ops_calculations` | Namespace consistency |
| `contracts` | `ops_contracts` | Namespace consistency |
| `agent_organizations` | `ops_agent_organizations` | Namespace consistency |
| `agent_organization_bank_details` | `ops_agent_organization_bank_details` | Namespace consistency |
| `agent_bonus` | `ops_agent_bonus` | Namespace consistency |
| `deal_documents` | `ops_deal_documents` | Namespace consistency |
| `client_documents` | `ops_client_documents` | Namespace consistency |
| `sub_agents` | `ops_sub_agents` | Namespace consistency |
| `todos` | `ops_todos` | Namespace consistency |
| `activity_log` | `ops_activity_log` | Namespace consistency |
| `telegraf_sessions` | `ops_telegraf_sessions` | Namespace consistency |
| `s3_cleanup_queue` | `ops_s3_cleanup_queue` | Namespace consistency |

### FK-мосты (nullable, заполняются постепенно)

| Таблица | Новая колонка | FK → | Назначение |
|---|---|---|---|
| `ops_agents` | `bedrock_user_id` (text) | `user.id` | Связь агента с bedrock-аккаунтом |
| `ops_clients` | `counterparty_id` (uuid) | `counterparties.id` | Клиент = контрагент в bedrock |
| `ops_agent_organizations` | `organization_id` (uuid) | `organizations.id` | Орг = организация в bedrock |
| `ops_agent_organization_bank_details` | `requisite_id` (uuid) | `requisites.id` | Банк. реквизиты = реquisites |
| `ops_calculations` | `fx_quote_id` (uuid) | `fx_quotes.id` | Калькуляция связана с FX-котировкой |

### Auth-стратегия

- Bedrock auth (`user`/`session`/`account`/`verification`) — основной auth
- MPayments auth (`ops_sessions`/`ops_accounts`/`ops_verifications`) — временно отдельный
- `ops_agents.bedrock_user_id` — мост: если заполнен, агент может входить в обе системы
- **Phase 2:** единая таблица user + RBAC (roles: admin, agent, customer, finance)

### Что НЕ меняется

- Код MPayments (NestJS) — только connection string в `.env`
- Код Bedrock (Hono) — только новый модуль schema
- Фронтенды обоих приложений
- BullMQ-интеграция (пока остаётся, убирается в Phase 2)

---

## Phase 2: Перенос бизнес-логики [DONE]

**Цель:** Бизнес-логика mpayments живёт в `packages/modules/` по DDD-архитектуре bedrock.

> Детальный план с описанием каждого шага — см. `plan.md`.

### Порядок миграции доменов (по зависимостям)

1. **activity-log** → `@bedrock/operations/activity-log` (DONE)
2. **contracts** → `@bedrock/operations/contracts` (DONE)
3. **auth (roles)** → расширение `user.role` в `@bedrock/users` (DONE)
4. **applications** → `@bedrock/operations/applications` (DONE)
5. **calculations** → `@bedrock/operations/calculations`, интеграция с `@bedrock/treasury` (DONE)
6. **deals** → `@bedrock/operations/deals` (DONE)
7. **agent_bonus** → workflow `packages/workflows/deal-commission/` + `@bedrock/ledger` (DONE)
8. **clients** → `@bedrock/operations/clients`, адаптер над `@bedrock/parties` (DONE)
9. **sub-agents** → расширение agents субдомена (DONE)
10. **external services** → см. секцию "Стратегия миграции внешних сервисов" (DONE — порты)

### Auth объединение

- Единая таблица `user` (bedrock, UUID PK)
- RBAC: `user.role` → text (admin, user, agent, customer, finance). Не pgEnum — только TypeScript-валидация. **DB-миграция не нужна.**
- MPayments-специфичные поля (tgId, isAllowed, tag) → используем существующую таблицу `ops_agents` (НЕ создаём `agent_profiles`)
- `ops_agents.bedrock_user_id` FK-мост — уже реализован
- Миграция: seed-скрипт сопоставления ops_agents ↔ user по email

### Связь сущностей (extension tables, НЕ слияние)

ops_* таблицы остаются как extension tables с FK-мостами к bedrock-сущностям. НЕ добавляем mpayments-колонки в bedrock-таблицы — это operations-specific данные (i18n, INN/KPP, sub-agent привязка).

| Operations | Bedrock | Действие |
|---|---|---|
| `ops_clients` | `counterparties` | Extension table. FK `counterparty_id` → `counterparties.id`. НЕ объединять. |
| `ops_agent_organizations` | `organizations` | Extension table. FK `organization_id` → `organizations.id`. |
| `ops_agent_organization_bank_details` | `requisites` | Extension table. FK `requisite_id` → `requisites.id`. |

---

### Стратегия миграции внешних сервисов MPayments

Помимо основных доменов (заявки, сделки, расчёты), MPayments содержит ряд внешних сервисов. Стратегия по каждому:

#### Обменные курсы (CBR + Investing.com)

**Статус: ЗАМЕНЕНЫ.** Модуль `@bedrock/treasury` полностью заменяет оба сервиса. `treasury.rates` предоставляет CBR и Investing.com провайдеры. Worker `treasury-rates` обновляет курсы автоматически. Миграция не требуется.

#### AI Service (Document Extraction)

**Решение:** Отдельный platform subpath `packages/platform/src/ai/`
**Что делает:** Извлечение данных из PDF/DOCX/XLSX через OpenAI gpt-4o, перевод полей с русского на английский
**Реализация:** Phase 2 — port interface (`DocumentExtractionPort`), Phase 3 — OpenAI adapter
**Зависимости:** `@ai-sdk/openai`, `mammoth`, `xlsx`

#### Document Service (Template Generation)

**Решение:** Workflow `packages/workflows/document-generation/`
**Что делает:** Генерация DOCX/PDF из шаблонов (контракты, счета, заявки, расчёты, акты) с i18n
**Реализация:** Phase 2 — workflow skeleton + port interface, Phase 3 — template rendering + PDF conversion
**Зависимости:** `easy-template-x`, `libreoffice-convert`, `exceljs`, `lvovich`, `russian-nouns-js`

#### S3 / Object Storage

**Решение:** Port interface в Phase 2, platform implementation в Phase 3
**Где:** Port — `@bedrock/operations` shared ports; Implementation — `packages/platform/src/object-storage/`
**Что делает:** Upload/download/delete файлов, signed URLs, cleanup queue
**Зависимости:** `@aws-sdk/client-s3`
**Существующие схемы:** `ops_s3_cleanup_queue`, `ops_deal_documents`, `ops_client_documents` — все уже в bedrock

#### Notification Service (Email)

**Решение:** Port interface в Phase 2, platform implementation в Phase 3
**Где:** Port — `@bedrock/operations` shared ports; Implementation — `packages/platform/src/notifications/`
**Что делает:** Email-уведомления через Resend (смена статусов сделок/заявок, новые расчёты)
**Зависимости:** `resend` SDK

#### DaData Service (Company Lookup)

**Решение:** Port в clients субдомене, HTTP adapter в Phase 3
**Что делает:** Поиск компании по ИНН через Tbank DaData API (возвращает наименование, директор, адрес, ИНН/КПП/ОГРН)
**Реализация:** Phase 2 — port + query handler, Phase 3 — HTTP adapter

#### Customer Service (Customer Portal)

**Решение:** Facade/workflow поверх существующих operations субдоменов
**Что делает:** Web-портал для клиентов (создание заявок, просмотр расчётов/сделок, ролевые ограничения)
**Реализация:** Phase 2 — customer workflow/port, Phase 3 — API routes (`apps/api/src/routes/customer/`)

#### Sub-Agent Service

**Решение:** Расширение agents субдомена в `@bedrock/operations`
**Что делает:** CRUD суб-агентов с отслеживанием комиссий. Таблица `ops_sub_agents` уже существует.
**Реализация:** Phase 2 — полная реализация

#### Telegram Bot

**Решение:** SKIP в Phase 2. Будет перестроен с нуля в Phase 3 как `apps/bot/`.
**Причина:** Текущий бот тесно связан с NestJS DI, telegraf sessions, 40 scene-файлов. Проще переписать на `grammy` или `telegraf` v5.
**Связанные таблицы:** `ops_telegraf_sessions` — сохраняются на Phase 2, удаляются на Phase 4.

#### Reports Scheduler

**Решение:** SKIP. Часть Telegram бота — будет перестроен вместе с ним.

---

## Phase 3: Перенос API и фронта (текущая фаза)

**Цель:** NestJS больше не нужен. Всё работает через Hono + Next.js в bedrock.

### Phase 3a: API + Adapters [DONE]

1. **NestJS контроллеры → Hono routes** в `apps/api/src/routes/operations/` ✅
   - 10 route модулей: clients, applications, deals, calculations, contracts, organizations, todos, activity-log, agents, customer-portal
   - Statistics/by-day/by-status analytics queries
   - Customer portal с role-based middleware
2. **BullMQ-интеграция удалена** — `packages/workflows/integration-mpayments/` ✅
3. **S3 adapter** → `packages/platform/src/object-storage/s3.adapter.ts` ✅
4. **AI adapter** → `packages/platform/src/ai/openai.adapter.ts` ✅
5. **Notification adapter** → `packages/platform/src/notifications/resend.adapter.ts` ✅
6. **DaData adapter** → `packages/modules/operations/src/clients/adapters/dadata.adapter.ts` ✅
7. **OperationsModule wired** into AppContext с composition ✅
8. **Zod-схемы** переиспользуются as-is + OpenAPI через `@hono/zod-openapi` ✅

### Phase 3b: Telegram-бот (TODO)

- **Telegram-бот → `apps/bot/`** — rebuild from scratch (grammy или telegraf v5)
- 41 scene из mpayments

### Phase 3c: Frontend (TODO)

- **Next.js фронт mpayments** → `apps/ops-web/` или объединить с `apps/web`

### Phase 3d: Document Generation Adapters [DONE]

1. **Template renderer** → `easy-template-x` adapter in `packages/workflows/document-generation/src/adapters/` ✅
2. **PDF converter** → `libreoffice-convert` adapter ✅
3. **Russian language utils** → declensions (lvovich), money-in-words (number-to-words-ru), noun grammar (russian-nouns-js) ✅
4. **Document data assembly** → 5 assemblers (contract, application, invoice, acceptance, calculation) ✅
5. **Document API routes** → `apps/api/src/routes/operations/documents.ts` (export, templates, generate) ✅
6. **Phase 3a gap fixes** → client/deal document CRUD, create-deal-from-application, org bank update/delete, client contract shortcuts ✅
7. **Composition wired** with real adapters (replacing stubs) ✅
8. **Template files** → directory at `packages/workflows/document-generation/templates/` (templates loaded from filesystem/S3) ✅

---

## Phase 4: Cleanup

1. Удалить mpayments-репозиторий
2. Удалить BullMQ-интеграцию (`packages/workflows/integration-mpayments/`)
3. Удалить ops_* auth таблицы (`ops_sessions`, `ops_accounts`, `ops_verifications`) и `ops_telegraf_sessions`. Остальные ops_* таблицы **СОХРАНЯЮТСЯ** как extension tables (`ops_clients`, `ops_agents`, `ops_agent_organizations` и т.д.)
4. Удалить Redis (если не используется для других целей)
5. Консолидировать документацию

---

## Маппинг сущностей (полный)

| MPayments сущность | Bedrock сущность | Тип связи | Статус |
|---|---|---|---|
| `user` (агенты) | `user` (auth) + `ops_agents` (extension) | FK-мост (extension) | Phase 1 мост DONE, Phase 2 auth DONE |
| `clients` | `counterparties` + `ops_clients` (extension) | FK-мост (extension) | Phase 1 мост DONE, Phase 2 adapter DONE |
| `agent_organizations` | `organizations` + `ops_agent_organizations` (extension) | FK-мост (extension) | Phase 1 мост DONE |
| `agent_organization_bank_details` | `requisites` + `ops_agent_org_bank_details` (extension) | FK-мост (extension) | Phase 1 мост DONE |
| `calculations` | `fx_quotes` + `fee_rules` | FK-мост | Phase 1 мост DONE, Phase 2 DONE |
| `deals` | `documents` + `ledger_operations` | Workflow | Phase 2 DONE |
| `applications` | (нет аналога) | Новый домен | Phase 2 DONE |
| `contracts` | (нет аналога) | Новый домен | Phase 2 DONE |
| `agent_bonus` | `postings` (леджер) | Workflow | Phase 2 DONE |
| `sub_agents` | (нет аналога) | Новый домен в agents | Phase 2 DONE |
| `todos` | (нет аналога) | Новый домен | Phase 2 |
| `activity_log` | (нет аналога) | Новый домен | Phase 2 DONE |
| `deal_documents` / `client_documents` | S3 storage | Port interface | Phase 2 DONE (port), Phase 3 adapter |
| `s3_cleanup_queue` | (нет аналога) | Worker task | Phase 2 DONE (port + catalog), Phase 3 worker |
| Currency services (CBR, Investing) | `@bedrock/treasury` | ЗАМЕНЕНЫ | DONE |
| AI service (OpenAI) | `packages/platform/src/ai/` | Platform subpath | Phase 2 DONE (port), Phase 3 adapter |
| Document generation | `packages/workflows/document-generation/` | Workflow | Phase 2 DONE (skeleton), Phase 3 adapters |
| Telegram bot | `apps/bot/` (rebuild) | Новый app | Phase 3 |

---

## Риски и митигации

| Риск | Вероятность | Митигация |
|---|---|---|
| Миграция ломает одно из приложений | Средняя | CI: оба приложения тестируются на каждую миграцию |
| Потеря данных при слиянии таблиц | Низкая | ops_* остаются как extension tables с FK-мостами, слияния нет |
| Конфликт имён таблиц | Устранён | Префикс `ops_` для всех mpayments-таблиц |
| Сложность параллельной разработки | Средняя | Phase 1 минимально инвазивна, код не меняется |
| NestJS-специфичный код (DI, decorators) | Средняя | Извлекать чистую логику, NestJS-обёртки удалять последними |
| Рассинхрон данных в FK-мостах | Низкая | Background job для автоматического заполнения FK |

---

## Технический стек (совпадения)

| Технология | MPayments | Bedrock | Совместимость |
|---|---|---|---|
| ORM | Drizzle 0.44 | Drizzle 0.45 | Да (minor diff) |
| Validation | Zod 3.25 | Zod 4.1 | Миграция в Phase 2 |
| Auth | better-auth 1.3 | better-auth 1.3 | Полная |
| Queue | BullMQ 5.70 | BullMQ 5.34 | Полная |
| DB | PostgreSQL | PostgreSQL + TigerBeetle | Общая PG |
| Runtime | Node.js 23 | Node.js 24 | Совместимы |
