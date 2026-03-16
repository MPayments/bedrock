import { describe, expect, it, vi } from "vitest";

import { createCreateCounterpartyHandler } from "../../src/application/counterparties/commands";
import { createRemoveCustomerHandler } from "../../src/application/customers/commands";
import { CustomerDeleteConflictError } from "../../src/errors";

describe("parties handlers", () => {
  it("adds the managed customer group when creating a customer-linked counterparty", async () => {
    const counterparties = {
      listGroupHierarchyNodes: vi.fn(async () => [
        {
          id: "00000000-0000-4000-8000-000000000911",
          code: "shared-group",
          parentId: null,
          customerId: null,
        },
        {
          id: "00000000-0000-4000-8000-000000000912",
          code: "customer:00000000-0000-4000-8000-000000000901",
          parentId: null,
          customerId: "00000000-0000-4000-8000-000000000901",
        },
      ]),
      insertCounterparty: vi.fn(async (counterparty: any) => ({
        ...counterparty,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      })),
      replaceMemberships: vi.fn(async () => undefined),
    };
    const customers = {
      listExistingCustomerIds: vi.fn(async () => [
        "00000000-0000-4000-8000-000000000901",
      ]),
      findCustomerSnapshotById: vi.fn(async () => ({
        id: "00000000-0000-4000-8000-000000000901",
        externalRef: null,
        displayName: "Acme Corp",
        description: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      })),
      ensureManagedCustomerGroup: vi.fn(async () => ({
        id: "00000000-0000-4000-8000-000000000912",
      })),
    };
    const context = {
      log: { info: vi.fn() },
      now: () => new Date("2026-01-01T00:00:00.000Z"),
      transactions: {
        withTransaction: vi.fn(async (run: any) =>
          run({
            counterparties,
            customers,
          }),
        ),
      },
    } as any;

    const createCounterparty = createCreateCounterpartyHandler(context);
    const result = await createCounterparty({
      shortName: "Acme",
      fullName: "Acme Corp",
      customerId: "00000000-0000-4000-8000-000000000901",
      groupIds: ["00000000-0000-4000-8000-000000000911"],
    });

    expect(result.groupIds).toEqual([
      "00000000-0000-4000-8000-000000000911",
      "00000000-0000-4000-8000-000000000912",
    ]);
    expect(counterparties.replaceMemberships).toHaveBeenCalledWith(
      expect.any(String),
      [
        "00000000-0000-4000-8000-000000000911",
        "00000000-0000-4000-8000-000000000912",
      ],
    );
  });

  it("blocks customer delete when documents port reports references", async () => {
    const documents = {
      hasDocumentsForCustomer: vi.fn(async () => true),
    };
    const context = {
      log: { info: vi.fn() },
      now: () => new Date("2026-01-01T00:00:00.000Z"),
      transactions: {
        withTransaction: vi.fn(async (run: any) =>
          run({
            documents,
            customers: {
              findCustomerSnapshotById: vi.fn(async () => ({
                id: "cust-1",
                externalRef: null,
                displayName: "Acme Corp",
                description: null,
                createdAt: new Date("2026-01-01T00:00:00.000Z"),
                updatedAt: new Date("2026-01-01T00:00:00.000Z"),
              })),
            },
          }),
        ),
      },
    } as any;

    const removeCustomer = createRemoveCustomerHandler(context);

    await expect(removeCustomer("cust-1")).rejects.toBeInstanceOf(
      CustomerDeleteConflictError,
    );
    expect(documents.hasDocumentsForCustomer).toHaveBeenCalledWith("cust-1");
  });
});
