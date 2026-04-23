export type LocaleTextMap = Record<string, string | null> | null;

export const LOCALIZED_TEXT_VARIANTS = [
  { value: "ru", label: "Русский" },
  { value: "en", label: "English" },
] as const;

export type LocalizedTextVariant = "base" | "ru" | "en" | "all";

export type LocalizedTextLocale = "ru" | "en";

const VARIANT_TO_LOCALE: Record<LocalizedTextLocale, string> = {
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
  if (params.variant === "base" || params.variant === "all") {
    return params.baseValue ?? "";
  }

  return params.localeMap?.[VARIANT_TO_LOCALE[params.variant]] ?? "";
}

export function readLocalizedTextLocale(params: {
  localeMap: LocaleTextMap;
  locale: LocalizedTextLocale;
}) {
  return params.localeMap?.[VARIANT_TO_LOCALE[params.locale]] ?? "";
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

  if (params.variant === "all") {
    return {
      baseValue: params.baseValue,
      localeMap: cloneLocaleTextMap(params.localeMap),
    };
  }

  return updateLocalizedTextLocale({
    baseValue: params.baseValue,
    localeMap: params.localeMap,
    nextValue: params.nextValue,
    locale: params.variant,
  });
}

export function updateLocalizedTextLocale(params: {
  baseValue: string;
  localeMap: LocaleTextMap;
  nextValue: string;
  locale: LocalizedTextLocale;
}) {
  const localeKey = VARIANT_TO_LOCALE[params.locale];
  const nextLocaleMap = normalizeLocaleTextMap({
    ...(params.localeMap ?? {}),
    [localeKey]: params.nextValue === "" ? null : params.nextValue,
  });

  return {
    baseValue: params.baseValue,
    localeMap: nextLocaleMap,
  };
}
