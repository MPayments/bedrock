import { describe, expect, it, vi } from "vitest";

import { CreateCounterpartyCommand } from "../../src/counterparties/application/commands/create-counterparty";
import { RemoveCounterpartyCommand } from "../../src/counterparties/application/commands/remove-counterparty";
import { RemoveCounterpartyGroupCommand } from "../../src/counterparties/application/commands/remove-counterparty-group";
import { UpdateCounterpartyCommand } from "../../src/counterparties/application/commands/update-counterparty";
import { Counterparty } from "../../src/counterparties/domain/counterparty";
import { CounterpartyGroup } from "../../src/counterparties/domain/counterparty-group";
import {
  CounterpartyCustomerNotFoundError,
  CounterpartyNotFoundError,
  CounterpartySystemGroupDeleteError,
} from "../../src/errors";

function createRuntime(overrides?: Record<string, unknown>) {
  return {
    generateUuid: () => "00000000-0000-4000-8000-000000000999",
    log: { info: vi.fn() },
    now: () => new Date("2026-01-03T00:00:00.000Z"),
    ...overrides,
  } as any;
}

function createLegalEntityBundle() {
  return {
    profile: {
      fullName: "Acme Incorporated",
      shortName: "Acme",
      fullNameI18n: null,
      shortNameI18n: null,
      legalFormCode: null,
      legalFormLabel: null,
      legalFormLabelI18n: null,
      countryCode: null,
      businessActivityCode: null,
      businessActivityText: null,
    },
    identifiers: [],
    addresses: [],
    contacts: [],
    representatives: [],
    licenses: [],
  };
}

describe("counterparty command handlers", () => {
  it("creates a customer-linked counterparty with the managed group", async () => {
    const customerId = "00000000-0000-4000-8000-000000000901";
    const sharedGroupId = "00000000-0000-4000-8000-000000000911";
    const managedGroupId = "00000000-0000-4000-8000-000000000912";
    const save = vi.fn(async (counterparty: Counterparty) => counterparty);
    const create = new CreateCounterpartyCommand(
      createRuntime(),
      {
        run: vi.fn(async (work) =>
          work({
            customerStore: {
              findById: vi.fn(async () => ({
                id: customerId,
                displayName: "Acme Corp",
              })),
            },
            counterparties: {
              save,
            },
            counterpartyGroupHierarchy: {
              listHierarchyNodes: vi.fn(async () => [
                {
                  id: sharedGroupId,
                  code: "shared",
                  parentId: null,
                  customerId: null,
                },
                {
                  id: managedGroupId,
                  code: `customer:${customerId}`,
                  parentId: null,
                  customerId,
                },
              ]),
            },
            counterpartyGroups: {
              findManagedCustomerGroup: vi.fn(async () =>
                CounterpartyGroup.fromSnapshot({
                  id: managedGroupId,
                  code: `customer:${customerId}`,
                  name: "Acme Corp",
                  description: null,
                  parentId: null,
                  customerId,
                  isSystem: false,
                  createdAt: new Date("2026-01-01T00:00:00.000Z"),
                  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
                }),
              ),
              save: vi.fn(async (group: CounterpartyGroup) => group),
            },
            legalEntities: {
              findBundleByOwner: vi.fn(async () => null),
              upsertProfile: vi.fn(),
              replaceIdentifiers: vi.fn(),
              replaceAddresses: vi.fn(),
              replaceContacts: vi.fn(),
              replaceRepresentatives: vi.fn(),
              replaceLicenses: vi.fn(),
            },
          } as any)),
      } as any,
    );

    const created = await create.execute({
      shortName: "Acme",
      fullName: "Acme Incorporated",
      customerId,
      groupIds: [sharedGroupId],
      legalEntity: createLegalEntityBundle(),
    });

    expect(created.groupIds).toEqual([sharedGroupId, managedGroupId]);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("throws when customer-linked create references a missing customer", async () => {
    const customerId = "00000000-0000-4000-8000-000000000901";
    const create = new CreateCounterpartyCommand(
      createRuntime(),
      {
        run: vi.fn(async (work) =>
          work({
            customerStore: {
              findById: vi.fn(async () => null),
            },
            counterparties: {},
            counterpartyGroups: {},
            legalEntities: {
              findBundleByOwner: vi.fn(async () => null),
              upsertProfile: vi.fn(),
              replaceIdentifiers: vi.fn(),
              replaceAddresses: vi.fn(),
              replaceContacts: vi.fn(),
              replaceRepresentatives: vi.fn(),
              replaceLicenses: vi.fn(),
            },
          } as any)),
      } as any,
    );

    await expect(
      create.execute({
        shortName: "Acme",
        fullName: "Acme Incorporated",
        customerId,
        legalEntity: createLegalEntityBundle(),
      }),
    ).rejects.toBeInstanceOf(CounterpartyCustomerNotFoundError);
  });

  it("drops customer-scoped memberships when clearing the customer link", async () => {
    const existing = Counterparty.fromSnapshot({
      id: "cp-1",
      externalId: null,
      relationshipKind: "customer_owned",
      customerId: "cust-1",
      shortName: "Acme",
      fullName: "Acme Incorporated",
      description: null,
      country: null,
      kind: "legal_entity",
      groupIds: ["customer-leaf", "shared-group"],
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    const update = new UpdateCounterpartyCommand(
      createRuntime(),
      {
        run: vi.fn(async (work) =>
          work({
            customerStore: {
              findById: vi.fn(),
            },
            counterparties: {
              findById: vi.fn(async () => existing),
              save: vi.fn(async (counterparty: Counterparty) => counterparty),
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
                  id: "customer-leaf",
                  code: "leaf",
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
              save: vi.fn(async (group: CounterpartyGroup) => group),
            },
            legalEntities: {
              findBundleByOwner: vi.fn(async () => null),
            },
          } as any)),
      } as any,
    );

    const updated = await update.execute("cp-1", {
      customerId: null,
    });

    expect(updated.customerId).toBeNull();
    expect(updated.groupIds).toEqual(["shared-group"]);
  });

  it("throws not found on remove when the counterparty is missing", async () => {
    const remove = new RemoveCounterpartyCommand(
      createRuntime(),
      {
        run: vi.fn(async (work) =>
          work({
            counterparties: {
              remove: vi.fn(async () => false),
            },
          } as any)),
      } as any,
    );

    await expect(remove.execute("missing")).rejects.toBeInstanceOf(
      CounterpartyNotFoundError,
    );
  });

  it("maps forbidden group deletion to a rule error", async () => {
    const remove = new RemoveCounterpartyGroupCommand(
      createRuntime(),
      {
        run: vi.fn(async (work) =>
          work({
            counterpartyGroups: {
              findById: vi.fn(async () =>
                CounterpartyGroup.fromSnapshot({
                  id: "managed-group",
                  code: "customer:cust-1",
                  name: "Managed",
                  description: null,
                  parentId: null,
                  customerId: "cust-1",
                  isSystem: false,
                  createdAt: new Date("2026-01-01T00:00:00.000Z"),
                  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
                }),
              ),
            },
          } as any)),
      } as any,
    );

    await expect(remove.execute("managed-group")).rejects.toBeInstanceOf(
      CounterpartySystemGroupDeleteError,
    );
  });

  it("reparents child groups through aggregate saves before delete", async () => {
    const saveGroup = vi.fn(async (group: CounterpartyGroup) => group);
    const removeGroup = vi.fn(async () => true);
    const remove = new RemoveCounterpartyGroupCommand(
      createRuntime(),
      {
        run: vi.fn(async (work) =>
          work({
            counterpartyGroupHierarchy: {
              listHierarchyNodes: vi.fn(async () => [
                {
                  id: "root-group",
                  code: "root",
                  parentId: null,
                  customerId: null,
                },
                {
                  id: "child-group",
                  code: "child",
                  parentId: "root-group",
                  customerId: null,
                },
                {
                  id: "grandchild-group",
                  code: "grandchild",
                  parentId: "child-group",
                  customerId: null,
                },
              ]),
            },
            counterpartyGroups: {
              findById: vi.fn(async (id: string) => {
                if (id !== "child-group") {
                  return null;
                }

                return CounterpartyGroup.fromSnapshot({
                  id: "child-group",
                  code: "child",
                  name: "Child",
                  description: null,
                  parentId: "root-group",
                  customerId: null,
                  isSystem: false,
                  createdAt: new Date("2026-01-01T00:00:00.000Z"),
                  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
                });
              }),
              findByParentId: vi.fn(async () => [
                CounterpartyGroup.fromSnapshot({
                  id: "grandchild-group",
                  code: "grandchild",
                  name: "Grandchild",
                  description: null,
                  parentId: "child-group",
                  customerId: null,
                  isSystem: false,
                  createdAt: new Date("2026-01-01T00:00:00.000Z"),
                  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
                }),
              ]),
              remove: removeGroup,
              save: saveGroup,
            },
          } as any)),
      } as any,
    );

    await remove.execute("child-group");

    expect(saveGroup).toHaveBeenCalledTimes(1);
    expect(saveGroup.mock.calls[0]?.[0].toSnapshot()).toEqual(
      expect.objectContaining({
        id: "grandchild-group",
        parentId: "root-group",
      }),
    );
    expect(removeGroup).toHaveBeenCalledWith("child-group");
  });
});
