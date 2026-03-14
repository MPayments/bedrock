import { describe, expect, it, vi } from "vitest";

import { schema } from "../../src/schema-registry";

import { seedCounterparties } from "../../src/seeds/counterparties";
import { COUNTERPARTIES, CUSTOMERS } from "../../src/seeds/fixtures";

describe("seedCounterparties", () => {
  it("ensures managed customer groups and memberships for seeded counterparties", async () => {
    const customerGroupRows = CUSTOMERS.map((customer, index) => ({
      id: `managed-group-${index + 1}`,
      code: `customer:${customer.id}`,
    }));
    const managedGroupIdsByCustomerId = new Map(
      customerGroupRows.map((group) => [
        group.code.slice("customer:".length),
        group.id,
      ]),
    );

    const customerGroupValues: Array<Record<string, unknown>> = [];
    const membershipValues: Array<Record<string, unknown>> = [];
    const deleteTables: unknown[] = [];

    const db = {
      insert: vi.fn((table: unknown) => ({
        values: vi.fn((values: Record<string, unknown>) => {
          if (table === schema.counterpartyGroups) {
            customerGroupValues.push(values);
          }

          if (table === schema.counterpartyGroupMemberships) {
            membershipValues.push(values);
          }

          return {
            onConflictDoUpdate: vi.fn(async () => undefined),
            onConflictDoNothing: vi.fn(async () => undefined),
          };
        }),
      })),
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(async () => customerGroupRows),
        })),
      })),
      delete: vi.fn((table: unknown) => ({
        where: vi.fn(async () => {
          deleteTables.push(table);
          return undefined;
        }),
      })),
    };

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    try {
      await seedCounterparties(db as any);
    } finally {
      logSpy.mockRestore();
    }

    expect(customerGroupValues).toEqual(
      CUSTOMERS.map((customer) => ({
        code: `customer:${customer.id}`,
        name: customer.displayName,
        description: "Auto-created customer group",
        parentId: null,
        customerId: customer.id,
        isSystem: false,
      })),
    );
    expect(deleteTables).toEqual(
      COUNTERPARTIES.map(() => schema.counterpartyGroupMemberships),
    );
    expect(membershipValues).toEqual(
      COUNTERPARTIES.map((counterparty) => ({
        counterpartyId: counterparty.id,
        groupId: managedGroupIdsByCustomerId.get(counterparty.customerId),
      })),
    );
  });
});
