# Redesign — CRM Deals · Итерация 3

Документ для агента с чистым контекстом. Итерация 2 (см. `REDESIGN_ITTERATION_2.md` и git-историю) довела детальную страницу сделки до визуального паритета с прототипом в большинстве областей, но оставила несколько технических компромиссов и нереализованных фрагментов плана. Твоя задача — закрыть хвосты и довести работу до production-ready.

---

## Референс

Всё как в итерации 2. Эталон:
- Архив: `Bedrock Finance.zip` в корне репо.
- Распакованная копия: `/tmp/bedrock-design/` (если нет — `cd /tmp && unzip -o "/mnt/disks/sata240/work/bedrock/Bedrock Finance.zip" -d bedrock-design`).
- Запуск: `cd /tmp/bedrock-design && python3 -m http.server 8765 &`. Вход в CRM: `http://localhost:3002/deals/{id}`, prototype: `http://localhost:8765/` → в showcase-nav выбрать **CRM → Deal · detail**.
- Ключевой файл эталона: `/tmp/bedrock-design/src/screens/deals.jsx` — функция `DealDetailScreen` и 5 pane-функций.

**Решения пользователя (из итерации 2):**
1. Селектор «Ответственный агент» — **удалён полностью**, агент в Parties-сайдбаре read-only.
2. `DealDocumentsTab` — **убран из панелей**, вместо него `DocumentRequirementsHintCard` с чипами (без upload/edit).
3. CalculatingPane Inputs — **Variant A: полный inline-редактор** (реализован частично — см. раздел «Компромиссы» ниже).

---

## Что уже сделано (итерация 2)

### A. Backend — обогащение проекции и контрактов

**`DealWorkflowLegSchema` расширена** (`packages/modules/deals/src/application/contracts/dto.ts:166`):
```ts
export const DealWorkflowLegSchema = z.object({
  amountMinor: z.string().nullable().default(null),
  currencyCode: z.string().nullable().default(null),
  fromPartyName: z.string().nullable().default(null),
  fromRole: DealParticipantRoleSchema.nullable().default(null),
  id: z.uuid().nullable().default(null),
  idx: z.number().int().positive(),
  kind: DealLegKindSchema,
  operationRefs: z.array(DealLegOperationRefSchema).default([]),
  state: DealLegStateSchema,
  toPartyName: z.string().nullable().default(null),
  toRole: DealParticipantRoleSchema.nullable().default(null),
});
```

**Pure domain helper** (`packages/modules/deals/src/domain/workflow.ts`):
```ts
export function getDealLegPartyRoles(
  dealType: DealType,
  kind: DealLegKind,
): { fromRole: DealParticipantRole | null; toRole: DealParticipantRole | null }
```
Возвращает `from/to` роли в зависимости от типа сделки и kind-a ноги. `createLeg(idx, kind, dealType)` теперь сам заполняет `fromRole/toRole`.

**Маппинг из `getDealLegPartyRoles`:**
- `collect`: `customer → internal_entity` (для `exporter_settlement`: `external_payer → internal_entity`).
- `convert`: `internal_entity → internal_entity`.
- `transit_hold`: `internal_entity → internal_entity`.
- `payout`: `internal_entity → external_beneficiary` (для `currency_exchange`: `→ customer`; для `exporter_settlement`: `→ applicant`).
- `settle_exporter`: `internal_entity → applicant`.

> ⚠️ **Компромисс:** для `exporter_settlement` mapping — best-guess (строки 252–256 `buildDealExecutionPlan` в `workflow.ts`). Проверь с пользователем/DDD-документами, правильно ли «payout» leg 1 в exporter_settlement означает `internal_entity → applicant` (могу ошибаться про advance-flow).

**Projection service** (`packages/workflows/deal-projections/src/service.ts`):
- Функция `enrichDealExecutionPlanWithParticipants(plan, participants)` — строит `nameByRole` map и заполняет `fromPartyName/toPartyName`.
- `getCrmDealWorkbenchProjection` теперь:
  - Подтягивает `assigneeDetails = await deps.iam.queries.findById(agentId)` и кладёт `displayName` в `workbench.assignee`.
  - Обогащает `workbench.executionPlan = enrichDealExecutionPlanWithParticipants(workflow.executionPlan, workflow.participants)`.

**Схема workbench**:
- `CrmDealAssigneeSchema` теперь `{userId, displayName}` (`contracts.ts:174`).
- `workbench.executionPlan: z.array(DealWorkflowLegSchema)` — автоматически подхватывает новые поля.

> ⚠️ **Компромисс:** `amountMinor/currencyCode` у leg-ов **остаются `null`** в проекции. Resolver через `operationRefs → treasury.operations → amount/currency` не реализован (см. раздел «TODO / Phase 0.3»).

**CRM-типы** (`apps/crm/app/(dashboard)/deals/[id]/_components/types.ts`):
- Добавлен `ApiDealParticipantRole`.
- `ApiDealWorkflowLeg` расширен 6 новыми полями.
- `assignee` в `ApiCrmDealWorkbenchProjection` теперь `{userId, displayName}`.

### B. Sidebar

Удалено из `page.tsx`:
- Импорты `DealManagementCard`, `DealTimelineCard`, `AgreementCard`.
- Тип `DealAgreementOption`.
- State `agreementOptions`, `isUpdatingAgreement`, `isUpdatingAssignee`.
- Handlers `handleAgreementChange`, `handleAssigneeChange`.
- Fetch `/agreements?customerId=...` (был источник данных для селектора договора).

Созданы:
- `apps/crm/app/(dashboard)/deals/[id]/_components/parties-sidebar-card.tsx` — Customer / Beneficiary / Agent блоки с разделителями.
- `apps/crm/app/(dashboard)/deals/[id]/_components/key-dates-sidebar-card.tsx` — read-only список ключевых дат.
- `apps/crm/lib/timeline-labels.ts` — два словаря:
  - `KEY_DATE_LABELS` / `KEY_DATE_ORDER` — для Key dates в сайдбаре (6 событий: `deal_created → CREATED`, `quote_created → QUOTED`, `quote_accepted → ACCEPTED`, `calculation_attached → CALC LOCKED`, `execution_requested → EXECUTION`, `deal_closed → SETTLED`).
  - `ACTIVITY_EVENT_LABELS` — для Activity card на PricingPane (словарь из 26 типов событий).

Удалены файлы: `deal-management-card.tsx`, `deal-timeline-card.tsx`, `deal-timeline-card.test.ts`, `agreement-card.tsx`.

### C. PricingPane

`apps/crm/app/(dashboard)/deals/[id]/_components/pricing-pane.tsx` — три карточки:

1. **`BeneficiaryIntakeCard`** — обёртка над существующим `IntakeEditorCard` (поля бенефициара, банка, реквизитов). Под формой — `.callout.info` «SWIFT/BIC и санкционный скрининг в следующей итерации» (stub).
2. **`InitialOfferCard`** — `kv-grid.cols-3` с 6 ячейками (Gross in, Proposed rate, Beneficiary receives, Proposed fee, Bedrock margin, Rate valid until). Кнопки: Edit proposal (ghost), Send to customer (secondary, stub), Customer accepted → Calculating (primary — вызывает `handleAcceptQuote`). Если котировок нет — `.callout.warn` + кнопка «Создать котировку».
3. **`ActivityCard`** — список `workflow.timeline` с аватарами (инициалы из `actor.label`), лейблами из `ACTIVITY_EVENT_LABELS` и датами.

Удалён `deal-intake-tab.tsx`.

### D. CalculatingPane

`apps/crm/app/(dashboard)/deals/[id]/_components/calculating-pane.tsx` — 5 карточек:

1. **`PromiseCallout`** — сравнивает `acceptedQuote.rate` vs `calculation.finalRate`. Порог: `|delta|/accepted ≤ 0.1%` → pos callout, иначе warn. Если нет калькуляции → warn-callout с кнопкой «Создать расчёт».
2. **`InputsCard`** — inline-поля: amount (Input), toCurrency (Select), quoteMarkupPercent (Input), fixedFeeAmount (Input), fixedFeeCurrencyCode (Select) + кнопка «Пересчитать котировку» (вызывает `handleCreateQuote`). В header — `CardAction` с кнопкой «Открыть полный диалог» (→ `handleOpenQuoteDialog`, открывает существующий `CalculationDialog` для сложных сценариев).
3. **`FeeBreakdownCard`** — shadcn `Table` с 3–4 строками (Agreement fee / FX markup / Fixed fee / Additional expenses) и total row. Источник: поля `calculation.*FeeAmount`.
4. **`QuoteSummaryCard`** — `kv-grid.cols-4` с 4 крупными значениями (Customer pays / Beneficiary receives / Final rate / Net profit).
5. **`ValidityLockCard`** — `kv-grid.cols-3` (Rate locked until / Quote expires / Funding deadline) + 4 кнопки: Duplicate (stub), PDF (stub), Send to customer (stub), «К согласованию» (вызывает `handleStatusUpdate("preparing_documents")`).

> ⚠️ **Компромисс 1:** Inputs — не полный inline-редактор формы. 5 полей покрывают самое частое (amount, currency, markup, fixed fee), но опции `asOf`, `overrideCalculationAmount`, сложные commercialTerms — только через `CalculationDialog` (кнопка «Открыть полный диалог»). Для получения полного Variant A нужно извлечь логику `CalculationDialog` в хук `useCalculationForm` (см. TODO).
>
> ⚠️ **Компромисс 2:** Duplicate calc / PDF / Send to customer — UI-кнопки без backend. `onSendCalcPdf`/`onSendToCustomer` не wired в page.tsx (props optional, props не переданы → кнопки disabled).

Удалён `deal-pricing-tab.tsx`.

### E. ApprovalPane

`apps/crm/app/(dashboard)/deals/[id]/_components/approval-pane.tsx` — 3 карточки:

1. **`CalculationLockedCard`** — `approval-summary` (grid-3) с Customer pays / Beneficiary receives / Net margin как `kv-value-lg`. Если нет калькуляции — info-callout.
2. **`ApproversCard`** — список `.approval-row` (grid `110px 1fr auto`): ROLE uppercase / name+comment / `Badge` (success/warning/destructive) + decidedAt. Bottom: «Напомнить» (stub) + «К фондированию» (disabled пока `transitionReadiness["awaiting_funds"].allowed !== true`; под кнопкой — первый `blockers[0].message`).
3. **`DocumentRequirementsHintCard`** — чипы из `workbench.documentRequirements`: `<Badge variant>{docType} · {state}</Badge>`. Под чипами — список блокёров (если есть `blockingReasons`).

> ⚠️ **Компромисс:** в `workbench.approvals[]` поля `requestedBy`/`decidedBy` — это userIds (string). Для Approvers-карточки показывается `approval.decidedBy ?? approval.requestedBy ?? "—"`. **Нужно резолвить displayName через IAM** (см. TODO Phase 0.3).

Удалён `deal-documents-tab.tsx`.

### F. FundingPane

`apps/crm/app/(dashboard)/deals/[id]/_components/funding-pane.tsx` — 3 карточки:

1. **`FinancialsCard`** — `kv-grid.cols-auto` с 6 полями (Gross amount, Final rate, Total fee, Total in base, Expenses, Net margin).
2. **`PaymentLegsCard`** — список `.leg-row`:
   - `LEG {idx}` (mono 11px, w-[32px]).
   - FROM: `leg.fromPartyName ?? fromLabel` + `{fromLabel} · sender`.
   - `<ArrowRight />`.
   - TO: `leg.toPartyName ?? toLabel` + `{toLabel} · receiver`.
   - Amount: `formatCurrency(minorToDecimalString(leg.amountMinor, 2), leg.currencyCode)` — **но `amountMinor`/`currencyCode` сейчас `null`**, поэтому отображается `leg.kind.replace(/_/g, " ")` как fallback.
   - Badge: success (done) / warning (ready/in_progress) / outline (pending) / destructive (blocked) / outline (skipped).
   - В header card — опциональная кнопка «Treasury workbench» (prop `onOpenTreasuryWorkbench`, сейчас не передана → кнопка не рендерится).
3. **`OperationalStateCard`** (существующий компонент) — операционные позиции (`customer_receivable`, `provider_payable`, `in_transit` и т.д.).

Удалён `deal-execution-tab.tsx`. Оставлены `execution-plan-card.tsx` и `operational-state-card.tsx` (используются в FundingPane).

### G. SettledPane

`apps/crm/app/(dashboard)/deals/[id]/_components/settled-pane.tsx`:

- Если `deal.status === "cancelled" || "rejected"` → `.callout.neg` «Сделка завершена без исполнения» + текст с `reason` (сейчас не проброшен — TODO).
- Иначе — **`ClosingStatementCard`**: `kv-grid.cols-3` (2 ряда по 3 поля):
  - Settlement date (formatted `closedAt`).
  - Actual T+n (`Math.ceil((closedAt - createdAt) / 86_400_000)` → `T+N`).
  - Realized margin (`netMarginInBase` с +/− знаком).
  - Variance vs plan (**`—`**, компромисс — planned margin в snapshot не прокинут).
  - Proof attached (`attachments.length` файлов).
  - Customer invoice (`formalDocuments.find(d => d.docType === "invoice")?.approvalStatus ?? "—"`).
- Bottom: «Выгрузить пакет» (stub), «Отправить клиенту» (stub).

Удалены `deal-overview-tab.tsx`, `stage-panes.tsx`.

### H. Очистка page.tsx

Удалены:
- State: `isUpdatingLegKey`, `isEditingComment`, `commentValue`, `isSavingComment`, `isUploadDialogOpen`, `uploadFile`, `uploadDescription`, `uploadPurpose`, `uploadVisibility`, `isUploadingAttachment`, `reingestingAttachmentId`, `deletingAttachmentId`.
- Handlers: `handleLegStateUpdate`, `handleEditComment`, `handleCancelEditComment`, `handleSaveComment`, `handleAttachmentUpload`, `handleAttachmentDelete`, `handleAttachmentDownload`, `handleOpenAttachmentDialog`, `handleAttachmentReingest`.
- Вычисляемое: `calculationDisabledReason`.
- Render: `<UploadAttachmentDialog />`.
- Неиспользуемый импорт `MAX_QUERY_LIST_LIMIT`, `DealLegState`.

---

## Компромиссы и неотфактуренные хвосты — их надо закрыть

### 1. Inputs card — частичный Variant A

**Сейчас:** `InputsCard` рендерит 5 inline-полей (amount, toCurrency, markup %, fixed fee amount, fixed fee currency) + кнопка «Пересчитать котировку» + CardAction-кнопка «Открыть полный диалог» открывает существующий `CalculationDialog`.

**Должно быть (полный Variant A):** единый hook `apps/crm/lib/hooks/useCalculationForm.ts` инкапсулирует всю form-логику (state, preview-debounce, validation, submit) и используется **и в** `CalculationDialog`, **и в** `InputsCard`. `CalculationDialog` становится тонкой обёрткой `<Dialog>{useCalculationForm(...)}</Dialog>`.

**Почему отложено:** `CalculationDialog` — ~400 строк логики с `useQuotePreview`, ручной BigInt-математикой и кастомной валидацией. Чистая экстракция требует отдельной сессии с вниманием на preview-побочки.

**Что сделать:**
1. Создать `apps/crm/lib/hooks/useCalculationForm.ts`. Перенести туда из `page.tsx` состояния `calculationAsOf`, `calculationAmount`, `fixedFeeAmount`, `fixedFeeCurrencyCode`, `quoteMarkupPercent`, `calculationToCurrency`, `overrideCalculationAmount`, `isCreatingQuote`, `quotePreview`, `quotePreviewError`, `isQuotePreviewLoading`, а также все handlers (`handleCreateQuote`, `handleOpenQuoteDialog`, `handleOpenCreateCalculationDialog`, debounced preview effect). Возвращать `{values, setters, preview, submit, reset, canSubmit, disabledReason, isCreating, isPreviewLoading}`.
2. В `page.tsx` вызвать `const calcForm = useCalculationForm({dealId, data, showError, loadDeal})`.
3. Передать `calcForm` в `CalculatingPane` и в `CalculationDialog`.
4. `InputsCard` стал полностью inline: все поля из dialog-а (amount с override-checkbox, asOf datetime, toCurrency, base rate source select, base rate, fee bps), preview отображается в `QuoteSummaryCard` live.

### 2. Leg amount/currency enrichment

**Сейчас:** `fromPartyName`/`toPartyName` заполняются из participants. `amountMinor`/`currencyCode` — `null`. Fallback в UI: показывает `leg.kind.replace(/_/g, " ")` вместо суммы.

**Что сделать (Phase 0.3):**

В `packages/workflows/deal-projections/src/service.ts` функция `enrichDealExecutionPlanWithParticipants` (сейчас принимает только `plan, participants`) должна также:
1. Получать список операций сделки: `const operations = await deps.treasury.operations.queries.list({dealId, ...})`.
2. Для каждой leg: брать её `operationRefs`, находить соответствующие операции из списка, извлечь `amountMinor`/`currencyId` из первой операции и резолвить `currencyCode` через `currenciesById` lookup.
3. Если `operationRefs.length === 0` — fallback:
   - Для `collect`/`transit_hold` legs: `intake.moneyRequest.sourceAmount` + `intake.moneyRequest.sourceCurrencyId`.
   - Для `payout` legs: `calculation.totalAmount` + `calculation.baseCurrencyCode`.
   - Иначе null.

Протестировать: `bunx vitest run --config vitest.config.ts` + проверить в браузере, что на FundingPane payment-legs показывают реальные суммы и валюты.

### 3. Read-only mode (Phase 8) — не wired

**Сейчас:** каждая новая pane (`PricingPane`, `CalculatingPane`, `ApprovalPane`, `FundingPane`) имеет prop `readOnly?: boolean`. В JSX скрывает кнопки и блокирует inputs при `readOnly === true`.

**НО:** в `page.tsx` значение `readOnly` не вычисляется и не передаётся. Все панели сейчас рендерятся с `readOnly = undefined` (т.е. всегда «активные»), даже когда юзер смотрит прошлый этап через `?tab=X`.

**Что сделать:**
В `page.tsx` в блоке `stagePanes`:
```tsx
const readOnly = viewStage !== currentStage;
const isFuture = DEAL_STAGE_ORDER.indexOf(viewStage) > DEAL_STAGE_ORDER.indexOf(currentStage);
```
Пробросить `readOnly={readOnly}` в каждую pane. Если `isFuture` — поверх pane рендерить `.callout.info` «Этап ещё не достигнут, данные предварительные» (`StageViewingBanner` уже это показывает в header, но внутри pane было бы нагляднее).

### 4. Approver displayName

**Сейчас:** `ApproversCard` показывает `approval.decidedBy ?? approval.requestedBy ?? "—"` — это userId (UUID), что плохо читается.

**Что сделать:**
1. В `packages/modules/deals/src/application/contracts/dto.ts` расширить `DealApprovalSchema` полями `requestedByDisplayName: string | null`, `decidedByDisplayName: string | null`, `approvalRoleLabel: string | null`.
2. В `packages/workflows/deal-projections/src/service.ts` при сборке workbench-проекции — для каждой `detail.approvals` запроса IAM lookup (`deps.iam.queries.findById`) + маппинг `approvalType → role label` (`commercial → "COMMERCIAL"` и т.д., сейчас `APPROVAL_ROLE_LABELS` живёт в `approval-pane.tsx`).
3. В CRM-типах (`types.ts`) обновить ApiDealDetails.approvals shape.
4. В `ApproversCard` использовать новые displayName-поля.

### 5. Sanctions screening / SWIFT BIC validation (B1 на PricingPane)

**Сейчас:** под `IntakeEditorCard` показывается серый `.callout.info` «SWIFT/BIC и санкционный скрининг в следующей итерации». Никакой валидации не происходит.

**Что сделать:**
- Если данные SWIFT resolver / sanctions screening доступны в проекции (наверняка нет) — подставить их. Иначе остаётся TODO.
- По умолчанию — разобраться с пользователем, нужна ли эта фича в iteration 3.

### 6. Variance vs plan (F1 на SettledPane)

**Сейчас:** в `ClosingStatementCard` поле `VARIANCE VS PLAN` всегда `—`.

**Что сделать:**
- Planned margin должен быть в snapshot первой калькуляции. `workbench.pricing.calculationHistory[0]?.netMarginInBase` — примерный источник. Realized margin уже есть в `netMarginInBase`. Variance = realized - planned.
- Если надёжно не вытащить — оставить `—` и TODO.

### 7. PDF / Email stub-кнопки

На нескольких панелях есть кнопки-stubs:
- PricingPane → InitialOfferCard: `onSendToCustomer` (не передан).
- CalculatingPane → ValidityLockCard: `onSendCalcPdf`, `onSendToCustomer` (не переданы → disabled).
- SettledPane → ClosingStatementCard: `onDownloadPack`, `onSendStatement` (не переданы → disabled).
- ApprovalPane → ApproversCard: «Напомнить» без обработчика.

Сейчас они отображаются но `disabled`. Разобраться с пользователем — нужна ли функциональность. Минимум — `toast.success("Отправлено")` без реального бэка.

### 8. Cancelled state в SettledPane — reason

В `settled-pane.tsx` prop `reason?: string | null` — но не передаётся из `page.tsx`. Источник причины отмены — в `workbench.summary` или deal.reason (проверь контракты).

### 9. «Open calculation» action в DealHeader

Прототип показывает в header справа 3 кнопки: Contract / Open calculation / Approve funding. Сейчас `DealHeader` (в `deal-header.tsx`) показывает только dropdown «Изменить статус». Header-action-buttons не реализованы.

Решение: обсудить с пользователем приоритет. Можно не делать — функциональность дублируется кнопками внутри панелей.

### 10. Playwright visual diff

Не прогонялся. Нужно:
1. Запустить `python3 -m http.server 8765` в `/tmp/bedrock-design`.
2. Запустить CRM + API dev-серверы.
3. Войти в CRM, открыть тестовую сделку.
4. Для каждой стадии — screenshot 1440×900 + сравнение с prototype (ручное или через `mcp__plugin_playwright_playwright__browser_take_screenshot`).
5. Чистить `.playwright-mcp/` из репо после.

---

## Верификация

### Текущий статус (перед началом iteration 3)
```bash
bun run check-types   # 66/66 зелёные
bun run lint          # 37/37 зелёные
bun run build         # 36/36 зелёные
bunx vitest run --config vitest.config.ts   # 922/922 зелёные
```

### Что запустить после своих правок
```bash
# Типы и линт
bun run check-types
bun run lint

# Юнит-тесты (в том числе новые для leg enrichment)
bunx vitest run --config vitest.config.ts

# Сборка
bun run build --filter=api --filter=crm --filter=@bedrock/workflow-deal-projections

# Интеграционные (если меняешь domain/projection логику)
bun run test:integration   # требует Postgres + TigerBeetle
```

---

## Файлы, которые ты будешь трогать

### Для TODO #1 (useCalculationForm hook)
- `apps/crm/lib/hooks/useCalculationForm.ts` — **NEW**, перенести form-state/handlers/preview логику.
- `apps/crm/app/(dashboard)/deals/[id]/_components/calculation-dialog.tsx` — превратить в обёртку `<Dialog>` над hook'ом.
- `apps/crm/app/(dashboard)/deals/[id]/_components/calculating-pane.tsx` — `InputsCard` использует тот же hook.
- `apps/crm/app/(dashboard)/deals/[id]/page.tsx` — вызов `useCalculationForm`, упрощение state.

### Для TODO #2 (leg amount enrichment)
- `packages/workflows/deal-projections/src/service.ts:324+` — `enrichDealExecutionPlanWithParticipants` + доп. параметр `operations: TreasuryOperationRecord[]`.
- `packages/workflows/deal-projections/src/service.ts:1957+` — `getCrmDealWorkbenchProjection` должен передать operations (загрузить рядом с quotesResult).
- `packages/workflows/deal-projections/tests/service.test.ts` — новые тесты.

### Для TODO #3 (read-only mode)
- `apps/crm/app/(dashboard)/deals/[id]/page.tsx:1887+` — блок `stagePanes`, добавить `readOnly` и `isFuture` вычисления, пробросить в панели.

### Для TODO #4 (approver displayName)
- `packages/modules/deals/src/application/contracts/dto.ts:526` — `DealApprovalSchema` extended.
- `packages/modules/deals/src/adapters/drizzle/deal.reads.ts` — проверить что displayName не нужно хранить (резолвится через IAM).
- `packages/workflows/deal-projections/src/service.ts:2065` — при сборке `approvals` для workbench — резолвить displayName.
- `apps/crm/app/(dashboard)/deals/[id]/_components/types.ts:333–341` — обновить approvals type.
- `apps/crm/app/(dashboard)/deals/[id]/_components/approval-pane.tsx` — использовать новые displayName-поля.

### Для TODO #7 (PDF/Email stubs с toast)
- `apps/crm/app/(dashboard)/deals/[id]/page.tsx` — создать handlers `handleSendCalcPdf`, `handleSendToCustomer`, `handleDownloadPack`, `handleSendStatement`, `handleNudgeApprover` — все с `toast.success(...)` через `sonner` или существующий mechanism.
- Передать их в соответствующие пропсы панелей.

---

## Приложение: карта структуры iteration 2

### Файлы, созданные в итерации 2
```
apps/crm/app/(dashboard)/deals/[id]/_components/
  ├── approval-pane.tsx          (NEW)
  ├── calculating-pane.tsx       (NEW)
  ├── funding-pane.tsx           (NEW)
  ├── key-dates-sidebar-card.tsx (NEW)
  ├── parties-sidebar-card.tsx   (NEW)
  ├── pricing-pane.tsx           (NEW)
  └── settled-pane.tsx           (NEW)

apps/crm/lib/
  └── timeline-labels.ts         (NEW)
```

### Файлы, удалённые в итерации 2
```
apps/crm/app/(dashboard)/deals/[id]/_components/
  ├── agreement-card.tsx
  ├── deal-documents-tab.tsx
  ├── deal-execution-tab.tsx
  ├── deal-intake-tab.tsx
  ├── deal-management-card.tsx
  ├── deal-overview-tab.tsx
  ├── deal-pricing-tab.tsx
  ├── deal-timeline-card.test.ts
  ├── deal-timeline-card.tsx
  └── stage-panes.tsx
```

### Файлы, значительно изменённые в итерации 2
```
apps/crm/app/(dashboard)/deals/[id]/page.tsx          — удаление 200+ строк legacy state/handlers, замена sidebar JSX, новые пропсы в панели
apps/crm/app/(dashboard)/deals/[id]/_components/types.ts — ApiDealWorkflowLeg + assignee
packages/modules/deals/src/application/contracts/dto.ts — DealWorkflowLegSchema
packages/modules/deals/src/adapters/drizzle/deal.reads.ts — nullable поля в hydrator
packages/modules/deals/src/domain/workflow.ts — getDealLegPartyRoles + createLeg с dealType
packages/workflows/deal-projections/src/contracts.ts — CrmDealAssigneeSchema
packages/workflows/deal-projections/src/service.ts — enrichDealExecutionPlanWithParticipants + iam lookup
packages/workflows/deal-projections/tests/{service,close-readiness}.test.ts — фикстуры leg с nullable полями
```

### Файлы, которые ОСТАЛИСЬ без изменений (но стоит знать)
```
apps/crm/app/(dashboard)/deals/[id]/_components/
  ├── attachments-card.tsx              (используется? проверить)
  ├── beneficiary-draft-card.tsx        (используется в IntakeEditorCard)
  ├── beneficiary-draft-card.test.ts
  ├── calculation-dialog.tsx            (nouveau используется из Pricing + Calculating panes)
  ├── constants.ts
  ├── constants.test.ts
  ├── counterparty-card.tsx             (возможно orphan — проверь grep)
  ├── create-calculation-dialog.tsx     (используется)
  ├── deal-header.tsx                   (используется)
  ├── deal-info-card.tsx                (orphan? проверь)
  ├── deal-stage-track.tsx              (используется)
  ├── deal-tabs.tsx                     (используется для URL tab mapping)
  ├── error-dialog.tsx                  (используется)
  ├── evidence-requirements-card.tsx    (orphan? проверь)
  ├── execution-plan-card.tsx           (используется в OperationalStateCard flow)
  ├── file-utils.tsx                    (orphan? проверь)
  ├── financial-card.tsx                (orphan? проверь)
  ├── format.ts                         (используется — formatCurrency / minorToDecimalString / rationalToDecimalString)
  ├── formal-documents-card.tsx         (orphan? проверь)
  ├── formal-documents-card.test.ts
  ├── intake-editor-card.tsx            (используется внутри BeneficiaryIntakeCard)
  ├── intake-editor-card.types.ts
  ├── operational-state-card.tsx        (используется в FundingPane)
  ├── organization-card.tsx             (orphan? проверь)
  ├── organization-requisite-card.tsx   (orphan? проверь)
  ├── types.ts                          (используется)
  └── upload-attachment-dialog.tsx      (orphan — UploadAttachmentDialog render удалён)
```

> 🔍 **Задача для iteration 3 Phase 9:** пройди по этому списку с `grep -r "OrganizationCard\|CounterpartyCard\|DealInfoCard\|EvidenceRequirementsCard\|FinancialCard\|FormalDocumentsCard\|OrganizationRequisiteCard\|AttachmentsCard\|FileUtils\|UploadAttachmentDialog" apps/crm` — что orphan, удали вместе с тестами. После удаления — `bun run check-types && bun run lint`.

---

## Архитектурные напоминания

- **Bun** — package manager, **Node 24.x** — runtime.
- Импорты через `package.json#exports`.
- Layers: `contracts / application / domain / infra / service.ts`. ESLint блокирует infra-импорты из application.
- Миграции baseline-only hard cutover. **Пользователь сам их запускает** — не вызывай `db:nuke/migrate/seed` без явной просьбы. В этой итерации никаких DB-миграций не требуется (все изменения — computed projection fields, не таблицы).
- Новые файлы `kebab-case.ts`; React-компоненты — `PascalCase` внутри.
- shadcn-компоненты из `@bedrock/sdk-ui/components/*`.

---

## Процедура работы

1. **Прочитай `REDESIGN.md` + `REDESIGN_ITTERATION_2.md`** для полного контекста дизайна.
2. **Запусти проверки** (check-types + lint + tests) чтобы убедиться, что стартуешь с чистого состояния.
3. **Выбери TODO из списка выше** в приоритетном порядке:
   - Phase 0.3 (leg enrichment) — прямо влияет на визуал FundingPane.
   - TODO #3 (read-only mode) — важно для UX просмотра прошлых этапов.
   - TODO #4 (approver displayName) — маленький, но нужный.
   - TODO #1 (useCalculationForm hook) — большой refactor, делай в последнюю очередь.
4. **Playwright-верификация** в финале (TODO #10).
5. **Коммит по каждому крупному TODO** отдельно, чтобы было легко откатить часть.

Удачи. Прототип — источник истины.
