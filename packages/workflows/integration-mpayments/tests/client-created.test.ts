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

function makeClientEvent(overrides: Record<string, unknown> = {}) {
  return {
    entity: "client",
    action: "created",
    entityId: 100,
    data: {
      id: 100,
      orgName: "Рога и Копыта",
      orgType: "ООО",
      inn: "7701234567",
      kpp: "770101001",
      ogrn: "1027700123456",
      directorName: "Иванов И.И.",
      position: "Генеральный директор",
      directorBasis: "Устав",
      address: "г. Москва, ул. Примерная, д. 1",
      email: "info@rogaikopyta.ru",
      phone: "+7 (495) 123-45-67",
      bankName: "АО «Тинькофф Банк»",
      bankCountry: "RU",
      bankAddress: "г. Москва",
      account: "40702810100000012345",
      bic: "044525974",
      corrAccount: "30101810145250000974",
      ...overrides,
    },
    metadata: {
      userId: 42,
      source: "web",
      timestamp: "2026-01-15T10:00:00.000Z",
    },
  };
}

describe("client.created handler", () => {
  it("creates counterparty and requisite (happy path)", async () => {
    const deps = createMockDeps();
    deps.listCustomers.mockResolvedValueOnce({
      data: [{ id: "cust-42", externalRef: "42" }],
      total: 1,
    });
    const handler = createIntegrationEventHandler(deps as any);

    await handler.processEvent(makeClientEvent());

    expect(deps.createCounterparty).toHaveBeenCalledWith(
      expect.objectContaining({
        externalId: "100",
        shortName: "Рога и Копыта",
        fullName: "ООО Рога и Копыта",
        kind: "legal_entity",
        country: "RU",
        customerId: "cust-42",
      }),
    );

    expect(deps.createRequisite).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerType: "counterparty",
        ownerId: "cp-1",
        currencyId: "cur-rub",
        kind: "bank",
        beneficiaryName: "Рога и Копыта",
        institutionName: "АО «Тинькофф Банк»",
        institutionCountry: "RU",
        accountNo: "40702810100000012345",
        bic: "044525974",
        corrAccount: "30101810145250000974",
        isDefault: true,
      }),
    );
  });

  it("skips creation when counterparty with same externalId exists (dedup)", async () => {
    const deps = createMockDeps();
    deps.listCounterparties.mockResolvedValueOnce({
      data: [{ id: "cp-existing", externalId: "100" }],
      total: 1,
    });
    const handler = createIntegrationEventHandler(deps as any);

    await handler.processEvent(makeClientEvent());

    expect(deps.createCounterparty).not.toHaveBeenCalled();
    expect(deps.createRequisite).not.toHaveBeenCalled();
    expect(deps.logger.info).toHaveBeenCalledWith(
      "Counterparty already exists, skipping creation",
      expect.objectContaining({ externalId: "100" }),
    );
  });

  it("creates counterparty without customerId when customer not found", async () => {
    const deps = createMockDeps();
    // listCustomers returns empty — no customer found for userId
    const handler = createIntegrationEventHandler(deps as any);

    await handler.processEvent(makeClientEvent());

    expect(deps.logger.warn).toHaveBeenCalledWith(
      "Customer not found for metadata.userId, creating counterparty without customerId",
      expect.objectContaining({ userId: 42 }),
    );
    expect(deps.createCounterparty).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: null,
      }),
    );
  });

  it("creates counterparty without requisite when bank details are missing", async () => {
    const deps = createMockDeps();
    const handler = createIntegrationEventHandler(deps as any);

    await handler.processEvent(
      makeClientEvent({ bankName: undefined, bankCountry: undefined, account: undefined, bic: undefined }),
    );

    expect(deps.createCounterparty).toHaveBeenCalled();
    expect(deps.createRequisite).not.toHaveBeenCalled();
  });

  it("does not create requisite when bankCountry is missing", async () => {
    const deps = createMockDeps();
    const handler = createIntegrationEventHandler(deps as any);

    await handler.processEvent(makeClientEvent({ bankCountry: undefined }));

    expect(deps.createCounterparty).toHaveBeenCalled();
    expect(deps.createRequisite).not.toHaveBeenCalled();
  });

  it("does not create requisite when bic is missing", async () => {
    const deps = createMockDeps();
    const handler = createIntegrationEventHandler(deps as any);

    await handler.processEvent(makeClientEvent({ bic: undefined }));

    expect(deps.createCounterparty).toHaveBeenCalled();
    expect(deps.createRequisite).not.toHaveBeenCalled();
  });

  it("reuses existing provider when name matches", async () => {
    const deps = createMockDeps();
    deps.listProviders.mockResolvedValueOnce({
      data: [{ id: "existing-prov", name: "АО «Тинькофф Банк»", kind: "bank" }],
      total: 1,
    });
    const handler = createIntegrationEventHandler(deps as any);

    await handler.processEvent(makeClientEvent());

    expect(deps.createProvider).not.toHaveBeenCalled();
    expect(deps.createRequisite).toHaveBeenCalledWith(
      expect.objectContaining({ providerId: "existing-prov" }),
    );
  });

  it("creates new provider when no match found", async () => {
    const deps = createMockDeps();
    // listProviders returns empty — no matching provider
    const handler = createIntegrationEventHandler(deps as any);

    await handler.processEvent(makeClientEvent());

    expect(deps.createProvider).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "bank",
        name: "АО «Тинькофф Банк»",
        country: "RU", // from bankCountry in event data
        bic: "044525974",
      }),
    );
    expect(deps.createRequisite).toHaveBeenCalledWith(
      expect.objectContaining({ providerId: "prov-1" }),
    );
  });

  it("builds fullName with orgType prefix when present", async () => {
    const deps = createMockDeps();
    const handler = createIntegrationEventHandler(deps as any);

    await handler.processEvent(makeClientEvent({ orgType: "ЗАО" }));

    expect(deps.createCounterparty).toHaveBeenCalledWith(
      expect.objectContaining({ fullName: "ЗАО Рога и Копыта" }),
    );
  });

  it("uses orgName as fullName when orgType is absent", async () => {
    const deps = createMockDeps();
    const handler = createIntegrationEventHandler(deps as any);

    await handler.processEvent(makeClientEvent({ orgType: undefined }));

    expect(deps.createCounterparty).toHaveBeenCalledWith(
      expect.objectContaining({ fullName: "Рога и Копыта" }),
    );
  });

  it("builds structured description from registration fields", async () => {
    const deps = createMockDeps();
    const handler = createIntegrationEventHandler(deps as any);

    await handler.processEvent(makeClientEvent());

    const call = deps.createCounterparty.mock.calls[0]![0];
    expect(call.description).toContain("ИНН: 7701234567");
    expect(call.description).toContain("КПП: 770101001");
    expect(call.description).toContain("ОГРН: 1027700123456");
    expect(call.description).toContain("Руководитель: Иванов И.И.");
    expect(call.description).toContain("Адрес: г. Москва, ул. Примерная, д. 1");
  });

  it("generates requisite label with last 4 digits of account", async () => {
    const deps = createMockDeps();
    const handler = createIntegrationEventHandler(deps as any);

    await handler.processEvent(makeClientEvent());

    expect(deps.createRequisite).toHaveBeenCalledWith(
      expect.objectContaining({
        label: "АО «Тинькофф Банк» •2345",
      }),
    );
  });

  it("combines email and phone into contact field", async () => {
    const deps = createMockDeps();
    const handler = createIntegrationEventHandler(deps as any);

    await handler.processEvent(makeClientEvent());

    expect(deps.createRequisite).toHaveBeenCalledWith(
      expect.objectContaining({
        contact: "info@rogaikopyta.ru, +7 (495) 123-45-67",
      }),
    );
  });

  it("handles contact with only email", async () => {
    const deps = createMockDeps();
    const handler = createIntegrationEventHandler(deps as any);

    await handler.processEvent(makeClientEvent({ phone: undefined }));

    expect(deps.createRequisite).toHaveBeenCalledWith(
      expect.objectContaining({
        contact: "info@rogaikopyta.ru",
      }),
    );
  });

  it("sets null contact when both email and phone are absent", async () => {
    const deps = createMockDeps();
    const handler = createIntegrationEventHandler(deps as any);

    await handler.processEvent(
      makeClientEvent({ email: undefined, phone: undefined }),
    );

    expect(deps.createRequisite).toHaveBeenCalledWith(
      expect.objectContaining({
        contact: null,
      }),
    );
  });

  it("accepts null email and phone from integration payload", async () => {
    const deps = createMockDeps();
    const handler = createIntegrationEventHandler(deps as any);

    await handler.processEvent(makeClientEvent({ email: null, phone: null }));

    expect(deps.createRequisite).toHaveBeenCalledWith(
      expect.objectContaining({
        contact: null,
      }),
    );
  });
});
