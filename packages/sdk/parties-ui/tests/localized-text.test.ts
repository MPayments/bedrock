import { describe, expect, it } from "vitest";

import {
  LOCALIZED_TEXT_VARIANTS,
  readLocalizedTextLocale,
  readLocalizedTextVariant,
  updateLocalizedTextLocale,
  updateLocalizedTextVariant,
} from "../src/lib/localized-text";

describe("localized text helpers", () => {
  it("reads base, ru, and en variants independently", () => {
    const localeMap = { ru: "Русский текст", en: "English text" };

    expect(
      readLocalizedTextVariant({
        baseValue: "Base text",
        localeMap,
        variant: "base",
      }),
    ).toBe("Base text");
    expect(
      readLocalizedTextVariant({
        baseValue: "Base text",
        localeMap,
        variant: "ru",
      }),
    ).toBe("Русский текст");
    expect(
      readLocalizedTextVariant({
        baseValue: "Base text",
        localeMap,
        variant: "en",
      }),
    ).toBe("English text");
  });

  it("updates a locale variant without mutating the base value", () => {
    const nextValue = updateLocalizedTextVariant({
      baseValue: "Base text",
      localeMap: { ru: "Старый текст" },
      nextValue: "Новый текст",
      variant: "ru",
    });

    expect(nextValue.baseValue).toBe("Base text");
    expect(nextValue.localeMap).toEqual({ ru: "Новый текст" });
  });

  it("updates the base variant without mutating localized values", () => {
    const nextValue = updateLocalizedTextVariant({
      baseValue: "Base text",
      localeMap: { ru: "Русский текст", en: "English text" },
      nextValue: "Updated base",
      variant: "base",
    });

    expect(nextValue.baseValue).toBe("Updated base");
    expect(nextValue.localeMap).toEqual({
      ru: "Русский текст",
      en: "English text",
    });
  });

  it("normalizes the locale map to null when all localized variants are cleared", () => {
    const clearedRu = updateLocalizedTextVariant({
      baseValue: "Base text",
      localeMap: { ru: "Русский текст" },
      nextValue: "",
      variant: "ru",
    });

    expect(clearedRu.localeMap).toBeNull();
  });

  it("preserves other locale entries when editing ru or en", () => {
    const nextValue = updateLocalizedTextVariant({
      baseValue: "Base text",
      localeMap: { de: "Deutsch", ru: "Русский текст" },
      nextValue: "English text",
      variant: "en",
    });

    expect(nextValue.localeMap).toEqual({
      de: "Deutsch",
      ru: "Русский текст",
      en: "English text",
    });
  });

  it("returns base value when reading 'all' variant (side-by-side mode)", () => {
    expect(
      readLocalizedTextVariant({
        baseValue: "Base",
        localeMap: { ru: "Русский", en: "English" },
        variant: "all",
      }),
    ).toBe("Base");
  });

  it("does not modify locale map when updating with 'all' variant", () => {
    const next = updateLocalizedTextVariant({
      baseValue: "Base",
      localeMap: { ru: "Русский", en: "English" },
      nextValue: "ignored",
      variant: "all",
    });

    expect(next.baseValue).toBe("Base");
    expect(next.localeMap).toEqual({ ru: "Русский", en: "English" });
  });

  it("reads a specific locale via readLocalizedTextLocale", () => {
    expect(
      readLocalizedTextLocale({
        localeMap: { ru: "Русский", en: "English" },
        locale: "ru",
      }),
    ).toBe("Русский");
    expect(
      readLocalizedTextLocale({
        localeMap: null,
        locale: "en",
      }),
    ).toBe("");
  });

  it("updateLocalizedTextLocale updates only the target locale", () => {
    const next = updateLocalizedTextLocale({
      baseValue: "Base",
      localeMap: { ru: "Старый", en: "Keep" },
      nextValue: "Новый",
      locale: "ru",
    });

    expect(next.baseValue).toBe("Base");
    expect(next.localeMap).toEqual({ ru: "Новый", en: "Keep" });
  });

  it("updateLocalizedTextLocale clears to null when empty and other locales empty", () => {
    const next = updateLocalizedTextLocale({
      baseValue: "Base",
      localeMap: { ru: "Был" },
      nextValue: "",
      locale: "ru",
    });

    expect(next.localeMap).toBeNull();
  });

  it("exposes only RU and EN as user-selectable UI variants", () => {
    expect(LOCALIZED_TEXT_VARIANTS.map((v) => v.value)).toEqual(["ru", "en"]);
  });
});
