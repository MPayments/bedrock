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
import { RateSourceSyncError } from "@bedrock/treasury";

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
      agreementVersionId: null,
      agreementFeeBps: "125",
      agreementFeeAmountMinor: "125",
      calculationCurrencyId: "00000000-0000-4000-8000-000000000001",
      originalAmountMinor: "10000",
      totalFeeBps: "125",
      totalFeeAmountMinor: "125",
      totalAmountMinor: "10125",
      baseCurrencyId: "00000000-0000-4000-8000-000000000002",
      totalFeeAmountInBaseMinor: "100",
      totalInBaseMinor: "8100",
      additionalExpensesCurrencyId: null,
      additionalExpensesAmountMinor: "0",
      additionalExpensesInBaseMinor: "0",
      fixedFeeAmountMinor: "0",
      fixedFeeCurrencyId: null,
      quoteMarkupBps: "0",
      quoteMarkupAmountMinor: "0",
      referenceRateSource: null,
      referenceRateNum: null,
      referenceRateDen: null,
      referenceRateAsOf: null,
      pricingProvenance: null,
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
    generateCalculationPrintForm: vi.fn(),
    listCalculationPrintForms: vi.fn(),
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
        agreementVersionId: null,
        agreementFeeBps: "125",
        agreementFeeAmountMinor: "125",
        calculationCurrencyId: detail.currentSnapshot.calculationCurrencyId,
        originalAmountMinor: "10000",
        totalFeeBps: "125",
        totalFeeAmountMinor: "125",
        totalAmountMinor: "10125",
        baseCurrencyId: detail.currentSnapshot.baseCurrencyId,
        totalFeeAmountInBaseMinor: "100",
        totalInBaseMinor: "8100",
        additionalExpensesCurrencyId: null,
        additionalExpensesAmountMinor: "0",
        additionalExpensesInBaseMinor: "0",
        fixedFeeAmountMinor: "0",
        fixedFeeCurrencyId: null,
        pricingProvenance: null,
        quoteMarkupAmountMinor: "0",
        quoteMarkupBps: "0",
        referenceRateAsOf: null,
        referenceRateSource: null,
        referenceRateNum: null,
        referenceRateDen: null,
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
      agreementVersionId: null,
      agreementFeeBps: "125",
      agreementFeeAmountMinor: "125",
      calculationCurrencyId: detail.currentSnapshot.calculationCurrencyId,
      originalAmountMinor: "10000",
      totalFeeBps: "125",
      totalFeeAmountMinor: "125",
      totalAmountMinor: "10125",
      baseCurrencyId: detail.currentSnapshot.baseCurrencyId,
      totalFeeAmountInBaseMinor: "100",
      totalInBaseMinor: "8100",
      additionalExpensesCurrencyId: null,
      additionalExpensesAmountMinor: "0",
      additionalExpensesInBaseMinor: "0",
      fixedFeeAmountMinor: "0",
      fixedFeeCurrencyId: null,
      pricingProvenance: null,
      quoteMarkupAmountMinor: "0",
      quoteMarkupBps: "0",
      referenceRateAsOf: null,
      referenceRateSource: null,
      referenceRateNum: null,
      referenceRateDen: null,
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

  it("returns 503 when calculation creation depends on an unavailable rate source", async () => {
    const { app, calculationsModule } = createTestApp();

    calculationsModule.calculations.commands.create.mockRejectedValue(
      new RateSourceSyncError("cbr", "sync failed"),
    );

    const response = await app.request("http://localhost/calculations", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": "calc-create-cbr",
      },
      body: JSON.stringify({
        agreementVersionId: null,
        agreementFeeBps: "125",
        agreementFeeAmountMinor: "125",
        calculationCurrencyId: "00000000-0000-4000-8000-000000000001",
        originalAmountMinor: "10000",
        totalFeeBps: "125",
        totalFeeAmountMinor: "125",
        totalAmountMinor: "10125",
        baseCurrencyId: "00000000-0000-4000-8000-000000000002",
        totalFeeAmountInBaseMinor: "100",
        totalInBaseMinor: "8100",
        additionalExpensesCurrencyId: null,
        additionalExpensesAmountMinor: "0",
        additionalExpensesInBaseMinor: "0",
        fixedFeeAmountMinor: "0",
        fixedFeeCurrencyId: null,
        pricingProvenance: null,
        quoteMarkupAmountMinor: "0",
        quoteMarkupBps: "0",
        referenceRateAsOf: null,
        referenceRateSource: null,
        referenceRateNum: null,
        referenceRateDen: null,
        totalWithExpensesInBaseMinor: "8100",
        rateSource: "manual",
        rateNum: "81",
        rateDen: "100",
        calculationTimestamp: "2026-03-30T00:00:00.000Z",
        fxQuoteId: null,
      }),
    });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: "cbr: sync failed",
    });
  });

  it("exports calculation print form using canonical document data", async () => {
    const { app, documentGenerationWorkflow } = createTestApp();
    const detail = createCalculationDetail();
    documentGenerationWorkflow.generateCalculationPrintForm.mockResolvedValue({
      fileName: "calculation.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("pdf"),
    });

    const response = await app.request(
      `http://localhost/calculations/${detail.id}/print-forms/calculation.calculation-ru?format=pdf`,
    );

    expect(response.status).toBe(200);
    expect(
      documentGenerationWorkflow.generateCalculationPrintForm,
    ).toHaveBeenCalledWith({
      calculationId: detail.id,
      format: "pdf",
      formId: "calculation.calculation-ru",
    });
  });
});
