import {
  aggregateFinancialLines,
  type FinancialLine,
} from "@bedrock/documents/contracts";
import { DomainError } from "@bedrock/shared/core/domain";
import { ValidationError } from "@bedrock/shared/core/errors";
import {
  effectiveRateFromAmounts,
  mulDivFloor,
} from "@bedrock/shared/money/math";

import { financialLineFromFeeComponent } from "./fee-financial-lines";
import type { FxQuotePreviewRecord, FxQuoteRecord } from "./ports";
import { FxQuote } from "../../domain/fx-quote";
import {
  buildAutoCrossTrace,
  computeExplicitRouteLegs,
} from "../../domain/routes";
import { NotFoundError, QuoteExpiredError } from "../../errors";
import type { CrossRate } from "../rates/ports";
import type { FxServiceContext } from "../shared/context";
import {
  type MarkQuoteUsedInput,
  type PreviewQuoteInput,
  type QuoteInput,
  validateMarkQuoteUsedInput,
  validatePreviewQuoteInput,
  validateQuoteInput,
} from "../validation";

const DEFAULT_QUOTE_TTL_SECONDS = 600;

type QuoteComputationInput =
  | QuoteInput
  | (PreviewQuoteInput & {
      mode: "auto_cross";
      asOf: Date;
      ttlSeconds?: number;
      anchor?: string;
      manualFinancialLines?: FinancialLine[];
      pricingTrace?: Record<string, unknown>;
    });

interface QuoteHandlersDeps {
  getCrossRate: (
    base: string,
    quote: string,
    asOf: Date,
    anchor?: string,
  ) => Promise<CrossRate>;
  withQuoteCurrencyCodes: (quote: FxQuoteRecord) => Promise<FxQuoteRecord>;
}

function buildQuoteUsageConflictMessage(quote: FxQuoteRecord): string {
  return `Quote ${quote.id} is already used by ${quote.usedByRef ?? "another document"}`;
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

  async function computeQuotePreview(
    validated: QuoteComputationInput,
  ): Promise<FxQuotePreviewRecord> {
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

    return {
      fromCurrency: validated.fromCurrency,
      toCurrency: validated.toCurrency,
      fromAmountMinor: validated.fromAmountMinor,
      toAmountMinor,
      pricingMode: validated.mode,
      pricingTrace,
      dealDirection: validated.dealDirection ?? null,
      dealForm: validated.dealForm ?? null,
      rateNum,
      rateDen,
      expiresAt,
      legs,
      feeComponents,
      financialLines,
    };
  }

  async function quote(input: QuoteInput): Promise<FxQuoteRecord> {
    const validated = validateQuoteInput(input);
    const computed = await computeQuotePreview(validated);

    return transactions.runInTransaction(async (tx) => {
      const currencyCodes = [
        computed.fromCurrency,
        computed.toCurrency,
        ...computed.legs.flatMap((leg) => [leg.fromCurrency, leg.toCurrency]),
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
          fromCurrencyId: currencyIdByCode.get(computed.fromCurrency)!,
          toCurrencyId: currencyIdByCode.get(computed.toCurrency)!,
          fromAmountMinor: computed.fromAmountMinor,
          toAmountMinor: computed.toAmountMinor,
          pricingMode: computed.pricingMode,
          pricingTrace: computed.pricingTrace,
          dealDirection: computed.dealDirection,
          dealForm: computed.dealForm,
          rateNum: computed.rateNum,
          rateDen: computed.rateDen,
          expiresAt: computed.expiresAt,
          status: "active",
          idempotencyKey: validated.idempotencyKey,
        },
        tx,
      );

      if (created) {
        await quotesRepository.insertQuoteLegs(
          computed.legs.map((leg) => ({
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
            components: computed.feeComponents,
          },
          tx,
        );

        const normalizedFinancialLines = aggregateFinancialLines(
          computed.financialLines,
        );
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
          legs: computed.legs.length,
          feeComponents: computed.feeComponents.length,
          financialLines: computed.financialLines.length,
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

  async function previewQuote(input: PreviewQuoteInput): Promise<FxQuotePreviewRecord> {
    const validated = validatePreviewQuoteInput(input);

    return computeQuotePreview({
      ...validated,
      mode: "auto_cross",
      asOf: new Date(),
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

    if (quoteRow.status === "used") {
      if (quoteRow.usedByRef === validated.usedByRef) {
        return deps.withQuoteCurrencyCodes(quoteRow);
      }

      throw new ValidationError(buildQuoteUsageConflictMessage(quoteRow));
    }

    if (quoteRow.status !== "active") {
      throw new ValidationError(`Quote ${validated.quoteId} is not active`);
    }

    let transition;
    try {
      transition = FxQuote.fromSnapshot({
        id: quoteRow.id,
        fromCurrencyId: quoteRow.fromCurrencyId,
        toCurrencyId: quoteRow.toCurrencyId,
        fromAmountMinor: quoteRow.fromAmountMinor,
        toAmountMinor: quoteRow.toAmountMinor,
        pricingMode: quoteRow.pricingMode,
        pricingTrace: quoteRow.pricingTrace,
        dealDirection: quoteRow.dealDirection,
        dealForm: quoteRow.dealForm,
        rateNum: quoteRow.rateNum,
        rateDen: quoteRow.rateDen,
        status: quoteRow.status,
        usedByRef: quoteRow.usedByRef,
        usedAt: quoteRow.usedAt,
        expiresAt: quoteRow.expiresAt,
        idempotencyKey: quoteRow.idempotencyKey,
        createdAt: quoteRow.createdAt,
      }).markUsed({
        usedByRef: validated.usedByRef,
        at: validated.at,
      });
    } catch (error) {
      if (error instanceof DomainError && error.code === "fx.quote.expired") {
        throw new QuoteExpiredError("Quote expired");
      }

      throw error;
    }

    if (transition.kind === "noop") {
      return deps.withQuoteCurrencyCodes(quoteRow);
    }

    const updated = await quotesRepository.markQuoteUsedIfActive({
      quoteId: validated.quoteId,
      usedByRef: validated.usedByRef,
      at: validated.at,
    });

    if (updated) {
      return deps.withQuoteCurrencyCodes(updated);
    }

    const reloaded = await quotesRepository.findQuoteById(validated.quoteId);

    if (!reloaded) {
      throw new NotFoundError("Quote", validated.quoteId);
    }

    if (reloaded.status === "used" && reloaded.usedByRef === validated.usedByRef) {
      return deps.withQuoteCurrencyCodes(reloaded);
    }

    if (reloaded.status === "used") {
      throw new ValidationError(buildQuoteUsageConflictMessage(reloaded));
    }

    if (reloaded.status !== "active") {
      throw new ValidationError(`Quote ${validated.quoteId} is not active`);
    }

    throw new ValidationError(
      `Quote ${validated.quoteId} could not be marked as used`,
    );
  }

  return {
    previewQuote,
    quote,
    markQuoteUsed,
  };
}
