import { describe, expect, it } from "vitest";

import { withLocalizedTemplateFields } from "../src/localized-text";

describe("withLocalizedTemplateFields", () => {
  it("populates _ru and _en suffixes strictly per locale, with no cross-language fallback", () => {
    const data: Record<string, unknown> = {};

    withLocalizedTemplateFields(data, "name", { ru: "Имя" }, "ru");

    expect(data.name).toBe("Имя");
    expect(data.name_ru).toBe("Имя");
    expect(data.name_en).toBeUndefined();
  });

  it("does not leak ru text into the _en suffix when rendering an EN template", () => {
    const data: Record<string, unknown> = {};

    withLocalizedTemplateFields(data, "name", { ru: "Имя" }, "en");

    // selected key falls back through ru when en is missing
    expect(data.name).toBe("Имя");
    // suffixed keys are strict per locale — _en stays empty
    expect(data.name_ru).toBe("Имя");
    expect(data.name_en).toBeUndefined();
  });

  it("populates both suffixes when both locales are set", () => {
    const data: Record<string, unknown> = {};

    withLocalizedTemplateFields(data, "name", { ru: "Имя", en: "Name" }, "ru");

    expect(data.name).toBe("Имя");
    expect(data.name_ru).toBe("Имя");
    expect(data.name_en).toBe("Name");
  });

  it("ignores blank strings on either locale", () => {
    const data: Record<string, unknown> = {};

    withLocalizedTemplateFields(data, "name", { ru: "  ", en: "Name" }, "ru");

    expect(data.name).toBe("Name");
    expect(data.name_ru).toBeUndefined();
    expect(data.name_en).toBe("Name");
  });

  it("writes nothing when the localized value is null or undefined", () => {
    const data: Record<string, unknown> = {};

    withLocalizedTemplateFields(data, "name", null, "ru");
    withLocalizedTemplateFields(data, "other", undefined, "ru");

    expect(data.name).toBeUndefined();
    expect(data.name_ru).toBeUndefined();
    expect(data.name_en).toBeUndefined();
    expect(data.other).toBeUndefined();
  });
});
