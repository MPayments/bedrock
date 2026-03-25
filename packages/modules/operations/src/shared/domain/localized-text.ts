export interface LocalizedText {
  ru?: string | null;
  en?: string | null;
}

export function mergeLocalizedText(
  existing: LocalizedText | null | undefined,
  update: Partial<LocalizedText> | null | undefined,
): LocalizedText | null {
  if (!update && !existing) return null;
  return {
    ru: update?.ru ?? existing?.ru ?? null,
    en: update?.en ?? existing?.en ?? null,
  };
}

export function normalizeLocalizedField(
  value: string | null | undefined,
  i18n: LocalizedText | null | undefined,
): LocalizedText | null {
  if (!value && !i18n) return null;

  const result: LocalizedText = { ...i18n };

  // If base value is set and ru is not, use base as ru
  if (value && !result.ru) {
    result.ru = value;
  }

  return result;
}
