import type { ModuleRuntime } from "@bedrock/shared/core";

import { QuoteIdempotencyConflictError } from "../../../errors";
import type { CrossRate } from "../../../rates/application/ports";
import { enrichPairCurrencyRecord } from "../../../shared/application/currency-codes";
import type {
  CurrenciesPort,
  QuoteFeesPort,
} from "../../../shared/application/external-ports";
import { Quote } from "../../domain/quote";
import { QuotePricingPlan } from "../../domain/quote-pricing-plan";
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

      const quote = Quote.create({
        id: this.runtime.generateUuid(),
        idempotencyKey: validated.idempotencyKey,
        fromCurrencyId: currencyIdByCode.get(pricingSnapshot.fromCurrency)!,
        toCurrencyId: currencyIdByCode.get(pricingSnapshot.toCurrency)!,
        createdAt: this.runtime.now(),
        pricingPlan: pricingSnapshot,
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
    const feeComponents = await this.fees.calculateQuoteFeeComponents({
      fromCurrency: validated.fromCurrency,
      toCurrency: validated.toCurrency,
      principalMinor: validated.fromAmountMinor,
      dealDirection: validated.dealDirection,
      dealForm: validated.dealForm,
      at: validated.asOf,
    });

    if (validated.mode === "auto_cross") {
      const cross = await this.getCrossRate(
        validated.fromCurrency,
        validated.toCurrency,
        validated.asOf,
        validated.anchor ?? "USD",
      );
      return QuotePricingPlan.autoCross({
        ...validated,
        crossRate: cross,
        feeComponents,
      });
    }

    return QuotePricingPlan.explicitRoute({
      ...validated,
      feeComponents,
    });
  }

  private async assertIdempotentReplayMatches(
    idempotencyKey: string,
    pricingPlan: QuotePricingPlan,
    existingQuote: QuoteRecord,
    tx: QuotesCommandTx,
  ): Promise<void> {
    if (
      !Quote.fromSnapshot(existingQuote).sameRequestAs({
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
