import { describe, expect, it, vi } from "vitest";

import {
  RequisiteAccountingBindingOwnerTypeError,
  RequisiteProviderBranchMismatchError,
  RequisiteProviderNotFoundError,
} from "../../src/errors";
import { CreateRequisiteCommand } from "../../src/requisites/application/commands/create-requisite";
import { RemoveRequisiteProviderCommand } from "../../src/requisites/application/commands/remove-requisite-provider";
import { UpdateRequisiteCommand } from "../../src/requisites/application/commands/update-requisite";
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
              findDetailById: vi.fn(async () => ({
                id: "00000000-0000-4000-8000-000000000999",
                ownerType: "organization",
                ownerId: "00000000-0000-4000-8000-000000000111",
                organizationId: "00000000-0000-4000-8000-000000000111",
                counterpartyId: null,
                providerId: "00000000-0000-4000-8000-000000000112",
                providerBranchId: null,
                currencyId: "00000000-0000-4000-8000-000000000113",
                kind: "bank",
                label: "Main",
                beneficiaryName: "Acme",
                beneficiaryNameLocal: null,
                beneficiaryAddress: null,
                paymentPurposeTemplate: null,
                notes: null,
                isDefault: true,
                createdAt: new Date("2026-01-03T00:00:00.000Z"),
                updatedAt: new Date("2026-01-03T00:00:00.000Z"),
                archivedAt: null,
                identifiers: [
                  {
                    id: "ri-1",
                    requisiteId: "00000000-0000-4000-8000-000000000999",
                    scheme: "local_account_number",
                    value: "1234",
                    normalizedValue: "1234",
                    isPrimary: true,
                    createdAt: new Date("2026-01-03T00:00:00.000Z"),
                    updatedAt: new Date("2026-01-03T00:00:00.000Z"),
                  },
                ],
              })),
              findSetByOwnerCurrency: vi.fn(async () =>
                RequisiteSet.empty({
                  ownerType: "organization",
                  ownerId: "00000000-0000-4000-8000-000000000111",
                  currencyId: "00000000-0000-4000-8000-000000000113",
                }),
              ),
              saveSet: vi.fn(async () => undefined),
              replaceIdentifiers: vi.fn(async () => undefined),
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
      beneficiaryName: "Acme",
      beneficiaryNameLocal: null,
      beneficiaryAddress: null,
      paymentPurposeTemplate: null,
      notes: null,
      identifiers: [
        {
          scheme: "local_account_number",
          value: "1234",
          isPrimary: true,
        },
      ],
    });

    expect(created.isDefault).toBe(true);
  });

  it("rejects a create request when the branch belongs to another provider", async () => {
    const uow = {
      run: vi.fn(),
    } as any;
    const create = new CreateRequisiteCommand(
      createRuntime(),
      {
        assertCurrencyExists: vi.fn(async () => undefined),
        listCodesById: vi.fn(async () => new Map()),
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
          branches: [
            {
              id: "00000000-0000-4000-8000-000000000211",
            },
          ],
        })),
      } as any,
      uow,
    );

    await expect(
      create.execute({
        ownerType: "organization",
        ownerId: "00000000-0000-4000-8000-000000000111",
        providerId: "00000000-0000-4000-8000-000000000112",
        providerBranchId: "00000000-0000-4000-8000-000000000212",
        currencyId: "00000000-0000-4000-8000-000000000113",
        kind: "bank",
        label: "Main",
        beneficiaryName: "Acme",
        beneficiaryNameLocal: null,
        beneficiaryAddress: null,
        paymentPurposeTemplate: null,
        notes: null,
        identifiers: [
          {
            scheme: "local_account_number",
            value: "1234",
            isPrimary: true,
          },
        ],
      }),
    ).rejects.toBeInstanceOf(RequisiteProviderBranchMismatchError);

    expect(uow.run).not.toHaveBeenCalled();
  });

  it("rejects a provider change when the carried branch belongs to the old provider", async () => {
    const findSetByOwnerCurrency = vi.fn();
    const update = new UpdateRequisiteCommand(
      createRuntime(),
      {
        assertCurrencyExists: vi.fn(async () => undefined),
        listCodesById: vi.fn(async () => new Map()),
      },
      {
        findActiveById: vi.fn(async () => ({
          id: "00000000-0000-4000-8000-000000000113",
          branches: [
            {
              id: "00000000-0000-4000-8000-000000000213",
            },
          ],
        })),
      } as any,
      {
        run: vi.fn(async (work) =>
          work({
            requisites: {
              findById: vi.fn(async () =>
                Requisite.fromSnapshot({
                  id: "req-1",
                  ownerType: "organization",
                  ownerId: "org-1",
                  providerId: "00000000-0000-4000-8000-000000000112",
                  providerBranchId: "00000000-0000-4000-8000-000000000212",
                  currencyId: "currency-1",
                  kind: "bank",
                  label: "Main",
                  beneficiaryName: "Acme",
                  beneficiaryNameLocal: null,
                  beneficiaryAddress: null,
                  paymentPurposeTemplate: null,
                  notes: null,
                  isDefault: true,
                  createdAt: new Date("2026-01-01T00:00:00.000Z"),
                  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
                  archivedAt: null,
                }),
              ),
              findSetByOwnerCurrency,
            },
          } as any)),
      } as any,
    );

    await expect(
      update.execute("req-1", {
        providerId: "00000000-0000-4000-8000-000000000113",
      }),
    ).rejects.toBeInstanceOf(RequisiteProviderBranchMismatchError);

    expect(findSetByOwnerCurrency).not.toHaveBeenCalled();
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
                  providerBranchId: null,
                  currencyId: "currency-1",
                  kind: "bank",
                  label: "Main",
                  beneficiaryName: "Acme",
                  beneficiaryNameLocal: null,
                  beneficiaryAddress: null,
                  paymentPurposeTemplate: null,
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
