import { DocumentValidationError } from "@bedrock/documents";
import { normalizeFinancialLine } from "@bedrock/documents/contracts";
import { canonicalJson } from "@bedrock/shared/core/canon";
import { sha256Hex } from "@bedrock/shared/core/crypto";
import { ServiceError } from "@bedrock/shared/core/errors";
import { minorToAmountString } from "@bedrock/shared/money";

type QuoteFinancialLineInput = Parameters<typeof normalizeFinancialLine>[0];

export interface QuoteSnapshotDetails {
  quote: {
    expiresAt: Date;
    fromAmountMinor: bigint;
    fromCurrency?: string | null;
    id: string;
    idempotencyKey: string;
    pricingMode: string;
    pricingTrace: Record<string, unknown> | null;
    rateDen: bigint;
    rateNum: bigint;
    toAmountMinor: bigint;
    toCurrency?: string | null;
  };
  legs: {
    asOf: Date;
    executionCounterpartyId: string | null;
    fromAmountMinor: bigint;
    fromCurrency?: string | null;
    idx: number;
    rateDen: bigint;
    rateNum: bigint;
    sourceKind: string;
    sourceRef: string | null;
    toAmountMinor: bigint;
    toCurrency?: string | null;
  }[];
  financialLines: QuoteFinancialLineInput[];
}

export interface QuoteSnapshotCurrencyLookup {
  findByCode(code: string): Promise<{ precision: number }>;
}

export function buildQuoteSnapshotHash(snapshot: Record<string, unknown>) {
  return sha256Hex(canonicalJson(snapshot));
}

export function rethrowAsDocumentValidationError(error: unknown): never {
  if (error instanceof DocumentValidationError) {
    throw error;
  }

  if (error instanceof ServiceError) {
    throw new DocumentValidationError(error.message);
  }

  throw error;
}

async function buildCurrencyPrecisionMap(
  currenciesService: QuoteSnapshotCurrencyLookup,
  currencyCodes: string[],
) {
  const uniqueCurrencyCodes = [...new Set(currencyCodes)];
  const precisionByCode = new Map<string, number>();

  await Promise.all(
    uniqueCurrencyCodes.map(async (code) => {
      const currency = await currenciesService.findByCode(code);
      precisionByCode.set(code, currency.precision);
    }),
  );

  return precisionByCode;
}

export async function buildQuoteSnapshotBase(input: {
  currenciesService: QuoteSnapshotCurrencyLookup;
  details: QuoteSnapshotDetails;
}) {
  const { currenciesService, details } = input;
  const fromCurrency = details.quote.fromCurrency;
  const toCurrency = details.quote.toCurrency;

  if (!fromCurrency || !toCurrency) {
    throw new DocumentValidationError(
      `Quote ${details.quote.id} is missing currency codes`,
    );
  }

  const precisionByCode = await buildCurrencyPrecisionMap(currenciesService, [
    fromCurrency,
    toCurrency,
    ...details.legs.flatMap((leg) => [
      leg.fromCurrency ?? fromCurrency,
      leg.toCurrency ?? toCurrency,
    ]),
    ...details.financialLines.map((line) => line.currency),
  ]);

  return {
    quoteId: details.quote.id,
    idempotencyKey: details.quote.idempotencyKey,
    fromCurrency,
    toCurrency,
    fromAmountMinor: details.quote.fromAmountMinor.toString(),
    toAmountMinor: details.quote.toAmountMinor.toString(),
    pricingMode: details.quote.pricingMode,
    rateNum: details.quote.rateNum.toString(),
    rateDen: details.quote.rateDen.toString(),
    expiresAt: details.quote.expiresAt.toISOString(),
    pricingTrace: details.quote.pricingTrace ?? {},
    legs: details.legs.map((leg) => ({
      idx: leg.idx,
      fromCurrency: leg.fromCurrency ?? fromCurrency,
      toCurrency: leg.toCurrency ?? toCurrency,
      fromAmountMinor: leg.fromAmountMinor.toString(),
      toAmountMinor: leg.toAmountMinor.toString(),
      rateNum: leg.rateNum.toString(),
      rateDen: leg.rateDen.toString(),
      sourceKind: leg.sourceKind,
      sourceRef: leg.sourceRef ?? null,
      asOf: leg.asOf.toISOString(),
      executionCounterpartyId: leg.executionCounterpartyId ?? null,
    })),
    financialLines: details.financialLines.map((line) => {
      const normalizedLine = normalizeFinancialLine(line);
      const precision = precisionByCode.get(normalizedLine.currency);

      if (precision === undefined) {
        throw new DocumentValidationError(
          `Missing currency precision for ${normalizedLine.currency}`,
        );
      }

      return {
        ...normalizedLine,
        amount: minorToAmountString(normalizedLine.amountMinor, {
          precision,
        }),
        amountMinor: normalizedLine.amountMinor.toString(),
        settlementMode: normalizedLine.settlementMode ?? "in_ledger",
      };
    }),
  };
}
