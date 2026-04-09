import { describe, expect, it, vi } from "vitest";

import { Counterparty } from "../../src/counterparties/domain/counterparty";
import { CounterpartyGroup } from "../../src/counterparties/domain/counterparty-group";
import { CreateCustomerCommand } from "../../src/customers/application/commands/create-customer";
import { RemoveCustomerCommand } from "../../src/customers/application/commands/remove-customer";
import { UpdateCustomerCommand } from "../../src/customers/application/commands/update-customer";
import { CustomerDeleteConflictError, CustomerNotFoundError } from "../../src/errors";

function createRuntime(overrides?: Record<string, unknown>) {
  return {
    generateUuid: () => "00000000-0000-4000-8000-000000000999",
    log: { info: vi.fn() },
    now: () => new Date("2026-01-03T00:00:00.000Z"),
    ...overrides,
  } as any;
}

describe("customer command handlers", () => {
  it("creates a managed customer group on create", async () => {
    const saveManagedGroup = vi.fn(async (group: CounterpartyGroup) => group);
    const create = new CreateCustomerCommand(
      createRuntime(),
      {
        run: vi.fn(async (work) =>
          work({
            customerStore: {
              create: vi.fn(async (customer: any) => ({
                ...customer,
                createdAt: new Date("2026-01-01T00:00:00.000Z"),
                updatedAt: new Date("2026-01-01T00:00:00.000Z"),
              })),
            },
            counterpartyGroups: {
              findManagedCustomerGroup: vi.fn(async () => null),
              save: saveManagedGroup,
            },
          } as any)),
      } as any,
    );

    const created = await create.execute({
      name: "Acme Corp",
      externalRef: "crm-1",
    });

    expect(created.name).toBe("Acme Corp");
    expect(saveManagedGroup).toHaveBeenCalledTimes(1);
    expect(saveManagedGroup.mock.calls[0]?.[0].toSnapshot()).toEqual(
      expect.objectContaining({
        code: expect.stringContaining("customer:"),
        customerId: expect.any(String),
        name: "Acme Corp",
        parentId: null,
      }),
    );
  });

  it("renames the managed group only when display name changes", async () => {
    const saveManagedGroup = vi.fn(async (group: CounterpartyGroup) => group);
    const update = new UpdateCustomerCommand(
      createRuntime(),
      {
        run: vi.fn(async (work) =>
          work({
            customerStore: {
              findById: vi.fn(async () => ({
                id: "cust-1",
                externalRef: null,
                name: "Acme Corp",
                description: null,
                createdAt: new Date("2026-01-01T00:00:00.000Z"),
                updatedAt: new Date("2026-01-01T00:00:00.000Z"),
              })),
              update: vi.fn(async (customer: any) => ({
                ...customer,
                updatedAt: new Date("2026-01-02T00:00:00.000Z"),
              })),
            },
            counterpartyGroups: {
              findManagedCustomerGroup: vi.fn(async () =>
                CounterpartyGroup.fromSnapshot({
                  id: "group-1",
                  code: "customer:cust-1",
                  name: "Acme Corp",
                  description: null,
                  parentId: null,
                  customerId: "cust-1",
                  isSystem: false,
                  createdAt: new Date("2026-01-01T00:00:00.000Z"),
                  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
                }),
              ),
              save: saveManagedGroup,
            },
          } as any)),
      } as any,
    );

    await update.execute("cust-1", { name: "Acme Updated" });
    expect(saveManagedGroup).toHaveBeenCalledTimes(1);
    expect(saveManagedGroup.mock.calls[0]?.[0].toSnapshot().name).toBe(
      "Acme Updated",
    );

    saveManagedGroup.mockClear();
    await update.execute("cust-1", {});
    expect(saveManagedGroup).not.toHaveBeenCalled();
  });

  it("throws not found on update when the customer is missing", async () => {
    const update = new UpdateCustomerCommand(
      createRuntime(),
      {
        run: vi.fn(async (work) =>
          work({
            customerStore: {
              findById: vi.fn(async () => null),
            },
            counterpartyGroups: {},
          } as any)),
      } as any,
    );

    await expect(
      update.execute("missing", { name: "Acme Updated" }),
    ).rejects.toBeInstanceOf(CustomerNotFoundError);
  });

  it("blocks delete when documents reference the customer", async () => {
    const run = vi.fn();
    const remove = new RemoveCustomerCommand(
      createRuntime(),
      {
        findById: vi.fn(async () => ({
          id: "cust-1",
          externalRef: null,
          name: "Acme Corp",
          description: null,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        })),
      } as any,
      {
        hasDocumentsForCustomer: vi.fn(async () => true),
      } as any,
      { run } as any,
    );

    await expect(remove.execute("cust-1")).rejects.toBeInstanceOf(
      CustomerDeleteConflictError,
    );
    expect(run).not.toHaveBeenCalled();
  });

  it("detaches linked counterparties and deletes the managed subtree on remove", async () => {
    const saveCounterparty = vi.fn(
      async (counterparty: Counterparty) => counterparty,
    );
    const removeGroup = vi.fn(async () => true);
    const remove = new RemoveCustomerCommand(
      createRuntime(),
      {
        findById: vi.fn(async () => ({
          id: "cust-1",
          externalRef: null,
          name: "Acme Corp",
          description: null,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        })),
      } as any,
      {
        hasDocumentsForCustomer: vi.fn(async () => false),
      } as any,
      {
        run: vi.fn(async (work) =>
          work({
            customerStore: {
              remove: vi.fn(async () => true),
            },
            counterparties: {
              findByCustomerId: vi.fn(async () => [
                Counterparty.fromSnapshot({
                  id: "cp-1",
                  externalRef: null,
                  relationshipKind: "customer_owned",
                  customerId: "cust-1",
                  shortName: "Acme CP",
                  fullName: "Acme Counterparty",
                  description: null,
                  country: null,
                  kind: "legal_entity",
                  groupIds: ["nested-group", "shared-group"],
                  createdAt: new Date("2026-01-01T00:00:00.000Z"),
                  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
                }),
              ]),
              save: saveCounterparty,
            },
            counterpartyGroupHierarchy: {
              listHierarchyNodes: vi.fn(async () => [
                {
                  id: "managed-group",
                  code: "customer:cust-1",
                  parentId: null,
                  customerId: "cust-1",
                },
                {
                  id: "nested-group",
                  code: "nested",
                  parentId: "managed-group",
                  customerId: null,
                },
                {
                  id: "shared-group",
                  code: "shared",
                  parentId: null,
                  customerId: null,
                },
              ]),
            },
            counterpartyGroups: {
              findManagedCustomerGroup: vi.fn(async () => ({
                id: "managed-group",
                name: "Acme Corp",
              })),
              remove: removeGroup,
            },
          } as any)),
      } as any,
    );

    await remove.execute("cust-1");

    expect(saveCounterparty).toHaveBeenCalledTimes(1);
    expect(saveCounterparty.mock.calls[0]?.[0].toSnapshot()).toEqual(
      expect.objectContaining({
        id: "cp-1",
        customerId: null,
        groupIds: ["shared-group"],
      }),
    );
    expect(removeGroup.mock.calls.map(([groupId]) => groupId)).toEqual([
      "managed-group",
      "nested-group",
    ]);
  });

  it("throws not found on remove when the customer is missing", async () => {
    const remove = new RemoveCustomerCommand(
      createRuntime(),
      {
        findById: vi.fn(async () => null),
      } as any,
      {
        hasDocumentsForCustomer: vi.fn(async () => false),
      } as any,
      {
        run: vi.fn(),
      } as any,
    );

    await expect(remove.execute("missing")).rejects.toBeInstanceOf(
      CustomerNotFoundError,
    );
  });
});
