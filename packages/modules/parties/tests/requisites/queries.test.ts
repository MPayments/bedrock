import { describe, expect, it, vi } from "vitest";

import { FindOrganizationBankByIdQuery } from "../../src/requisites/application/queries/find-organization-bank-by-id";
import { FindPreferredCounterpartyBankByCounterpartyIdQuery } from "../../src/requisites/application/queries/find-preferred-counterparty-bank-by-counterparty-id";

function createRequisite(overrides?: Record<string, unknown>) {
  return {
    id: "requisite-1",
    ownerType: "organization",
    ownerId: "owner-1",
    providerId: "provider-1",
    currencyId: "currency-1",
    kind: "bank",
    label: "Main bank",
    description: null,
    beneficiaryName: null,
    accountNo: null,
    corrAccount: null,
    iban: null,
    network: null,
    assetCode: null,
    address: null,
    memoTag: null,
    accountRef: null,
    subaccountRef: null,
    contact: null,
    notes: null,
    isDefault: false,
    createdAt: new Date("2026-04-01T00:00:00.000Z"),
    updatedAt: new Date("2026-04-01T00:00:00.000Z"),
    archivedAt: null,
    ...overrides,
  };
}

describe("requisite queries", () => {
  it("findOrganizationBankById returns null for missing or non-organization-bank requisites", async () => {
    const reads = {
      findActiveById: vi
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(
          createRequisite({
            ownerType: "counterparty",
          }),
        )
        .mockResolvedValueOnce(
          createRequisite({
            kind: "crypto_wallet",
          }),
        ),
    } as any;
    const query = new FindOrganizationBankByIdQuery(reads);

    await expect(query.execute("missing")).resolves.toBeNull();
    await expect(query.execute("counterparty-bank")).resolves.toBeNull();
    await expect(query.execute("organization-non-bank")).resolves.toBeNull();
  });

  it("findOrganizationBankById returns the active organization bank requisite", async () => {
    const requisite = createRequisite();
    const query = new FindOrganizationBankByIdQuery({
      findActiveById: vi.fn(async () => requisite),
    } as any);

    await expect(query.execute(requisite.id)).resolves.toBe(requisite);
  });

  it("findPreferredCounterpartyBankByCounterpartyId prefers the active default bank requisite", async () => {
    const defaultRequisite = createRequisite({
      id: "requisite-default",
      ownerType: "counterparty",
      ownerId: "counterparty-1",
      isDefault: true,
      createdAt: new Date("2026-03-01T00:00:00.000Z"),
    });
    const newestNonDefault = createRequisite({
      id: "requisite-newest",
      ownerType: "counterparty",
      ownerId: "counterparty-1",
      createdAt: new Date("2026-04-01T00:00:00.000Z"),
    });
    const query = new FindPreferredCounterpartyBankByCounterpartyIdQuery({
      listActiveBankByCounterpartyId: vi.fn(async () => [
        newestNonDefault,
        defaultRequisite,
      ]),
    } as any);

    await expect(query.execute("counterparty-1")).resolves.toBe(
      defaultRequisite,
    );
  });

  it("findPreferredCounterpartyBankByCounterpartyId falls back to the newest active bank requisite", async () => {
    const newest = createRequisite({
      id: "requisite-newest",
      ownerType: "counterparty",
      ownerId: "counterparty-1",
      createdAt: new Date("2026-04-01T00:00:00.000Z"),
    });
    const older = createRequisite({
      id: "requisite-older",
      ownerType: "counterparty",
      ownerId: "counterparty-1",
      createdAt: new Date("2026-03-01T00:00:00.000Z"),
    });
    const query = new FindPreferredCounterpartyBankByCounterpartyIdQuery({
      listActiveBankByCounterpartyId: vi.fn(async () => [newest, older]),
    } as any);

    await expect(query.execute("counterparty-1")).resolves.toBe(newest);
  });

  it("findPreferredCounterpartyBankByCounterpartyId returns null when no active bank requisites exist", async () => {
    const query = new FindPreferredCounterpartyBankByCounterpartyIdQuery({
      listActiveBankByCounterpartyId: vi.fn(async () => []),
    } as any);

    await expect(query.execute("counterparty-1")).resolves.toBeNull();
  });
});
