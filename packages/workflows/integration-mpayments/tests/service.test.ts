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

describe("integration event handler", () => {
  it("dispatches customer.created events to customer handler", async () => {
    const deps = createMockDeps();
    const handler = createIntegrationEventHandler(deps as any);

    await handler.processEvent({
      entity: "customer",
      action: "created",
      entityId: 42,
      data: { id: 42, name: "Test Customer", email: "test@example.com" },
      metadata: { source: "auth", timestamp: "2026-01-01T00:00:00.000Z" },
    });

    expect(deps.createCustomer).toHaveBeenCalledWith({
      externalRef: "42",
      displayName: "Test Customer",
      description: "test@example.com",
    });
  });

  it("logs and ignores unknown event types", async () => {
    const deps = createMockDeps();
    const handler = createIntegrationEventHandler(deps as any);

    await handler.processEvent({
      entity: "order",
      action: "updated",
      entityId: 1,
      data: { id: 1 },
      metadata: { timestamp: "2026-01-01T00:00:00.000Z" },
    });

    expect(deps.createCustomer).not.toHaveBeenCalled();
    expect(deps.logger.info).toHaveBeenCalledWith(
      "Ignoring unhandled integration event",
      expect.objectContaining({ entity: "order", action: "updated" }),
    );
  });

  it("throws on invalid payload", async () => {
    const deps = createMockDeps();
    const handler = createIntegrationEventHandler(deps as any);

    await expect(handler.processEvent({ invalid: true })).rejects.toThrow();
  });
});
