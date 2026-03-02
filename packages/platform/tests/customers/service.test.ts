import { describe, expect, it, vi } from "vitest";

import { schema as counterpartiesSchema } from "@bedrock/platform/counterparties/schema";

import {
  CustomerDeleteConflictError,
  CustomerNotFoundError,
} from "../../src/customers/errors";
import { createCustomersService } from "../../src/customers/service";

function makeCustomer(overrides: Record<string, unknown> = {}) {
  return {
    id: "00000000-0000-4000-8000-000000000201",
    externalRef: "crm-201",
    displayName: "Acme Corp",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function createStubDb() {
  return {
    transaction: vi.fn(),
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
}

function selectWhereLimitRows<T>(rows: T[]) {
  return {
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: vi.fn(async () => rows),
      })),
    })),
  };
}

function selectWhereRows<T>(rows: T[]) {
  return {
    from: vi.fn(() => ({
      where: vi.fn(async () => rows),
    })),
  };
}

function selectFromRows<T>(rows: T[]) {
  return {
    from: vi.fn(async () => rows),
  };
}

function selectListRows<T>(rows: T[]) {
  return {
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        orderBy: vi.fn(() => ({
          limit: vi.fn(() => ({
            offset: vi.fn(async () => rows),
          })),
        })),
      })),
    })),
  };
}

describe("createCustomersService", () => {
  it("lists customers with filters and count", async () => {
    const customer = makeCustomer();
    const db = createStubDb();
    db.select
      .mockReturnValueOnce(selectListRows([customer]))
      .mockReturnValueOnce(selectWhereRows([{ total: 1 }]));

    const service = createCustomersService({ db: db as any });
    const page = await service.list({
      displayName: "Acme",
      externalRef: "crm",
      sortBy: "displayName",
      sortOrder: "asc",
      limit: 10,
      offset: 0,
    });

    expect(page).toEqual({
      data: [customer],
      total: 1,
      limit: 10,
      offset: 0,
    });
  });

  it("finds customer by id", async () => {
    const customer = makeCustomer();
    const db = createStubDb();
    db.select.mockReturnValue(selectWhereLimitRows([customer]));

    const service = createCustomersService({ db: db as any });
    const result = await service.findById(customer.id);

    expect(result).toEqual(customer);
  });

  it("throws not found when customer is missing", async () => {
    const db = createStubDb();
    db.select.mockReturnValue(selectWhereLimitRows([]));

    const service = createCustomersService({ db: db as any });

    await expect(service.findById("missing-id")).rejects.toThrow(
      CustomerNotFoundError,
    );
  });

  it("creates customer and ensures customer group", async () => {
    const customer = makeCustomer();
    const db = createStubDb();
    const tx = {
      insert: vi
        .fn()
        .mockReturnValueOnce({
          values: vi.fn(() => ({
            returning: vi.fn(async () => [customer]),
          })),
        })
        .mockReturnValue({
          values: vi.fn(() => ({
            onConflictDoNothing: vi.fn(async () => undefined),
          })),
        }),
      select: vi
        .fn()
        .mockReturnValueOnce(
          selectWhereRows([
            { id: "treasury-root", code: "treasury" },
            { id: "customers-root", code: "customers" },
          ]),
        )
        .mockReturnValueOnce(
          selectWhereLimitRows([{ id: "customer-group-id" }]),
        ),
      update: vi.fn(),
      delete: vi.fn(),
    };
    db.transaction.mockImplementation(
      async (fn: (tx: any) => Promise<unknown>) => fn(tx),
    );

    const service = createCustomersService({ db: db as any });
    const created = await service.create({
      displayName: customer.displayName,
      externalRef: customer.externalRef,
    });

    expect(created).toEqual(customer);
    expect(tx.insert).toHaveBeenCalledTimes(4);
  });

  it("updates customer and refreshes the customer group when name changes", async () => {
    const existing = makeCustomer();
    const updated = makeCustomer({ displayName: "Acme International" });
    const db = createStubDb();
    const tx = {
      select: vi
        .fn()
        .mockReturnValueOnce(selectWhereLimitRows([existing]))
        .mockReturnValueOnce(
          selectWhereRows([
            { id: "treasury-root", code: "treasury" },
            { id: "customers-root", code: "customers" },
          ]),
        )
        .mockReturnValueOnce(
          selectWhereLimitRows([{ id: "customer-group-id" }]),
        ),
      update: vi
        .fn()
        .mockReturnValueOnce({
          set: vi.fn(() => ({
            where: vi.fn(() => ({
              returning: vi.fn(async () => [updated]),
            })),
          })),
        })
        .mockReturnValueOnce({
          set: vi.fn(() => ({
            where: vi.fn(async () => undefined),
          })),
        }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn(() => ({
          onConflictDoNothing: vi.fn(async () => undefined),
        })),
      }),
      delete: vi.fn(),
    };
    db.transaction.mockImplementation(
      async (fn: (tx: any) => Promise<unknown>) => fn(tx),
    );

    const service = createCustomersService({ db: db as any });
    const result = await service.update(existing.id, {
      displayName: updated.displayName,
    });

    expect(result).toEqual(updated);
    expect(tx.update).toHaveBeenCalledTimes(2);
  });

  it("removes customer and detaches counterparties from customer tree", async () => {
    const customer = makeCustomer();
    const db = createStubDb();
    const tx = {
      select: vi
        .fn()
        .mockReturnValueOnce(selectWhereLimitRows([{ id: customer.id }]))
        .mockReturnValueOnce(selectWhereLimitRows([]))
        .mockReturnValueOnce(selectWhereRows([{ id: "counterparty-1" }]))
        .mockReturnValueOnce(
          selectWhereRows([
            {
              counterpartyId: "counterparty-1",
              groupId: "customer-leaf",
            },
            {
              counterpartyId: "counterparty-1",
              groupId: "treasury-leaf",
            },
          ]),
        )
        .mockReturnValueOnce(
          selectFromRows([
            {
              id: "customers-root",
              parentId: null,
              code: "customers",
            },
            {
              id: "customer-leaf",
              parentId: "customers-root",
              code: "customer:00000000-0000-4000-8000-000000000201",
            },
            {
              id: "treasury-root",
              parentId: null,
              code: "treasury",
            },
            {
              id: "treasury-leaf",
              parentId: "treasury-root",
              code: "treasury:ops",
            },
          ]),
        ),
      delete: vi
        .fn()
        .mockReturnValueOnce({
          where: vi.fn(async () => undefined),
        })
        .mockReturnValueOnce({
          where: vi.fn(async () => undefined),
        })
        .mockReturnValueOnce({
          where: vi.fn(() => ({
            returning: vi.fn(async () => [{ id: customer.id }]),
          })),
        }),
      update: vi.fn().mockReturnValue({
        set: vi.fn(() => ({
          where: vi.fn(async () => undefined),
        })),
      }),
      insert: vi.fn(),
    };
    db.transaction.mockImplementation(
      async (fn: (tx: any) => Promise<unknown>) => fn(tx),
    );

    const service = createCustomersService({ db: db as any });
    await service.remove(customer.id);

    expect(tx.delete).toHaveBeenCalledTimes(3);
    expect(tx.delete).toHaveBeenNthCalledWith(
      2,
      counterpartiesSchema.counterpartyGroups,
    );
    expect(tx.update).toHaveBeenCalledTimes(1);
  });

  it("blocks delete when payment orders reference customer", async () => {
    const customer = makeCustomer();
    const db = createStubDb();
    const tx = {
      select: vi
        .fn()
        .mockReturnValueOnce(selectWhereLimitRows([{ id: customer.id }]))
        .mockReturnValueOnce(selectWhereLimitRows([{ id: "order-1" }])),
      delete: vi.fn(),
      update: vi.fn(),
      insert: vi.fn(),
    };

    db.transaction.mockImplementation(
      async (fn: (tx: any) => Promise<unknown>) => fn(tx),
    );

    const service = createCustomersService({ db: db as any });

    await expect(service.remove(customer.id)).rejects.toThrow(
      CustomerDeleteConflictError,
    );
  });
});
