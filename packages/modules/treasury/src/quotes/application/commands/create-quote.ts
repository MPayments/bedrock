import type { ModuleRuntime } from "@bedrock/shared/core";

import { QuoteIdempotencyConflictError } from "../../../errors";
import type { CrossRate } from "../../../rates/application/ports";
import { enrichPairCurrencyRecord } from "../../../shared/application/currency-codes";
import type {
  CurrenciesPort,
  QuoteFeesPort,
} from "../../../shared/application/external-ports";
import {
  buildCommercialFeeComponents,
  createQuoteCommercialTerms,
} from "../../domain/commercial-terms";
import { computePricingFingerprint } from "../../domain/pricing-fingerprint";
import { Quote } from "../../domain/quote";
import { QuotePricingPlan } from "../../domain/quote-pricing-plan";
import { QuoteRoute } from "../../domain/quote-route";
import {
  CreateQuoteInputSchema,
  type CreateQuoteInput,
} from "../contracts/commands";
import type {
  QuoteRecord,
  QuotesCommandTx,
  QuotesCommandUnitOfWork,
} from "../ports";

export class CreateQuoteCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly currencies: CurrenciesPort,
    private readonly fees: QuoteFeesPort,
    private readonly commandUow: QuotesCommandUnitOfWork,
    private readonly getCrossRate: (
      base: string,
      quote: string,
      asOf: Date,
      anchor?: string,
    ) => Promise<CrossRate>,
  ) {}

  async execute(input: CreateQuoteInput): Promise<QuoteRecord> {
    const validated = CreateQuoteInputSchema.parse(input);
    const pricingPlan = await this.buildPricingPlan(validated);

    return this.commandUow.run(async (tx) => {
      const pricingSnapshot = pricingPlan.toSnapshot();
      const currencyCodes = [
        pricingSnapshot.fromCurrency,
        pricingSnapshot.toCurrency,
        ...pricingSnapshot.legs.flatMap((leg) => [leg.fromCurrency, leg.toCurrency]),
        ...pricingSnapshot.feeComponents.map((component) => component.currency),
        ...pricingSnapshot.financialLines.map((line) => line.currency),
      ];
      const uniqueCurrencyCodes = [...new Set(currencyCodes)];
      const currencyIdByCode = new Map<string, string>();
      await Promise.all(
        uniqueCurrencyCodes.map(async (code) => {
          const currency = await this.currencies.findByCode(code);
          currencyIdByCode.set(currency.code, currency.id);
        }),
      );

      const fromCurrencyId = currencyIdByCode.get(pricingSnapshot.fromCurrency)!;
      const toCurrencyId = currencyIdByCode.get(pricingSnapshot.toCurrency)!;
      const pricingFingerprint = computePricingFingerprint({
        commercialTerms: pricingSnapshot.commercialTerms
          ? {
              agreementFeeBps: pricingSnapshot.commercialTerms.agreementFeeBps,
              agreementVersionId:
                pricingSnapshot.commercialTerms.agreementVersionId,
              fixedFeeAmountMinor:
                pricingSnapshot.commercialTerms.fixedFeeAmountMinor,
              fixedFeeCurrency:
                pricingSnapshot.commercialTerms.fixedFeeCurrency,
              quoteMarkupBps: pricingSnapshot.commercialTerms.quoteMarkupBps,
            }
          : null,
        fromAmountMinor: pricingSnapshot.fromAmountMinor,
        fromCurrencyId,
        pricingMode: pricingSnapshot.pricingMode,
        routeTemplateId: validated.routeTemplateId ?? null,
        toAmountMinor: pricingSnapshot.toAmountMinor,
        toCurrencyId,
      });

      const quote = Quote.create({
        id: this.runtime.generateUuid(),
        dealId: validated.dealId ?? null,
        idempotencyKey: validated.idempotencyKey,
        fromCurrencyId,
        toCurrencyId,
        createdAt: this.runtime.now(),
        pricingPlan: pricingSnapshot,
        pricingFingerprint,
      });

      const created = await tx.quotes.insertQuote(quote.toSnapshot());

      if (created) {
        await tx.quotes.insertQuoteLegs(
          pricingSnapshot.legs.map((leg) => ({
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
        );

        await tx.quoteFeeComponents.replaceQuoteFeeComponents(
          {
            quoteId: created.id,
            components: pricingSnapshot.feeComponents.map((component, index) => ({
              quoteId: created.id,
              idx: index + 1,
              ruleId: component.ruleId ?? null,
              kind: component.kind,
              currencyId: currencyIdByCode.get(component.currency)!,
              amountMinor: component.amountMinor,
              source: component.source,
              settlementMode: component.settlementMode ?? "in_ledger",
              memo: component.memo ?? null,
              metadata: component.metadata ?? null,
            })),
          },
        );

        const financialLineCurrencyIds = new Map<string, string>();
        await Promise.all(
          [...new Set(pricingSnapshot.financialLines.map((line) => line.currency))].map(
            async (code) => {
              const currency = await this.currencies.findByCode(code);
              financialLineCurrencyIds.set(currency.code, currency.id);
            },
          ),
        );
        await tx.quoteFinancialLines.replaceQuoteFinancialLines(
          {
            quoteId: created.id,
            financialLines: pricingSnapshot.financialLines.map((line, index) => ({
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
        );

        this.runtime.log.info("Treasury quote created", {
          quoteId: created.id,
          mode: validated.mode,
          legs: pricingSnapshot.legs.length,
          feeComponents: pricingSnapshot.feeComponents.length,
          financialLines: pricingSnapshot.financialLines.length,
        });

        return enrichPairCurrencyRecord(this.currencies, created);
      }

      const racedExisting = await tx.quotes.findQuoteByIdempotencyKey(
        validated.idempotencyKey,
      );

      if (!racedExisting) {
        throw new Error(
          `Quote insert conflict without existing idempotency row: ${validated.idempotencyKey}`,
        );
      }

        await this.assertIdempotentReplayMatches(
          validated.idempotencyKey,
          validated.dealId ?? null,
          pricingPlan,
          racedExisting,
          tx,
      );

      return enrichPairCurrencyRecord(this.currencies, racedExisting);
    });
  }

  async buildPricingPlan(
    validated: CreateQuoteInput,
  ): Promise<QuotePricingPlan> {
    if (validated.mode === "auto_cross") {
      const cross = await this.getCrossRate(
        validated.fromCurrency,
        validated.toCurrency,
        validated.asOf,
        validated.anchor ?? "USD",
      );
      const sourceAmountMinor = this.resolveAutoCrossSourceAmountMinor({
        input: validated,
        rateNum: cross.rateNum,
        rateDen: cross.rateDen,
      });
      const feeComponents = await this.fees.calculateQuoteFeeComponents({
        fromCurrency: validated.fromCurrency,
        toCurrency: validated.toCurrency,
        principalMinor: sourceAmountMinor,
        dealDirection: validated.dealDirection,
        dealForm: validated.dealForm,
        at: validated.asOf,
      });
      const commercialTerms = createQuoteCommercialTerms({
        agreementVersionId: validated.commercialTerms?.agreementVersionId ?? null,
        agreementFeeBps:
          validated.commercialTerms?.agreementFeeBps !== undefined
            ? BigInt(validated.commercialTerms.agreementFeeBps)
            : undefined,
        quoteMarkupBps:
          validated.commercialTerms?.quoteMarkupBps !== undefined
            ? BigInt(validated.commercialTerms.quoteMarkupBps)
            : undefined,
        fixedFeeAmount: validated.commercialTerms?.fixedFeeAmount ?? null,
        fixedFeeCurrency: validated.commercialTerms?.fixedFeeCurrency ?? null,
      });

      return QuotePricingPlan.autoCross({
        ...validated,
        fromAmountMinor: sourceAmountMinor,
        crossRate: cross,
        feeComponents: [
          ...feeComponents,
          ...buildCommercialFeeComponents({
            commercialTerms,
            feeCurrency: validated.fromCurrency,
            principalMinor: sourceAmountMinor,
          }),
        ],
        commercialTerms,
      });
    }

    const sourceAmountMinor = this.resolveExplicitRouteSourceAmountMinor(validated);
    const feeComponents = await this.fees.calculateQuoteFeeComponents({
      fromCurrency: validated.fromCurrency,
      toCurrency: validated.toCurrency,
      principalMinor: sourceAmountMinor,
      dealDirection: validated.dealDirection,
      dealForm: validated.dealForm,
      at: validated.asOf,
    });
    const commercialTerms = createQuoteCommercialTerms({
      agreementVersionId: validated.commercialTerms?.agreementVersionId ?? null,
      agreementFeeBps:
        validated.commercialTerms?.agreementFeeBps !== undefined
          ? BigInt(validated.commercialTerms.agreementFeeBps)
          : undefined,
      quoteMarkupBps:
        validated.commercialTerms?.quoteMarkupBps !== undefined
          ? BigInt(validated.commercialTerms.quoteMarkupBps)
          : undefined,
      fixedFeeAmount: validated.commercialTerms?.fixedFeeAmount ?? null,
      fixedFeeCurrency: validated.commercialTerms?.fixedFeeCurrency ?? null,
    });

    return QuotePricingPlan.explicitRoute({
      ...validated,
      fromAmountMinor: sourceAmountMinor,
      feeComponents: [
        ...feeComponents,
        ...buildCommercialFeeComponents({
          commercialTerms,
          feeCurrency: validated.fromCurrency,
          principalMinor: sourceAmountMinor,
        }),
      ],
      commercialTerms,
    });
  }

  private resolveAutoCrossSourceAmountMinor(input: {
    input: Extract<CreateQuoteInput, { mode: "auto_cross" }>;
    rateNum: bigint;
    rateDen: bigint;
  }): bigint {
    if ("fromAmountMinor" in input.input) {
      return input.input.fromAmountMinor;
    }

    return QuoteRoute.singleFromTarget({
      fromCurrency: input.input.fromCurrency,
      toCurrency: input.input.toCurrency,
      toAmountMinor: input.input.toAmountMinor,
      rateNum: input.rateNum,
      rateDen: input.rateDen,
      asOf: input.input.asOf,
      sourceKind: "derived",
      sourceRef: input.input.anchor ?? "USD",
      executionCounterpartyId: null,
    }).fromAmountMinor;
  }

  private resolveExplicitRouteSourceAmountMinor(
    input: Extract<CreateQuoteInput, { mode: "explicit_route" }>,
  ): bigint {
    if ("fromAmountMinor" in input) {
      return input.fromAmountMinor;
    }

    return QuoteRoute.explicitFromTarget({
      fromCurrency: input.fromCurrency,
      toCurrency: input.toCurrency,
      toAmountMinor: input.toAmountMinor,
      asOf: input.asOf,
      legs: input.legs,
    }).fromAmountMinor;
  }

  private async assertIdempotentReplayMatches(
    idempotencyKey: string,
    dealId: string | null,
    pricingPlan: QuotePricingPlan,
    existingQuote: QuoteRecord,
    tx: QuotesCommandTx,
  ): Promise<void> {
    if (
      !Quote.fromSnapshot(existingQuote).sameRequestAs({
        dealId,
        idempotencyKey,
        pricingPlan: pricingPlan.toSnapshot(),
      })
    ) {
      throw new QuoteIdempotencyConflictError(idempotencyKey);
    }

    const [legs, feeComponentRows, financialLineRows] = await Promise.all([
      tx.quotes.listQuoteLegs(existingQuote.id),
      tx.quoteFeeComponents.listQuoteFeeComponents(existingQuote.id),
      tx.quoteFinancialLines.listQuoteFinancialLines(existingQuote.id),
    ]);
    const legCurrencyIds = [
      ...new Set(
        legs.flatMap((leg) => [leg.fromCurrencyId, leg.toCurrencyId]),
      ),
    ];
    const legCurrencyCodeById = new Map<string, string>();
    await Promise.all(
      legCurrencyIds.map(async (currencyId) => {
        const currency = await this.currencies.findById(currencyId);
        legCurrencyCodeById.set(currencyId, currency.code);
      }),
    );
    const feeComponents = await Promise.all(
      feeComponentRows
        .slice()
        .sort((left, right) => left.idx - right.idx)
        .map(async (row) => {
          const currency = await this.currencies.findById(row.currencyId);
          return {
            id: `quote_component:${row.quoteId}:${row.idx}`,
            ruleId: row.ruleId ?? undefined,
            kind: row.kind,
            currency: currency.code,
            amountMinor: row.amountMinor,
            source: row.source,
            settlementMode: row.settlementMode,
            memo: row.memo ?? undefined,
            metadata: row.metadata ?? undefined,
          };
        }),
    );
    const financialLines = await Promise.all(
      financialLineRows.map(async (row) => {
        const currency = await this.currencies.findById(row.currencyId);
        return {
          id: `quote_financial_line:${row.quoteId}:${row.idx}`,
          bucket: row.bucket,
          currency: currency.code,
          amountMinor: row.amountMinor,
          source: row.source,
          settlementMode: row.settlementMode,
          memo: row.memo ?? undefined,
          metadata: row.metadata ?? undefined,
        };
      }),
    );

    if (
      !pricingPlan.matchesPersistedChildren({
        legs: legs.map((leg) => ({
          idx: leg.idx,
          fromCurrency:
            leg.fromCurrency ??
            legCurrencyCodeById.get(leg.fromCurrencyId) ??
            "",
          toCurrency:
            leg.toCurrency ??
            legCurrencyCodeById.get(leg.toCurrencyId) ??
            "",
          fromAmountMinor: leg.fromAmountMinor,
          toAmountMinor: leg.toAmountMinor,
          rateNum: leg.rateNum,
          rateDen: leg.rateDen,
          sourceKind: leg.sourceKind,
          sourceRef: leg.sourceRef,
          asOf: leg.asOf,
          executionCounterpartyId: leg.executionCounterpartyId,
        })),
        feeComponents,
        financialLines,
      })
    ) {
      throw new QuoteIdempotencyConflictError(idempotencyKey);
    }
  }
}
