import { describe, expect, it } from "vitest";

import { RequisiteSet } from "../../src/requisites/domain/requisite-set";

function createInput(id: string) {
  return {
    id,
    providerId: "provider-1",
    kind: "bank" as const,
    label: id,
    description: null,
    beneficiaryName: "Acme",
    accountNo: "1234",
    iban: null,
    network: null,
    assetCode: null,
    address: null,
    memoTag: null,
    accountRef: null,
    subaccountRef: null,
    contact: null,
    notes: null,
  };
}

function snapshot(input: {
  id: string;
  isDefault?: boolean;
}) {
  return {
    id: input.id,
    ownerType: "organization" as const,
    ownerId: "org-1",
    providerId: "provider-1",
    currencyId: "currency-1",
    kind: "bank" as const,
    label: input.id,
    description: null,
    beneficiaryName: "Acme",
    accountNo: "1234",
    iban: null,
    network: null,
    assetCode: null,
    address: null,
    memoTag: null,
    accountRef: null,
    subaccountRef: null,
    contact: null,
    notes: null,
    isDefault: input.isDefault ?? false,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    archivedAt: null,
  };
}

describe("requisite set domain", () => {
  it("makes the first requisite default", () => {
    const set = RequisiteSet.fromSnapshot({
      ownerType: "organization",
      ownerId: "org-1",
      currencyId: "currency-1",
      requisites: [],
    });
    const created = set.createRequisite(
      {
        ...createInput("req-1"),
      },
      new Date("2026-01-01T00:00:00.000Z"),
    );

    expect(created.requisite.toSnapshot().isDefault).toBe(true);
  });

  it("promotes another requisite when the default is archived", () => {
    const set = RequisiteSet.fromSnapshot({
      ownerType: "organization",
      ownerId: "org-1",
      currencyId: "currency-1",
      requisites: [snapshot({ id: "req-1", isDefault: true }), snapshot({ id: "req-2" })],
    });
    const archived = set.archiveRequisite(
      "req-1",
      new Date("2026-01-02T00:00:00.000Z"),
    );
    const promoted = archived.set
      .toSnapshots()
      .find((requisite) => requisite.id === "req-2");

    expect(promoted?.isDefault).toBe(true);
  });
});
