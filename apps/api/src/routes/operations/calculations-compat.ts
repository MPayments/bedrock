import { z } from "@hono/zod-openapi";
import {
  and,
  asc,
  desc,
  eq,
  sql,
  type SQL,
} from "drizzle-orm";

import {
  serializeCompatibilityCalculation,
  type CalculationCompatibilityCurrency,
} from "@bedrock/calculations";
import type { Calculation } from "@bedrock/calculations/contracts";
import {
  calculationApplicationLinks,
  calculations,
  calculationSnapshots,
} from "@bedrock/calculations/schema";
import { currencies } from "@bedrock/currencies/schema";
import { opsCalculations } from "@bedrock/operations/schema";
import {
  createPaginatedListSchema,
  type PaginatedList,
} from "@bedrock/shared/core/pagination";
import { toMinorAmountString } from "@bedrock/shared/money";
import {
  effectiveRateFromAmounts,
  mulDivFloor,
  parseDecimalToFraction,
  type Fraction,
} from "@bedrock/shared/money/math";
import { NotFoundError, ValidationError } from "@bedrock/shared/core/errors";
import { fxQuotes } from "@bedrock/treasury/schema";

import type { AppContext } from "../../context";
import { db } from "../../db/client";

const LEGACY_RATE_SOURCE_VALUES = [
  "cbru",
  "investing",
  "xe",
  "manual",
  "fx_quote",
] as const;

const LEGACY_STATUS_VALUES = ["draft", "active", "archived"] as const;

export const CompatibilityCalculationSchema = z.object({
  id: z.string().uuid(),
  applicationId: z.number().int(),
  currencyCode: z.string(),
  originalAmount: z.string(),
  feePercentage: z.string(),
  feeAmount: z.string(),
  totalAmount: z.string(),
  rateSource: z.enum(LEGACY_RATE_SOURCE_VALUES),
  rate: z.string(),
  additionalExpensesCurrencyCode: z.string().nullable(),
  additionalExpenses: z.string(),
  baseCurrencyCode: z.string(),
  feeAmountInBase: z.string(),
  totalInBase: z.string(),
  additionalExpensesInBase: z.string(),
  totalWithExpensesInBase: z.string(),
  calculationTimestamp: z.string(),
  sentToClient: z.number().int(),
  status: z.enum(["active", "archived"]),
  fxQuoteId: z.string().uuid().nullable(),
  createdAt: z.string(),
});

export const PaginatedCompatibilityCalculationsSchema =
  createPaginatedListSchema(CompatibilityCalculationSchema);

export const CompatibilityCalculationsListQuerySchema = z.object({
  applicationId: z.coerce.number().int().optional(),
  status: z.enum(LEGACY_STATUS_VALUES).optional(),
  sortBy: z.enum(["createdAt"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  limit: z.coerce.number().int().min(1).max(200).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const CompatibilityCalculationCreateInputSchema = z.object({
  applicationId: z.number().int(),
  currencyCode: z.string().trim().min(1),
  originalAmount: z.coerce.string(),
  feePercentage: z.coerce.string(),
  feeAmount: z.coerce.string(),
  totalAmount: z.coerce.string(),
  rateSource: z.enum(LEGACY_RATE_SOURCE_VALUES),
  rate: z.coerce.string(),
  additionalExpensesCurrencyCode: z.string().trim().min(1).nullable().optional(),
  additionalExpenses: z.coerce.string(),
  baseCurrencyCode: z.string().trim().min(1).default("RUB"),
  feeAmountInBase: z.coerce.string(),
  totalInBase: z.coerce.string(),
  additionalExpensesInBase: z.coerce.string(),
  totalWithExpensesInBase: z.coerce.string(),
  calculationTimestamp: z.coerce.string(),
  fxQuoteId: z.string().uuid().nullable().optional(),
});

export const CompatibilityCalculationPreviewInputSchema = z.object({
  applicationId: z.number().int().optional(),
  currencyCode: z.string().trim().min(1),
  originalAmount: z.coerce.string(),
  feePercentage: z.coerce.string(),
  rateSource: z.enum(LEGACY_RATE_SOURCE_VALUES),
  manualRate: z.coerce.string().optional(),
  additionalExpenses: z.coerce.string().default("0"),
  additionalExpensesCurrency: z.string().trim().min(1).nullable().optional(),
  additionalExpensesCurrencyCode: z
    .string()
    .trim()
    .min(1)
    .nullable()
    .optional(),
  additionalExpensesManualRate: z.coerce.string().optional(),
  baseCurrencyCode: z.string().trim().min(1).default("RUB"),
  fxQuoteId: z.string().uuid().nullable().optional(),
});

export const CompatibilityCalculationPreviewResultSchema = z.object({
  currencyCode: z.string(),
  originalAmount: z.string(),
  feePercentage: z.string(),
  feeAmount: z.string(),
  totalAmount: z.string(),
  rateSource: z.enum(LEGACY_RATE_SOURCE_VALUES),
  rate: z.string(),
  additionalExpensesCurrencyCode: z.string().nullable(),
  additionalExpensesCurrency: z.string(),
  additionalExpenses: z.string(),
  baseCurrencyCode: z.string(),
  feeAmountInBase: z.string(),
  totalInBase: z.string(),
  additionalExpensesInBase: z.string(),
  totalWithExpensesInBase: z.string(),
  calculationTimestamp: z.string(),
  timestamp: z.string(),
  fxQuoteId: z.string().uuid().nullable(),
});

type CompatibilityCalculation = z.infer<typeof CompatibilityCalculationSchema>;
type CompatibilityCalculationsListQuery = z.infer<
  typeof CompatibilityCalculationsListQuerySchema
>;
type CompatibilityCalculationCreateInput = z.infer<
  typeof CompatibilityCalculationCreateInputSchema
>;
type CompatibilityCalculationPreviewInput = z.infer<
  typeof CompatibilityCalculationPreviewInputSchema
>;

type CompatibilityCalculationRow = {
  id: string;
  applicationId: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  sentToClient: number | null;
  currentSnapshotId: string;
  snapshotNumber: number;
  calculationCurrencyId: string;
  calculationCurrencyCode: string;
  calculationCurrencyPrecision: number;
  originalAmountMinor: bigint;
  feeBps: bigint;
  feeAmountMinor: bigint;
  totalAmountMinor: bigint;
  baseCurrencyId: string;
  baseCurrencyCode: string;
  baseCurrencyPrecision: number;
  feeAmountInBaseMinor: bigint;
  totalInBaseMinor: bigint;
  additionalExpensesCurrencyId: string | null;
  additionalExpensesCurrencyCode: string | null;
  additionalExpensesCurrencyPrecision: number | null;
  additionalExpensesAmountMinor: bigint;
  additionalExpensesInBaseMinor: bigint;
  totalWithExpensesInBaseMinor: bigint;
  rateSource: "cbr" | "investing" | "xe" | "manual" | "fx_quote";
  rateNum: bigint;
  rateDen: bigint;
  additionalExpensesRateSource:
    | "cbr"
    | "investing"
    | "xe"
    | "manual"
    | "fx_quote"
    | null;
  additionalExpensesRateNum: bigint | null;
  additionalExpensesRateDen: bigint | null;
  calculationTimestamp: Date;
  fxQuoteId: string | null;
  snapshotCreatedAt: Date;
  snapshotUpdatedAt: Date;
};

type CanonicalCreatePayload = {
  additionalExpensesAmountMinor: string;
  additionalExpensesCurrencyId: string | null;
  additionalExpensesInBaseMinor: string;
  additionalExpensesRateDen: string | null;
  additionalExpensesRateNum: string | null;
  additionalExpensesRateSource:
    | "cbr"
    | "investing"
    | "xe"
    | "manual"
    | "fx_quote"
    | null;
  baseCurrencyId: string;
  calculationCurrencyId: string;
  calculationTimestamp: Date;
  feeAmountInBaseMinor: string;
  feeAmountMinor: string;
  feeBps: string;
  fxQuoteId: string | null;
  originalAmountMinor: string;
  rateDen: string;
  rateNum: string;
  rateSource: "cbr" | "investing" | "xe" | "manual" | "fx_quote";
  totalAmountMinor: string;
  totalInBaseMinor: string;
  totalWithExpensesInBaseMinor: string;
};

type ResolvedCurrency = {
  code: string;
  id: string;
  precision: number;
};

type ResolvedRate = {
  fxQuoteId: string | null;
  rate: Fraction;
  source: "cbr" | "investing" | "xe" | "manual" | "fx_quote";
};

function createCompatibilityCalculationIdParamSchema(paramName = "id") {
  return z.object({
    [paramName]: z
      .string()
      .uuid()
      .openapi({
        param: {
          name: paramName,
          in: "path",
          example: "00000000-0000-4000-8000-000000000001",
        },
      }),
  });
}

export const CompatibilityCalculationIdParamSchema =
  createCompatibilityCalculationIdParamSchema();

function buildCompatibilityQuery() {
  const calculationCurrency = currencies.as("compat_calculation_currency");
  const baseCurrency = currencies.as("compat_base_currency");
  const additionalExpensesCurrency = currencies.as(
    "compat_additional_expenses_currency",
  );

  return {
    calculationCurrency,
    baseCurrency,
    additionalExpensesCurrency,
    select: {
      id: calculations.id,
      applicationId: calculationApplicationLinks.applicationId,
      isActive: calculations.isActive,
      createdAt: calculations.createdAt,
      updatedAt: calculations.updatedAt,
      sentToClient: opsCalculations.sentToClient,
      currentSnapshotId: calculationSnapshots.id,
      snapshotNumber: calculationSnapshots.snapshotNumber,
      calculationCurrencyId: calculationSnapshots.calculationCurrencyId,
      calculationCurrencyCode: calculationCurrency.code,
      calculationCurrencyPrecision: calculationCurrency.precision,
      originalAmountMinor: calculationSnapshots.originalAmountMinor,
      feeBps: calculationSnapshots.feeBps,
      feeAmountMinor: calculationSnapshots.feeAmountMinor,
      totalAmountMinor: calculationSnapshots.totalAmountMinor,
      baseCurrencyId: calculationSnapshots.baseCurrencyId,
      baseCurrencyCode: baseCurrency.code,
      baseCurrencyPrecision: baseCurrency.precision,
      feeAmountInBaseMinor: calculationSnapshots.feeAmountInBaseMinor,
      totalInBaseMinor: calculationSnapshots.totalInBaseMinor,
      additionalExpensesCurrencyId:
        calculationSnapshots.additionalExpensesCurrencyId,
      additionalExpensesCurrencyCode: additionalExpensesCurrency.code,
      additionalExpensesCurrencyPrecision:
        additionalExpensesCurrency.precision,
      additionalExpensesAmountMinor:
        calculationSnapshots.additionalExpensesAmountMinor,
      additionalExpensesInBaseMinor:
        calculationSnapshots.additionalExpensesInBaseMinor,
      totalWithExpensesInBaseMinor:
        calculationSnapshots.totalWithExpensesInBaseMinor,
      rateSource: calculationSnapshots.rateSource,
      rateNum: calculationSnapshots.rateNum,
      rateDen: calculationSnapshots.rateDen,
      additionalExpensesRateSource:
        calculationSnapshots.additionalExpensesRateSource,
      additionalExpensesRateNum:
        calculationSnapshots.additionalExpensesRateNum,
      additionalExpensesRateDen:
        calculationSnapshots.additionalExpensesRateDen,
      calculationTimestamp: calculationSnapshots.calculationTimestamp,
      fxQuoteId: calculationSnapshots.fxQuoteId,
      snapshotCreatedAt: calculationSnapshots.createdAt,
      snapshotUpdatedAt: calculationSnapshots.updatedAt,
    },
  };
}

function mapCompatibilityCalculationRow(
  row: CompatibilityCalculationRow,
): CompatibilityCalculation {
  const calculation: Calculation = {
    id: row.id,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    currentSnapshot: {
      id: row.currentSnapshotId,
      snapshotNumber: row.snapshotNumber,
      calculationCurrencyId: row.calculationCurrencyId,
      originalAmountMinor: row.originalAmountMinor.toString(),
      feeBps: row.feeBps.toString(),
      feeAmountMinor: row.feeAmountMinor.toString(),
      totalAmountMinor: row.totalAmountMinor.toString(),
      baseCurrencyId: row.baseCurrencyId,
      feeAmountInBaseMinor: row.feeAmountInBaseMinor.toString(),
      totalInBaseMinor: row.totalInBaseMinor.toString(),
      additionalExpensesCurrencyId: row.additionalExpensesCurrencyId,
      additionalExpensesAmountMinor:
        row.additionalExpensesAmountMinor.toString(),
      additionalExpensesInBaseMinor:
        row.additionalExpensesInBaseMinor.toString(),
      totalWithExpensesInBaseMinor:
        row.totalWithExpensesInBaseMinor.toString(),
      rateSource: row.rateSource,
      rateNum: row.rateNum.toString(),
      rateDen: row.rateDen.toString(),
      additionalExpensesRateSource: row.additionalExpensesRateSource,
      additionalExpensesRateNum:
        row.additionalExpensesRateNum?.toString() ?? null,
      additionalExpensesRateDen:
        row.additionalExpensesRateDen?.toString() ?? null,
      calculationTimestamp: row.calculationTimestamp,
      fxQuoteId: row.fxQuoteId,
      createdAt: row.snapshotCreatedAt,
      updatedAt: row.snapshotUpdatedAt,
    },
  };

  const metadata = new Map<string, CalculationCompatibilityCurrency>([
    [
      row.calculationCurrencyId,
      {
        id: row.calculationCurrencyId,
        code: row.calculationCurrencyCode,
        precision: row.calculationCurrencyPrecision,
      },
    ],
    [
      row.baseCurrencyId,
      {
        id: row.baseCurrencyId,
        code: row.baseCurrencyCode,
        precision: row.baseCurrencyPrecision,
      },
    ],
  ]);

  if (
    row.additionalExpensesCurrencyId &&
    row.additionalExpensesCurrencyCode &&
    row.additionalExpensesCurrencyPrecision !== null
  ) {
    metadata.set(row.additionalExpensesCurrencyId, {
      id: row.additionalExpensesCurrencyId,
      code: row.additionalExpensesCurrencyCode,
      precision: row.additionalExpensesCurrencyPrecision,
    });
  }

  return serializeCompatibilityCalculation({
    applicationId: row.applicationId,
    calculation,
    currencies: metadata,
    sentToClient: row.sentToClient ?? 0,
  });
}

function buildCompatibilityConditions(
  input: CompatibilityCalculationsListQuery,
): SQL[] {
  const conditions: SQL[] = [];

  if (input.applicationId !== undefined) {
    conditions.push(
      eq(calculationApplicationLinks.applicationId, input.applicationId),
    );
  }

  if (input.status === "active") {
    conditions.push(eq(calculations.isActive, true));
  } else if (input.status === "archived") {
    conditions.push(eq(calculations.isActive, false));
  } else if (input.status === "draft") {
    conditions.push(sql`1 = 0`);
  }

  return conditions;
}

async function resolveCurrencyByCode(
  ctx: AppContext,
  code: string,
): Promise<ResolvedCurrency> {
  const currency = await ctx.currenciesService.findByCode(code.trim().toUpperCase());

  return {
    id: currency.id,
    code: currency.code,
    precision: currency.precision,
  };
}

async function resolveQuoteRate(
  input: {
    calculationCurrencyId: string;
    baseCurrencyId: string;
    fxQuoteId: string | null | undefined;
  },
): Promise<ResolvedRate> {
  const fxQuoteId = input.fxQuoteId ?? null;
  if (!fxQuoteId) {
    throw new ValidationError("fxQuoteId is required when rateSource is fx_quote");
  }

  const [quote] = await db
    .select({
      id: fxQuotes.id,
      fromCurrencyId: fxQuotes.fromCurrencyId,
      toCurrencyId: fxQuotes.toCurrencyId,
      rateNum: fxQuotes.rateNum,
      rateDen: fxQuotes.rateDen,
    })
    .from(fxQuotes)
    .where(eq(fxQuotes.id, fxQuoteId))
    .limit(1);

  if (!quote) {
    throw new NotFoundError("FX quote", fxQuoteId);
  }

  if (
    quote.fromCurrencyId !== input.calculationCurrencyId ||
    quote.toCurrencyId !== input.baseCurrencyId
  ) {
    throw new ValidationError(
      "FX quote currencies do not match the calculation currency pair",
    );
  }

  return {
    source: "fx_quote",
    rate: {
      num: quote.rateNum,
      den: quote.rateDen,
    },
    fxQuoteId,
  };
}

function normalizeLegacyRateSource(
  input: string,
): "cbr" | "investing" | "xe" | "manual" | "fx_quote" {
  if (input === "cbru") {
    return "cbr";
  }

  if (
    input === "cbr" ||
    input === "investing" ||
    input === "xe" ||
    input === "manual" ||
    input === "fx_quote"
  ) {
    return input;
  }

  throw new ValidationError(`Unsupported rate source: ${input}`);
}

function normalizePreviewAdditionalExpensesCurrencyCode(
  input: CompatibilityCalculationPreviewInput,
): string | null {
  const raw =
    input.additionalExpensesCurrencyCode ?? input.additionalExpensesCurrency;
  const normalized = raw?.trim().toUpperCase() ?? null;

  if (!normalized || normalized === "NONE") {
    return null;
  }

  return normalized;
}

function parseRateFraction(value: string, fieldName: string): Fraction {
  try {
    return parseDecimalToFraction(value);
  } catch (error) {
    throw new ValidationError(
      error instanceof Error
        ? `${fieldName}: ${error.message}`
        : `${fieldName} is invalid`,
    );
  }
}

function parseFeeBps(value: string): bigint {
  const feeBps = BigInt(toMinorAmountString(value, undefined));
  if (feeBps < 0n) {
    throw new ValidationError("feePercentage must be non-negative");
  }

  return feeBps;
}

function convertAmountMinor(
  amountMinor: bigint,
  rate: Fraction,
): bigint {
  return mulDivFloor(amountMinor, rate.num, rate.den);
}

async function resolvePrimaryRate(
  ctx: AppContext,
  input: {
    baseCurrency: ResolvedCurrency;
    calculationCurrency: ResolvedCurrency;
    fxQuoteId: string | null | undefined;
    manualRate?: string | undefined;
    requestedRateSource: string;
  },
): Promise<ResolvedRate> {
  const requestedRateSource = normalizeLegacyRateSource(input.requestedRateSource);

  if (input.calculationCurrency.id === input.baseCurrency.id) {
    return {
      source: requestedRateSource === "fx_quote" ? "manual" : requestedRateSource,
      rate: { num: 1n, den: 1n },
      fxQuoteId: null,
    };
  }

  if (requestedRateSource === "manual") {
    if (!input.manualRate) {
      throw new ValidationError("manualRate is required when rateSource is manual");
    }

    return {
      source: "manual",
      rate: parseRateFraction(input.manualRate, "manualRate"),
      fxQuoteId: null,
    };
  }

  if (requestedRateSource === "fx_quote") {
    return resolveQuoteRate({
      calculationCurrencyId: input.calculationCurrency.id,
      baseCurrencyId: input.baseCurrency.id,
      fxQuoteId: input.fxQuoteId,
    });
  }

  const rate = await ctx.treasuryModule.rates.queries.getLatestRate(
    input.calculationCurrency.code,
    input.baseCurrency.code,
    new Date(),
  );

  return {
    source: normalizeLegacyRateSource(rate.source),
    rate: {
      num: rate.rateNum,
      den: rate.rateDen,
    },
    fxQuoteId: null,
  };
}

async function resolveAdditionalExpensesRate(
  ctx: AppContext,
  input: {
    additionalExpensesAmountMinor: bigint;
    additionalExpensesCurrency: ResolvedCurrency | null;
    additionalExpensesManualRate?: string | undefined;
    baseCurrency: ResolvedCurrency;
    fxQuoteId: string | null;
    primaryRate: ResolvedRate;
    calculationCurrency: ResolvedCurrency;
    requestedRateSource: string;
  },
): Promise<{
  additionalExpensesCurrencyId: string | null;
  additionalExpensesInBaseMinor: bigint;
  additionalExpensesRateDen: bigint | null;
  additionalExpensesRateNum: bigint | null;
  additionalExpensesRateSource:
    | "cbr"
    | "investing"
    | "xe"
    | "manual"
    | "fx_quote"
    | null;
}> {
  if (input.additionalExpensesAmountMinor === 0n) {
    return {
      additionalExpensesCurrencyId: null,
      additionalExpensesInBaseMinor: 0n,
      additionalExpensesRateDen: null,
      additionalExpensesRateNum: null,
      additionalExpensesRateSource: null,
    };
  }

  if (
    !input.additionalExpensesCurrency ||
    input.additionalExpensesCurrency.id === input.baseCurrency.id
  ) {
    return {
      additionalExpensesCurrencyId: null,
      additionalExpensesInBaseMinor: input.additionalExpensesAmountMinor,
      additionalExpensesRateDen: null,
      additionalExpensesRateNum: null,
      additionalExpensesRateSource: null,
    };
  }

  if (input.additionalExpensesCurrency.id === input.calculationCurrency.id) {
    return {
      additionalExpensesCurrencyId: input.additionalExpensesCurrency.id,
      additionalExpensesInBaseMinor: convertAmountMinor(
        input.additionalExpensesAmountMinor,
        input.primaryRate.rate,
      ),
      additionalExpensesRateSource: input.primaryRate.source,
      additionalExpensesRateNum: input.primaryRate.rate.num,
      additionalExpensesRateDen: input.primaryRate.rate.den,
    };
  }

  const requestedRateSource = normalizeLegacyRateSource(input.requestedRateSource);

  if (requestedRateSource === "manual") {
    if (!input.additionalExpensesManualRate) {
      throw new ValidationError(
        "additionalExpensesManualRate is required when additional expenses are manual and not base-denominated",
      );
    }

    const rate = parseRateFraction(
      input.additionalExpensesManualRate,
      "additionalExpensesManualRate",
    );

    return {
      additionalExpensesCurrencyId: input.additionalExpensesCurrency.id,
      additionalExpensesInBaseMinor: convertAmountMinor(
        input.additionalExpensesAmountMinor,
        rate,
      ),
      additionalExpensesRateSource: "manual",
      additionalExpensesRateNum: rate.num,
      additionalExpensesRateDen: rate.den,
    };
  }

  if (requestedRateSource === "fx_quote") {
    throw new ValidationError(
      "A single fx_quote cannot justify additional expenses in a different currency pair",
    );
  }

  const rate = await ctx.treasuryModule.rates.queries.getLatestRate(
    input.additionalExpensesCurrency.code,
    input.baseCurrency.code,
    new Date(),
  );

  return {
    additionalExpensesCurrencyId: input.additionalExpensesCurrency.id,
    additionalExpensesInBaseMinor: convertAmountMinor(
      input.additionalExpensesAmountMinor,
      {
        num: rate.rateNum,
        den: rate.rateDen,
      },
    ),
    additionalExpensesRateSource: normalizeLegacyRateSource(rate.source),
    additionalExpensesRateNum: rate.rateNum,
    additionalExpensesRateDen: rate.rateDen,
  };
}

async function buildCanonicalPayloadFromPreviewInput(
  ctx: AppContext,
  raw: CompatibilityCalculationPreviewInput,
): Promise<{
  additionalExpensesCurrency: ResolvedCurrency | null;
  applicationId: number | null;
  baseCurrency: ResolvedCurrency;
  calculationCurrency: ResolvedCurrency;
  payload: CanonicalCreatePayload;
}> {
  const input = CompatibilityCalculationPreviewInputSchema.parse(raw);
  const calculationCurrency = await resolveCurrencyByCode(
    ctx,
    input.currencyCode,
  );
  const baseCurrency = await resolveCurrencyByCode(ctx, input.baseCurrencyCode);
  const additionalExpensesCurrencyCode =
    normalizePreviewAdditionalExpensesCurrencyCode(input);
  const additionalExpensesCurrency = additionalExpensesCurrencyCode
    ? await resolveCurrencyByCode(ctx, additionalExpensesCurrencyCode)
    : null;

  const originalAmountMinor = BigInt(
    toMinorAmountString(input.originalAmount, calculationCurrency.code, {
      requirePositive: true,
    }),
  );
  const feeBps = parseFeeBps(input.feePercentage);
  const feeAmountMinor = mulDivFloor(originalAmountMinor, feeBps, 10000n);
  const totalAmountMinor = originalAmountMinor + feeAmountMinor;
  const primaryRate = await resolvePrimaryRate(ctx, {
    calculationCurrency,
    baseCurrency,
    fxQuoteId: input.fxQuoteId,
    manualRate: input.manualRate,
    requestedRateSource: input.rateSource,
  });

  const feeAmountInBaseMinor = convertAmountMinor(
    feeAmountMinor,
    primaryRate.rate,
  );
  const totalInBaseMinor = convertAmountMinor(
    totalAmountMinor,
    primaryRate.rate,
  );

  const additionalExpensesAmountMinor = BigInt(
    toMinorAmountString(
      input.additionalExpenses,
      additionalExpensesCurrency?.code ?? baseCurrency.code,
    ),
  );
  const additionalExpensesResolved = await resolveAdditionalExpensesRate(ctx, {
    additionalExpensesAmountMinor,
    additionalExpensesCurrency,
    additionalExpensesManualRate: input.additionalExpensesManualRate,
    baseCurrency,
    fxQuoteId: primaryRate.fxQuoteId,
    primaryRate,
    calculationCurrency,
    requestedRateSource: input.rateSource,
  });

  const totalWithExpensesInBaseMinor =
    totalInBaseMinor + additionalExpensesResolved.additionalExpensesInBaseMinor;

  return {
    applicationId: input.applicationId ?? null,
    calculationCurrency,
    baseCurrency,
    additionalExpensesCurrency,
    payload: {
      calculationCurrencyId: calculationCurrency.id,
      originalAmountMinor: originalAmountMinor.toString(),
      feeBps: feeBps.toString(),
      feeAmountMinor: feeAmountMinor.toString(),
      totalAmountMinor: totalAmountMinor.toString(),
      baseCurrencyId: baseCurrency.id,
      feeAmountInBaseMinor: feeAmountInBaseMinor.toString(),
      totalInBaseMinor: totalInBaseMinor.toString(),
      additionalExpensesCurrencyId:
        additionalExpensesResolved.additionalExpensesCurrencyId,
      additionalExpensesAmountMinor: additionalExpensesAmountMinor.toString(),
      additionalExpensesInBaseMinor:
        additionalExpensesResolved.additionalExpensesInBaseMinor.toString(),
      totalWithExpensesInBaseMinor:
        totalWithExpensesInBaseMinor.toString(),
      rateSource: primaryRate.source,
      rateNum: primaryRate.rate.num.toString(),
      rateDen: primaryRate.rate.den.toString(),
      additionalExpensesRateSource:
        additionalExpensesResolved.additionalExpensesRateSource,
      additionalExpensesRateNum:
        additionalExpensesResolved.additionalExpensesRateNum?.toString() ?? null,
      additionalExpensesRateDen:
        additionalExpensesResolved.additionalExpensesRateDen?.toString() ?? null,
      calculationTimestamp: new Date(),
      fxQuoteId: primaryRate.fxQuoteId,
    },
  };
}

async function buildCanonicalPayloadFromCompatibilityInput(
  ctx: AppContext,
  raw: CompatibilityCalculationCreateInput,
): Promise<{
  applicationId: number;
  payload: CanonicalCreatePayload;
}> {
  const input = CompatibilityCalculationCreateInputSchema.parse(raw);
  const calculationCurrency = await resolveCurrencyByCode(
    ctx,
    input.currencyCode,
  );
  const baseCurrency = await resolveCurrencyByCode(ctx, input.baseCurrencyCode);
  const originalAmountMinor = BigInt(
    toMinorAmountString(input.originalAmount, calculationCurrency.code, {
      requirePositive: true,
    }),
  );
  const additionalExpensesAmountMinor = BigInt(
    toMinorAmountString(
      input.additionalExpenses,
      input.additionalExpensesCurrencyCode
        ? input.additionalExpensesCurrencyCode
        : baseCurrency.code,
    ),
  );
  const additionalExpensesInBaseMinor = BigInt(
    toMinorAmountString(input.additionalExpensesInBase, baseCurrency.code),
  );
  const calculationRateSource = normalizeLegacyRateSource(input.rateSource);
  const primaryRate = parseRateFraction(input.rate, "rate");
  const feeBps = parseFeeBps(input.feePercentage);

  let fxQuoteId = input.fxQuoteId ?? null;
  if (calculationRateSource === "fx_quote") {
    await resolveQuoteRate({
      calculationCurrencyId: calculationCurrency.id,
      baseCurrencyId: baseCurrency.id,
      fxQuoteId,
    });
  } else {
    fxQuoteId = null;
  }

  let additionalExpensesCurrencyId: string | null = null;
  let additionalExpensesRateSource:
    | "cbr"
    | "investing"
    | "xe"
    | "manual"
    | "fx_quote"
    | null = null;
  let additionalExpensesRateNum: bigint | null = null;
  let additionalExpensesRateDen: bigint | null = null;

  const additionalExpensesCurrencyCode = input.additionalExpensesCurrencyCode
    ?.trim()
    .toUpperCase();

  if (
    additionalExpensesAmountMinor > 0n &&
    additionalExpensesCurrencyCode &&
    additionalExpensesCurrencyCode !== baseCurrency.code
  ) {
    const additionalExpensesCurrency = await resolveCurrencyByCode(
      ctx,
      additionalExpensesCurrencyCode,
    );

    additionalExpensesCurrencyId = additionalExpensesCurrency.id;

    if (additionalExpensesCurrency.id === calculationCurrency.id) {
      additionalExpensesRateSource = calculationRateSource;
      additionalExpensesRateNum = primaryRate.num;
      additionalExpensesRateDen = primaryRate.den;
    } else if (calculationRateSource === "fx_quote") {
      throw new ValidationError(
        "fx_quote calculations cannot derive additional expenses for a different currency pair from the legacy compatibility payload",
      );
    } else {
      if (additionalExpensesInBaseMinor <= 0n) {
        throw new ValidationError(
          "additionalExpensesInBase must be positive when additional expenses use a non-base currency",
        );
      }

      const additionalExpensesRate = effectiveRateFromAmounts(
        additionalExpensesAmountMinor,
        additionalExpensesInBaseMinor,
      );
      additionalExpensesRateSource = calculationRateSource;
      additionalExpensesRateNum = additionalExpensesRate.rateNum;
      additionalExpensesRateDen = additionalExpensesRate.rateDen;
    }
  }

  return {
    applicationId: input.applicationId,
    payload: {
      calculationCurrencyId: calculationCurrency.id,
      originalAmountMinor: originalAmountMinor.toString(),
      feeBps: feeBps.toString(),
      feeAmountMinor: toMinorAmountString(
        input.feeAmount,
        calculationCurrency.code,
      ),
      totalAmountMinor: toMinorAmountString(
        input.totalAmount,
        calculationCurrency.code,
      ),
      baseCurrencyId: baseCurrency.id,
      feeAmountInBaseMinor: toMinorAmountString(
        input.feeAmountInBase,
        baseCurrency.code,
      ),
      totalInBaseMinor: toMinorAmountString(input.totalInBase, baseCurrency.code),
      additionalExpensesCurrencyId,
      additionalExpensesAmountMinor: additionalExpensesAmountMinor.toString(),
      additionalExpensesInBaseMinor:
        additionalExpensesInBaseMinor.toString(),
      totalWithExpensesInBaseMinor: toMinorAmountString(
        input.totalWithExpensesInBase,
        baseCurrency.code,
      ),
      rateSource: calculationRateSource,
      rateNum: primaryRate.num.toString(),
      rateDen: primaryRate.den.toString(),
      additionalExpensesRateSource,
      additionalExpensesRateNum:
        additionalExpensesRateNum?.toString() ?? null,
      additionalExpensesRateDen:
        additionalExpensesRateDen?.toString() ?? null,
      calculationTimestamp: new Date(input.calculationTimestamp),
      fxQuoteId,
    },
  };
}

function buildPreviewResponse(input: {
  additionalExpensesCurrency: ResolvedCurrency | null;
  baseCurrency: ResolvedCurrency;
  calculationCurrency: ResolvedCurrency;
  payload: CanonicalCreatePayload;
}): z.infer<typeof CompatibilityCalculationPreviewResultSchema> {
  const now = input.payload.calculationTimestamp;
  const calculation: Calculation = {
    id: "00000000-0000-4000-8000-000000000000",
    isActive: true,
    createdAt: now,
    updatedAt: now,
    currentSnapshot: {
      id: "00000000-0000-4000-8000-000000000001",
      snapshotNumber: 1,
      calculationCurrencyId: input.payload.calculationCurrencyId,
      originalAmountMinor: input.payload.originalAmountMinor,
      feeBps: input.payload.feeBps,
      feeAmountMinor: input.payload.feeAmountMinor,
      totalAmountMinor: input.payload.totalAmountMinor,
      baseCurrencyId: input.payload.baseCurrencyId,
      feeAmountInBaseMinor: input.payload.feeAmountInBaseMinor,
      totalInBaseMinor: input.payload.totalInBaseMinor,
      additionalExpensesCurrencyId: input.payload.additionalExpensesCurrencyId,
      additionalExpensesAmountMinor: input.payload.additionalExpensesAmountMinor,
      additionalExpensesInBaseMinor:
        input.payload.additionalExpensesInBaseMinor,
      totalWithExpensesInBaseMinor:
        input.payload.totalWithExpensesInBaseMinor,
      rateSource: input.payload.rateSource,
      rateNum: input.payload.rateNum,
      rateDen: input.payload.rateDen,
      additionalExpensesRateSource:
        input.payload.additionalExpensesRateSource,
      additionalExpensesRateNum: input.payload.additionalExpensesRateNum,
      additionalExpensesRateDen: input.payload.additionalExpensesRateDen,
      calculationTimestamp: input.payload.calculationTimestamp,
      fxQuoteId: input.payload.fxQuoteId,
      createdAt: now,
      updatedAt: now,
    },
  };

  const serialized = serializeCompatibilityCalculation({
    applicationId: null,
    calculation,
    currencies: new Map<string, CalculationCompatibilityCurrency>([
      [
        input.calculationCurrency.id,
        {
          id: input.calculationCurrency.id,
          code: input.calculationCurrency.code,
          precision: input.calculationCurrency.precision,
        },
      ],
      [
        input.baseCurrency.id,
        {
          id: input.baseCurrency.id,
          code: input.baseCurrency.code,
          precision: input.baseCurrency.precision,
        },
      ],
      ...(input.additionalExpensesCurrency
        ? [
            [
              input.additionalExpensesCurrency.id,
              {
                id: input.additionalExpensesCurrency.id,
                code: input.additionalExpensesCurrency.code,
                precision: input.additionalExpensesCurrency.precision,
              },
            ] as const,
          ]
        : []),
    ]),
    sentToClient: 0,
  });

  return {
    currencyCode: serialized.currencyCode,
    originalAmount: serialized.originalAmount,
    feePercentage: serialized.feePercentage,
    feeAmount: serialized.feeAmount,
    totalAmount: serialized.totalAmount,
    rateSource: serialized.rateSource as (typeof LEGACY_RATE_SOURCE_VALUES)[number],
    rate: serialized.rate,
    additionalExpensesCurrencyCode: serialized.additionalExpensesCurrencyCode,
    additionalExpensesCurrency:
      serialized.additionalExpensesCurrencyCode ?? serialized.baseCurrencyCode,
    additionalExpenses: serialized.additionalExpenses,
    baseCurrencyCode: serialized.baseCurrencyCode,
    feeAmountInBase: serialized.feeAmountInBase,
    totalInBase: serialized.totalInBase,
    additionalExpensesInBase: serialized.additionalExpensesInBase,
    totalWithExpensesInBase: serialized.totalWithExpensesInBase,
    calculationTimestamp: serialized.calculationTimestamp,
    timestamp: serialized.calculationTimestamp,
    fxQuoteId: serialized.fxQuoteId,
  };
}

export async function previewCompatibilityCalculation(
  ctx: AppContext,
  raw: CompatibilityCalculationPreviewInput,
) {
  const preview = await buildCanonicalPayloadFromPreviewInput(ctx, raw);
  return buildPreviewResponse(preview);
}

export async function createCompatibilityCalculation(
  ctx: AppContext,
  raw: CompatibilityCalculationCreateInput,
  actorUserId: string,
  idempotencyKey: string,
) {
  const input = CompatibilityCalculationCreateInputSchema.parse(raw);
  const application =
    await ctx.operationsModule.applications.queries.findById(input.applicationId);
  if (!application) {
    throw new NotFoundError("Application", String(input.applicationId));
  }

  const { applicationId, payload } =
    await buildCanonicalPayloadFromCompatibilityInput(ctx, input);

  await ctx.calculationsModule.calculations.commands.createForApplication({
    ...payload,
    actorUserId,
    applicationId,
    idempotencyKey,
  });

  return findCompatibilityCalculationByApplicationAndNewest(applicationId);
}

async function findCompatibilityCalculationByApplicationAndNewest(
  applicationId: number,
) {
  const calculations = await listCompatibilityCalculationsByApplicationId(
    applicationId,
  );
  const [latest] = calculations;
  if (!latest) {
    throw new NotFoundError("Calculation", `application:${applicationId}`);
  }

  return latest;
}

export async function createCompatibilityCalculationForApplication(
  ctx: AppContext,
  applicationId: number,
  raw: Omit<CompatibilityCalculationPreviewInput, "applicationId">,
  actorUserId: string,
  idempotencyKey: string,
) {
  const application =
    await ctx.operationsModule.applications.queries.findById(applicationId);
  if (!application) {
    throw new NotFoundError("Application", String(applicationId));
  }

  const preview = await buildCanonicalPayloadFromPreviewInput(ctx, {
    ...raw,
    applicationId,
  });

  await ctx.calculationsModule.calculations.commands.createForApplication({
    ...preview.payload,
    actorUserId,
    applicationId,
    idempotencyKey,
  });

  return findCompatibilityCalculationByApplicationAndNewest(applicationId);
}

export async function archiveCompatibilityCalculation(
  ctx: AppContext,
  calculationId: string,
) {
  const calculation = await findCompatibilityCalculationById(calculationId);
  if (!calculation) {
    throw new NotFoundError("Calculation", calculationId);
  }

  await ctx.calculationsModule.calculations.commands.archive(calculationId);
}

export async function findCompatibilityCalculationById(
  id: string,
): Promise<CompatibilityCalculation | null> {
  const { additionalExpensesCurrency, baseCurrency, calculationCurrency, select } =
    buildCompatibilityQuery();

  const [row] = await db
    .select(select)
    .from(calculations)
    .innerJoin(
      calculationApplicationLinks,
      eq(calculationApplicationLinks.calculationId, calculations.id),
    )
    .innerJoin(
      calculationSnapshots,
      eq(calculations.currentSnapshotId, calculationSnapshots.id),
    )
    .innerJoin(
      calculationCurrency,
      eq(calculationSnapshots.calculationCurrencyId, calculationCurrency.id),
    )
    .innerJoin(
      baseCurrency,
      eq(calculationSnapshots.baseCurrencyId, baseCurrency.id),
    )
    .leftJoin(
      additionalExpensesCurrency,
      eq(
        calculationSnapshots.additionalExpensesCurrencyId,
        additionalExpensesCurrency.id,
      ),
    )
    .leftJoin(opsCalculations, eq(opsCalculations.calculationId, calculations.id))
    .where(eq(calculations.id, id))
    .limit(1);

  return row
    ? mapCompatibilityCalculationRow(row as CompatibilityCalculationRow)
    : null;
}

export async function listCompatibilityCalculations(
  input: CompatibilityCalculationsListQuery,
): Promise<PaginatedList<CompatibilityCalculation>> {
  const query = CompatibilityCalculationsListQuerySchema.parse(input);
  const conditions = buildCompatibilityConditions(query);
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const orderBy =
    query.sortOrder === "asc" ? asc(calculations.createdAt) : desc(calculations.createdAt);
  const orderById =
    query.sortOrder === "asc" ? asc(calculations.id) : desc(calculations.id);
  const { additionalExpensesCurrency, baseCurrency, calculationCurrency, select } =
    buildCompatibilityQuery();

  const [rows, countRows] = await Promise.all([
    db
      .select(select)
      .from(calculations)
      .innerJoin(
        calculationApplicationLinks,
        eq(calculationApplicationLinks.calculationId, calculations.id),
      )
      .innerJoin(
        calculationSnapshots,
        eq(calculations.currentSnapshotId, calculationSnapshots.id),
      )
      .innerJoin(
        calculationCurrency,
        eq(calculationSnapshots.calculationCurrencyId, calculationCurrency.id),
      )
      .innerJoin(
        baseCurrency,
        eq(calculationSnapshots.baseCurrencyId, baseCurrency.id),
      )
      .leftJoin(
        additionalExpensesCurrency,
        eq(
          calculationSnapshots.additionalExpensesCurrencyId,
          additionalExpensesCurrency.id,
        ),
      )
      .leftJoin(
        opsCalculations,
        eq(opsCalculations.calculationId, calculations.id),
      )
      .where(where)
      .orderBy(orderBy, orderById)
      .limit(query.limit)
      .offset(query.offset),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(calculations)
      .innerJoin(
        calculationApplicationLinks,
        eq(calculationApplicationLinks.calculationId, calculations.id),
      )
      .where(where),
  ]);

  return {
    data: (rows as CompatibilityCalculationRow[]).map(
      mapCompatibilityCalculationRow,
    ),
    total: countRows[0]?.total ?? 0,
    limit: query.limit,
    offset: query.offset,
  };
}

export async function listCompatibilityCalculationsByApplicationId(
  applicationId: number,
): Promise<CompatibilityCalculation[]> {
  const result = await listCompatibilityCalculations({
    applicationId,
    limit: 200,
    offset: 0,
    sortBy: "createdAt",
    sortOrder: "desc",
  });

  return result.data;
}

export function assertCompatibilityCalculationBelongsToApplication(
  calculation: CompatibilityCalculation | null,
  applicationId: number,
) {
  if (!calculation || calculation.applicationId !== applicationId) {
    throw new NotFoundError(
      "Calculation",
      `application:${applicationId}`,
    );
  }
}
