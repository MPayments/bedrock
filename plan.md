# План рефакторинга: переход к 1С-подобной модели `organizations / counterparties / requisites / requisite_providers`

## Summary
- Цель: убрать текущую смешанную модель `counterparties + treasury/internal-ledger + split requisites`, и привести систему к явной 1С-подобной структуре: `organizations`, `counterparties`, `requisites`, `requisite_providers`.
- Выбранный режим: `hard cutover`. Совместимый legacy-слой не сохраняется. Все runtime-API, UI, документы и схема БД переводятся на новую модель одним релизом.
- Зафиксированные решения:
  - `organizations` — отдельный плоский справочник, без treasury-групп.
  - `counterparties` — отдельный справочник внешних сущностей.
  - `requisites` — одна общая сущность для обоих владельцев.
  - `requisite_providers` — отдельный справочник, обязателен для любого реквизита.
  - Явной связи `organization <-> counterparty` нет.
  - У `counterparties` остаются только пользовательские папки/группы, без системной tree-логики.
  - Бухгалтерская привязка хранится во внутренней таблице binding, не как бизнес-сущность UI.

## Целевая доменная модель
- `organizations`
  - Новый домен `@bedrock/core/organizations`.
  - Таблица `organizations`: `id`, `external_id`, `short_name`, `full_name`, `description`, `country`, `kind`, `created_at`, `updated_at`.
  - Для мигрированных внутренних компаний использовать те же UUID, что у текущих internal-ledger counterparties, чтобы упростить перенос книг, документов и ссылок.
- `counterparties`
  - Текущий домен сохраняется, но очищается от treasury/internal-ledger семантики.
  - `counterparties` больше не содержат наши балансовые компании.
  - `counterparty_groups` превращаются в пользовательские папки: остаются `id`, `name`, `parent_id`, `customer_id`, `created_at`, `updated_at`.
  - Поля `code`, `isSystem`, root-логика `treasury/customers`, `treasury_internal_entities`, group-rule validators и endpoint `internal-ledger-entities` удаляются.
- `requisite_providers`
  - Новый домен `@bedrock/core/requisite-providers`.
  - Таблица `requisite_providers`: `id`, `kind`, `name`, `description`, `country`, `address`, `contact`, `bic`, `swift`, `created_at`, `updated_at`, `archived_at`.
  - `providerId` обязателен для любого реквизита.
  - Валидация:
    - `bank`: `name` обязателен; для `RU` обязателен `bic`, вне `RU` обязателен `swift`.
    - `exchange|custodian`: обязателен `name`, `country`.
    - `blockchain`: обязателен `name`; `country` опционален.
- `requisites`
  - Новый домен `@bedrock/core/requisites`.
  - Одна таблица `requisites`, но с физически безопасной FK-моделью:
    - `owner_type enum('organization','counterparty')`
    - `organization_id uuid null references organizations(id)`
    - `counterparty_id uuid null references counterparties(id)`
    - `provider_id uuid not null references requisite_providers(id)`
    - `currency_id uuid not null references currencies(id)`
    - `kind`, `label`, `description`, общие банковские/crypto/exchange поля, `is_default`, `archived_at`, `created_at`, `updated_at`
  - DB check: ровно один owner FK заполнен и соответствует `owner_type`.
  - В публичных контрактах наружу отдается только `ownerType` + `ownerId`; двойные FK наружу не торчат.
  - Partial unique default:
    - один default per `(organization_id, currency_id)` для ownerType=`organization`
    - один default per `(counterparty_id, currency_id)` для ownerType=`counterparty`
- `organization_requisite_bindings`
  - Внутренняя таблица сохраняется, но привязывается к новой `requisites.id`.
  - Структура: `requisite_id`, `book_id`, `book_account_instance_id`, `posting_account_no`, `created_at`, `updated_at`.
  - Разрешена только для `requisites.owner_type = organization`.

## Книги, balances и accounting
- `books.counterparty_id` заменяется на `books.organization_id`.
- Весь internal-ledger слой переносится из `counterparties` в `organizations`.
- Новый helper `organizations/internal/default-book.ts` обеспечивает одну default-книгу на организацию.
- Инварианты:
  - каждая организация, участвующая в ledger, должна иметь ровно одну default-книгу;
  - книги не могут принадлежать `counterparties`;
  - внешние реквизиты не создают книги и не участвуют в balances.
- Dimension key `counterpartyAccountId` удаляется.
- Новый accounting dimension: `organizationRequisiteId`.
- В отчетности, journal, balances API и accounting constants все ссылки на банковую/расчетную сущность переводятся на `organizationRequisiteId`.

## Public API / types / contracts
- Удалить публичные домены и контракты:
  - `counterparty-accounts`
  - `counterparty-account-providers`
  - `counterparty-requisites`
  - `organization-requisites`
- Добавить новые публичные типы:
  - `OrganizationSchema`
  - `RequisiteProviderSchema`
  - `RequisiteSchema`
  - `RequisiteAccountingBindingSchema`
  - `Create/Update/List` схемы для `organizations`, `requisite_providers`, `requisites`
- API routes:
  - добавить `/v1/organizations`
  - добавить `/v1/organizations/options`
  - оставить `/v1/counterparties`, но удалить `/v1/counterparties/internal-ledger-entities`
  - добавить `/v1/requisite-providers`
  - добавить `/v1/requisites`
  - добавить `/v1/requisites/options?ownerType=&ownerId=`
  - добавить `/v1/requisites/{id}/binding`
- Удалить routes:
  - `/v1/counterparty-accounts`
  - `/v1/counterparty-account-providers`
  - `/v1/counterparty-requisites`
  - `/v1/organization-requisites`
- Permissions:
  - новые ресурсы `organizations`, `requisites`, `requisite_providers`
  - binding-операции идут отдельным permission action, например `requisites.configure_binding`

## Документы и workflows
- Полный hard cutover payload-ов без legacy alias.
- `transfer_intra`
  - новый payload: `organizationId`, `sourceRequisiteId`, `destinationRequisiteId`, `amount`, `currency`, `memo`, `timeoutSeconds`
  - оба реквизита обязаны принадлежать одной `organization`
- `transfer_intercompany`
  - новый payload: `sourceOrganizationId`, `sourceRequisiteId`, `destinationOrganizationId`, `destinationRequisiteId`, `amount`, `currency`, `memo`, `timeoutSeconds`
- `capital_funding`
  - новый payload: `organizationId`, `organizationRequisiteId`, `counterpartyId`, `counterpartyRequisiteId`, `kind`, `amount`, `currency`, `memo`
  - `counterpartyRequisiteId` обязателен; исключений по `kind` в этом рефакторинге не вводить
- `payment_intent`
  - новый payload: `direction`, `organizationId`, `organizationRequisiteId`, `counterpartyId`, `counterpartyRequisiteId`, `currency`, `corridor`, `providerConstraint`, `countryFrom`, `countryTo`, `riskScore`, `timeoutSeconds`, `memo`
  - runtime сам определяет source/destination по `direction`
- `payment_resolution` не меняет внешний контракт, только внутренние резолверы intent-а
- В `documents` summary/types:
  - удалить `counterpartyAccountId`
  - добавить `organizationRequisiteId`
  - `counterpartyRequisiteId` хранить в payload; не выводить в generic summary-колонку
- Все document modules, validators, summary builders, posting workers и query filters переводятся на новые имена без alias.

## Web UI / navigation
- Добавить отдельный реестр `Организации`.
- Оставить отдельный реестр `Контрагенты`.
- Объединить `counterparty-requisites` и `organization-requisites` в один реестр `Реквизиты`.
- Добавить отдельный реестр `Провайдеры реквизитов`.
- В owner workspaces:
  - у `organizations` таб `Реквизиты`
  - у `counterparties` таб `Реквизиты`
- Форма реквизита:
  - обязательные поля `ownerType`, `ownerId`, `providerId`, `currencyId`, `kind`, `label`
  - provider выбирается явно
  - organization/counterparty выбираются через общий owner selector или через prefilled owner context
- Документные формы:
  - больше не использовать поля/лейблы `counterparty account`
  - `payin/payout` явно спрашивают `Организация`, `Реквизит организации`, `Контрагент`, `Реквизит контрагента`
- Удалить редиректы и остатки старых страниц `counterparty-accounts`, `counterparty-account-providers`, `counterparty-requisites`, `organization-requisites`.

## План миграции данных
1. Подготовить audit script, который фиксирует:
   - все internal-ledger counterparties
   - все current `organization_requisites`
   - все current `counterparty_requisites`
   - все legacy `counterparty_accounts`
   - все документы, где поля еще содержат legacy ids
2. Создать `organizations` и вставить туда текущие internal-ledger counterparties с теми же UUID.
3. Добавить `organization_id` в `books`, backfill из текущего `books.counterparty_id`, затем сделать `organization_id not null`, удалить `counterparty_id`.
4. Создать `requisite_providers`.
5. Backfill providers:
   - сначала из legacy `counterparty_account_providers`
   - затем из текущих requisites по сигнатуре `(kind, institutionName/name, institutionCountry/country, bic, swift, contact, address)`
   - для blockchain без явного института создавать synthetic provider с `name = coalesce(institutionName, label, network)`
6. Создать unified `requisites`.
7. Перенести текущие `organization_requisites` в `requisites(ownerType=organization)` и сохранить mapping oldId -> newId.
8. Перенести текущие `counterparty_requisites` в `requisites(ownerType=counterparty)` и сохранить mapping oldId -> newId.
9. Перенести `organization_requisite_bindings`, перепривязав их к новым `requisites.id`.
10. Переписать документы:
   - если old field уже указывает на `organization_requisites.id`, использовать mapping из шага 7
   - если old field указывает на legacy `counterparty_accounts.id`, сначала резолвить через legacy account -> provider/owner mapping и создать соответствующую новую запись `requisites`, затем обновить payload
   - переписать payload keys на новые имена по doc type
11. Переписать summary columns / reporting dimensions / journal labels на `organizationRequisiteId`.
12. После успешной валидации удалить старые таблицы:
   - `counterparty_accounts`
   - `counterparty_account_bindings`
   - `counterparty_account_providers`
   - `counterparty_requisites`
   - `organization_requisites`
   - `organization_requisite_bindings`
13. Удалить old manifests, routes, services, tests и UI feature trees.

## Порядок реализации в коде
1. Ввести новый core-domain `organizations`.
2. Ввести новый core-domain `requisite-providers`.
3. Ввести новый core-domain `requisites`.
4. Перенести book ownership и default-book logic в `organizations`.
5. Перевести application modules и reporting на `organizations + requisites`.
6. Перевести API routes и permissions.
7. Перевести web navigation, registries, forms, documents UI.
8. Выполнить data migration и drop legacy schema.
9. Удалить старые runtime imports, contracts, manifests и tests.

## Test cases and scenarios
- CRUD `organizations`.
- CRUD `counterparties` без treasury/internal-ledger root-логики.
- CRUD `requisite_providers` для `bank|exchange|blockchain|custodian`.
- CRUD `requisites` для ownerType=`organization`.
- CRUD `requisites` для ownerType=`counterparty`.
- Негативный кейс: requisite без `providerId` отклоняется.
- Негативный кейс: binding для `counterparty`-requisite отклоняется.
- Негативный кейс: два default requisites в одной валюте для одного owner отклоняются.
- Миграция internal-ledger counterparties -> `organizations` с сохранением UUID.
- Миграция `books.counterparty_id` -> `books.organization_id`.
- Миграция `organization_requisites` и `counterparty_requisites` в unified `requisites`.
- Миграция providers с синтетическим backfill для blockchain.
- Переписывание payload-ов документов для `transfer_intra`, `transfer_intercompany`, `capital_funding`, `payment_intent`.
- Проверка posting/reporting: balances строятся только по organization requisites.
- Проверка journal/report labels: legacy `counterpartyAccountId` нигде не остается.
- Полный `check-types` для `@bedrock/core`, `@bedrock/application`, `apps/api`, `apps/web`.
- API build обязателен после route changes.
- Smoke test web navigation: старых href и breadcrumbs больше нет.

## Assumptions and defaults
- В этом рефакторинге не добавляются новые 1С-поля вроде ИНН/КПП/ОГРН; сохраняется текущий базовый identity shape (`shortName`, `fullName`, `country`, `kind`, `externalId`, `description`).
- `organizations` и `counterparties` независимы и не связаны FK.
- Все собственные расчетные позиции и ledger books принадлежат только `organizations`.
- Все внешние реквизиты используются в документах, но не участвуют в balances/books.
- `requisite_providers` обязателен для любого реквизита, включая blockchain.
- Контрпартии сохраняют только пользовательские папки; системные root/subgroup правила полностью удаляются.
- Из-за выбранного `hard cutover` legacy read/write compatibility не делается; приемка включает полное удаление старого слоя в одном релизе.
