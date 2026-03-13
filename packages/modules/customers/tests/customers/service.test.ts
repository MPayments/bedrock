import { describe, expect, it, vi } from "vitest";

import {
  CustomerDeleteConflictError,
  CustomerNotFoundError,
} from "../../src/errors";
import { createCustomersService } from "../../src/service";

function makeCustomer(overrides: Record<string, unknown> = {}) {
  return {
    id: "00000000-0000-4000-8000-000000000201",
    externalRef: "crm-201",
    displayName: "Acme Corp",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
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
    execute: vi.fn(),
  };
}

function createLifecyclePort() {
  return {
    onCustomerCreated: vi.fn(async () => undefined),
    onCustomerRenamed: vi.fn(async () => undefined),
    onCustomerDeleted: vi.fn(async () => undefined),
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
    const customerLifecycleSyncPort = createLifecyclePort();
    db.select
      .mockReturnValueOnce(selectListRows([customer]))
      .mockReturnValueOnce(selectWhereRows([{ total: 1 }]));

    const service = createCustomersService({
      db: db as any,
      customerLifecycleSyncPort,
    });
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
    const customerLifecycleSyncPort = createLifecyclePort();
    db.select.mockReturnValue(selectWhereLimitRows([customer]));

    const service = createCustomersService({
      db: db as any,
      customerLifecycleSyncPort,
    });
    const result = await service.findById(customer.id);

    expect(result).toEqual(customer);
  });

  it("throws not found when customer is missing", async () => {
    const db = createStubDb();
    const customerLifecycleSyncPort = createLifecyclePort();
    db.select.mockReturnValue(selectWhereLimitRows([]));

    const service = createCustomersService({
      db: db as any,
      customerLifecycleSyncPort,
    });

    await expect(service.findById("missing-id")).rejects.toThrow(
      CustomerNotFoundError,
    );
  });

  it("creates customer and notifies the lifecycle port", async () => {
    const customer = makeCustomer();
    const db = createStubDb();
    const customerLifecycleSyncPort = createLifecyclePort();
    const tx = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn(() => ({
          returning: vi.fn(async () => [customer]),
        })),
      }),
      select: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      execute: vi.fn(),
    };
    db.transaction.mockImplementation(
      async (fn: (tx: any) => Promise<unknown>) => fn(tx),
    );

    const service = createCustomersService({
      db: db as any,
      customerLifecycleSyncPort,
    });
    const created = await service.create({
      displayName: customer.displayName,
      externalRef: customer.externalRef,
    });

    expect(created).toEqual(customer);
    expect(customerLifecycleSyncPort.onCustomerCreated).toHaveBeenCalledWith(
      tx,
      {
        customerId: customer.id,
        displayName: customer.displayName,
      },
    );
  });

  it("updates customer and notifies the lifecycle port when name changes", async () => {
    const existing = makeCustomer();
    const updated = makeCustomer({ displayName: "Acme International" });
    const db = createStubDb();
    const customerLifecycleSyncPort = createLifecyclePort();
    const tx = {
      select: vi.fn().mockReturnValueOnce(selectWhereLimitRows([existing])),
      update: vi.fn().mockReturnValue({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn(async () => [updated]),
          })),
        })),
      }),
      insert: vi.fn(),
      delete: vi.fn(),
      execute: vi.fn(),
    };
    db.transaction.mockImplementation(
      async (fn: (tx: any) => Promise<unknown>) => fn(tx),
    );

    const service = createCustomersService({
      db: db as any,
      customerLifecycleSyncPort,
    });
    const result = await service.update(existing.id, {
      displayName: updated.displayName,
    });

    expect(result).toEqual(updated);
    expect(customerLifecycleSyncPort.onCustomerRenamed).toHaveBeenCalledWith(
      tx,
      {
        customerId: existing.id,
        displayName: updated.displayName,
      },
    );
  });

  it("removes customer and notifies the lifecycle port", async () => {
    const customer = makeCustomer();
    const db = createStubDb();
    const customerLifecycleSyncPort = createLifecyclePort();
    const tx = {
      select: vi.fn().mockReturnValueOnce(selectWhereLimitRows([{ id: customer.id }])),
      delete: vi.fn().mockReturnValue({
        where: vi.fn(() => ({
          returning: vi.fn(async () => [{ id: customer.id }]),
        })),
      }),
      update: vi.fn(),
      execute: vi.fn().mockResolvedValue({ rows: [] }),
      insert: vi.fn(),
    };
    db.transaction.mockImplementation(
      async (fn: (tx: any) => Promise<unknown>) => fn(tx),
    );

    const service = createCustomersService({
      db: db as any,
      customerLifecycleSyncPort,
    });
    await service.remove(customer.id);

    expect(customerLifecycleSyncPort.onCustomerDeleted).toHaveBeenCalledWith(
      tx,
      {
        customerId: customer.id,
      },
    );
  });

  it("blocks delete when payment orders reference customer", async () => {
    const customer = makeCustomer();
    const db = createStubDb();
    const customerLifecycleSyncPort = createLifecyclePort();
    const tx = {
      select: vi
        .fn()
        .mockReturnValueOnce(selectWhereLimitRows([{ id: customer.id }])),
      delete: vi.fn(),
      update: vi.fn(),
      execute: vi.fn().mockResolvedValue({ rows: [{ id: "order-1" }] }),
      insert: vi.fn(),
    };

    db.transaction.mockImplementation(
      async (fn: (tx: any) => Promise<unknown>) => fn(tx),
    );

    const service = createCustomersService({
      db: db as any,
      customerLifecycleSyncPort,
    });

    await expect(service.remove(customer.id)).rejects.toThrow(
      CustomerDeleteConflictError,
    );
    expect(customerLifecycleSyncPort.onCustomerDeleted).not.toHaveBeenCalled();
  });
});
