import { describe, expect, it, vi } from "vitest";

import { createIntegrationEventHandler } from "../src";

function createMockDeps() {
  return {
    createCustomer: vi.fn(async (input: any) => ({
      id: "cust-1",
      ...input,
    })),
    listCustomers: vi.fn(async () => ({ data: [] as any[], total: 0 })),
    createCounterparty: vi.fn(async (input: any) => ({
      id: "cp-1",
      ...input,
    })),
    listCounterparties: vi.fn(async () => ({ data: [] as any[], total: 0 })),
    createRequisite: vi.fn(async (input: any) => ({
      id: "req-1",
      ...input,
    })),
    listProviders: vi.fn(async () => ({ data: [] as any[], total: 0 })),
    createProvider: vi.fn(async (input: any) => ({
      id: "prov-1",
      ...input,
    })),
    findCurrencyByCode: vi.fn(async () => ({
      id: "cur-rub",
      code: "RUB",
      name: "Russian Ruble",
      symbol: "₽",
      precision: 2,
    })),
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
  };
}

describe("customer created mapping", () => {
  it("maps entityId to externalRef as string", async () => {
    const deps = createMockDeps();
    const handler = createIntegrationEventHandler(deps as any);

    await handler.processEvent({
      entity: "customer",
      action: "created",
      entityId: 999,
      data: { id: 999, name: "Customer", email: "c@example.com" },
      metadata: { timestamp: "2026-01-01T00:00:00.000Z" },
    });

    expect(deps.createCustomer).toHaveBeenCalledWith(
      expect.objectContaining({ externalRef: "999" }),
    );
  });

  it("maps data.name to displayName", async () => {
    const deps = createMockDeps();
    const handler = createIntegrationEventHandler(deps as any);

    await handler.processEvent({
      entity: "customer",
      action: "created",
      entityId: 1,
      data: { id: 1, name: "Иванов Иван", email: "ivan@example.com" },
      metadata: { timestamp: "2026-01-01T00:00:00.000Z" },
    });

    expect(deps.createCustomer).toHaveBeenCalledWith(
      expect.objectContaining({ displayName: "Иванов Иван" }),
    );
  });

  it("maps data.email to description", async () => {
    const deps = createMockDeps();
    const handler = createIntegrationEventHandler(deps as any);

    await handler.processEvent({
      entity: "customer",
      action: "created",
      entityId: 1,
      data: { id: 1, name: "Test", email: "test@example.com" },
      metadata: { timestamp: "2026-01-01T00:00:00.000Z" },
    });

    expect(deps.createCustomer).toHaveBeenCalledWith(
      expect.objectContaining({ description: "test@example.com" }),
    );
  });

  it("maps null customer email to null description", async () => {
    const deps = createMockDeps();
    const handler = createIntegrationEventHandler(deps as any);

    await handler.processEvent({
      entity: "customer",
      action: "created",
      entityId: 1,
      data: { id: 1, name: "Test", email: null },
      metadata: { timestamp: "2026-01-01T00:00:00.000Z" },
    });

    expect(deps.createCustomer).toHaveBeenCalledWith(
      expect.objectContaining({ description: null }),
    );
  });

  it("skips creation when customer with same externalRef exists", async () => {
    const deps = createMockDeps();
    deps.listCustomers.mockResolvedValueOnce({
      data: [{ id: "existing-1", externalRef: "42" }],
      total: 1,
    });
    const handler = createIntegrationEventHandler(deps as any);

    await handler.processEvent({
      entity: "customer",
      action: "created",
      entityId: 42,
      data: { id: 42, name: "Dup Customer", email: "dup@example.com" },
      metadata: { timestamp: "2026-01-01T00:00:00.000Z" },
    });

    expect(deps.createCustomer).not.toHaveBeenCalled();
    expect(deps.logger.info).toHaveBeenCalledWith(
      "Customer already exists, skipping creation",
      expect.objectContaining({ externalRef: "42" }),
    );
  });

  it("checks externalRef via list filter", async () => {
    const deps = createMockDeps();
    const handler = createIntegrationEventHandler(deps as any);

    await handler.processEvent({
      entity: "customer",
      action: "created",
      entityId: 77,
      data: { id: 77, name: "Test", email: "t@example.com" },
      metadata: { timestamp: "2026-01-01T00:00:00.000Z" },
    });

    expect(deps.listCustomers).toHaveBeenCalledWith({
      externalRef: "77",
    });
  });
});
