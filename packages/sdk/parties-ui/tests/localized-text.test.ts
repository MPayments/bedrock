import { describe, expect, it } from "vitest";

import {
  readLocalizedTextVariant,
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
});
