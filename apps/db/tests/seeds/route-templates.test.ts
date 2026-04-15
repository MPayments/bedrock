import { describe, expect, it, vi } from "vitest";

const { seedCurrenciesMock, seedOrganizationsMock } = vi.hoisted(() => ({
  seedCurrenciesMock: vi.fn(async () => undefined),
  seedOrganizationsMock: vi.fn(async () => undefined),
}));

vi.mock("../../src/seeds/currencies", async () => {
  const actual = await vi.importActual<typeof import("../../src/seeds/currencies")>(
    "../../src/seeds/currencies",
  );

  return {
    ...actual,
    seedCurrencies: seedCurrenciesMock,
  };
});

vi.mock("../../src/seeds/organizations", async () => {
  const actual = await vi.importActual<
    typeof import("../../src/seeds/organizations")
  >("../../src/seeds/organizations");

  return {
    ...actual,
    seedOrganizations: seedOrganizationsMock,
  };
});

import { schema } from "../../src/schema-registry";
import { seedRouteTemplates } from "../../src/seeds/route-templates";

describe("seedRouteTemplates", () => {
  it("seeds published templates and their nested route rows", async () => {
    const routeTemplateValues: Record<string, unknown>[] = [];
    const routeTemplateParticipantBatches: Record<string, unknown>[][] = [];
    const routeTemplateLegBatches: Record<string, unknown>[][] = [];
    const routeTemplateCostComponentBatches: Record<string, unknown>[][] = [];
    const deleteTables: unknown[] = [];

    const db = {
      delete: vi.fn((table: unknown) => ({
        where: vi.fn(async () => {
          deleteTables.push(table);
          return undefined;
        }),
      })),
      insert: vi.fn((table: unknown) => ({
        values: vi.fn(async (values: Record<string, unknown> | Record<string, unknown>[]) => {
          if (table === schema.routeTemplates) {
            routeTemplateValues.push(values as Record<string, unknown>);
          }

          if (table === schema.routeTemplateParticipants) {
            routeTemplateParticipantBatches.push(
              values as Record<string, unknown>[],
            );
          }

          if (table === schema.routeTemplateLegs) {
            routeTemplateLegBatches.push(values as Record<string, unknown>[]);
          }

          if (table === schema.routeTemplateCostComponents) {
            routeTemplateCostComponentBatches.push(
              values as Record<string, unknown>[],
            );
          }

          return undefined;
        }),
      })),
    };

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    try {
      await seedRouteTemplates(db as never);
    } finally {
      logSpy.mockRestore();
    }

    expect(seedCurrenciesMock).toHaveBeenCalledTimes(1);
    expect(seedOrganizationsMock).toHaveBeenCalledTimes(1);
    expect(deleteTables).toEqual([schema.routeTemplates]);
    expect(routeTemplateValues).toHaveLength(4);
    expect(
      routeTemplateValues.every((template) => template.status === "published"),
    ).toBe(true);
    expect(
      routeTemplateValues.map((template) => template.code),
    ).toEqual([
      "payment-rub-aed-usd-payout",
      "payment-direct-rub",
      "currency-transit-usd",
      "exporter-settlement-usd-internal",
    ]);
    expect(
      routeTemplateParticipantBatches.flat().length,
    ).toBe(14);
    expect(routeTemplateLegBatches.flat().length).toBe(12);
    expect(routeTemplateCostComponentBatches.flat().length).toBe(13);
  });
});
