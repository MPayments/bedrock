export type LocaleTextMap = Record<string, string | null> | null;

export const LOCALIZED_TEXT_VARIANTS = [
  { value: "base", label: "Основной" },
  { value: "ru", label: "Русский" },
  { value: "en", label: "English" },
] as const;

export type LocalizedTextVariant =
  (typeof LOCALIZED_TEXT_VARIANTS)[number]["value"];

const VARIANT_TO_LOCALE: Record<Exclude<LocalizedTextVariant, "base">, string> =
  {
    ru: "ru",
    en: "en",
  };

function cloneLocaleTextMap(value: LocaleTextMap): LocaleTextMap {
  if (!value) {
    return null;
  }

  return Object.fromEntries(
    Object.entries(value).map(([locale, text]) => [locale, text ?? null]),
  );
}

function normalizeLocaleTextMap(value: LocaleTextMap): LocaleTextMap {
  if (!value) {
    return null;
  }

  const normalizedEntries = Object.entries(value).map(([locale, text]) => [
    locale,
    text === "" ? null : text ?? null,
  ]);

  const hasText = normalizedEntries.some(([, text]) => text !== null);
  return hasText ? Object.fromEntries(normalizedEntries) : null;
}

export function readLocalizedTextVariant(params: {
  baseValue: string | null | undefined;
  localeMap: LocaleTextMap;
  variant: LocalizedTextVariant;
}) {
  if (params.variant === "base") {
    return params.baseValue ?? "";
  }

  return params.localeMap?.[VARIANT_TO_LOCALE[params.variant]] ?? "";
}

export function updateLocalizedTextVariant(params: {
  baseValue: string;
  localeMap: LocaleTextMap;
  nextValue: string;
  variant: LocalizedTextVariant;
}) {
  if (params.variant === "base") {
    return {
      baseValue: params.nextValue,
      localeMap: cloneLocaleTextMap(params.localeMap),
    };
  }

  const localeKey = VARIANT_TO_LOCALE[params.variant];
  const nextLocaleMap = normalizeLocaleTextMap({
    ...(params.localeMap ?? {}),
    [localeKey]: params.nextValue === "" ? null : params.nextValue,
  });

  return {
    baseValue: params.baseValue,
    localeMap: nextLocaleMap,
  };
}
