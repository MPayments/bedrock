import { describe, expect, it } from "vitest";

import { CounterpartyRequisiteSet } from "../../src/domain/counterparty-requisite-set";

function makeRequisite(overrides: Partial<{
  id: string;
  currencyId: string;
  isDefault: boolean;
}> = {}) {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    counterpartyId: "counterparty-1",
    providerId: "provider-1",
    currencyId: overrides.currencyId ?? "currency-usd",
    kind: "bank" as const,
    label: "Primary bank",
    description: null,
    beneficiaryName: "Acme LLC",
    institutionName: "Bank",
    institutionCountry: "US",
    accountNo: "123456",
    corrAccount: null,
    iban: null,
    bic: null,
    swift: null,
    bankAddress: null,
    network: null,
    assetCode: null,
    address: null,
    memoTag: null,
    accountRef: null,
    subaccountRef: null,
    contact: null,
    notes: null,
    isDefault: overrides.isDefault ?? false,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    archivedAt: null,
  };
}

describe("counterparty requisite set", () => {
  it("promotes the first requisite to default on create", () => {
    const set = CounterpartyRequisiteSet.reconstitute({
      counterpartyId: "counterparty-1",
      currencyId: "currency-usd",
      requisites: [],
    });

    expect(set.planCreate("requisite-1")).toEqual({
      candidateIsDefault: true,
      demotedIds: [],
    });
  });

  it("demotes existing defaults when a new default is requested", () => {
    const set = CounterpartyRequisiteSet.reconstitute({
      counterpartyId: "counterparty-1",
      currencyId: "currency-usd",
      requisites: [makeRequisite({ id: "req-1", isDefault: true })],
    });

    expect(set.planCreate("req-2", true)).toEqual({
      candidateIsDefault: true,
      demotedIds: ["req-1"],
    });
  });

  it("promotes another requisite when the default is removed", () => {
    const set = CounterpartyRequisiteSet.reconstitute({
      counterpartyId: "counterparty-1",
      currencyId: "currency-usd",
      requisites: [
        makeRequisite({ id: "req-1", isDefault: true }),
        makeRequisite({ id: "req-2", isDefault: false }),
      ],
    });

    expect(set.planArchive("req-1")).toEqual({
      promotedId: "req-2",
    });
  });
});
