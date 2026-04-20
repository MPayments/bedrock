# Redesign — CRM Deals

Сессия редизайна CRM-раздела «Сделки» под новый дизайн Bedrock Finance (prototype на React/JSX + CSS).

## Где лежат референсы

### Архив
`Bedrock Finance.zip` — в корне репозитория (`/mnt/disks/sata240/work/bedrock/Bedrock Finance.zip`).

### Распакованный прототип
`/tmp/bedrock-design/` — содержит:
- `index.html` — entry point, React 18 + Babel standalone, подхватывает все `src/**/*.jsx`
- `styles.css` — все дизайн-токены (OKLCH, Geist/Geist Mono, radii, semantic aliases) + классы
- `src/screens/deals.jsx` — эталон списка сделок (`DealsScreen`) и детальной страницы (`DealDetailScreen` со стадиями Pricing/Calculating/Approval/Funding/Settled)
- `src/primitives.jsx` — базовые компоненты (Btn, Badge, Segmented, Card, Field, Input, Select, SearchSelect, Sparkline)
- `src/shells.jsx` — layout-оболочка (CrmTopnav + FinanceSidebar)
- `src/icons.jsx` — каталог иконок (77 имён)
- `src/data.jsx` — фикстуры DEALS + Money primitive + STAGE_LABEL/STAGE_BADGE
- `src/dialogs.jsx`, `src/bilingual.jsx`, остальные screens

Распаковать заново: `cd /tmp && unzip -o "/mnt/disks/sata240/work/bedrock/Bedrock Finance.zip" -d bedrock-design`.

### Открыть в браузере
`file://` в Playwright заблокирован. Поднять локальный сервер:
```bash
cd /tmp/bedrock-design && python3 -m http.server 8765 &
```
Открыть `http://localhost:8765/`. В сайдбаре прототипа:
- **CRM → Deals (pipeline)** — эталон списка (`DealsScreen`)
- **CRM → Deal · detail** — эталон детальной страницы (`DealDetailScreen`)

## Что сделано в этой сессии

### 1. Список сделок `/deals`

**Файлы:**
- `apps/crm/app/(dashboard)/deals/page.tsx` — полный переписанный UI
- `apps/crm/components/dashboard/dealsColumns.tsx` — колонки через `<Badge>` + `font-mono tabular-nums` + колонка владельца с аватаром
- `apps/crm/app/globals.css` — `@layer components` с `.deals-table`, `.kpi-card`, `.segmented`, `.badge-dot`, `.dt-flat`

**Структура страницы:**
- `page-head`: большой title + подпись `Pipeline · N сделок · X итого` + Экспорт/Фильтры/Новая сделка
- KPI-сетка (4 плитки с uppercase mono-метками и крупными mono-значениями): Активные / Блокеры (warn) / Объём (pos) / Завершено
- Карточка таблицы с двумя toolbar-рядами:
  - Верхний: segmented-фильтр по категориям статусов (Все / Черновики / Прайсинг / Документы / Активные / Блокеры) — пишет в status-фильтр таблицы через маппинг `SEG_TO_STATUSES`, плюс DataTableViewOptions справа
  - Нижний: существующие фильтры (клиент, агент, комментарий, валюта)
- DataTable с плоской рамкой (`.dt-flat` убирает внутренний border/radius)
- Статус-колонка рендерит `<Badge variant="success|warning|destructive|secondary|outline" className="badge-dot">`
- Ownership показывается аватаром с инициалами (hooked в `getDefaultColumnVisibility(isAdmin)`)

### 2. Детальная страница `/deals/[id]`

**Файлы:**
- `apps/crm/app/(dashboard)/deals/[id]/_components/deal-stage-track.tsx` — **новый** компонент `DealStageTrack` + `StageViewingBanner`
- `apps/crm/app/(dashboard)/deals/[id]/_components/deal-header.tsx` — перезаписан целиком
- `apps/crm/app/(dashboard)/deals/[id]/page.tsx` — заменён блок `<DealTabs>` на stage-driven layout; удалён больше не нужный `tabBadges`
- `apps/crm/app/globals.css` — добавлены `.detail-header`, `.detail-title`, `.detail-id`, `.stage-track`, `.stage-tab` (+ состояния active/done/current/pending), `.stage-tab-pulse` (animation), `.stage-track-sep`, `.stage-viewing-banner`, `.detail-grid`, `.detail-main`, `.detail-side`

**Дизайн-модель этапов:**
Статусы сделки маппятся на 5 этапов прототипа через `STATUS_TO_STAGE_INDEX` в `deal-stage-track.tsx`:
- `draft` → `pricing` (01)
- `submitted` → `calculating` (02)
- `preparing_documents` → `approval` (03)
- `awaiting_funds`, `awaiting_payment`, `closing_documents` → `funding` (04)
- `done`, `rejected`, `cancelled` → `settled` (05)

Визуальные состояния tab'а: `active` (тёмная заливка primary = просмотр), `done` (зелёный check), `current` (pulse-точка amber; для rejected/cancelled — красная Info), `pending` (lock).

**Маппинг этапов на существующие таб-рендеры** (бизнес-логика сохранена, переименована визуальная оболочка):
- `pricing` → `<DealIntakeTab>`
- `calculating` → `<DealPricingTab>`
- `approval` → `<DealDocumentsTab>`
- `funding` → `<DealExecutionTab>`
- `settled` → `<DealOverviewTab>`

URL-параметр `?tab=` остался прежним (backwards-compat). Если параметра нет, `viewStage` по умолчанию = текущий этап по статусу сделки (а не `settled`, как было бы при буквальном маппинге `overview`).

**Header:**
- Компактная ghost-иконка Назад слева (было: outline-кнопка с текстом)
- Крупный title `Клиент → Бенефициар` + инлайн-бейдж статуса (success/warning/destructive/secondary/outline, с точкой)
- Monosubtitle `#compactId · ТипСделки · SourceCcy → TargetCcy`
- Справа — прежний dropdown «Изменить статус» (логика перехода не тронута)

**Sticky-сайдбар** (xl+): `DealManagementCard`, `DealTimelineCard`, `AgreementCard` — без изменений по содержанию, только новая колонка через `.detail-grid`.

## Что НЕ сделано (следующие шаги для другого агента)

1. **Стадия-специфичные панели из прототипа не реализованы**. В дизайне `src/screens/deals.jsx` есть `PricingPane`, `CalculatingPane`, `ApprovalPane`, `FundingPane`, `SettledPane` — красиво оформленные карточки под каждый этап (callout с обещанием клиенту, kv-grid для котировок, ряды approvers, leg-рядки и т.д.). Мы показываем существующие таб-компоненты внутри этапов, которые визуально проще. Можно их постепенно переоформлять в стиль прототипа, не ломая props.

2. **Сайдбар в CRM** — существующий `AppHeader` (топ-нав) сохранён, хотя прототип показывает и sidebar-вариант. Скоуп работы — только страница сделок.

3. **Пустое состояние таблицы** — показывается стандартным «Нет результатов»; дизайн не задаёт специального варианта.

4. **Дополнительные страницы** (`/customers`, `/calendar`, `/documents`, `/admin/*`) — в скоуп не входили.

5. **Демо-сид сделок** — `bun run db:seed` сейчас не создаёт deals-записи; сделки создаются через UI (NewDealDialog) или отдельным скриптом, которого ещё нет. Если потребуется — добавить `apps/db/src/seeds/run-deals-demo.ts`.

## Проверка

```bash
bun run check-types --filter=crm   # ✓
bun run lint --filter=crm          # ✓
```

**Playwright-проверка (дев-сервер должен быть запущен — обычно `bun run dev`):**
- `http://localhost:3002/deals` — список
- `http://localhost:3002/deals/<uuid>` — деталь (дефолт: текущий этап сделки)
- `http://localhost:3002/deals/<uuid>?tab=execution` — форсированный просмотр другого этапа, покажется yellow-банер «Просмотр этапа … — перейти к текущему»

## Дизайн-токены / правила

- Шрифты уже есть: Geist Sans (`--font-sans`), Geist Mono (`--font-mono`) — инжектятся в `apps/crm/app/layout.tsx` через `next/font`
- Цвета из `@bedrock/sdk-ui/globals.css` (OKLCH): `--primary`, `--muted`, `--muted-foreground`, `--border`, `--success`, `--destructive`, `--card`
- Warn-тон (amber) используется литералом `oklch(0.68 0.13 75)` — нет именованного токена (стоит добавить `--warning` в `sdk-ui/globals.css` при следующем заходе)
- Числа в таблице: `.num` класс применяет `font-mono tabular-nums tracking-tight`
- Статус-бейджи: `<Badge variant="…" className="badge-dot">` — точка рендерится `.badge-dot::before { background: currentColor }`, так что подхватывает цвет варианта

## Критичные соглашения репо (важно помнить)

- **Bun** как package manager, **Node 24.x** как runtime (не Bun runtime)
- Пакеты импортируются только через `package.json#exports` — deep imports запрещены
- Каждый модуль: `contracts / application / domain / infra / service.ts`; ESLint запрещает infra-импорты из application и пр.
- Миграции — baseline-only hard cutover (`db:nuke → db:migrate → db:seed`)
- **Пользователь сам прогоняет `db:nuke/migrate/seed`** — агент не запускает без явной просьбы
