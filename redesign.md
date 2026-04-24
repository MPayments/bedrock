# Counterparty pages — перенос 2 плашек из дизайна

Документ-хэндовер для следующего агента. Восстановлен из промпта пользователя, плана предыдущего агента и текущих незакоммиченных изменений на ветке `feature/agreement-contract-number`.

## Исходный запрос

Сделать неполный редизайн страниц counterparties в CRM под дизайн-прототип `/mnt/disks/sata240/work/bedrock-finance-design/`.

Целевые страницы CRM:
- `apps/crm/app/(dashboard)/customers/[id]/counterparties/new/page.tsx`
- `apps/crm/app/(dashboard)/customers/[id]/counterparties/[counterpartyId]/page.tsx`

Дизайн-источник:
- `/mnt/disks/sata240/work/bedrock-finance-design/CLAUDE.md` — правила дизайн-пакета.
- `/mnt/disks/sata240/work/bedrock-finance-design/components/bedrock/screens/counterparty-new.tsx` — экран создания.
- `/mnt/disks/sata240/work/bedrock-finance-design/components/bedrock/screens/counterparty-edit.tsx` — экран редактирования.
- `/mnt/disks/sata240/work/bedrock-finance-design/components/bedrock/bilingual/{bilingual-toolbar,bilingual-field,locale-tabs}.tsx` — bilingual UI.

Из дизайна нужно перенести **только две верхние плашки**:

1. **Input method card** — выбор способа заполнения (Manual / Fill by INN / From business card). Только на странице `/new`.
2. **BilingualToolbar** — переключатель локализации (`RU / EN / All`) + прогресс перевода + кнопка "Translate all". На обеих страницах.

Явные исключения из запроса:
- Кнопки `ru/en` рядом с каждым полем переносить **НЕ нужно**.
- Но inline-подписи `RU`/`EN` над полями в режиме `All` — **нужно** перенести (в тексте промпта пользователь назвал их "тултипы").

---

## Архитектурные решения (из плана предыдущего агента)

1. **Legacy-совместимость типов локализации.** Вариант `"base"` убран из UI-массива `LOCALIZED_TEXT_VARIANTS` (SDK), но тип `LocalizedTextVariant` расширен до `"base" | "ru" | "en" | "all"`. Функции чтения/записи продолжают понимать `base` — используется в `admin/organizations/[id]` и legacy-данных.
2. **Новый `BilingualMode = "ru" | "en" | "all"`** — UI-концепция тулбара. Пробрасывается в `LocalizedTextInputField` как `variant`.
3. **Режим `all`** в `LocalizedTextInputField` — side-by-side 2 инпута с inline-лейблами `RU`/`EN` (grid 2-cols на md+, 1 col на xs).
4. **Prefill из INN/PDF** вынесен в SDK-helper `apps/crm/lib/counterparty-prefill.ts` и переиспользуется обеими страницами (+ `customers/new`).
5. **Patch-паттерн с nonce.** `externalPatch: {nonce, patch}` в `CounterpartyGeneralEditor`, `partyProfileOverride: {nonce, patch}` в CRM-обёртках. `nonce` меняется → `useEffect` перезаписывает форму/draft через `reset({...current, ...patch}, {keepDirty: true})` / `applyPartyProfilePatch`.
6. **Completeness (0..1)** считается в SDK-хелпере `computePartyProfileCompleteness(bundle)`. Обходит все `*I18n`-слоты, `total += 2`, `filled += (ru?1:0) + (en?1:0)`.
7. **Translate all** переводит **только пустые EN-ячейки** (`onlyEmpty: true` по умолчанию) — чтобы не затирать ручной ввод. Это отличается от `customers/new`, где перезаписывается безусловно.
8. **Banking из parse-card игнорируется** на странице counterparty — у неё нет banking-UI. В UI показывается подсказка "Найдены банковские реквизиты, добавьте вручную". TODO на будущее.
9. **INN/Card режимы** доступны только для `counterpartyKind === "legal_entity"`. При переключении kind → individual mode автоматически сбрасывается на `manual`.

---

## Текущее состояние (незакоммичено)

### Новые файлы (7)

| Файл | Статус |
|---|---|
| `packages/sdk/parties-ui/src/components/bilingual-toolbar.tsx` | реализован, экспортирует `BilingualToolbar`, `BilingualMode` |
| `packages/sdk/parties-ui/src/lib/party-profile-completeness.ts` | реализован |
| `packages/sdk/parties-ui/tests/party-profile-completeness.test.ts` | 4 теста: null / empty / half / nested |
| `apps/crm/lib/counterparty-prefill.ts` | реализован (`lookupCounterpartyByInn`, `parseCounterpartyCardPdf`) |
| `apps/crm/lib/translate-party-profile.ts` | реализован (`translatePartyProfileToEnglish`, опция `onlyEmpty`) |
| `apps/crm/app/(dashboard)/customers/[id]/components/counterparty-input-method-card.tsx` | реализован (Manual / INN / Card + `InnLookupPanel` / `CardParsePanel`) |
| `apps/crm/app/(dashboard)/customers/[id]/components/party-profile-patch.ts` | реализован (`applyPartyProfilePatch`, тип `PartyProfileOverride`) |

### Изменённые файлы (12)

| Файл | Что поменялось |
|---|---|
| `packages/sdk/parties-ui/src/lib/localized-text.ts` | тип `LocalizedTextVariant` += `"all"`, массив без `base`, добавлены `readLocalizedTextLocale` и `updateLocalizedTextLocale` |
| `packages/sdk/parties-ui/src/components/localized-text-input-field.tsx` | добавлена ветка `variant === "all"` (grid md:grid-cols-2 + `LocalizedCell` с inline-лейблом RU/EN) |
| `packages/sdk/parties-ui/src/components/counterparty-general-editor.tsx` | добавлен prop `externalPatch` (`{nonce, patch}`) + useEffect по `nonce` делает `reset` с `keepDirty: true`; экспортирован тип `CounterpartyGeneralEditorExternalPatch` |
| `packages/sdk/parties-ui/src/components/party-profile-editor.tsx` | дефолтный internal variant `"base"` → `"ru"` |
| `packages/sdk/parties-ui/src/components/requisite-provider-master-data-editor.tsx` | дефолт `"base"` → `"ru"` |
| `packages/sdk/parties-ui/tests/localized-text.test.ts` | +тесты для `all`, `readLocalizedTextLocale`, `updateLocalizedTextLocale` |
| `apps/crm/app/(dashboard)/customers/[id]/counterparties/new/page.tsx` | перестроена: H1 → `<CounterpartyInputMethodCard>` → `<BilingualToolbar>` → alerts → `<CustomerCounterpartyCreateEditor>`. Добавлены state `bilingualMode`, `inputMethod`, `externalPatch`, `partyProfileOverride`, `generalValues`, `partyProfileDraft`, `translating`, `translateError` |
| `apps/crm/app/(dashboard)/customers/[id]/counterparties/[counterpartyId]/page.tsx` | перестроена: H1 → `<BilingualToolbar>` → alerts → `<CustomerCounterpartyEditor>`. **Input method card здесь НЕТ** (так задумано) |
| `apps/crm/app/(dashboard)/customers/[id]/components/customer-counterparty-create-editor.tsx` | добавлены props `externalPatch`, `partyProfileOverride`, `localizedTextVariant`, `onGeneralValuesChange`, `onPartyProfileChange`. useEffect по `partyProfileOverride.nonce` мёржит через `applyPartyProfilePatch` |
| `apps/crm/app/(dashboard)/customers/[id]/components/customer-counterparty-editor.tsx` | зеркально: `partyProfileOverride`, `onPartyProfileChange`, `localizedTextVariant`. Поддерживает override для уже загруженного counterparty |
| `apps/crm/app/admin/organizations/[id]/page.tsx` | dropdown остался, но дефолт `"base"` → `"ru"` (см. Риски) |
| `apps/crm/app/(dashboard)/customers/new/page.tsx` | извлечены `handleInnSearch`/`handleFileUpload` в `counterparty-prefill.ts`. Сама страница дизайна в этой итерации НЕ меняется — только de-duplication |

### Переиспользуется без изменений

- `apps/crm/lib/translate-fields.ts` (`translateFieldsToEnglish`)
- `packages/sdk/parties-ui/src/lib/party-profile.ts` (`createSeededPartyProfileBundle`, `clonePartyProfileBundleInput`, `toPartyProfileBundleInput`)
- `packages/sdk/parties-ui/src/lib/contracts.ts` (все `Party*Input` типы)

---

## Верификация (что уже прошло)

- `bun run check-types` — успешно (74 tasks cached/successful в turbo по последнему прогону)
- `bun run build` — успешно (сборка завершена)

Что ещё рекомендуется прогнать перед коммитом:

1. `bun --filter @bedrock/sdk-parties-ui run test` — тесты `localized-text` и новый `party-profile-completeness`
2. `bun --filter @bedrock/crm run lint`
3. `bun --filter @bedrock/crm run build`
4. Ручной прогон в dev (`bun dev --filter=@bedrock/crm`):
   - `/customers/:id/counterparties/new`:
     - Переключение Manual/INN/Card работает
     - INN lookup (напр. `7707083893` — Сбер) заполняет поля general + profile
     - Загрузка PDF-карточки заполняет поля, banking игнорируется с подсказкой
     - Переключение kind → individual сбрасывает mode на manual, INN/Card кнопки disabled
     - `BilingualToolbar`: RU/EN/All меняет вид полей; прогресс-бар пересчитывается
     - "Заполнить EN по RU" заполняет только пустые EN, не трогает заполненные
     - Submit создаёт контрагента
   - `/customers/:id/counterparties/:counterpartyId`:
     - Только `BilingualToolbar` сверху, Input method card отсутствует
     - Translate работает, сохранение dirty-сегмента после translate работает
   - `/admin/organizations/:id`:
     - Dropdown показывает только RU/EN, дефолт RU, переключение работает

---

## Известные TODO и риски

1. **Banking из `parse-card` на counterparty не сохраняется.** Намеренно: у counterparty UI нет banking-блока. В `counterparty-input-method-card.tsx` показывается подсказка "Добавьте реквизиты вручную". Будущая задача — прокинуть banking в counterparty (или явно решить, что оно нужно только в `customers/new`).
2. **`admin/organizations/[id]` dropdown** потерял опцию "Основной" (`base`). Дефолт теперь `"ru"` — приемлемая деградация. Если пользователь хочет иное поведение — отдельная задача.
3. **Гонка `externalPatch` vs `reset(initialValues)` в `CounterpartyGeneralEditor`.** `reset(initial)` в эффекте на `initialValues` и `reset({...current, ...patch}, {keepDirty:true})` в эффекте на `externalPatchNonce` — потенциально конкурируют. Нужен ручной прогон: prefill → дописать поля → submit должен содержать всё.
4. **`LocalizedTextInputField` в режиме `all`** теперь всегда full-row (через `md:col-span-2`) — см. Итерацию 2. Риск на узких планшетах (md breakpoint → grid-cols-1 fallback) снят.
5. **Completeness useMemo** зависит от `partyProfileDraft` — пересчитывается на каждый keystroke. Для одной `<div>` плашки не проблема, не оптимизируем.
6. **Порядок вариантов в `BilingualToolbar`** — `All / RU / EN`. В дизайне может быть `RU / EN / All`. Уточнить, если это принципиально.
7. **Translate-all перезаписывает EN.** Защищено `onlyEmpty: true` по умолчанию. Confirm-диалог при непустых EN **не добавлен** (выходит за рамки итерации).
8. **Ошибка в `customer-counterparty-editor.tsx`:** на этой странице нет `PartyProfileEditor` с `externalPatch`-подобным механизмом для general-блока — kind edit-readonly. Но translate-all там пишет через `partyProfileOverride`, это норм.
9. **`counterparty.descriptionI18n` НЕ существует в схеме БД.** В UI верхней карточки мы показываем bilingual `description` (RU+EN), но на submit сохраняется только RU. EN хранится в форм-стейте и теряется. Добавлен TODO-коммент `TODO(description-i18n)` в `customer-counterparty-create-editor.tsx` и `customer-counterparty-editor.tsx`. Чтобы полноценно поддержать EN описания — нужна миграция `counterparty.description` → `description + descriptionI18n` на бэке (contracts + dto + commands + миграция).

---

## Итерация 2 — визуальные фиксы под дизайн (2026-04-23)

Доведение верстки до референса `/mnt/disks/sata240/work/bedrock-finance-design/`. **Это не новая фича**, а серия UI/UX правок поверх уже перенесённых двух плашек. Важная информация для следующих агентов собрана здесь — читайте ДО того, как трогать компоненты ниже.

### Что изменилось концептуально

1. **`CounterpartyGeneralFormValues` расширен** тремя EN-полями: `shortNameEn`, `fullNameEn`, `descriptionEn`. Это **breaking** для всех вызывающих сторон — все `INITIAL_VALUES`/`toFormValues` в `apps/crm`, `apps/finance` обновлены. Любой новый caller должен включать эти три поля (пустые строки в дефолте).
2. **Новый prop `bilingualMode: "ru" | "en" | "all"`** у `CounterpartyGeneralEditor`. Дефолт — `"ru"` (обратная совместимость: одно поле). При `"all"` верхняя карточка рендерит bilingual-пары RU/EN side-by-side, full-row. Страницы `/counterparties/new` и `/counterparties/[id]` прокидывают сюда свой `bilingualMode` из `BilingualToolbar` (уже было реализовано, теперь пробрасывается глубже).
3. **Тип экспортируется**: `CounterpartyGeneralBilingualMode` из `@bedrock/sdk-parties-ui/components/counterparty-general-editor`.
4. **Inline-helper `BilingualTextField`** внутри `counterparty-general-editor.tsx` — приватный (не экспортирован). Принимает `control`, `ruName`, `enName`, `idBase`, `label`, `placeholderRu/En`, `multiline`, `rows`, `required`, `disabled`, `bilingualMode`. Рендерит `<Field className="md:col-span-2">` + условно один/два инпута. Если нужно расширить — расширяйте прямо в файле.
5. **EN-значения пишутся через `partyProfile.*NameI18n.en`**, НЕ через новые колонки counterparty. Используется `updateLocalizedTextLocale` из `@bedrock/sdk-parties-ui/lib/localized-text`. `descriptionEn` пока ни в какой бэк-поле не идёт (см. TODO #9).

### Архитектурные решения итерации

| Проблема | Решение | Файлы |
|---|---|---|
| **Infinite render loop** в `CounterpartyGeneralEditor` (из-за нестабильных inline-колбэков `onValuesChange`/`onShortNameChange`/`onDirtyChange` в родителе) | Ref-паттерн: `useRef(callback)` + `ref.current = callback` в теле, эффекты зависят только от данных (не от колбэков). | `counterparty-general-editor.tsx` |
| **CountrySelect scroll-jump** (открытие popover тянет страницу наверх) | **Root cause**: `cmdk` в `Command.List` вызывает `scrollIntoView({block:'nearest'})` на первом элементе при маунте; попап рендерится в portal у root body, т.е. nearest scrollable → окно. **Fix**: save `window.scrollY` на открытие → в `requestAnimationFrame` восстановить + `input.focus({preventScroll: true})`. На close — `finalFocus` возвращает фокус на триггер с `preventScroll`. `initialFocus={false}` у base-ui `PopoverPopup`. | `packages/sdk/ui/src/components/country-select.tsx` |
| **Bilingual поля узкие в режиме `all` внутри `md:grid-cols-2`** | `LocalizedTextInputField` в `variant==="all"` автоматически добавляет `md:col-span-2` на внешний `<Field>`. | `packages/sdk/parties-ui/src/components/localized-text-input-field.tsx` |
| **Иконки input-method не черные при выборе** | Селекторы перестилизованы под `.cp-mode-card.active` из `bedrock-finance-design`: `border-foreground ring-1 ring-foreground` + `bg-foreground text-background` icon-box + `<Check>` абсолютно в правом верхнем углу. | `counterparty-input-method-card.tsx` |
| **INN/PDF панели не как в дизайне** | INN: `InputGroup` с prefix `Search`, заголовок + subtitle, "Найти в реестре". PDF: dashed-dropzone (click + DnD), состояния idle/uploading/success. | `counterparty-input-method-card.tsx` |

### Важные гайдлайны для будущих правок

- **Любой useEffect в SDK-компонентах, который вызывает родительский колбэк**, должен использовать ref-паттерн для колбэка. Родители часто передают inline-замыкания — зависимость на колбэк в deps эффекта приводит к infinite loop.
- **Base UI Popover ≠ Radix Popover.** API focus-менеджмента другое: `initialFocus`/`finalFocus` вместо `onOpenAutoFocus`/`onCloseAutoFocus`. `preventScroll=true` в base-ui приходит автоматически только когда `initialFocus` возвращает сам floating element; для кастомного элемента — фокусим вручную с `preventScroll: true`.
- **cmdk + Popover portal = потенциальный scroll-jump.** Тот же паттерн «save scrollY → restore в rAF» может потребоваться для любых других комбобоксов на базе `cmdk` + `@base-ui/react/popover`. Ищите другие использования `Command` + `Popover` в SDK (`packages/sdk/ui/src/components/`) и в приложениях при подозрениях.
- **Любое новое поле у counterparty → обновите `CounterpartyGeneralFormValues` + `DEFAULT_VALUES` + `CounterpartyGeneralFormSchema` + все `INITIAL_VALUES`/`toFormValues`** в:
  - `apps/crm/app/(dashboard)/customers/[id]/components/customer-counterparty-create-editor.tsx`
  - `apps/crm/app/(dashboard)/customers/[id]/components/customer-counterparty-editor.tsx`
  - `apps/finance/features/entities/counterparties/components/create-counterparty-form-client.tsx`
  - `apps/finance/features/entities/counterparties/components/organization-edit-form.tsx`
- **При переходе на bilingual-форму в других местах** — используйте тот же ref-паттерн и проверяйте, что RU-пустой кейс не триггерит zod-валидацию на EN (EN в `CounterpartyGeneralFormSchema` — `z.string()` без `min(1)`).

### Новые зависимости / файлы не появились

Итерация 2 — чисто правки существующих файлов (кроме одного `useCallback` → `useRef` рефакторинга):

- `packages/sdk/ui/src/components/country-select.tsx` — добавлен useEffect + `popupRef` + `triggerRef`, используется `initialFocus={false}` и `finalFocus={...}`.
- `packages/sdk/parties-ui/src/components/counterparty-general-editor.tsx` — новый `bilingualMode` prop, `BilingualTextField` helper, схема + дефолты расширены, ref-паттерн для колбэков, унифицированный outer grid.
- `packages/sdk/parties-ui/src/components/localized-text-input-field.tsx` — `cn("md:col-span-2", className)` на `Field` wrapper в `variant === "all"`.
- `apps/crm/app/(dashboard)/customers/[id]/components/customer-counterparty-create-editor.tsx` — новый `bilingualMode` prop; submit маппит `*En` в `partyProfile.*NameI18n.en` через `updateLocalizedTextLocale`; `descriptionEn` — `TODO(description-i18n)`.
- `apps/crm/app/(dashboard)/customers/[id]/components/customer-counterparty-editor.tsx` — зеркально; `toGeneralFormValues` читает EN из существующего `partyProfile.*NameI18n.en`.
- `apps/crm/app/(dashboard)/customers/[id]/counterparties/{new,[counterpartyId]}/page.tsx` — пробрасывают `bilingualMode={bilingualMode}` в обёртки.
- `apps/crm/app/(dashboard)/customers/[id]/components/counterparty-input-method-card.tsx` — restyle selected state + `<Check>`-маркер; `Input` → `InputGroup` для INN-инпута; dashed-dropzone для PDF с DnD.
- `apps/finance/features/entities/counterparties/components/{create-counterparty-form-client,organization-edit-form}.tsx` — расширены INITIAL_VALUES/toFormValues.

### Верификация итерации 2

- ✅ `bunx turbo run check-types` — 67/67.
- ✅ `bun run test` в `@bedrock/sdk-parties-ui` — 15/15.
- ✅ Playwright-регресс CountrySelect: `scrollY=300` держится через open → select → close на `/admin/organizations/new`.
- ✅ Визуально верифицировано на `/customers/:id/counterparties/new` в режиме `bilingualMode="all"`: черные иконки + чек-маркер, bilingual shortName/fullName/description full-row, INN и PDF панели новые.

---

## Итерация 3 — фиксы INN / PDF / Translate (2026-04-23)

Баг-фиксы поверх итерации 2. Пользователь нашёл два регресса при ручном тестировании:

1. **INN-lookup заполнял только `fullAddress`** — гранулярные поля (`city`, `postalCode`, `streetAddress`, `addressDetails`) оставались пустыми. Симптом проявлялся на всех ИНН (проверено на `6316152593` — Самара).
2. **Translate all не переводил shortName / fullName / description** — эти поля живут в top-level form (`CounterpartyGeneralFormValues`), а `translatePartyProfileToEnglish` обходил только вложенный `PartyProfileBundleInput`. На `[counterpartyId]/page.tsx` дополнительно не было `externalPatch` pipe-line вообще.
3. **PDF parse-card** — та же проблема с плоским адресом, пофиксили превентивно.

### Концептуальные изменения

1. **DaData-маппинг теперь извлекает гранулярный адрес.** `lookupCompanyByInn` (API) парсит `company.address.data.*_with_type` + `house_type/house` + `block/flat` → возвращает четыре отдельных поля. Конвенция:
   - `postalCode` ← `postal_code`
   - `city` ← `city_with_type` с fallback на `settlement_with_type`, затем голый `city`/`settlement`
   - `streetAddress` ← `street_with_type + ", " + (house_type + " " + house)` (e.g. `"ул Куйбышева, д 17"`)
   - `addressDetails` ← `block + flat` через запятую (e.g. `"офис 3"`)
   - `fullAddress` остался как был (`unrestricted_value`)
   - **`region_with_type` НЕ маппится в отдельное поле** — его нет в `PartyAddressInput`; он остаётся только в `fullAddress`. Если надумаете класть в `addressDetails` — сломаете UX «Доп. адресной информации».
2. **PDF extraction теперь тоже структурирован.** `ExtractedDocumentData` (в `packages/platform/src/ai`) получил те же 4 поля. Системный промпт расширен инструкцией «split address into components». LLM возвращает `null` для поля, которого нет в документе — UI тогда показывает только `fullAddress`. Другими словами: PDF не-регрессировал для документов, где гранулярности нет.
3. **Unified translate helper: `translateCounterpartyToEnglish({bundle, general}, {onlyEmpty})`.** Заменил `translatePartyProfileToEnglish` (удалён). Батчит и profile-слоты, и general-поля (`shortName`/`fullName`/`description`) в **один** вызов `translateFieldsToEnglish` → возвращает `{ general: Partial<CounterpartyGeneralFormValues>, profile: PartyProfileBundleInput | null }`. Default `onlyEmpty=true` унаследован.
4. **Страницы сетают два override-а под один nonce.** `handleTranslateAll` → `setPartyProfileOverride({nonce, patch: result.profile})` + `setExternalPatch({nonce, patch: result.general})`. Оба эффекта триггерятся синхронно — визуально перевод прилетает одновременно в top-card и в profile-editor.
5. **`CustomerCounterpartyEditor` теперь принимает `externalPatch`.** До итерации 3 проп был только у create-варианта. Без него translate-all на странице `[counterpartyId]` не мог донести EN-значения до top-card (общий RU уже на месте, а EN-поля приходят из `partyProfile.*NameI18n.en` только на первоначальной загрузке через `toGeneralFormValues`).

### Архитектурные решения итерации

| Проблема | Решение | Файлы |
|---|---|---|
| **INN: только `fullAddress`** в форме, гранулярные поля `null` | Расширить DaData transformer + `CompanyLookupResultSchema` + `CustomerPortalCompanyLookupResultSchema` (портал тоже!) + `CounterpartyInnLookupResult` + `INN_LOOKUP_FIELDS` + `buildAddress` принимает весь lookup-объект (не строку) и возвращает `PartyAddressInput | null` | `apps/api/src/routes/{counterparty-directory,customer}.ts`, `apps/crm/lib/counterparty-prefill.ts`, `apps/crm/app/(dashboard)/customers/[id]/components/counterparty-input-method-card.tsx` |
| **PDF: только `address: string`** в LLM output | Расширить `ExtractedDocumentData` + `extractedDocumentZodSchema` + `SYSTEM_EXTRACT` prompt инструкцией о разбивке. `address` (single-line) сохраняется для fallback | `packages/platform/src/ai/{contracts,openai.adapter}.ts` |
| **Translate all не видит `shortName`/`fullName`/`description`** — они в top form, не в bundle | Unified helper `translateCounterpartyToEnglish({bundle, general})` + обновить оба `handleTranslateAll` + добавить `externalPatch` в `CustomerCounterpartyEditor` | `apps/crm/lib/translate-party-profile.ts`, `apps/crm/app/(dashboard)/customers/[id]/{counterparties/*,components/customer-counterparty-editor.tsx}` |
| **`translatePartyProfileToEnglish` — мёртвый API** после миграции | Удалён (все колеры перешли на `translateCounterpartyToEnglish`). Если создаёте новое место для перевода — используйте unified helper, не воскрешайте старый | — |

### Важные гайдлайны для будущих правок

- **Если добавляете новую страницу с `BilingualToolbar` → `translate all`**: зовите `translateCounterpartyToEnglish({bundle, general}, opts)`, сетайте `{externalPatch, partyProfileOverride}` под одним `nonce = Date.now()`. Оба эффекта должны пройти атомарно — иначе top-card и profile-editor рассинхронизируются.
- **`translateCounterpartyToEnglish` принимает `bundle: null`** — полезно, если пользователь нажал «Translate all» до того, как `partyProfileDraft` успел пробросить наверх. Helper сам вернёт `{general, profile: null}` → страница не поставит `partyProfileOverride`.
- **`buildAddress(data)` возвращает `null` если всех 5 полей нет.** `applyPartyProfilePatch` этот `null` должен получить в `patch.address = null` → НЕ перезаписывает. Сейчас страница делает `if (addressPatch) patch.address = addressPatch` — не трогает, если пусто. Если захотите маппить адрес из какого-то нового источника — держите тот же контракт (`null` или полный объект с `countryCode`).
- **DaData-конвенция city vs settlement**: `city_with_type` → `city`, fallback `settlement_with_type`. Это правильно для городов («г Самара»), сёл («с Кроткое»). Если видите `null` city у мелких адресов — DaData не вернула ни то ни другое, это edge-case исходных данных.
- **LLM-промпт для PDF — append-only.** Если меняете `SYSTEM_EXTRACT`, проверяйте, что добавленная инструкция не конфликтует с существующей «return valid JSON only». Следующий изменяющий агент: **сперва прочтите весь промпт**, потом дописывайте.
- **`CustomerPortalCompanyLookupResultSchema` в `apps/api/src/routes/customer.ts`** живёт параллельно с `CompanyLookupResultSchema` — если добавляете ещё поля от DaData, держите обе схемы в sync. Иначе портальный клиент (см. `apps/portal/app/(portal)/onboard/onboard-form.tsx`) получит ответ с отсутствующими в схеме полями — на практике не ломается (Hono не режет лишнее), но типы расходятся.

### Новые файлы — нет

Итерация 3 — чисто правки существующих:

- `apps/api/src/routes/counterparty-directory.ts` — `DadataAddressData` + `extractAddressComponents` + `joinAddressParts`/`normalizeAddressPart` хелперы, `CompanyLookupResultSchema` расширена на 4 поля.
- `apps/api/src/routes/customer.ts` — `CustomerPortalCompanyLookupResultSchema` расширена зеркально.
- `packages/platform/src/ai/contracts.ts` — `ExtractedDocumentData` +4 поля.
- `packages/platform/src/ai/openai.adapter.ts` — `extractedDocumentZodSchema` +4 поля, `SYSTEM_EXTRACT` prompt +1 строка про address split.
- `apps/crm/lib/counterparty-prefill.ts` — `CounterpartyInnLookupResult` +4 поля, `INN_LOOKUP_FIELDS` расширен.
- `apps/crm/app/(dashboard)/customers/[id]/components/counterparty-input-method-card.tsx` — `buildAddress` теперь принимает `CounterpartyInnLookupResult`, возвращает `PartyAddressInput | null` с гранулярным маппингом.
- `apps/crm/lib/translate-party-profile.ts` — `translateCounterpartyToEnglish({bundle, general}, opts)` + `CounterpartyGeneralTranslatable`/`TranslateCounterpartyResult` типы; `translatePartyProfileToEnglish` **удалён**.
- `apps/crm/app/(dashboard)/customers/[id]/counterparties/new/page.tsx` — `handleTranslateAll` сетает оба override-а.
- `apps/crm/app/(dashboard)/customers/[id]/counterparties/[counterpartyId]/page.tsx` — добавлен state `externalPatch`, прокидывается в `<CustomerCounterpartyEditor>`; `handleTranslateAll` сетает оба override-а.
- `apps/crm/app/(dashboard)/customers/[id]/components/customer-counterparty-editor.tsx` — новый prop `externalPatch`, проброшен в `<CounterpartyGeneralEditor>`.

### Верификация итерации 3

- ✅ `bunx turbo run check-types` — 74/74.
- ✅ `bun --filter=@bedrock/sdk-parties-ui run test` — 26/26.
- ✅ `bun --filter=crm lint` — clean (max-warnings 0).
- ✅ `bun --filter=api run build` — OK (обновление `apps/api/dist/` для finance-side типов).
- ⚠️ **Ручной e2e не выполнен агентом** — пользователь должен прогнать:
  1. INN `6316152593` → проверить, что Индекс=`443099`, Город=`г Самара`, Улица и дом=`ул Куйбышева, д 17`, Доп=`офис 3`.
  2. BilingualMode="All" → Translate all → `shortNameEn` / `fullNameEn` заполнены, уже-заполненные EN-поля НЕ перезатёрты.
  3. Страница `[counterpartyId]` → Translate all видит top-card (`externalPatch` работает).
  4. PDF: опционально, проверить ручной парсинг — если LLM вернул гранулярные поля, они заполнятся; иначе — только fullAddress.

### TODO / риски

- **`translateFieldsToEnglish` — один батч-запрос на все ключи.** Если ключей стало много (рост representatives/licenses + 3 general-ключа + 4 address-ключа + 4 profile-ключа) — возможна деградация качества перевода. Пока не проблема, но иметь в виду при росте схемы.
- **`description` всё ещё НЕ персистится на бэке** (см. TODO #9 в первой итерации). В итерации 3 мы научились **переводить** `descriptionEn`, но на submit `descriptionEn` по-прежнему уходит в никуда. Миграция `counterparty.descriptionI18n` — открытая задача.
- **Portal onboard-form (`apps/portal/app/(portal)/onboard/onboard-form.tsx:811` `applyCompanyData`)** тоже получит новые гранулярные поля после A1. Текущая реализация применяет `companyData` как `Record<string, unknown>` — extra keys игнорируются. Если портал хочет воспользоваться гранулярным адресом — это отдельная задача для портальной команды.
- **DaData timeout** (`DADATA_TIMEOUT_MS`) не увеличили; запрос всё тот же, просто extractor делает больше работы на готовых данных — никакого latency-impact.

---

## Явно НЕ делаем в этой итерации

- Multi-stage прогресс BusinessCardMode (Uploading → Extracting → Identifying)
- AI-confidence score / pre-filled markers на полях
- Pretty-banner "Extracted from X · N fields detected" после parse — заменён простым "Данные обновлены"
- `<LocaleChip>` рядом с `FieldLabel` в режимах `ru`/`en`
- Per-field TranslateButton (`← EN`/`← RU`)
- Bilingual layouts `tabs` / `sbs` / `toggle` из дизайна — реализован только один: `all` = side-by-side, `ru`/`en` = одно поле
- Drag-drop зона с heavy-анимацией — минимальный `onChange`-файл-инпут
- Сохранение banking из `parse-card` на counterparty
- Изменение UI `customers/new` под новый дизайн (в этой итерации только рефакторинг на общие helper'ы)

---

## Связанные точки монорепо

- **SDK pkg:** `@bedrock/sdk-parties-ui` (`packages/sdk/parties-ui`)
- **API endpoints:** `/counterparties/lookup-by-inn`, `/counterparties/parse-card`, `/v1/ai/translate` — уже существуют
- **Contracts:** `@bedrock/parties/contracts` (`PartyProfileBundleInput`, `PartyAddressInput`, `PartyContactInput`, `PartyIdentifierInput`, `PartyRepresentativeInput`, `PartyLicenseInput`)

## Что делать следующему агенту

1. Прочитай этот файл + промпт пользователя.
2. Открой `/mnt/disks/sata240/work/bedrock-finance-design/components/bedrock/screens/counterparty-new.tsx` и `counterparty-edit.tsx` — это референс.
3. Прогони лок+тесты+билд (см. Верификация), исправь если что-то красное.
4. Сделай ручной прогон в dev-режиме по списку.
5. Если всё ок — подготовь коммит. **Не коммить сам** — пользователь обычно хочет просмотреть diff.
6. Если есть визуальные расхождения с дизайном или UX-проблемы — перечисли их списком и спроси, что фиксить.
7. Открытые вопросы к пользователю (если нужно уточнить): порядок вариантов в `BilingualToolbar`, нужен ли confirm при перезаписи EN, прокидывать ли banking в counterparty, мигрировать ли `counterparty.descriptionI18n` на бэке (чтобы EN описания персистилось).
8. **Перед правкой bilingual-форм или CountrySelect** — обязательно прочитай раздел «Итерация 2» выше: там зафиксированы грабли (cmdk scroll-jump, base-ui focus API, ref-паттерн для родительских колбэков, breaking-изменения `CounterpartyGeneralFormValues`).
9. **Перед правкой Translate-all, INN-lookup или PDF parse-card** — прочитай «Итерация 3»: unified `translateCounterpartyToEnglish` helper, атомарный `{nonce, externalPatch + partyProfileOverride}`-паттерн, DaData `*_with_type` маппинг, LLM-схема с гранулярным адресом. Не воскрешай удалённый `translatePartyProfileToEnglish`.
10. **БД нулевая?** — пользователь запускает `db:seed` сам (см. memory `feedback_db_ops`). Не запускай автоматически. Можно создать тестового клиента через `/customers/new` UI — только required поля.

---

## Итерация 4 — редизайн организаций по аналогии с counterparty (2026-04-24)

Следующий по масштабу шаг: **тот же набор паттернов (BilingualToolbar + InputMethodCard + bilingual names + translate-all + атомарный nonce) применён к страницам «наших» юрлиц (`Organizations`)**, параллельно в CRM и Finance. Дизайн-пакет `bedrock-finance-design` экранов org пока не содержит — воспроизводим counterparty как source of truth.

**Ветка этой итерации**: `redesign/organizations`.

### Scope

- **CRM + Finance обе апки**: `/admin/organizations/{new,[id]}` (CRM) и `/treasury/organizations/{create,[id]}` (Finance) получают полный набор плашек.
- **InputMethodCard только на `/new`-страницах** (Manual / INN / PDF). Edit-страницы — без неё.
- **Parallel helper files**: `organization-prefill.ts`, `organization-input-method-card.tsx` в обеих апках. `translateOrganizationToEnglish` добавлен рядом с `translateCounterpartyToEnglish` в CRM `translate-party-profile.ts`; в Finance — новый файл `translate-organization.ts`. Переименование counterparty-helper-ов в party/company generic — отдельная задача.
- **Finance edit: имена остаются read-only** (сохраняется прошлая семантика; новый `readOnlyNames` prop у `OrganizationGeneralEditor`). BilingualToolbar доступен как view-переключатель + translate-all пишет в `partyProfile.*NameI18n.en` через `partyProfileOverride`, имена в top-card не редактируются.

### Концептуальные изменения

1. **`OrganizationGeneralFormValues` расширена** до `{shortName, shortNameEn, fullName, fullNameEn, kind, country, externalRef, description}`. `externalRef` остаётся RU-only (технический внешний ID); `description` — тоже plain RU-only Textarea (см. следующий пункт).
2. **Зеркально counterparty-решению в `refactor(counterparties): drop descriptionEn`** (коммит `87e5dab9`) — **`descriptionEn` НЕ вводим** ни в схему, ни в UI, ни в translate-payload. `organization.description` не имеет `descriptionI18n`-колонки в БД, миграцию не делаем — значит и EN-input не показываем. Если в будущем миграция появится, расширять надо синхронно с counterparty (общий паттерн `{field, fieldI18n}`).
3. **`OrganizationGeneralEditor` получил два новых prop-а** (`packages/sdk/parties-ui/src/components/organization-general-editor.tsx`): `bilingualMode?: OrganizationGeneralBilingualMode = "ru" | "en" | "all"` (дефолт `"ru"`) и `externalPatch?: OrganizationGeneralEditorExternalPatch = {nonce, patch}`. Плюс `readOnlyNames?: boolean` для finance edit (делает `shortName/fullName` inputs `disabled` во всех bilingual-режимах).
4. **Inline-helper `BilingualTextField`** внутри `organization-general-editor.tsx` — полная копия counterparty-паттерна (приватный, не экспортирован). Используется для `shortName`/`shortNameEn` и `fullName`/`fullNameEn`. Для `description` используется plain Controller+Textarea с `md:col-span-2` (не-bilingual).
5. **Ref-паттерн для колбэков** обязательно применён (`onValuesChange`, `onShortNameChange`, `onDirtyChange`) — те же грабли, что в counterparty Iteration 2.
6. **EN-значения имён пишутся через `partyProfile.shortNameI18n.en` / `fullNameI18n.en`** через `updateLocalizedTextLocale` из `@bedrock/sdk-parties-ui/lib/localized-text`. Новых колонок на `organization` не добавляем.
7. **Атомарный nonce-паттерн** `{externalPatch, partyProfileOverride}` применён на всех 4 страницах одинаково — `setExternalPatch({nonce, patch: general})` + `setPartyProfileOverride({nonce, patch: profile})` под одним `Date.now()`. Поведение идентично counterparty Iteration 3.
8. **`translateOrganizationToEnglish`** (CRM: дополнение в `translate-party-profile.ts`; Finance: новый файл `translate-organization.ts`). Батчит profile-слоты (переиспользует те же `collectSlots` internals) + `shortName`/`fullName` из general формы. `description` **не** включён в translate-payload — та же причина, что у counterparty после `drop descriptionEn`.
9. **`applyPartyProfilePatch` перенесён** из `apps/crm/app/(dashboard)/customers/[id]/components/party-profile-patch.ts` в `apps/crm/lib/party-profile-patch.ts` — теперь импортируется и counterparty-формами, и org-страницами через `@/lib/party-profile-patch`. Counterparty-файлы обновили импорт. В Finance — дубль в `apps/finance/lib/party-profile-patch.ts` (финанс не видит crm/lib).
10. **INN/PDF endpoint-ы переиспользуем**: `lookupOrganizationByInn` и `parseOrganizationCardPdf` обращаются к тем же `/counterparties/lookup-by-inn` и `/counterparties/parse-card` — DaData + LLM отдают company-generic данные независимо от «кто спрашивает». Переименование эндпоинтов на `/companies/*` — отдельная задача, в эту итерацию не попадает.

### Архитектурные решения итерации

| Проблема | Решение | Файлы |
|---|---|---|
| `OrganizationGeneralEditor` не bilingual | Внедрили тот же паттерн, что у counterparty: `bilingualMode` + `externalPatch` + inline `BilingualTextField` helper + ref-паттерн колбэков | `packages/sdk/parties-ui/src/components/organization-general-editor.tsx` |
| Finance edit — имена read-only (legacy поведение) | Новый prop `readOnlyNames?: boolean`; дисейблит `shortName`/`fullName` inputs во всех bilingual-режимах. Translate-all всё равно пишет в bundle через `partyProfileOverride` — после PUT `/party-profile` EN-имена сохраняются | `organization-general-editor.tsx`, `apps/finance/features/entities/organizations/components/edit-organization-form-client.tsx` |
| `applyPartyProfilePatch` нужен и counterparty, и org-формам | Перенесли из `customers/[id]/components/` в `apps/crm/lib/party-profile-patch.ts` + дубль в `apps/finance/lib/party-profile-patch.ts`. Counterparty-импорты обновили, re-export `PartyProfileOverride` из create-editor сохранили ради совместимости существующих caller-ов | `apps/crm/lib/party-profile-patch.ts`, `customer-counterparty-{create-editor,editor}.tsx` |
| Translate для org-формы | `translateOrganizationToEnglish({bundle, general})` — зеркально counterparty, но без description-слота. CRM: дополнение в `translate-party-profile.ts`. Finance: новый файл `translate-organization.ts` (у Finance нет counterparty translate-helper) | `apps/crm/lib/translate-party-profile.ts`, `apps/finance/lib/translate-organization.ts` |
| Dropdown RU/EN на CRM `/admin/organizations/[id]` | Заменили на `BilingualToolbar` (с translate-all). Опция `base` удалена окончательно. Показывается только для `legal_entity` на вкладке `organization` | `apps/crm/app/admin/organizations/[id]/page.tsx` |

### Новые файлы (7)

| Файл | Назначение |
|---|---|
| `packages/sdk/parties-ui/src/components/organization-general-editor.tsx` | Расширен схемой EN-полей + bilingual props + `readOnlyNames` + `BilingualTextField` helper (это **не новый файл**, а большой рерайт — но считаем по смыслу «новый в bilingual-состоянии»). |
| `apps/crm/lib/party-profile-patch.ts` | Перенос из `customers/[id]/components/`. Теперь общий helper для counterparty + org. |
| `apps/crm/lib/organization-prefill.ts` | `lookupOrganizationByInn`, `parseOrganizationCardPdf`, типы `Organization{Inn,Card}*Result`. Вызывает те же counterparty-эндпоинты. |
| `apps/crm/app/admin/organizations/_components/organization-input-method-card.tsx` | Manual / INN / PDF card + `InnLookupPanel`, `CardParsePanel`. Зеркально counterparty-версии, но с org-prefill. |
| `apps/finance/lib/party-profile-patch.ts` | Дубль. Finance не видит crm/lib. |
| `apps/finance/lib/organization-prefill.ts` | Finance-вариант с `credentials: "include"` fetch на `/v1/counterparties/...`. |
| `apps/finance/lib/translate-organization.ts` | Полный helper (slot-коллекторы, general-слоты, `translateFieldsToEnglish` inline — т.к. у Finance нет общего `translate-fields.ts`). |
| `apps/finance/features/entities/organizations/components/organization-input-method-card.tsx` | Finance-вариант InputMethodCard, вызывает `organization-prefill.ts` из finance-lib. |

### Изменённые файлы (7)

| Файл | Что поменялось |
|---|---|
| `packages/sdk/parties-ui/src/components/organization-general-editor.tsx` | Схема +`shortNameEn`/`fullNameEn` (без `descriptionEn`), `DEFAULT_VALUES` расширен, +props `externalPatch`/`bilingualMode`/`readOnlyNames`, `BilingualTextField` helper, ref-паттерн колбэков, `description` — plain Controller+Textarea |
| `apps/crm/lib/translate-party-profile.ts` | +`translateOrganizationToEnglish({bundle, general}, opts)` рядом с `translateCounterpartyToEnglish`. Переиспользует `collectSlots`, `readRu/readEn/writeEn`, `GENERAL_SLOT_PREFIX`. General-slots: только `shortName` и `fullName` (без description) |
| `apps/crm/app/admin/organizations/new/page.tsx` | Полный рерайт: H1 → InputMethodCard → BilingualToolbar → alerts → OrganizationGeneralEditor + PartyProfileEditor + Files. Новый state: `bilingualMode`, `inputMethod`, `externalPatch`, `partyProfileOverride`, `generalValues`, `partyProfileDraft`, `translating`, `translateError`. Submit маппит `shortNameEn`/`fullNameEn` → `partyProfile.*NameI18n.en` |
| `apps/crm/app/admin/organizations/[id]/page.tsx` | Dropdown `LOCALIZED_TEXT_VARIANTS` заменён на `BilingualToolbar` (только для `legal_entity` на tab `organization`). +translate-all с атомарным nonce. State: `bilingualMode`, `externalPatch`, `partyProfileOverride`, `partyProfileDraft`, `generalValues`, `translating`, `translateError` |
| `apps/crm/app/admin/organizations/[id]/_components/organization-canonical-editor.tsx` | +props `bilingualMode`, `externalPatch`, `onGeneralValuesChange`, `onPartyProfileChange`, `partyProfileOverride`. useEffect по nonce применяет patch через `applyPartyProfilePatch`. `toGeneralFormValues` читает EN из `partyProfile.*NameI18n.en`. Submit маппит `*En` обратно в bundle через `updateLocalizedTextLocale` |
| `apps/finance/features/entities/organizations/components/create-organization-form-client.tsx` | Зеркально CRM new: +BilingualToolbar, +OrganizationInputMethodCard, +EN-поля, +externalPatch, +partyProfileOverride, +translate-all, submit маппит `*En` → `partyProfile.*NameI18n.en` |
| `apps/finance/features/entities/organizations/components/edit-organization-form-client.tsx` | +BilingualToolbar (без InputMethodCard), `readOnlyNames`-пропс на editor (имена остаются read-only), translate-all пишет в bundle через `partyProfileOverride`. Существующие PATCH `/{id}` (externalRef + description) и PUT `/{id}/party-profile` контракты не меняются |
| `apps/crm/app/(dashboard)/customers/[id]/components/customer-counterparty-{create-editor,editor}.tsx` | Импорт `applyPartyProfilePatch`/`PartyProfileOverride` с `./party-profile-patch` → `@/lib/party-profile-patch` (после переноса) |

### Важные гайдлайны для будущих правок

- **`descriptionEn` НЕ вводим** ни в org-схему, ни в translate-payload — согласовано с counterparty-решением после коммита `87e5dab9` (EN-поля без БД-поддержки = mental overhead без value). Если будущая миграция добавит `organization.descriptionI18n`, расширять надо синхронно с counterparty и прогонять оба приложения.
- **Finance edit имена read-only**: `readOnlyNames={true}` проброшено в `OrganizationGeneralEditor`. BilingualToolbar на edit-странице всё равно показывается (bilingual view + translate-all пишет в bundle). Если политика изменится — убрать `readOnlyNames` и добавить names в PATCH-payload.
- **Unified translate helper**: на CRM `translateOrganizationToEnglish` живёт в том же файле, что `translateCounterpartyToEnglish` — делят slot-internals. Если появится ещё один «party»-редактор (например, `SubAgentGeneralEditor`), следуй тому же паттерну: дополняй файл новой функцией, не дублируй slot-коллекторы.
- **INN/PDF endpoints**: `/counterparties/lookup-by-inn` и `/counterparties/parse-card` возвращают company-generic данные — не нужно создавать отдельные org-роуты. Переименование на `/companies/*` — отдельная задача для бэк-команды.
- **`readOnlyNames` prop** в `OrganizationGeneralEditor` — новый; если в будущем понадобится аналог для counterparty (сейчас там `kindReadonly` есть, но именно имена не запираются) — перенеси паттерн обратно в `CounterpartyGeneralEditor`.
- **CRM org list-view и вкладки `/requisites`, `/files`** не менялись — редизайн касается только tab `organization` и страницы `/new`. При будущих правках requisites/files: эти вкладки не получают BilingualToolbar, т.к. там нет bilingual-контента.

### Верификация итерации 4

- ✅ `bunx turbo run check-types --filter=crm --filter=@bedrock/sdk-parties-ui` — 66/66.
- ✅ `bun --filter=crm run lint` — clean.
- ✅ `bun --filter=finance run lint` — clean.
- ✅ `bun --filter=@bedrock/sdk-parties-ui run test` — 26/26.
- ✅ `bun run build --filter=crm` — OK (17 routes, все org-страницы бьются).
- ⚠️ **Finance `check-types` имеет pre-existing ошибки** в `features/treasury/{deals,queue}/*` про `@bedrock/deals/contracts` — НЕ вызваны этим редизайном (по-файлам проверено: org-файлы tsgo-чистые). Отдельная инфраструктурная задача.
- ⚠️ **Ручной e2e не выполнен агентом** — пользователь должен прогнать:
  1. CRM `/admin/organizations/new`: Manual/INN/Card, INN `6316152593` (Самара) → поля general + profile заполнены, PDF → поля заполнены, banking-алерт виден; `BilingualMode="All"` → translate-all заполняет EN-имена + bundle.
  2. CRM `/admin/organizations/[id]`: BilingualToolbar вместо dropdown, translate-all работает, сохранение bundle с EN в `*NameI18n.en` после submit.
  3. Finance `/treasury/organizations/create`: то же, что CRM new, через finance-apiClient.
  4. Finance `/treasury/organizations/[id]`: BilingualToolbar показывается, имена остаются read-only, translate-all обновляет bundle (сохраняется через PartyProfileEditor submit).

### TODO / открытые вопросы

- **`apps/finance/lib/translate-organization.ts` дублирует slot-коллекторы** (у Finance нет общего `translate-fields.ts` / `translate-party-profile.ts`). Если в Finance когда-нибудь появится counterparty bilingual — надо вынести slot-коллекторы в `@bedrock/sdk-parties-ui/lib/translate-slots` и реиспользовать из обоих helper-файлов.
- **`organization-prefill.ts` и `counterparty-prefill.ts`** почти идентичны по схеме. Когда backend-эндпоинты переименуют на `/companies/lookup-by-inn` и `/companies/parse-card`, стоит слить в один `company-prefill.ts` (shared lib или SDK).
- **Finance `edit-organization-form-client.tsx` — имена read-only**: bilingual view работает, но пользователь может удивиться, что поля disabled. Если политика изменится (названия всё-таки редактируемы в Finance), убрать `readOnlyNames` prop и расширить PATCH-payload на `shortName`/`fullName`.
- **`OrganizationGeneralEditor.bilingualMode="en"`** — редкий режим (показывает только EN inputs). Для новой организации без RU-имени это позволит ввести только EN — что потом зафейлится на zod-валидации `shortName.min(1)`. Считаем это OK: create-страницы всегда стартуют с `bilingualMode="all"`.
- **Bugs/regression risks**: те же грабли, что у counterparty Iteration 2 (infinite render loop, cmdk scroll-jump) — уже пофикшены общими механизмами (ref-паттерн применён, CountrySelect переиспользуется).

### Что следующему агенту делать

1. Читай `Итерацию 4` + исходный промпт (редизайн организаций по аналогии с counterparty).
2. Если пользователь сообщит о визуальных расхождениях — фиксить точечно. **Не трогай counterparty-паттерны** (они стабильны); меняй только org-файлы.
3. Перед правкой `OrganizationGeneralEditor` — прочитай его целиком: там три разных «режима» (RU / EN / All) и три места, где `namesDisabled` влияет на disabled-пропс. Перед добавлением bilingual-полей — повторяй паттерн `BilingualTextField` (multi-line для descriptions, single-line для names).
4. Перед правкой `translate-organization`/`translate-party-profile` — пойми, что они шарят slot-коллекторы. Не ломай общий code-path.
5. Перед добавлением `descriptionEn` в любой форме (counterparty ИЛИ organization) — **не надо**. Был выпилен намеренно (см. коммит `87e5dab9` + п.2 «Концептуальные изменения» выше). Если появится задача на `descriptionI18n` миграцию — это сразу бэк-ветка (contracts + dto + commands + миграция + фронт).
6. Перед правкой `/admin/organizations/[id]/page.tsx` — проверь, что `organizationDirty` и `partyProfileDraft` приходят правильно. Здесь `OrganizationCanonicalEditor` внутри сам грузит данные — страница только прокидывает props.
