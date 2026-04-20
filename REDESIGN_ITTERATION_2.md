# Redesign — CRM Deals · Итерация 2

Документ для агента с чистым контекстом. В итерации 1 (см. `REDISIGN.md` и git-историю) был сделан визуальный фундамент, но **содержимое stage-панелей и сайдбара детальной страницы всё ещё не соответствует референсу** — пользователь увидел старые блоки (Управление сделкой / Таймлайн / Агентский договор) и не нашёл новых полей (Beneficiary intake / Parties / Initial offer / Activity / Approvers / Financials / Payment legs / Closing statement).

Твоя задача — довести детальную страницу до визуальной и UX-паритетности с прототипом. **До последней мелочи.**

---

## Референс — где лежит и как открыть

### Файлы
- Архив: `Bedrock Finance.zip` в корне репо (`/mnt/disks/sata240/work/bedrock/Bedrock Finance.zip`)
- Распакованная копия: `/tmp/bedrock-design/` (содержит `index.html`, `src/screens/deals.jsx`, `src/primitives.jsx`, `src/shells.jsx`, `src/icons.jsx`, `src/data.jsx`, `styles.css`).
- Если копии нет — пересобрать:
  ```bash
  cd /tmp && unzip -o "/mnt/disks/sata240/work/bedrock/Bedrock Finance.zip" -d bedrock-design
  ```

### Запуск прототипа (для Playwright-сравнений)
```bash
cd /tmp/bedrock-design && python3 -m http.server 8765 &
```
Открыть `http://localhost:8765/` → в showcase-nav выбрать **CRM → Deal · detail** (или через JS: `localStorage.setItem("bedrock-screen","crm-deal"); location.reload();`).

### Ключевой эталон для этой итерации
Файл `/tmp/bedrock-design/src/screens/deals.jsx` — полная разметка `DealDetailScreen`. Читать его вместе с:
- `/tmp/bedrock-design/src/primitives.jsx` — базовые компоненты (Card, Btn, Badge, Field, Input и т.д.)
- `/tmp/bedrock-design/src/data.jsx` — фикстуры DEALS + STAGE_LABEL/STAGE_BADGE + Money primitive
- `/tmp/bedrock-design/styles.css` — токены и классы `.stage-pane / .kv-grid / .callout / .approval-row / .leg-row`

---

## Что уже сделано (итерация 1)

### Фундамент — визуальные токены и шелл
- `apps/crm/app/globals.css` — добавлены утилиты `.stage-pane`, `.kv-grid` (+`.cols-3`, `.cols-4`, `.cols-auto`), `.kv-label/.kv-value/.kv-value-lg` (+`.pos/.neg`), `.callout` (+`.warn/.info/.neg`), `.approval-row/.approval-summary`, `.leg-row`, `.stage-track*`, `.detail-grid`, `.detail-main/.detail-side`.
- Центрирование лейаута: `max-w-[1440px] px-6 py-6` в `apps/crm/app/(dashboard)/layout.tsx` + `components/app/header.tsx`.
- KPI монотонные (удалены `.kpi-value.pos/.warn` и `tone` prop в вызовах).

### Список сделок `/deals`
- `apps/crm/components/dashboard/dealsColumns.tsx` — 8 колонок под референс: ID / Клиент→Бенефициар / Сумма / Комиссия / Маржа / Этап / Срок / Владелец. Legacy-колонки скрыты, но доступны через `DataTableViewOptions`.
- Сегмент-фильтр: 6 опций (Все/Прайсинг/Расчёт/Согласование/Исполнение/Завершены), rejected/cancelled → Settled.
- Backend: `netMarginInBase` прокинут из `buildCrmDealMoneySummary` (`packages/workflows/deal-projections/src/service.ts`) через `CrmDealListItemSchema` (`contracts.ts`) в `DealsRow` (`apps/crm/lib/hooks/useDealsTable.ts`).

### Детальная страница — каркас (но не контент!)
- `DealStageTrack` + `StageViewingBanner` — работают.
- `DealHeader` — title `{applicant} → {beneficiary}` + mono-subtitle + dropdown «Изменить статус».
- `stage-panes.tsx` — 5 обёрток (PricingPane/CalculatingPane/ApprovalPane/FundingPane/SettledPane), которые добавляют один intro-callout/summary-карточку **сверху** и рендерят существующие табы (DealIntakeTab/DealPricingTab/DealDocumentsTab/DealExecutionTab/DealOverviewTab) **снизу**.

**Проблема:** existing табы не соответствуют формам прототипа. Сайдбар — тоже.

---

## Что ещё нужно сделать (итерация 2)

Разбито по областям. Каждый блок — отдельный, можно делать последовательно. Пропсы уже прокинуты через `stage-panes.tsx` — в нём же и переделывать структуру.

---

### A. Сайдбар `.detail-side` — полная замена

**Эталон:** `/tmp/bedrock-design/src/screens/deals.jsx` (функция `DealDetailScreen`, sidebar-блок). Показывает **две** карточки:

#### A1. Card «Parties»
Три записи с разделителями `<div className="divider" />`:
```
CUSTOMER
Nordmax Trading LLC
CUS-0042 · RU
---
BENEFICIARY
Lotus Global FZE
CP-2101 · AE
---
AGENT
Anna Ermolova
Bedrock CRM · AE desk
```

Лейбл — `.kv-label` (uppercase mono 10.5px letter-spacing 0.08em).
Имя — 13px / weight 500.
Id + country — `.mono` 11px muted-foreground.

**Источник данных:**
- Customer: `data.customer.customers[0]` (имя) + `data.workbench.context.customer.customer` (в workbench-проекции имя + ИНН/страна)
- Beneficiary: `data.workbench.beneficiaryDraft?.beneficiarySnapshot` ИЛИ `data.workflow.intake.externalBeneficiary.beneficiarySnapshot`. Имя в `beneficiarySnapshot.displayName`/`name`.
- Agent: `data.workbench.assignee.userId` — если есть, резолвить имя через `data.workbench.summary.assignee` (проверь фактическое поле, возможно потребуется прокинуть agent name в workbench-проекции; если нет — показать `userId` и TODO).

Страна/id — если недоступно, показать `—` или скрыть вторую строку.

#### A2. Card «Key dates»
Список пар `ключ — значение mono`:
```
CREATED        Apr 18 · 10:05
QUOTED         Apr 18 · 14:12
ACCEPTED       Apr 19 · 11:40
APPROVED       Apr 20 · 09:02
FUNDING STARTED Apr 20 · 16:00
SETTLED        —
```

**Источник данных:** `data.workflow.timeline` — массив `ApiDealTimelineEvent` с `occurredAt` и `type` (`deal_created`, `intake_saved`, `quote_created`, `quote_accepted`, `calculation_created`, `calculation_locked`, `deal_approved`, `deal_funding_started`, `deal_settled` и т.д. — проверь точный enum в `apps/crm/app/(dashboard)/deals/[id]/_components/types.ts`, поле `ApiDealTimelineEvent.type`).

Маппинг `event.type → лейбл` собрать самому по доступным типам. Если события не было — показать `—`.

Формат даты: локализованный (`Intl.DateTimeFormat("ru-RU", { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" })`), например `20 апр · 18:00`.

#### A3. Удалить три существующие карточки из `data.side`
В `apps/crm/app/(dashboard)/deals/[id]/page.tsx` (~строка 2136+):
```tsx
<div className="detail-side">
  <DealManagementCard ... />     // УДАЛИТЬ
  <DealTimelineCard ... />        // УДАЛИТЬ
  <AgreementCard ... />           // УДАЛИТЬ
</div>
```
Заменить на `<PartiesSidebarCard />` + `<KeyDatesSidebarCard />`.

Компоненты реализовать в отдельных файлах:
- `apps/crm/app/(dashboard)/deals/[id]/_components/parties-sidebar-card.tsx`
- `apps/crm/app/(dashboard)/deals/[id]/_components/key-dates-sidebar-card.tsx`

**Вопрос по DealManagementCard:** он содержит поле «Ответственный агент» (назначение), которое может быть бизнес-критичным (сейчас нет другого способа сменить агента). Если оно нужно — перенести в PartiesSidebarCard как select под AGENT. Если нет — удалить и дать знать пользователю. **По-умолчанию: перенести селект в PartiesSidebarCard.**

---

### B. PricingPane — полная переделка контента

**Эталон:** `/tmp/bedrock-design/src/screens/deals.jsx`, функция `PricingPane` (рендерится при `viewIdx === 0`).

Текущий pane рендерит один callout + `<DealIntakeTab>` (= `IntakeEditorCard`). Нужно **заменить** на три карточки.

#### B1. Card «1 · Beneficiary intake»
Заголовок: `1 · Beneficiary intake`, подзаголовок: `Captured on deal creation — complete missing fields before pricing`.

Внутри: **переиспользовать** `IntakeEditorCard` (в нём уже есть поля beneficiary: SWIFT, bank, IBAN, address). Обернуть в новую `Card` с правильным заголовком через shadcn `Card/CardHeader/CardTitle/CardDescription`.

Под формой — `.callout` (зелёный) валидации:
```
✓ All fields valid. SWIFT BIC resolves to <b>First Abu Dhabi Bank · Dubai</b>.
  Sanctions screen <b class="mono" style="color:var(--success)">CLEAN</b> (ran Apr 18).
```
(Если данные sanctions не прокинуты — показать серый `.callout.info` «Валидация недоступна» и TODO.)

**Источник SWIFT-резолва:** поле `beneficiarySnapshot.bankName` или `bankInstructionSnapshot.bankName`. Проверь в types.ts — `ApiDealBankInstructionSnapshot`. Sanctions — скорее всего отсутствует, оставить TODO.

#### B2. Card «2 · Initial offer to customer»
Заголовок: `2 · Initial offer to customer`, подзаголовок: `Indicative rate and fee — customer must accept before we calculate`.

`kv-grid.cols-3` с 6 ячейками:
```
Gross in           13 126 568.00 RUB
Proposed all-in rate  93.7214
Beneficiary receives  140 040.00 USD
Proposed fee         1 960.00 USD
Bedrock margin (est.) +1 240.00 USD
Rate valid until    Apr 19 · 18:00 MSK
```

**Источник данных:**
- Gross in: `data.workflow.intake.moneyRequest.sourceAmount` + source currency code (резолвить через `data.currencyOptions` или `data.sourceCurrency`).
- Rate: первое draft-котировка `data.workbench.pricing.quotes[0]` (см. `ApiDealPricingQuote`) ИЛИ `data.calculation.finalRate`.
- Beneficiary receives: из первой котировки `quote.targetAmount`.
- Proposed fee: `quote.feeAmount` (проверь точное поле).
- Bedrock margin: `quote.markupAmount` или `calculation.quoteMarkupAmount`.
- Rate valid until: `quote.expiresAt`.

Если данных нет (нет котировок) — показать `.callout.warn` «Первоначальное предложение не сформировано» + кнопку «Создать котировку» (та же логика, что сейчас в DealPricingTab → `handleOpenQuoteDialog`).

Кнопки внизу (`.hstack` justify-end gap-2):
- `Edit proposal` (ghost) — открывает QuoteDialog
- `Send to customer` (secondary) — no-op с toast «Отправлено клиенту» (email-фича не в скоупе)
- `Customer accepted → Calculating` (primary, icon `ArrowRight`) — вызывает `handleAcceptQuote(quoteId)` если есть котировка, иначе disabled

#### B3. Card «Activity»
Заголовок: `Activity`. Список событий из `data.workflow.timeline` (vstack gap:10px):
```tsx
<div className="hstack" style="gap:10px">
  <span className="avatar sm muted">AE</span>   // initials агента, если event.actor.userId есть
  <div style="flex:1">
    <div>Anna Ermolova sent initial offer to customer</div>
  </div>
  <span className="mono" style="fontSize:11px; color:var(--muted-foreground)">
    Apr 18 · 14:12
  </span>
</div>
```

Маппинг `event.type → текст` — собрать по доступным типам (`ApiDealTimelineEvent.type`). Аватар через `Avatar` из sdk-ui с fallback из инициалов.

#### B4. Заменить содержимое PricingPane
В `apps/crm/app/(dashboard)/deals/[id]/_components/stage-panes.tsx`, функция `PricingPane` — переписать `return`:
```tsx
return (
  <div className="stage-pane">
    <BeneficiaryIntakeCard {...} />    // B1
    <InitialOfferCard {...} />          // B2
    <ActivityCard timeline={...} />     // B3
  </div>
);
```
Каждую карточку вынести в отдельный под-компонент в том же файле (или в отдельные `*-card.tsx` если по ~80 строк).

---

### C. CalculatingPane — полная переделка

**Эталон:** `/tmp/bedrock-design/src/screens/deals.jsx`, функция `CalculatingPane`. Пять секций:

#### C1. Promise-callout
Сверху — `.callout` (pos или warn). Сравнивает текущую котировку с принятой клиентом ранее.
```
✓ Within promise. Customer accepted 93.7214 · Current quote 93.6988 (−0.02%).
```
или warn:
```
⚠ Above promise. Customer accepted 93.7214 · Current quote 94.1500 (+0.46%).
   Re-confirm with customer before locking.
```

**Источник:**
- Принятая котировка: `data.workbench.acceptedQuote` — поле `rate` или `finalRate`.
- Текущий расчёт: `data.calculation.finalRate`.
- Вычислить отклонение (%) и покрасить (pos если ≤ 0.1%, warn иначе).

Если `data.calculation` нет — показать `.callout.warn` «Расчёт ещё не создан. Нажмите Создать расчёт» + CTA-кнопка `handleOpenCreateCalculationDialog`.

#### C2. Card «Inputs»
Заголовок: `Inputs`, подзаголовок: `Change any input — totals recalculate below`.

Два ряда по 3 поля (`.field-row.three` → grid 3-col):
```
Gross amount             Settlement currency    Route template
[ 13 126 568.00 ] RUB    [ USD ▼ ]              [ RT-081 standard ▼ ]

Base rate source         Base rate              Fee (bps)
[ CBR · 10:05 ▼ ]        [ 93.6988 ]            [ 150 ]
```

**Источник / поведение:**
- Эта форма — **inline-версия `CalculationDialog`**. Из-за масштаба — опционально:
  - **Вариант A (полный порт)**: вынуть логику из `CalculationDialog`/`CreateCalculationDialog` в компонент-хук `useCalculationForm`, использовать его inline.
  - **Вариант B (прагматичный)**: показать как read-only карточку с текущими значениями, при клике «Редактировать» — открывать существующий `CalculationDialog`. Эта кнопка может идти в правом верхнем углу карточки.
  
  **Рекомендация: Вариант B** — минимальный диф, максимум визуального парити. Можно в будущем проапгрейдить.

#### C3. Card «Fee breakdown»
Заголовок: `Fee breakdown`, подзаголовок: `Per-leg fees from route template {routeName}`.

Таблица:
| Component | Provider | Basis | Amount |
|-----------|----------|-------|--------|
| Agreement fee | Contract | 0.15% | 196.89 USD |
| FX markup | Internal | +5 bps | 700.00 USD |
| Provider fee | SWIFT | Fixed | 40.00 USD |
| **Total fee** | | | **1 960.00 USD** |

**Источник:** `data.calculation.totalFeeAmount` (общая), `agreementFeeAmount`, `quoteMarkupAmount`, `fixedFeeAmount`, `additionalExpenses`. Собрать 3-4 строки из калькуляции. Provider/Basis — если недоступно, показать `—`.

Использовать существующую `Table` из sdk-ui.

#### C4. Card «Quote»
Заголовок: `Quote`, подзаголовок: `What the customer sees · what Bedrock earns`.

`kv-grid.cols-4` с 4 крупными значениями (`.kv-value-lg`):
```
CUSTOMER PAYS          BENEFICIARY RECEIVES     FINAL RATE       NET PROFIT
13 126 568.00 RUB      140 040.00 USD           93.6988          +1 240.00 USD
                                                                 (pos, after provider costs)
```

Внизу net profit — subscript «(after provider costs)».

#### C5. Card «Validity & lock»
Заголовок: `Validity & lock`.

`kv-grid.cols-3`:
```
RATE LOCKED UNTIL    QUOTE EXPIRES         FUNDING DEADLINE
Apr 19 · 18:00 MSK   Apr 19 · 18:00 MSK    Apr 22 · 16:00 MSK
```

**Источник:** `data.calculation.expiresAt` (если есть), `data.workflow.intake.common.requestedExecutionDate`.

Действия (`.hstack` justify-end gap:8px):
- `Duplicate calc` (ghost) — дублирует текущий расчёт
- `PDF for customer` (secondary) — генерирует PDF (stub/TODO)
- `Send to customer` (secondary)
- `Accept calculation → Approval` (primary) — переводит статус сделки в `preparing_documents`. Disabled если нет калькуляции или не within-promise.

#### C6. Переписать CalculatingPane
Структура:
```tsx
<div className="stage-pane">
  <PromiseCallout acceptedRate={...} currentRate={...} />
  <InputsCard {...} />
  <FeeBreakdownCard calculation={data.calculation} />
  <QuoteSummaryCard calculation={data.calculation} netMarginInBase={...} />
  <ValidityLockCard calculation={data.calculation} />
</div>
```

---

### D. ApprovalPane — полная переделка

**Эталон:** `/tmp/bedrock-design/src/screens/deals.jsx`, функция `ApprovalPane`. Две секции:

#### D1. Card «Calculation · locked»
Заголовок: `Calculation · locked`, подзаголовок: `Commercial promise frozen — approvers must sign before funding`.

`.approval-summary` (grid 3-col крупных значений):
```
CUSTOMER PAYS          BENEFICIARY RECEIVES     NET MARGIN
13 126 568.00 RUB      140 040.00 USD           +1 240.00 USD (pos)
```

**Это уже частично сделано** (мой intro-card). Просто оформить как полноценную `Card` с CardHeader + CardDescription.

#### D2. Card «Approvers»
Заголовок: `Approvers`, подзаголовок: `Gated by deal size and customer risk tier`.

Список `.approval-row` (grid 110px 1fr auto):
```
AGENT        Anna Ermolova                    ● Approved    Apr 20 · 09:02
             Verified customer relationship
TREASURY     Dmitry Volkov                    ● Approved    Apr 20 · 10:15
             Within provider limits
COMPLIANCE   —                                ○ Pending     —
             Waiting for sanctions re-screen
```

**Источник:** `data.workbench.approvals` — массив `ApiDealApproval` (проверь shape в types.ts/contracts). Поля: `role` (enum), `approverName`, `status` (approved/pending/rejected), `decidedAt`, `note/reason`.

Бейдж статуса — `Badge variant="success" className="badge-dot"` / `variant="warning"` / `variant="destructive"`.

Действия внизу:
- `Nudge Compliance` (secondary) — no-op с toast
- `Move to Funding` (primary, disabled если не все approved, с текстом причины под кнопкой)

**Если `approvals` пустой/отсутствует на workbench** — показать `.callout.info` «Апруверы не настроены для этого типа сделки» + TODO в коде.

#### D3. Существующий `DealDocumentsTab` 
- **УДАЛИТЬ** из ApprovalPane (он к approval-этапу отношения не имеет — это документооборот).
- Документы переехали в FundingPane или отдельный «Documents» инспектор — проверь с пользователем. **По-умолчанию: оставить документы отдельным блоком ПОСЛЕ Approvers в ApprovalPane**, так как их проверяют на согласовании. Но обернуть в `Card` с правильными заголовками.

#### D4. Переписать ApprovalPane
```tsx
<div className="stage-pane">
  <CalculationLockedCard calculation={...} netMarginInBase={...} />
  <ApproversCard approvals={data.workbench.approvals} />
  {/* опционально — документы как дополнительный блок */}
  <DealDocumentsTab {...documentsProps} />  // оставляем, но обёрнут в Card
</div>
```

---

### E. FundingPane — доработка

**Эталон:** `/tmp/bedrock-design/src/screens/deals.jsx`, функция `FundingPane`.

#### E1. Card «Financials» (уже частично сделано)
Сейчас есть — оформить как полноценную `Card` с CardHeader «Financials» / CardDescription «Final, committed — no further edits allowed». Сохранить 6-cell `kv-grid.cols-auto`.

#### E2. Card «Payment legs» — нужна data-работа
Сейчас рендерится упрощённый превью (только `kind` и `state`). Референс требует:
```
LEG 01   Customer · sender RU       →   Bedrock · receiver RU      13 126 568.00 RUB   ✓ Received
LEG 02   Bedrock · sender RU        →   Bedrock · receiver AE       140 040.00 USD     ⏳ In-flight
LEG 03   Bedrock · sender AE        →   Lotus Global · receiver AE  140 040.00 USD     ○ Queued
```

**Проблема:** `ApiDealWorkflowLeg` (см. `apps/crm/app/(dashboard)/deals/[id]/_components/types.ts` ~строка 81) имеет только `id/idx/kind/operationRefs/state`. Нет полей `from/to/amount/currency`.

**Варианты:**
- (а) Обогатить `ApiDealWorkflowLeg` на бэкенде: поля `fromPartyName/fromRole/toPartyName/toRole/amountMinor/currencyCode/statusLabel`. Расширить `DealWorkflowLegSchema` в `@bedrock/deals/contracts`.
- (б) Резолвить через `operationRefs` клиентски — если каждая операция в `data.workflow.operations` уже содержит эти данные.
- (в) Оставить упрощённый вид (kind/state) и пометить TODO.

**Рекомендация:** (а) — это правильно архитектурно. Начать с изменения `DealWorkflowLegSchema` в `packages/modules/deals/src/application/contracts/dto.ts` или `@bedrock/deals/contracts`, прокинуть через проекцию в `@bedrock/workflow-deal-projections`. Вариант (б) как краткосрочный fallback.

Badge-статус:
- `Received` / `Settled` → `variant="success"` (dot)
- `In-flight` / `Submitted` → `variant="warning"` (dot)
- `Queued` / `Planned` → `variant="outline"` (dot)

#### E3. Treasury workbench CTA
В `CardHeader` actions (`<Btn variant="secondary" size="sm" icon="external">Open treasury workbench</Btn>`) — ведёт на `/finance/deals/{id}/workbench` (если этот раут уже есть; если нет — просто откладывать с toast).

#### E4. Финансовые inputs (не в референсе pane, но может быть отдельный секторный блок)
Оставить существующий `DealExecutionTab` (с `OperationalStateCard` + `ExecutionPlanCard`) как нижний блок FundingPane для операционки. Не дублировать legs — спрятать leg-список в `ExecutionPlanCard`, показывать только в нашем `Payment legs` Card'е.

---

### F. SettledPane — доработка

**Эталон:** `/tmp/bedrock-design/src/screens/deals.jsx`, функция `SettledPane`.

#### F1. Card «Closing statement»
Уже частично сделано. Расширить до 6 полей в `kv-grid.cols-3` (2 ряда):
```
SETTLEMENT DATE    ACTUAL T+N         REALIZED MARGIN
Apr 21 · 16:02     T+3 (on plan)      +1 280.00 USD (pos)

VARIANCE VS PLAN   PROOF ATTACHED     CUSTOMER INVOICE
+40.00 USD (+3%)   3 files            INV-0441 sent (pos dot)
```

**Источник:**
- Settlement date: `closedAt` (уже есть).
- Actual T+n: вычислить из `closedAt − createdAt` в днях.
- Realized margin: `netMarginInBase` (уже есть).
- Variance: `realized - planned`. Planned margin должна быть в snapshot или в первом расчёте. Если недоступно — `—`.
- Proof attached: `data.attachments.length` + «files».
- Customer invoice: `data.formalDocuments.find(d => d.docType === "invoice")?.status`.

Действия (`hstack` justify-end):
- `Download pack` (ghost, icon `Download`) — TODO/stub (генерация ZIP с документами)
- `Send statement to customer` (secondary, icon `Mail`)

#### F2. Удалить/переместить содержимое `DealOverviewTab`
Сейчас `DealOverviewTab` показывает: Что нужно сделать сейчас + DealInfoCard + CounterpartyCard + OrganizationCard + OrganizationRequisiteCard.

После settled ни один из этих блоков не нужен (сделка закрыта, делать нечего). **Оставить только DealInfoCard** (для редактирования комментария) или удалить совсем. **Рекомендация: удалить DealOverviewTab полностью из SettledPane**, оставить только `ClosingStatementCard`.

#### F3. Если сделка rejected/cancelled
Показывать `.callout.neg` «Сделка завершена без исполнения» + краткую сводку почему (`data.deal.reason` если есть) + ссылку на timeline (через новый Key dates в сайдбаре).

---

### G. Icons — единый каталог иконок из прототипа

Прототип использует `<Icon name="...">` компонент (см. `/tmp/bedrock-design/src/icons.jsx`) — 77 имён. Часть совпадает с `lucide-react`:
- `check` → `Check`
- `alert` → `AlertCircle`
- `info` → `Info`
- `lock` → `Lock`
- `arrow_right` → `ArrowRight`
- `download` → `Download`
- `mail` → `Mail`
- `calculator` → `Calculator`
- `external` → `ExternalLink`
- `file` → `File`
- `plus` → `Plus`
- `filter` → `Filter`

Используй `lucide-react` — он уже в `package.json`. Размеры: `h-3.5 w-3.5` (14px) для inline, `h-4 w-4` (16px) для кнопок.

---

### H. Фоны стадии — учитывать `viewStage !== currentStage`

Когда юзер смотрит не текущий этап — уже есть `StageViewingBanner` (жёлтый). Кроме того, карточки в неактивной стадии должны быть **read-only или disabled**. Пример:
- На PricingPane в режиме `viewStage=pricing, currentStage=funding` — все поля disabled, кнопки hidden или disabled с tooltip.
- На ApprovalPane, если смотришь из будущего (`viewStage > currentStage`) — показать `.callout.info` «Этап ещё не достигнут, данные плейсхолдеры».

Реализовать через prop `readOnly: boolean` в каждой pane (вычислять в page.tsx: `readOnly = viewStage !== currentStage`).

---

## Что нужно проверить в данных

### Workbench projection — доступные поля
Файл: `apps/crm/app/(dashboard)/deals/[id]/_components/types.ts`. Ищи:
- `ApiCrmDealWorkbenchProjection` — базовая проекция, есть `context.customer`, `context.applicant`, `context.agreement`, `context.internalEntity`.
- `ApiDealApproval` — поля approvals. Проверь shape.
- `ApiDealPricingQuote` — котировки.
- `ApiDealWorkflowLeg` — пока скуднее референса (см. E2).
- `ApiDealTimelineEvent.type` — полный enum событий для B3/A2.

Если какого-то поля нет и его нужно добавить — правка в:
- `@bedrock/deals/contracts` (шейм деллов)
- `@bedrock/workflow-deal-projections/src/service.ts` (проекция)
- `apps/crm/app/(dashboard)/deals/[id]/_components/types.ts` (фронт-тип)

### Beneficiary name — откуда брать
- `data.workflow.intake.externalBeneficiary.beneficiarySnapshot.displayName` (проверь точное поле).
- Альтернатива: `data.workbench.beneficiaryDraft?.beneficiarySnapshot?.displayName`.

Если в конкретной сделке бенефициар == клиент (т.е. обе стороны — одна компания), по текущей практике сейчас показывается `BARNAVA TRADING FZCO → BARNAVA TRADING FZCO`. Вопрос UX: правильно ли показывать повтор или схлопнуть? **По-умолчанию: оставить как есть, повтор виден — честная картина.**

---

## Процедура работы

1. **Запусти реф и CRM:**
   ```bash
   cd /tmp/bedrock-design && python3 -m http.server 8765 &
   bun --cwd apps/crm run dev &   # :3002
   bun --cwd apps/api run dev &   # :3000
   ```
   Вход в CRM: `admin@bedrock.com` / `admin123`.

2. **Создай тестовую сделку** через UI (Новая сделка → заполни обязательные поля → создай), чтобы не упираться в пустую таблицу. Или прогони `db:seed` если у неё есть deals-фикстура (проверь `apps/db/src/seeds/`).

3. **Делай пошагово** в порядке A → B → C → D → E → F. После каждого блока:
   - Сравни с прототипом в браузере (viewport 1440×900).
   - Screenshot-диф: `.playwright-mcp/ref-*.png` vs `.playwright-mcp/crm-*.png`.
   - `bun run check-types --filter=crm` + `bun run lint --filter=crm`.

4. **Плейтрайт-верификация каждого этапа:**
   - `http://localhost:3002/deals/{id}?tab=intake` → Pricing
   - `?tab=pricing` → Calculating
   - `?tab=documents` → Approval
   - `?tab=execution` → Funding
   - `?tab=overview` → Settled

5. **Финал:**
   ```bash
   bun run check-types --filter=crm --filter=@bedrock/workflow-deal-projections
   bun run lint --filter=crm
   ```
   Оба должны быть зелёные.

---

## Архитектурные напоминания (см. `CLAUDE.md`)

- **Bun** — package manager, **Node 24.x** — runtime.
- Импорты через `package.json#exports` — никаких deep imports.
- Layers: `contracts / application / domain / infra / service.ts`. ESLint блокирует infra-импорты из application.
- Миграции baseline-only hard cutover (`db:nuke → db:migrate → db:seed`). **Пользователь сам их запускает** — не вызывай без явной просьбы.
- Новые файлы `kebab-case.ts`; React-компоненты — `PascalCase` внутри.
- Tailwind + shadcn `Card/Badge/Button/Avatar` из `@bedrock/sdk-ui/components/*`.

---

## Файлы, которые ты будешь трогать

### Точно
- `apps/crm/app/(dashboard)/deals/[id]/_components/stage-panes.tsx` — полностью переписать 5 функций.
- `apps/crm/app/(dashboard)/deals/[id]/page.tsx` — удалить импорты/рендер старых sidebar-карточек (`DealManagementCard`, `DealTimelineCard`, `AgreementCard`), добавить новые.
- `apps/crm/app/(dashboard)/deals/[id]/_components/parties-sidebar-card.tsx` — NEW (A1).
- `apps/crm/app/(dashboard)/deals/[id]/_components/key-dates-sidebar-card.tsx` — NEW (A2).
- Разбить stage-panes на отдельные файлы если >600 строк суммарно:
  - `pricing-pane.tsx` (B), `calculating-pane.tsx` (C), `approval-pane.tsx` (D), `funding-pane.tsx` (E), `settled-pane.tsx` (F).

### Возможно
- `apps/crm/app/globals.css` — если найдёшь недостающую утилиту.
- `packages/modules/deals/src/application/contracts/dto.ts` + `packages/workflows/deal-projections/src/service.ts` — если нужно обогатить `ApiDealWorkflowLeg` для E2.
- Удалить файлы `deal-intake-tab.tsx / deal-pricing-tab.tsx / deal-documents-tab.tsx / deal-execution-tab.tsx / deal-overview-tab.tsx` если они больше не используются — но сначала убедись, что они нигде ещё не импортируются (grep).

---

## Критерии приёмки

- [ ] На PricingPane видны три карточки (Beneficiary intake / Initial offer / Activity).
- [ ] На CalculatingPane видна promise-callout + 4 карточки (Inputs / Fee breakdown / Quote / Validity).
- [ ] На ApprovalPane видна Calculation locked + Approvers list.
- [ ] На FundingPane видна Financials + Payment legs с sender/receiver/amount/status.
- [ ] На SettledPane видна Closing statement (6 полей) без лишних overview-карточек.
- [ ] В `.detail-side` — две карточки (Parties + Key dates), старые три удалены.
- [ ] `viewStage !== currentStage` → все панели read-only с info-баннером.
- [ ] `check-types` + `lint` зелёные.
- [ ] Playwright-сравнение с `http://localhost:8765/` → `crm-deal` экран даёт визуальный паритет на 1440×900.

**Вопросы к пользователю до старта работ:**
1. Селект «Ответственный агент» из старого `DealManagementCard` — переносить в Parties-сайдбар или полностью удалить?
2. `DealDocumentsTab` — оставить как отдельный блок внутри ApprovalPane, или переместить в FundingPane, или убрать совсем (только требования к документам показывать в подсказке)?
3. Для CalculatingPane — вариант B (read-only + existing CalculationDialog для редактирования) устраивает, или нужен полноценный inline-редактор (вариант A)?

Задай их через `AskUserQuestion` до начала работы — иначе придётся переделывать.

---

## Приложение: карта компонентов прототипа → наш код

| Reference | Наш код (итерация 2) |
|-----------|----------------------|
| `<Card title=... sub=...>` | `<Card>` + `<CardHeader>` с `<CardTitle>` + `<CardDescription>` из `@bedrock/sdk-ui/components/card` |
| `<Btn variant="primary/secondary/ghost">` | `<Button variant="default/secondary/ghost">` |
| `<Badge tone="pos/warn/info/neg" dot>` | `<Badge variant="success/warning/outline/destructive" className="badge-dot">` |
| `<Icon name="x" size={n} />` | `<X className="h-{n/4} w-{n/4}" />` из `lucide-react` |
| `<Money value={n} ccy="USD" signed signColor />` | `formatCurrency(n, ccy)` + ручная обработка знака/цвета (см. `formatSignedCurrency` в `dealsColumns.tsx`) |
| `.page-head` | `flex items-end justify-between gap-4` |
| `.page-title` | `text-[22px] font-semibold leading-tight tracking-tight` |
| `.hstack / .vstack` | `flex items-center gap-{n}` / `flex flex-col gap-{n}` |
| `.field-row.two / .three` | `grid grid-cols-2 / grid-cols-3 gap-4` |
| `.callout / .callout.warn` | уже в globals.css |
| `.kv-grid.cols-3 / .cols-4 / .cols-auto` | уже в globals.css |
| `.approval-row / .approval-summary` | уже в globals.css |
| `.leg-row` | уже в globals.css (но требует данных — см. E2) |
| `.divider` | `<div className="h-px bg-border" />` или напрямую Tailwind |

Удачи. Прототип — источник истины, код — его воплощение.
