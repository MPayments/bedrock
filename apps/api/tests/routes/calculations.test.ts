import { OpenAPIHono } from "@hono/zod-openapi";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { userHasPermission } = vi.hoisted(() => ({
  userHasPermission: vi.fn(async () => ({ success: true })),
}));

vi.mock("../../src/auth", () => ({
  default: {
    api: {
      userHasPermission,
    },
  },
}));

import { CalculationNotFoundError } from "@bedrock/calculations";

import { calculationsRoutes } from "../../src/routes/calculations";

function createCalculationDetail() {
  const now = new Date("2026-03-30T00:00:00.000Z");

  return {
    id: "00000000-0000-4000-8000-000000000010",
    isActive: true,
    createdAt: now,
    updatedAt: now,
    currentSnapshot: {
      id: "00000000-0000-4000-8000-000000000011",
      snapshotNumber: 1,
      calculationCurrencyId: "00000000-0000-4000-8000-000000000001",
      originalAmountMinor: "10000",
      feeBps: "125",
      feeAmountMinor: "125",
      totalAmountMinor: "10125",
      baseCurrencyId: "00000000-0000-4000-8000-000000000002",
      feeAmountInBaseMinor: "100",
      totalInBaseMinor: "8100",
      additionalExpensesCurrencyId: null,
      additionalExpensesAmountMinor: "0",
      additionalExpensesInBaseMinor: "0",
      totalWithExpensesInBaseMinor: "8100",
      rateSource: "manual" as const,
      rateNum: "81",
      rateDen: "100",
      additionalExpensesRateSource: null,
      additionalExpensesRateNum: null,
      additionalExpensesRateDen: null,
      calculationTimestamp: now,
      fxQuoteId: null,
      createdAt: now,
      updatedAt: now,
    },
    lines: [
      {
        id: "00000000-0000-4000-8000-000000000012",
        idx: 0,
        kind: "original_amount" as const,
        currencyId: "00000000-0000-4000-8000-000000000001",
        amountMinor: "10000",
        createdAt: now,
        updatedAt: now,
      },
    ],
  };
}

function createCalculationsModuleStub() {
  return {
    calculations: {
      queries: {
        list: vi.fn(),
        findById: vi.fn(),
      },
      commands: {
        create: vi.fn(),
        archive: vi.fn(),
      },
    },
  };
}

function createTestApp() {
  const calculationsModule = createCalculationsModuleStub();
  const currenciesService = {
    findById: vi.fn(),
  };
  const documentGenerationWorkflow = {
    generateCalculation: vi.fn(),
  };
  const app = new OpenAPIHono();

  app.use("*", async (c, next) => {
    c.set("user", { id: "user-1" } as any);
    c.set("requestContext", {
      requestId: "req-1",
      correlationId: "corr-1",
      traceId: null,
      causationId: null,
      idempotencyKey: c.req.header("idempotency-key") ?? null,
    });
    await next();
  });

  app.route(
    "/calculations",
    calculationsRoutes({
      calculationsModule,
      currenciesService,
      documentGenerationWorkflow,
    } as any),
  );

  return {
    app,
    calculationsModule,
    currenciesService,
    documentGenerationWorkflow,
  };
}

describe("calculations routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userHasPermission.mockResolvedValue({ success: true });
  });

  it("lists, fetches, creates, and archives calculations", async () => {
    const { app, calculationsModule } = createTestApp();
    const detail = createCalculationDetail();
    calculationsModule.calculations.queries.list.mockResolvedValue({
      data: [
        {
          id: detail.id,
          isActive: detail.isActive,
          createdAt: detail.createdAt,
          updatedAt: detail.updatedAt,
          currentSnapshot: detail.currentSnapshot,
        },
      ],
      total: 1,
      limit: 20,
      offset: 0,
    });
    calculationsModule.calculations.queries.findById.mockResolvedValue(detail);
    calculationsModule.calculations.commands.create.mockResolvedValue(detail);
    calculationsModule.calculations.commands.archive.mockResolvedValue(true);

    const listResponse = await app.request("http://localhost/calculations");
    const getResponse = await app.request(
      `http://localhost/calculations/${detail.id}`,
    );
    const createResponse = await app.request("http://localhost/calculations", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": "calc-create-1",
      },
      body: JSON.stringify({
        calculationCurrencyId: detail.currentSnapshot.calculationCurrencyId,
        originalAmountMinor: "10000",
        feeBps: "125",
        feeAmountMinor: "125",
        totalAmountMinor: "10125",
        baseCurrencyId: detail.currentSnapshot.baseCurrencyId,
        feeAmountInBaseMinor: "100",
        totalInBaseMinor: "8100",
        additionalExpensesCurrencyId: null,
        additionalExpensesAmountMinor: "0",
        additionalExpensesInBaseMinor: "0",
        totalWithExpensesInBaseMinor: "8100",
        rateSource: "manual",
        rateNum: "81",
        rateDen: "100",
        calculationTimestamp:
          detail.currentSnapshot.calculationTimestamp.toISOString(),
        fxQuoteId: null,
      }),
    });
    const deleteResponse = await app.request(
      `http://localhost/calculations/${detail.id}`,
      {
        method: "DELETE",
      },
    );

    expect(listResponse.status).toBe(200);
    expect(getResponse.status).toBe(200);
    expect(createResponse.status).toBe(201);
    expect(deleteResponse.status).toBe(200);

    expect(calculationsModule.calculations.queries.list).toHaveBeenCalledWith({
      limit: 20,
      offset: 0,
      sortBy: "createdAt",
      sortOrder: "desc",
    });
    expect(calculationsModule.calculations.queries.findById).toHaveBeenCalledWith(
      detail.id,
    );
    expect(
      calculationsModule.calculations.commands.create,
    ).toHaveBeenCalledWith({
      calculationCurrencyId: detail.currentSnapshot.calculationCurrencyId,
      originalAmountMinor: "10000",
      feeBps: "125",
      feeAmountMinor: "125",
      totalAmountMinor: "10125",
      baseCurrencyId: detail.currentSnapshot.baseCurrencyId,
      feeAmountInBaseMinor: "100",
      totalInBaseMinor: "8100",
      additionalExpensesCurrencyId: null,
      additionalExpensesAmountMinor: "0",
      additionalExpensesInBaseMinor: "0",
      totalWithExpensesInBaseMinor: "8100",
      rateSource: "manual",
      rateNum: "81",
      rateDen: "100",
      calculationTimestamp: detail.currentSnapshot.calculationTimestamp,
      fxQuoteId: null,
      actorUserId: "user-1",
      idempotencyKey: "calc-create-1",
    });
    expect(
      calculationsModule.calculations.commands.archive,
    ).toHaveBeenCalledWith(detail.id);
  });

  it("returns 404 when a calculation is missing", async () => {
    const { app, calculationsModule } = createTestApp();
    calculationsModule.calculations.queries.findById.mockRejectedValue(
      new CalculationNotFoundError(
        "00000000-0000-4000-8000-000000000099",
      ),
    );

    const response = await app.request(
      "http://localhost/calculations/00000000-0000-4000-8000-000000000099",
    );

    expect(response.status).toBe(404);
  });

  it("exports calculation using canonical document data without compatibility serializer", async () => {
    const { app, calculationsModule, currenciesService, documentGenerationWorkflow } =
      createTestApp();
    const detail = createCalculationDetail();
    calculationsModule.calculations.queries.findById.mockResolvedValue(detail);
    currenciesService.findById.mockImplementation(async (id: string) => {
      if (id === detail.currentSnapshot.calculationCurrencyId) {
        return {
          code: "USD",
          id,
          precision: 2,
        };
      }

      if (id === detail.currentSnapshot.baseCurrencyId) {
        return {
          code: "RUB",
          id,
          precision: 2,
        };
      }

      throw new Error(`Unexpected currency id ${id}`);
    });
    documentGenerationWorkflow.generateCalculation.mockResolvedValue({
      fileName: "calculation.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("pdf"),
    });

    const response = await app.request(
      `http://localhost/calculations/${detail.id}/export?format=pdf&lang=ru`,
    );

    expect(response.status).toBe(200);
    expect(documentGenerationWorkflow.generateCalculation).toHaveBeenCalledWith({
      calculationData: {
        additionalExpenses: "0.00",
        additionalExpensesInBase: "0.00",
        baseCurrencyCode: "RUB",
        calculationTimestamp:
          detail.currentSnapshot.calculationTimestamp.toISOString(),
        currencyCode: "USD",
        feeAmount: "1.25",
        feeAmountInBase: "1.00",
        feePercentage: "1.25",
        id: detail.id,
        originalAmount: "100.00",
        rate: "0.81",
        rateSource: "manual",
        totalAmount: "101.25",
        totalInBase: "81.00",
        totalWithExpensesInBase: "81.00",
      },
      format: "pdf",
      lang: "ru",
    });
  });
});
