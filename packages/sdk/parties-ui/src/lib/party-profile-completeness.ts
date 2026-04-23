import type { PartyProfileBundleInput } from "./contracts";
import type { LocaleTextMap } from "./localized-text";

export type PartyProfileCompleteness = {
  filled: number;
  total: number;
  ratio: number;
};

export type PartyProfileCompletenessPair = {
  ru: string | null | undefined;
  en: string | null | undefined;
};

export type PartyProfileCompletenessOptions = {
  // When true, the top-level profile fullName/shortName I18n slots are skipped.
  // Useful when the hosting UI shows those fields in a separate (general) editor
  // and counts them as `extraPairs` instead to avoid double-counting.
  excludeProfileNames?: boolean;
  // Additional bilingual fields to count (typically general-editor fields that
  // don't live inside the party profile bundle itself).
  extraPairs?: PartyProfileCompletenessPair[];
};

const EMPTY: PartyProfileCompleteness = { filled: 0, total: 0, ratio: 0 };

export function computePartyProfileCompleteness(
  bundle: PartyProfileBundleInput | null | undefined,
  options: PartyProfileCompletenessOptions = {},
): PartyProfileCompleteness {
  const { excludeProfileNames = false, extraPairs = [] } = options;

  if (!bundle && extraPairs.length === 0) {
    return EMPTY;
  }

  let filled = 0;
  let total = 0;

  const accumulateLocaleMap = (localeMap: LocaleTextMap) => {
    total += 2;
    if (readLocale(localeMap, "ru")) {
      filled += 1;
    }
    if (readLocale(localeMap, "en")) {
      filled += 1;
    }
  };

  const accumulatePair = (pair: PartyProfileCompletenessPair) => {
    total += 2;
    if (typeof pair.ru === "string" && pair.ru.trim().length > 0) {
      filled += 1;
    }
    if (typeof pair.en === "string" && pair.en.trim().length > 0) {
      filled += 1;
    }
  };

  for (const pair of extraPairs) {
    accumulatePair(pair);
  }

  if (bundle) {
    if (!excludeProfileNames) {
      accumulateLocaleMap(bundle.profile.fullNameI18n);
      accumulateLocaleMap(bundle.profile.shortNameI18n);
    }
    accumulateLocaleMap(bundle.profile.legalFormLabelI18n);
    accumulateLocaleMap(bundle.profile.businessActivityTextI18n);

    if (bundle.address) {
      accumulateLocaleMap(bundle.address.cityI18n);
      accumulateLocaleMap(bundle.address.streetAddressI18n);
      accumulateLocaleMap(bundle.address.addressDetailsI18n);
      accumulateLocaleMap(bundle.address.fullAddressI18n);
    }

    for (const representative of bundle.representatives) {
      accumulateLocaleMap(representative.fullNameI18n);
      accumulateLocaleMap(representative.titleI18n);
      accumulateLocaleMap(representative.basisDocumentI18n);
    }

    for (const license of bundle.licenses) {
      accumulateLocaleMap(license.issuedByI18n);
      accumulateLocaleMap(license.activityTextI18n);
    }
  }

  return {
    filled,
    total,
    ratio: total === 0 ? 0 : filled / total,
  };
}

function readLocale(localeMap: LocaleTextMap, locale: "ru" | "en"): boolean {
  const value = localeMap?.[locale];
  return typeof value === "string" && value.trim().length > 0;
}
