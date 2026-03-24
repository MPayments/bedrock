# Merge Plan: Bedrock + MPayments

## Overview

**Bedrock** (финансовая платформа: леджер, бухгалтерия, FX, fees, reconciliation) и **MPayments** (операционка: заявки, сделки, агенты, клиенты, Telegram-бот) объединяются в единую систему.

**Текущая интеграция:** BullMQ + HTTP (fire-and-forget, потеря событий, eventual consistency).
**Целевое состояние:** Единая PostgreSQL, единый монорепо, единый auth.

---

## Phase 1: Общая БД (текущая фаза)

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

## Phase 2: Перенос бизнес-логики

**Цель:** Бизнес-логика mpayments живёт в `packages/modules/` по DDD-архитектуре bedrock.

### Порядок миграции доменов (по зависимостям)

1. **clients** → объединить с `@bedrock/parties` (counterparties)
2. **contracts** → новый субдомен в `@bedrock/operations` или `@bedrock/parties`
3. **applications** → `@bedrock/operations/applications`
4. **calculations** → интеграция с `@bedrock/treasury` (fx_quotes + fee_rules)
5. **deals** → `@bedrock/operations/deals` (ядро, зависит от всех выше)
6. **agent_bonus** → интеграция с `@bedrock/ledger`

### Auth объединение

- Единая таблица `user` (bedrock, UUID PK)
- RBAC: `user.role` → enum (admin, agent, customer, finance)
- MPayments-специфичные поля (tgId, isAllowed, tag) → отдельная таблица `agent_profiles`
- Миграция: скрипт сопоставления ops_agents ↔ user по email

### Слияние сущностей

| Operations | Bedrock | Действие |
|---|---|---|
| `ops_clients` | `counterparties` | Добавить mpayments-поля в counterparties (inn, kpp, director, i18n) |
| `ops_agent_organizations` | `organizations` | Добавить mpayments-поля (inn, director, seal, signature) |
| `ops_agent_organization_bank_details` | `requisites` | Уже совместимы по структуре |

---

## Phase 3: Перенос API и фронта

**Цель:** NestJS больше не нужен. Всё работает через Hono + Next.js в bedrock.

1. **NestJS контроллеры → Hono routes** в `apps/api/src/routes/operations/`
2. **Telegram-бот → `apps/bot/`** (новый app в монорепо) или `apps/workers/`
3. **Next.js фронт mpayments** → отдельный app `apps/ops-web/` или объединить с `apps/web`
4. **Zod-схемы валидации** переиспользуются as-is (обе системы на Zod)
5. **OpenAPI** уже есть в bedrock через `@hono/zod-openapi`

---

## Phase 4: Cleanup

1. Удалить mpayments-репозиторий
2. Удалить BullMQ-интеграцию (`packages/workflows/integration-mpayments/`)
3. Удалить ops_* таблицы (данные мигрированы в основные)
4. Удалить Redis (если не используется для других целей)
5. Консолидировать документацию

---

## Маппинг сущностей (полный)

| MPayments сущность | Bedrock сущность | Тип связи | Когда объединять |
|---|---|---|---|
| `user` (агенты) | `user` (auth) | FK-мост → слияние | Phase 1 мост, Phase 2 слияние |
| `clients` | `counterparties` | FK-мост → слияние | Phase 1 мост, Phase 2 слияние |
| `agent_organizations` | `organizations` | FK-мост → слияние | Phase 1 мост, Phase 2 слияние |
| `agent_organization_bank_details` | `requisites` | FK-мост → слияние | Phase 1 мост, Phase 2 слияние |
| `calculations` | `fx_quotes` + `fee_rules` | FK-мост | Phase 1 мост, Phase 2 интеграция |
| `deals` | `documents` + `ledger_operations` | Workflow | Phase 2 |
| `applications` | (нет аналога) | Новый домен | Phase 2 |
| `contracts` | (нет аналога) | Новый домен | Phase 2 |
| `agent_bonus` | `postings` (леджер) | Workflow | Phase 2 |
| `todos` | (нет аналога) | Новый домен | Phase 2 |
| `activity_log` | (нет аналога) | Новый домен | Phase 2 |
| `deal_documents` / `client_documents` | S3 storage | Сохранить | Phase 3 |

---

## Риски и митигации

| Риск | Вероятность | Митигация |
|---|---|---|
| Миграция ломает одно из приложений | Средняя | CI: оба приложения тестируются на каждую миграцию |
| Потеря данных при слиянии таблиц (Phase 2) | Низкая | Миграции-мосты: FK → постепенная денормализация → удаление старых |
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
