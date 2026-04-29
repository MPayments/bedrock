export type SupportedLang = "ru" | "en";

export interface LocalizedTextValue {
  ru?: string | null;
  en?: string | null;
}

function normalizeValue(value?: string | null): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function resolveLocalizedText(
  localized?: LocalizedTextValue | null,
  lang: SupportedLang = "ru",
): string | undefined {
  if (!localized) return undefined;

  const byLang = normalizeValue(localized[lang]);
  if (byLang) return byLang;

  const ru = normalizeValue(localized.ru);
  if (ru) return ru;

  return normalizeValue(localized.en);
}

function strictLocalizedText(
  localized: LocalizedTextValue | null | undefined,
  lang: SupportedLang,
): string | undefined {
  if (!localized) return undefined;
  return normalizeValue(localized[lang]);
}

export function withLocalizedTemplateFields(
  data: Record<string, unknown>,
  key: string,
  localized?: LocalizedTextValue | null,
  lang: SupportedLang = "ru",
): void {
  const ruStrict = strictLocalizedText(localized, "ru");
  const enStrict = strictLocalizedText(localized, "en");
  const selected = resolveLocalizedText(localized, lang);

  if (selected != null) data[key] = selected;
  if (ruStrict != null) data[`${key}_ru`] = ruStrict;
  if (enStrict != null) data[`${key}_en`] = enStrict;
}

export function applyLocalizedTemplateField(
  data: Record<string, unknown>,
  key: string,
  entity: object,
  baseField: string,
  lang: SupportedLang,
): void {
  const localized = (entity as Record<string, unknown>)[`${baseField}I18n`] as
    | LocalizedTextValue
    | undefined;
  withLocalizedTemplateFields(data, key, localized, lang);
}

export function getLocalizedValue(
  entity: object,
  baseField: string,
  lang: SupportedLang,
): string | undefined {
  const localized = (entity as Record<string, unknown>)[`${baseField}I18n`] as
    | LocalizedTextValue
    | undefined;
  return resolveLocalizedText(localized, lang);
}
