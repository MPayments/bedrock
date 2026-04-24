import type { CounterpartyGeneralFormValues } from "@bedrock/sdk-parties-ui/components/counterparty-general-editor";
import type { OrganizationGeneralFormValues } from "@bedrock/sdk-parties-ui/components/organization-general-editor";
import type {
  PartyAddressInput,
  PartyLicenseInput,
  PartyProfileBundleInput,
  PartyRepresentativeInput,
} from "@bedrock/sdk-parties-ui/lib/contracts";
import type { LocaleTextMap } from "@bedrock/sdk-parties-ui/lib/localized-text";
import { clonePartyProfileBundleInput } from "@bedrock/sdk-parties-ui/lib/party-profile";

import { translateFieldsToEnglish } from "./translate-fields";

export type TranslatePartyProfileOptions = {
  onlyEmpty?: boolean;
};

type SlotReader = (bundle: PartyProfileBundleInput) => LocaleTextMap;
type SlotWriter = (
  bundle: PartyProfileBundleInput,
  nextLocaleMap: LocaleTextMap,
) => void;

type Slot = {
  key: string;
  read: SlotReader;
  write: SlotWriter;
};

function readRu(localeMap: LocaleTextMap): string {
  const value = localeMap?.ru;
  return typeof value === "string" ? value.trim() : "";
}

function readEn(localeMap: LocaleTextMap): string {
  const value = localeMap?.en;
  return typeof value === "string" ? value.trim() : "";
}

function writeEn(localeMap: LocaleTextMap, nextEn: string): LocaleTextMap {
  const next: Record<string, string | null> = {
    ...(localeMap ?? {}),
    en: nextEn,
  };

  const hasAny = Object.values(next).some(
    (value) => typeof value === "string" && value.trim().length > 0,
  );

  return hasAny ? next : null;
}

function profileSlot(
  key: string,
  field: keyof Pick<
    PartyProfileBundleInput["profile"],
    | "fullNameI18n"
    | "shortNameI18n"
    | "legalFormLabelI18n"
    | "businessActivityTextI18n"
  >,
): Slot {
  return {
    key,
    read: (bundle) => bundle.profile[field],
    write: (bundle, nextLocaleMap) => {
      bundle.profile[field] = nextLocaleMap;
    },
  };
}

function addressSlot(
  key: string,
  field: keyof Pick<
    PartyAddressInput,
    "cityI18n" | "streetAddressI18n" | "addressDetailsI18n" | "fullAddressI18n"
  >,
): Slot {
  return {
    key,
    read: (bundle) => bundle.address?.[field] ?? null,
    write: (bundle, nextLocaleMap) => {
      if (bundle.address) {
        bundle.address[field] = nextLocaleMap;
      }
    },
  };
}

function representativeSlot(
  key: string,
  index: number,
  field: keyof Pick<
    PartyRepresentativeInput,
    "fullNameI18n" | "titleI18n" | "basisDocumentI18n"
  >,
): Slot {
  return {
    key,
    read: (bundle) => bundle.representatives[index]?.[field] ?? null,
    write: (bundle, nextLocaleMap) => {
      const representative = bundle.representatives[index];
      if (representative) {
        representative[field] = nextLocaleMap;
      }
    },
  };
}

function licenseSlot(
  key: string,
  index: number,
  field: keyof Pick<PartyLicenseInput, "issuedByI18n" | "activityTextI18n">,
): Slot {
  return {
    key,
    read: (bundle) => bundle.licenses[index]?.[field] ?? null,
    write: (bundle, nextLocaleMap) => {
      const license = bundle.licenses[index];
      if (license) {
        license[field] = nextLocaleMap;
      }
    },
  };
}

function collectSlots(bundle: PartyProfileBundleInput): Slot[] {
  const slots: Slot[] = [
    profileSlot("profile.fullName", "fullNameI18n"),
    profileSlot("profile.shortName", "shortNameI18n"),
    profileSlot("profile.legalFormLabel", "legalFormLabelI18n"),
    profileSlot("profile.businessActivityText", "businessActivityTextI18n"),
  ];

  if (bundle.address) {
    slots.push(
      addressSlot("address.city", "cityI18n"),
      addressSlot("address.streetAddress", "streetAddressI18n"),
      addressSlot("address.addressDetails", "addressDetailsI18n"),
      addressSlot("address.fullAddress", "fullAddressI18n"),
    );
  }

  bundle.representatives.forEach((_, index) => {
    slots.push(
      representativeSlot(`rep.${index}.fullName`, index, "fullNameI18n"),
      representativeSlot(`rep.${index}.title`, index, "titleI18n"),
      representativeSlot(
        `rep.${index}.basisDocument`,
        index,
        "basisDocumentI18n",
      ),
    );
  });

  bundle.licenses.forEach((_, index) => {
    slots.push(
      licenseSlot(`lic.${index}.issuedBy`, index, "issuedByI18n"),
      licenseSlot(`lic.${index}.activityText`, index, "activityTextI18n"),
    );
  });

  return slots;
}

export type CounterpartyGeneralTranslatable = {
  shortName: string;
  shortNameEn: string;
  fullName: string;
  fullNameEn: string;
};

export type TranslateCounterpartyResult = {
  general: Partial<CounterpartyGeneralFormValues>;
  profile: PartyProfileBundleInput | null;
};

const GENERAL_SLOT_PREFIX = "general.";

type GeneralSlot = {
  key: string;
  target: keyof CounterpartyGeneralFormValues & ("shortNameEn" | "fullNameEn");
  ru: string;
  en: string;
};

function collectGeneralSlots(
  general: CounterpartyGeneralTranslatable,
): GeneralSlot[] {
  return [
    {
      key: `${GENERAL_SLOT_PREFIX}shortName`,
      target: "shortNameEn",
      ru: general.shortName.trim(),
      en: general.shortNameEn.trim(),
    },
    {
      key: `${GENERAL_SLOT_PREFIX}fullName`,
      target: "fullNameEn",
      ru: general.fullName.trim(),
      en: general.fullNameEn.trim(),
    },
  ];
}

export async function translateCounterpartyToEnglish(
  input: {
    bundle: PartyProfileBundleInput | null;
    general: CounterpartyGeneralTranslatable | null;
  },
  options: TranslatePartyProfileOptions = {},
): Promise<TranslateCounterpartyResult> {
  const onlyEmpty = options.onlyEmpty ?? true;
  const next = input.bundle ? clonePartyProfileBundleInput(input.bundle) : null;
  const slots = next ? collectSlots(next) : [];

  const request: Record<string, string> = {};
  const candidateSlots: Slot[] = [];

  if (next) {
    for (const slot of slots) {
      const localeMap = slot.read(next);
      const ru = readRu(localeMap);
      if (!ru) {
        continue;
      }

      if (onlyEmpty && readEn(localeMap)) {
        continue;
      }

      request[slot.key] = ru;
      candidateSlots.push(slot);
    }
  }

  const generalSlots = input.general ? collectGeneralSlots(input.general) : [];
  const candidateGeneralSlots: GeneralSlot[] = [];

  for (const slot of generalSlots) {
    if (!slot.ru) {
      continue;
    }

    if (onlyEmpty && slot.en) {
      continue;
    }

    request[slot.key] = slot.ru;
    candidateGeneralSlots.push(slot);
  }

  if (candidateSlots.length === 0 && candidateGeneralSlots.length === 0) {
    return { general: {}, profile: next };
  }

  const translated = await translateFieldsToEnglish(request);

  if (next) {
    for (const slot of candidateSlots) {
      const translation = translated[slot.key];
      if (typeof translation !== "string" || translation.trim().length === 0) {
        continue;
      }

      const currentMap = slot.read(next);
      slot.write(next, writeEn(currentMap, translation));
    }
  }

  const generalPatch: Partial<CounterpartyGeneralFormValues> = {};
  for (const slot of candidateGeneralSlots) {
    const translation = translated[slot.key];
    if (typeof translation !== "string" || translation.trim().length === 0) {
      continue;
    }
    generalPatch[slot.target] = translation;
  }

  return { general: generalPatch, profile: next };
}

export type OrganizationGeneralTranslatable = {
  shortName: string;
  shortNameEn: string;
  fullName: string;
  fullNameEn: string;
};

export type TranslateOrganizationResult = {
  general: Partial<OrganizationGeneralFormValues>;
  profile: PartyProfileBundleInput | null;
};

type OrganizationGeneralSlot = {
  key: string;
  target: keyof OrganizationGeneralFormValues & ("shortNameEn" | "fullNameEn");
  ru: string;
  en: string;
};

function collectOrganizationGeneralSlots(
  general: OrganizationGeneralTranslatable,
): OrganizationGeneralSlot[] {
  return [
    {
      key: `${GENERAL_SLOT_PREFIX}shortName`,
      target: "shortNameEn",
      ru: general.shortName.trim(),
      en: general.shortNameEn.trim(),
    },
    {
      key: `${GENERAL_SLOT_PREFIX}fullName`,
      target: "fullNameEn",
      ru: general.fullName.trim(),
      en: general.fullNameEn.trim(),
    },
  ];
}

export async function translateOrganizationToEnglish(
  input: {
    bundle: PartyProfileBundleInput | null;
    general: OrganizationGeneralTranslatable | null;
  },
  options: TranslatePartyProfileOptions = {},
): Promise<TranslateOrganizationResult> {
  const onlyEmpty = options.onlyEmpty ?? true;
  const next = input.bundle ? clonePartyProfileBundleInput(input.bundle) : null;
  const slots = next ? collectSlots(next) : [];

  const request: Record<string, string> = {};
  const candidateSlots: Slot[] = [];

  if (next) {
    for (const slot of slots) {
      const localeMap = slot.read(next);
      const ru = readRu(localeMap);
      if (!ru) {
        continue;
      }

      if (onlyEmpty && readEn(localeMap)) {
        continue;
      }

      request[slot.key] = ru;
      candidateSlots.push(slot);
    }
  }

  const generalSlots = input.general
    ? collectOrganizationGeneralSlots(input.general)
    : [];
  const candidateGeneralSlots: OrganizationGeneralSlot[] = [];

  for (const slot of generalSlots) {
    if (!slot.ru) {
      continue;
    }

    if (onlyEmpty && slot.en) {
      continue;
    }

    request[slot.key] = slot.ru;
    candidateGeneralSlots.push(slot);
  }

  if (candidateSlots.length === 0 && candidateGeneralSlots.length === 0) {
    return { general: {}, profile: next };
  }

  const translated = await translateFieldsToEnglish(request);

  if (next) {
    for (const slot of candidateSlots) {
      const translation = translated[slot.key];
      if (typeof translation !== "string" || translation.trim().length === 0) {
        continue;
      }

      const currentMap = slot.read(next);
      slot.write(next, writeEn(currentMap, translation));
    }
  }

  const generalPatch: Partial<OrganizationGeneralFormValues> = {};
  for (const slot of candidateGeneralSlots) {
    const translation = translated[slot.key];
    if (typeof translation !== "string" || translation.trim().length === 0) {
      continue;
    }
    generalPatch[slot.target] = translation;
  }

  return { general: generalPatch, profile: next };
}
