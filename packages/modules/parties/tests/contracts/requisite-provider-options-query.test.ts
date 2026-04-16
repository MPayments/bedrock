import { describe, expect, it } from "vitest";

import { ListRequisiteProviderOptionsQuerySchema } from "../../src/contracts";

const UUID_1 = "11111111-1111-4111-8111-111111111111";
const UUID_2 = "22222222-2222-4222-8222-222222222222";
const UUID_3 = "33333333-3333-4333-8333-333333333333";

describe("ListRequisiteProviderOptionsQuerySchema (idsPreprocess)", () => {
  it("treats omitted ids as undefined", () => {
    const parsed = ListRequisiteProviderOptionsQuerySchema.parse({});
    expect(parsed.ids).toBeUndefined();
  });

  it("treats empty-string ids as undefined", () => {
    const parsed = ListRequisiteProviderOptionsQuerySchema.parse({ ids: "" });
    expect(parsed.ids).toBeUndefined();
  });

  it("splits a comma-separated string into individual UUIDs", () => {
    const parsed = ListRequisiteProviderOptionsQuerySchema.parse({
      ids: `${UUID_1},${UUID_2},${UUID_3}`,
    });
    expect(parsed.ids).toEqual([UUID_1, UUID_2, UUID_3]);
  });

  it("trims whitespace and drops empty segments", () => {
    const parsed = ListRequisiteProviderOptionsQuerySchema.parse({
      ids: `  ${UUID_1} , ,${UUID_2}  ,`,
    });
    expect(parsed.ids).toEqual([UUID_1, UUID_2]);
  });

  it("accepts repeated ?ids params arriving as an array", () => {
    const parsed = ListRequisiteProviderOptionsQuerySchema.parse({
      ids: [UUID_1, UUID_2],
    });
    expect(parsed.ids).toEqual([UUID_1, UUID_2]);
  });

  it("flattens mixed array + comma-separated entries", () => {
    const parsed = ListRequisiteProviderOptionsQuerySchema.parse({
      ids: [`${UUID_1},${UUID_2}`, UUID_3],
    });
    expect(parsed.ids).toEqual([UUID_1, UUID_2, UUID_3]);
  });

  it("rejects non-UUID values in the list", () => {
    expect(() =>
      ListRequisiteProviderOptionsQuerySchema.parse({
        ids: `${UUID_1},not-a-uuid`,
      }),
    ).toThrow();
  });

  it("coerces and validates the limit field", () => {
    expect(
      ListRequisiteProviderOptionsQuerySchema.parse({ limit: "25" }).limit,
    ).toBe(25);
    expect(() =>
      ListRequisiteProviderOptionsQuerySchema.parse({ limit: "0" }),
    ).toThrow();
    expect(() =>
      ListRequisiteProviderOptionsQuerySchema.parse({ limit: "501" }),
    ).toThrow();
  });

  it("trims q and rejects empty string", () => {
    expect(
      ListRequisiteProviderOptionsQuerySchema.parse({ q: "  bank  " }).q,
    ).toBe("bank");
    expect(() =>
      ListRequisiteProviderOptionsQuerySchema.parse({ q: "   " }),
    ).toThrow();
  });
});
