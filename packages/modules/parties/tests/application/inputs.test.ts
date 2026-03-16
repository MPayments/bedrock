import { resolveUpdateCounterpartyProps } from "../../src/application/counterparties/inputs";
import { resolveUpdateCounterpartyRequisiteProps } from "../../src/application/requisites/inputs";
import { GroupHierarchy } from "../../src/domain/group-hierarchy";

describe("parties application input resolution", () => {
  it("resolves counterparty patches to concrete domain values", () => {
    const hierarchy = GroupHierarchy.create([
      {
        id: "shared-group",
        code: "shared",
        parentId: null,
        customerId: null,
      },
      {
        id: "customer-group",
        code: "customer:cust-1",
        parentId: null,
        customerId: "cust-1",
      },
    ]);

    const resolved = resolveUpdateCounterpartyProps(
      {
        id: "counterparty-1",
        externalId: "ext-1",
        customerId: "cust-1",
        shortName: "Acme",
        fullName: "Acme LLC",
        description: null,
        country: "US",
        kind: "legal_entity",
        groupIds: ["shared-group", "customer-group"],
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
      {
        customerId: null,
      },
      hierarchy,
    );

    expect(resolved).toEqual({
      externalId: "ext-1",
      customerId: null,
      shortName: "Acme",
      fullName: "Acme LLC",
      description: null,
      country: "US",
      kind: "legal_entity",
      groupIds: ["shared-group"],
    });
  });

  it("resolves requisite patches without leaving undefined fields", () => {
    const resolved = resolveUpdateCounterpartyRequisiteProps(
      {
        id: "req-1",
        counterpartyId: "counterparty-1",
        providerId: "provider-1",
        currencyId: "currency-1",
        kind: "bank",
        label: "Primary",
        description: "Current",
        beneficiaryName: null,
        institutionName: null,
        institutionCountry: "US",
        accountNo: "123",
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
        isDefault: true,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        archivedAt: null,
      },
      {
        label: "Updated",
        description: null,
      },
    );

    expect(resolved).toEqual({
      providerId: "provider-1",
      currencyId: "currency-1",
      kind: "bank",
      label: "Updated",
      description: null,
      beneficiaryName: null,
      institutionName: null,
      institutionCountry: "US",
      accountNo: "123",
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
      isDefault: true,
    });
  });
});
