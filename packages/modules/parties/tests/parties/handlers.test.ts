import { describe, expect, it, vi } from "vitest";

import { createCreateCounterpartyHandler } from "../../src/application/counterparties/commands";
import { createRemoveCustomerHandler } from "../../src/application/customers/commands";
import { CustomerDeleteConflictError } from "../../src/errors";

describe("parties handlers", () => {
  it("adds the managed customer group when creating a customer-linked counterparty", async () => {
    const tx = {};
    const context = {
      db: {
        transaction: vi.fn(async (run: (tx: typeof tx) => Promise<unknown>) =>
          run(tx),
        ),
      },
      log: { info: vi.fn() },
      documents: {
        hasDocumentsForCustomer: vi.fn(),
      },
      parties: {
        listExistingCustomerIds: vi.fn(async () => [
          "00000000-0000-4000-8000-000000000901",
        ]),
        findCustomerById: vi.fn(async () => ({
          id: "00000000-0000-4000-8000-000000000901",
          displayName: "Acme Corp",
        })),
        ensureManagedCustomerGroupTx: vi.fn(async () => ({
          id: "00000000-0000-4000-8000-000000000912",
        })),
        listGroupNodes: vi.fn(async () => [
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
        insertCounterpartyTx: vi.fn(async () => ({
          id: "cp-1",
          externalId: null,
          customerId: "00000000-0000-4000-8000-000000000901",
          shortName: "Acme",
          fullName: "Acme Corp",
          description: null,
          country: null,
          kind: "legal_entity",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        })),
        replaceMembershipsTx: vi.fn(async () => undefined),
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
    expect(context.parties.replaceMembershipsTx).toHaveBeenCalledWith(
      tx,
      "cp-1",
      [
        "00000000-0000-4000-8000-000000000911",
        "00000000-0000-4000-8000-000000000912",
      ],
    );
  });

  it("blocks customer delete when documents port reports references", async () => {
    const tx = {};
    const context = {
      db: {
        transaction: vi.fn(async (run: (tx: typeof tx) => Promise<unknown>) =>
          run(tx),
        ),
      },
      log: { info: vi.fn() },
      documents: {
        hasDocumentsForCustomer: vi.fn(async () => true),
      },
      parties: {
        findCustomerById: vi.fn(async () => ({
          id: "cust-1",
          externalRef: null,
          displayName: "Acme Corp",
          description: null,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        })),
      },
    } as any;

    const removeCustomer = createRemoveCustomerHandler(context);

    await expect(removeCustomer("cust-1")).rejects.toBeInstanceOf(
      CustomerDeleteConflictError,
    );
    expect(context.documents.hasDocumentsForCustomer).toHaveBeenCalledWith(
      "cust-1",
      tx,
    );
  });
});
