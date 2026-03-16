import { describe, expect, it } from "vitest";

import { DomainError } from "@bedrock/shared/core/domain";

import { Organization } from "../../src/domain/organization";

describe("organization domain", () => {
  it("normalizes optional fields and country codes on create", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const organization = Organization.create({
      id: "org-1",
      externalId: "  ext-1  ",
      shortName: "  Acme  ",
      fullName: "  Acme Incorporated  ",
      description: "  Treasury entity  ",
      country: "us",
      kind: "legal_entity",
    }, now);

    expect(organization.toSnapshot()).toEqual({
      id: "org-1",
      externalId: "ext-1",
      shortName: "Acme",
      fullName: "Acme Incorporated",
      description: "Treasury entity",
      country: "US",
      kind: "legal_entity",
      createdAt: now,
      updatedAt: now,
    });
  });

  it("rejects invalid countries", () => {
    expect(() =>
      Organization.create({
        id: "org-1",
        shortName: "Acme",
        fullName: "Acme Incorporated",
        country: "zz",
        kind: "legal_entity",
      }, new Date("2026-01-01T00:00:00.000Z"))).toThrow(DomainError);
  });
});
