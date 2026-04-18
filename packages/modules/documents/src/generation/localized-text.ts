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

export function resolveLocalizedText(
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

export function withLocalizedTemplateFields(
  data: Record<string, unknown>,
  key: string,
  localized?: LocalizedTextValue | null,
  lang: SupportedLang = "ru",
): void {
  const ru = resolveLocalizedText(localized, "ru");
  const en = resolveLocalizedText(localized, "en");
  const selected = resolveLocalizedText(localized, lang);

  if (selected != null) data[key] = selected;
  if (ru != null) data[`${key}_ru`] = ru;
  if (en != null) data[`${key}_en`] = en;
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
