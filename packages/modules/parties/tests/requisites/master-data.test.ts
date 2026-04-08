import { describe, expect, it } from "vitest";

import { findRequisiteProviderIdentifier } from "../../src/master-data";

function createProvider() {
  const now = new Date("2026-04-01T00:00:00.000Z");

  return {
    id: "provider-1",
    kind: "bank",
    legalName: "Acme Bank",
    legalNameI18n: null,
    displayName: "Acme Bank",
    displayNameI18n: null,
    description: null,
    country: "RU",
    website: null,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
    identifiers: [],
    branches: [
      {
        id: "branch-1",
        providerId: "provider-1",
        code: null,
        name: "Acme Bank Moscow",
        nameI18n: null,
        country: "RU",
        postalCode: null,
        city: null,
        cityI18n: null,
        line1: null,
        line1I18n: null,
        line2: null,
        line2I18n: null,
        rawAddress: "Moscow",
        rawAddressI18n: null,
        contactEmail: null,
        contactPhone: null,
        isPrimary: true,
        archivedAt: null,
        createdAt: now,
        updatedAt: now,
        identifiers: [
          {
            id: "branch-bic-1",
            scheme: "bic",
            value: "044525225",
            normalizedValue: "044525225",
            isPrimary: true,
            createdAt: now,
            updatedAt: now,
          },
        ],
      },
    ],
  } as const;
}

describe("parties master data", () => {
  it("falls back to the primary branch when provider identifiers are absent", () => {
    const provider = createProvider();

    expect(
      findRequisiteProviderIdentifier({
        provider,
        scheme: "bic",
      }),
    ).toEqual(provider.branches[0]?.identifiers[0] ?? null);
  });
});
