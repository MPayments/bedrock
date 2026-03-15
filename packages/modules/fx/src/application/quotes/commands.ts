import {
  aggregateFinancialLines,
  type FinancialLine,
} from "@bedrock/documents/contracts";
import {
  effectiveRateFromAmounts,
  mulDivFloor,
} from "@bedrock/shared/money/math";

import { NotFoundError, QuoteExpiredError } from "../../errors";
import { financialLineFromFeeComponent } from "../../domain/financial-lines";
import {
  buildAutoCrossTrace,
  computeExplicitRouteLegs,
} from "../../domain/routes";
import type { CrossRate, FxQuoteRecord } from "../ports";
import type { FxServiceContext } from "../shared/context";
import {
  type MarkQuoteUsedInput,
  type QuoteInput,
  validateMarkQuoteUsedInput,
  validateQuoteInput,
} from "../validation";

const DEFAULT_QUOTE_TTL_SECONDS = 600;

interface QuoteHandlersDeps {
  getCrossRate: (
    base: string,
    quote: string,
    asOf: Date,
    anchor?: string,
  ) => Promise<CrossRate>;
  withQuoteCurrencyCodes: (quote: FxQuoteRecord) => Promise<FxQuoteRecord>;
}

export function createFxQuoteCommandHandlers(
  context: FxServiceContext,
  deps: QuoteHandlersDeps,
) {
  const {
    feesService,
    currenciesService,
    log,
    quotesRepository,
    quoteFinancialLinesRepository,
    transactions,
  } = context;

  async function quote(input: QuoteInput): Promise<FxQuoteRecord> {
    const validated = validateQuoteInput(input);

    let legs = [] as ReturnType<typeof computeExplicitRouteLegs>;
    let toAmountMinor = 0n;
    let rateNum = 1n;
    let rateDen = 1n;
    let pricingTrace: Record<string, unknown>;

    if (validated.mode === "auto_cross") {
      const cross = await deps.getCrossRate(
        validated.fromCurrency,
        validated.toCurrency,
        validated.asOf,
        validated.anchor ?? "USD",
      );
      toAmountMinor = mulDivFloor(
        validated.fromAmountMinor,
        cross.rateNum,
        cross.rateDen,
      );
      const effectiveRate = effectiveRateFromAmounts(
        validated.fromAmountMinor,
        toAmountMinor,
      );
      rateNum = effectiveRate.rateNum;
      rateDen = effectiveRate.rateDen;

      legs = [
        {
          idx: 1,
          fromCurrency: validated.fromCurrency,
          toCurrency: validated.toCurrency,
          fromAmountMinor: validated.fromAmountMinor,
          toAmountMinor,
          rateNum,
          rateDen,
          sourceKind: "derived",
          sourceRef: validated.anchor ?? "USD",
          asOf: validated.asOf,
          executionCounterpartyId: null,
        },
      ];
      pricingTrace =
        validated.pricingTrace ??
        buildAutoCrossTrace(validated, cross.rateNum, cross.rateDen);
    } else {
      legs = computeExplicitRouteLegs(validated);
      toAmountMinor = legs[legs.length - 1]!.toAmountMinor;
      const effectiveRate = effectiveRateFromAmounts(
        validated.fromAmountMinor,
        toAmountMinor,
      );
      rateNum = effectiveRate.rateNum;
      rateDen = effectiveRate.rateDen;
      pricingTrace = validated.pricingTrace;
    }

    const feeComponents = await feesService.calculateFxQuoteFeeComponents({
      fromCurrency: validated.fromCurrency,
      toCurrency: validated.toCurrency,
      principalMinor: validated.fromAmountMinor,
      dealDirection: validated.dealDirection,
      dealForm: validated.dealForm,
      at: validated.asOf,
    });
    const computedFinancialLines = feeComponents.map(
      financialLineFromFeeComponent,
    );
    const financialLines = aggregateFinancialLines([
      ...computedFinancialLines,
      ...(validated.manualFinancialLines ?? []),
    ]) as FinancialLine[];

    const ttlSeconds = validated.ttlSeconds ?? DEFAULT_QUOTE_TTL_SECONDS;
    const expiresAt = new Date(validated.asOf.getTime() + ttlSeconds * 1000);

    return transactions.runInTransaction(async (tx) => {
      const currencyCodes = [
        validated.fromCurrency,
        validated.toCurrency,
        ...legs.flatMap((leg) => [leg.fromCurrency, leg.toCurrency]),
      ];
      const uniqueCurrencyCodes = [...new Set(currencyCodes)];
      const currencyIdByCode = new Map<string, string>();
      await Promise.all(
        uniqueCurrencyCodes.map(async (code) => {
          const currency = await currenciesService.findByCode(code);
          currencyIdByCode.set(currency.code, currency.id);
        }),
      );

      const created = await quotesRepository.insertQuote(
        {
          fromCurrencyId: currencyIdByCode.get(validated.fromCurrency)!,
          toCurrencyId: currencyIdByCode.get(validated.toCurrency)!,
          fromAmountMinor: validated.fromAmountMinor,
          toAmountMinor,
          pricingMode: validated.mode,
          pricingTrace,
          dealDirection: validated.dealDirection ?? null,
          dealForm: validated.dealForm ?? null,
          rateNum,
          rateDen,
          expiresAt,
          status: "active",
          idempotencyKey: validated.idempotencyKey,
        },
        tx,
      );

      if (created) {
        await quotesRepository.insertQuoteLegs(
          legs.map((leg) => ({
            quoteId: created.id,
            idx: leg.idx,
            fromCurrencyId: currencyIdByCode.get(leg.fromCurrency)!,
            toCurrencyId: currencyIdByCode.get(leg.toCurrency)!,
            fromAmountMinor: leg.fromAmountMinor,
            toAmountMinor: leg.toAmountMinor,
            rateNum: leg.rateNum,
            rateDen: leg.rateDen,
            sourceKind: leg.sourceKind,
            sourceRef: leg.sourceRef,
            asOf: leg.asOf,
            executionCounterpartyId: leg.executionCounterpartyId,
          })),
          tx,
        );

        await feesService.saveQuoteFeeComponents(
          {
            quoteId: created.id,
            components: feeComponents,
          },
          tx,
        );

        const normalizedFinancialLines = aggregateFinancialLines(financialLines);
        const financialLineCurrencyIds = new Map<string, string>();
        await Promise.all(
          [...new Set(normalizedFinancialLines.map((line) => line.currency))].map(
            async (code) => {
              const currency = await currenciesService.findByCode(code);
              financialLineCurrencyIds.set(currency.code, currency.id);
            },
          ),
        );
        await quoteFinancialLinesRepository.replaceQuoteFinancialLines(
          {
            quoteId: created.id,
            financialLines: normalizedFinancialLines.map((line, index) => ({
              quoteId: created.id,
              idx: index + 1,
              bucket: line.bucket,
              currencyId: financialLineCurrencyIds.get(line.currency)!,
              amountMinor: line.amountMinor,
              source: line.source,
              settlementMode: line.settlementMode ?? "in_ledger",
              memo: line.memo ?? null,
              metadata: line.metadata ?? null,
            })),
          },
          tx,
        );

        log.info("FX quote created", {
          quoteId: created.id,
          mode: validated.mode,
          legs: legs.length,
          feeComponents: feeComponents.length,
          financialLines: financialLines.length,
        });
        return deps.withQuoteCurrencyCodes(created);
      }

      const racedExisting = await quotesRepository.findQuoteByIdempotencyKey(
        validated.idempotencyKey,
        tx,
      );

      if (!racedExisting) {
        throw new Error(
          `Quote insert conflict without existing idempotency row: ${validated.idempotencyKey}`,
        );
      }

      return deps.withQuoteCurrencyCodes(racedExisting);
    });
  }

  async function markQuoteUsed(
    input: MarkQuoteUsedInput,
  ): Promise<FxQuoteRecord> {
    const validated = validateMarkQuoteUsedInput(input);
    const quoteRow = await quotesRepository.findQuoteById(validated.quoteId);

    if (!quoteRow) {
      throw new NotFoundError("Quote", validated.quoteId);
    }

    if (quoteRow.status !== "active") {
      return deps.withQuoteCurrencyCodes(quoteRow);
    }

    if (quoteRow.expiresAt.getTime() < validated.at.getTime()) {
      throw new QuoteExpiredError("Quote expired");
    }

    const updated = await quotesRepository.markQuoteUsedIfActive({
      quoteId: validated.quoteId,
      usedByRef: validated.usedByRef,
      at: validated.at,
    });

    return deps.withQuoteCurrencyCodes(updated ?? quoteRow);
  }

  return {
    quote,
    markQuoteUsed,
  };
}
