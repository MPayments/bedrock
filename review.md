# React / Next.js Best Practices — исправления

## 1. Добавлено `twoFactorEnabled` в admin-типы

**Файлы:** `apps/web/app/(shell)/users/lib/queries.ts`, `apps/web/app/(shell)/users/components/columns.tsx`

API возвращает поле `twoFactorEnabled`, но клиентские типы `UserDetails` и `SerializedUser` его не описывали. Добавлено `twoFactorEnabled: boolean | null` в оба типа, чтобы они соответствовали реальному ответу сервера. Колонка в таблицу не добавлялась — достаточно типовой корректности.

## 2. Удалён мёртвый `onNameChange` + `watch`

**Файл:** `apps/web/app/(shell)/users/components/user-general-form.tsx`

Компонент `UserGeneralForm` содержал проп `onNameChange`, подписку `watch("name")` и `useEffect`, пробрасывающий значение наружу. При этом ни один вызов `<UserGeneralForm>` в проекте не передавал `onNameChange` — проп нигде не использовался.

`watch("name")` вызывает ре-рендер компонента при каждом нажатии клавиши в поле «Имя», что было полностью бесполезной нагрузкой. Удалены:

- Проп `onNameChange` из типа и деструктуризации
- `watch` из деструктуризации `useForm`
- Переменная `watchedName`
- `useEffect`, который вызывал `onNameChange`

Аналогичный паттерн в `currency-general-form.tsx` и `provider-general-form.tsx` не тронут — там `onNameChange` реально передаётся из родительских компонентов.

## 3. Динамический импорт `qrcode.react`

**Файл:** `apps/web/app/(shell)/profile/components/profile-two-factor-section.tsx`

Заменён статический импорт:

```typescript
import { QRCodeSVG } from "qrcode.react";
```

на динамический:

```typescript
const QRCodeSVG = dynamic(
    () => import("qrcode.react").then((m) => m.QRCodeSVG),
    { ssr: false },
);
```

QR-код отображается только в редком flow настройки 2FA (после нажатия «Включить»). При обычном посещении `/profile` библиотека `qrcode.react` (~4 KB gzip) теперь не загружается. `ssr: false` — QR-код рендерится только на клиенте, серверный рендеринг для него не нужен.

## 4. Разбивка `ProfileTwoFactorSection` на подкомпоненты

**Файл:** `apps/web/app/(shell)/profile/components/profile-two-factor-section.tsx`

Компонент (600 строк) содержал три полностью независимых ветки рендеринга в одном теле функции. Выделены три подкомпонента в том же файле:

| Компонент | Назначение |
|---|---|
| `TwoFactorDisabled` | Описание 2FA + кнопка «Включить» + диалог ввода пароля |
| `TwoFactorSetup` | QR-код + резервные коды + поле верификации TOTP |
| `TwoFactorEnabled` | Badge «2FA активна» + диалоги отключения и перегенерации кодов |

Родительский `ProfileTwoFactorSection` остался единственным владельцем состояния и делает switch по трём ветвям (`setupData` → Setup, `isEnabled` → Enabled, иначе → Disabled). Логика и обработчики не изменены — рефакторинг чисто структурный.
