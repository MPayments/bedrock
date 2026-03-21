import { describe, expect, it, vi } from "vitest";

import {
  RequisiteAccountingBindingOwnerTypeError,
  RequisiteProviderNotFoundError,
} from "../../src/errors";
import { CreateRequisiteCommand } from "../../src/requisites/application/commands/create-requisite";
import { RemoveRequisiteProviderCommand } from "../../src/requisites/application/commands/remove-requisite-provider";
import { UpsertRequisiteBindingCommand } from "../../src/requisites/application/commands/upsert-requisite-binding";
import { Requisite } from "../../src/requisites/domain/requisite";
import { RequisiteSet } from "../../src/requisites/domain/requisite-set";

function createRuntime(overrides?: Record<string, unknown>) {
  return {
    generateUuid: () => "00000000-0000-4000-8000-000000000999",
    log: { info: vi.fn() },
    now: () => new Date("2026-01-03T00:00:00.000Z"),
    ...overrides,
  } as any;
}

describe("requisite command handlers", () => {
  it("creates the first requisite as default", async () => {
    const create = new CreateRequisiteCommand(
      createRuntime(),
      {
        assertCurrencyExists: vi.fn(async () => undefined),
        listCodesById: vi.fn(async () =>
          new Map([["00000000-0000-4000-8000-000000000113", "USD"]]),
        ),
      },
      {
        findById: vi.fn(async () => ({
          id: "00000000-0000-4000-8000-000000000111",
        })),
      } as any,
      {
        findById: vi.fn(),
      } as any,
      {
        findActiveById: vi.fn(async () => ({
          id: "00000000-0000-4000-8000-000000000112",
        })),
      } as any,
      {
        run: vi.fn(async (work) =>
          work({
            requisites: {
              findSetByOwnerCurrency: vi.fn(async () =>
                RequisiteSet.empty({
                  ownerType: "organization",
                  ownerId: "00000000-0000-4000-8000-000000000111",
                  currencyId: "00000000-0000-4000-8000-000000000113",
                }),
              ),
              saveSet: vi.fn(async () => undefined),
            },
          } as any)),
      } as any,
    );

    const created = await create.execute({
      ownerType: "organization",
      ownerId: "00000000-0000-4000-8000-000000000111",
      providerId: "00000000-0000-4000-8000-000000000112",
      currencyId: "00000000-0000-4000-8000-000000000113",
      kind: "bank",
      label: "Main",
      description: null,
      beneficiaryName: "Acme",
      institutionName: "JPM",
      institutionCountry: "US",
      accountNo: "1234",
    });

    expect(created.isDefault).toBe(true);
  });

  it("rejects non-organization binding subjects", async () => {
    const upsert = new UpsertRequisiteBindingCommand(
      createRuntime(),
      {
        assertCurrencyExists: vi.fn(async () => undefined),
        listCodesById: vi.fn(async () => new Map()),
      },
      {
        run: vi.fn(async (work) =>
          work({
            requisites: {
              findById: vi.fn(async () =>
                Requisite.fromSnapshot({
                  id: "req-1",
                  ownerType: "counterparty",
                  ownerId: "cp-1",
                  providerId: "provider-1",
                  currencyId: "currency-1",
                  kind: "bank",
                  label: "Main",
                  description: null,
                  beneficiaryName: "Acme",
                  institutionName: "JPM",
                  institutionCountry: "US",
                  accountNo: "1234",
                  corrAccount: null,
                  iban: null,
                  bic: null,
                  swift: "SWIFT",
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
                }),
              ),
            },
          } as any)),
      } as any,
    );

    await expect(
      upsert.execute({
        requisiteId: "req-1",
        bookId: "book-1",
        bookAccountInstanceId: "instance-1",
        postingAccountNo: "1010",
      }),
    ).rejects.toBeInstanceOf(RequisiteAccountingBindingOwnerTypeError);
  });

  it("throws not found when archiving a missing provider", async () => {
    const remove = new RemoveRequisiteProviderCommand(
      createRuntime(),
      {
        run: vi.fn(async (work) =>
          work({
            requisiteProviderStore: {
              archive: vi.fn(async () => false),
            },
          } as any)),
      } as any,
    );

    await expect(remove.execute("provider-1")).rejects.toBeInstanceOf(
      RequisiteProviderNotFoundError,
    );
  });
});
