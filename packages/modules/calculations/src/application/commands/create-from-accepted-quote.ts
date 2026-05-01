import { z } from "zod";

import { ValidationError } from "@bedrock/shared/core/errors";
import {
  calculateBpsAmountMinorHalfUp,
  mulDivRoundHalfUp,
} from "@bedrock/shared/money";
import type { QuoteDetailsRecord } from "@bedrock/treasury/contracts";

import type { CreateCalculationCommand } from "./create-calculation";
import type { CalculationDetails } from "../contracts/dto";
import type { CalculationReferencesPort } from "../ports/references.port";

const CreateCalculationFromAcceptedQuoteCommandInputSchema = z.object({
  acceptedAgreementVersionId: z.uuid().nullable().optional(),
  actorUserId: z.string().trim().min(1),
  idempotencyKey: z.string().trim().min(1).max(255),
  quoteDetails: z.custom<QuoteDetailsRecord>(
    (value) => value !== null && typeof value === "object",
  ),
  quoteSnapshot: z.record(z.string(), z.unknown()).nullable().optional(),
});

export type CreateCalculationFromAcceptedQuoteCommandInput = z.infer<
  typeof CreateCalculationFromAcceptedQuoteCommandInputSchema
>;

function convertQuoteComponentToBaseMinorHalfUp(input: {
  amountMinor: bigint;
  quote: QuoteDetailsRecord["quote"];
}) {
  // Standalone derived components are converted and rounded per component.
  return mulDivRoundHalfUp(
    input.amountMinor,
    input.quote.rateNum,
    input.quote.rateDen,
  );
}

function resolveAdditionalExpensesInBaseMinor(input: {
  amountMinor: bigint;
  currencyCode: string;
  quote: QuoteDetailsRecord["quote"];
}) {
  if (input.amountMinor === 0n) {
    return {
      additionalExpensesAmountMinor: 0n,
      additionalExpensesCurrencyId: null,
      additionalExpensesInBaseMinor: 0n,
      additionalExpensesRateDen: null,
      additionalExpensesRateNum: null,
      additionalExpensesRateSource: null,
    };
  }

  if (input.currencyCode === input.quote.toCurrency) {
    return {
      additionalExpensesAmountMinor: input.amountMinor,
      additionalExpensesCurrencyId: input.quote.toCurrencyId,
      additionalExpensesInBaseMinor: input.amountMinor,
      additionalExpensesRateDen: null,
      additionalExpensesRateNum: null,
      additionalExpensesRateSource: null,
    };
  }

  if (input.currencyCode === input.quote.fromCurrency) {
    return {
      additionalExpensesAmountMinor: input.amountMinor,
      additionalExpensesCurrencyId: input.quote.fromCurrencyId,
      additionalExpensesInBaseMinor: convertQuoteComponentToBaseMinorHalfUp({
        amountMinor: input.amountMinor,
        quote: input.quote,
      }),
      additionalExpensesRateDen: input.quote.rateDen.toString(),
      additionalExpensesRateNum: input.quote.rateNum.toString(),
      additionalExpensesRateSource: "fx_quote" as const,
    };
  }

  throw new ValidationError(
    `Additional expenses currency ${input.currencyCode} is unsupported for quote ${input.quote.id}`,
  );
}

export class CreateCalculationFromAcceptedQuoteCommand {
  constructor(
    private readonly createCalculation: CreateCalculationCommand,
    private readonly references: CalculationReferencesPort,
  ) {}

  async execute(
    raw: CreateCalculationFromAcceptedQuoteCommandInput,
  ): Promise<CalculationDetails> {
    const input =
      CreateCalculationFromAcceptedQuoteCommandInputSchema.parse(raw);
    const quoteDetails = input.quoteDetails;
    const quote = quoteDetails.quote;

    if (!quote.fromCurrency || !quote.toCurrency) {
      throw new ValidationError(`Quote ${quote.id} is missing currency codes`);
    }

    const currencyCodes = new Set(
      quoteDetails.financialLines.map((line) => line.currency),
    );
    if (quote.commercialTerms?.fixedFeeCurrency) {
      currencyCodes.add(quote.commercialTerms.fixedFeeCurrency);
    }
    const currencies = await Promise.all(
      Array.from(currencyCodes).map((code) =>
        this.references.findCurrencyByCode(code),
      ),
    );
    const currencyIdByCode = new Map(
      currencies.map((currency) => [currency.code, currency.id]),
    );

    const quoteAdditionalExpensesByCurrency =
      quoteDetails.financialLines.reduce((totals, line) => {
        if (
          line.bucket !== "pass_through" ||
          line.metadata?.embeddedInRoute === "true"
        ) {
          return totals;
        }

        totals.set(
          line.currency,
          (totals.get(line.currency) ?? 0n) + line.amountMinor,
        );

        return totals;
      }, new Map<string, bigint>());

    for (const amountMinor of quoteAdditionalExpensesByCurrency.values()) {
      if (amountMinor < 0n) {
        throw new ValidationError(
          `Quote ${quote.id} has negative pass_through total`,
        );
      }
    }

    const originalAmountMinor = quote.fromAmountMinor;
    const acceptedAgreementVersionId = input.acceptedAgreementVersionId ?? null;
    const commercialTerms = quote.commercialTerms ?? {
      agreementVersionId: acceptedAgreementVersionId,
      agreementFeeBps: 0n,
      quoteMarkupBps: 0n,
      totalFeeBps: 0n,
      fixedFeeAmountMinor: null,
      fixedFeeCurrency: null,
    };

    if (
      acceptedAgreementVersionId &&
      commercialTerms.agreementVersionId &&
      acceptedAgreementVersionId !== commercialTerms.agreementVersionId
    ) {
      throw new ValidationError(
        `Accepted quote ${quote.id} agreementVersionId does not match commercial terms`,
      );
    }

    const agreementVersionId =
      acceptedAgreementVersionId ?? commercialTerms.agreementVersionId ?? null;
    const agreementFeeAmountMinor = calculateBpsAmountMinorHalfUp(
      originalAmountMinor,
      commercialTerms.agreementFeeBps,
    );
    const quoteMarkupAmountMinor = calculateBpsAmountMinorHalfUp(
      originalAmountMinor,
      commercialTerms.quoteMarkupBps,
    );
    const totalFeeAmountMinor =
      agreementFeeAmountMinor + quoteMarkupAmountMinor;
    const totalAmountMinor = originalAmountMinor + totalFeeAmountMinor;
    const totalFeeAmountInBaseMinor = convertQuoteComponentToBaseMinorHalfUp({
      amountMinor: totalFeeAmountMinor,
      quote,
    });
    const totalInBaseMinor = quote.toAmountMinor;
    const fixedFeeAmountMinor = commercialTerms.fixedFeeAmountMinor ?? 0n;
    const fixedFeeCurrencyId = commercialTerms.fixedFeeCurrency
      ? (currencyIdByCode.get(commercialTerms.fixedFeeCurrency) ?? null)
      : null;

    const nonZeroAdditionalExpenses = Array.from(
      quoteAdditionalExpensesByCurrency.entries(),
    ).filter(([, amountMinor]) => amountMinor !== 0n);

    if (nonZeroAdditionalExpenses.length > 1) {
      throw new ValidationError(
        "Additional expenses must use a single currency when creating a calculation from quote",
      );
    }

    const additionalExpenses =
      nonZeroAdditionalExpenses.length === 0
        ? {
            additionalExpensesAmountMinor: 0n,
            additionalExpensesCurrencyId: null,
            additionalExpensesInBaseMinor: 0n,
            additionalExpensesRateDen: null,
            additionalExpensesRateNum: null,
            additionalExpensesRateSource: null,
          }
        : resolveAdditionalExpensesInBaseMinor({
            amountMinor: nonZeroAdditionalExpenses[0]![1],
            currencyCode: nonZeroAdditionalExpenses[0]![0],
            quote,
          });
    const additionalExpensesAmountMinor =
      additionalExpenses.additionalExpensesAmountMinor;
    const additionalExpensesCurrencyId =
      additionalExpenses.additionalExpensesCurrencyId;
    const additionalExpensesInBaseMinor =
      additionalExpenses.additionalExpensesInBaseMinor;
    const totalWithExpensesInBaseMinor =
      totalInBaseMinor +
      totalFeeAmountInBaseMinor +
      additionalExpensesInBaseMinor;

    const financialLines = quoteDetails.financialLines
      .filter((line) => line.amountMinor !== 0n)
      .map((line) => {
        const currencyId = currencyIdByCode.get(line.currency);
        if (!currencyId) {
          throw new ValidationError(
            `Currency ${line.currency} is not configured`,
          );
        }

        return {
          kind: line.bucket,
          currencyId,
          amountMinor: line.amountMinor.toString(),
        };
      });

    return this.createCalculation.execute({
      actorUserId: input.actorUserId,
      additionalExpensesAmountMinor: additionalExpensesAmountMinor.toString(),
      additionalExpensesCurrencyId,
      additionalExpensesInBaseMinor: additionalExpensesInBaseMinor.toString(),
      additionalExpensesRateDen: additionalExpenses.additionalExpensesRateDen,
      additionalExpensesRateNum: additionalExpenses.additionalExpensesRateNum,
      additionalExpensesRateSource:
        additionalExpenses.additionalExpensesRateSource,
      agreementFeeAmountMinor: agreementFeeAmountMinor.toString(),
      agreementFeeBps: commercialTerms.agreementFeeBps.toString(),
      agreementVersionId,
      baseCurrencyId: quote.toCurrencyId,
      calculationCurrencyId: quote.fromCurrencyId,
      calculationTimestamp: quote.createdAt,
      fixedFeeAmountMinor: fixedFeeAmountMinor.toString(),
      fixedFeeCurrencyId,
      financialLines,
      fxQuoteId: quote.id,
      idempotencyKey: input.idempotencyKey,
      originalAmountMinor: originalAmountMinor.toString(),
      pricingProvenance: {
        source: "accepted_quote",
        acceptedAgreementVersionId,
        quoteCommercialTerms: {
          agreementVersionId: commercialTerms.agreementVersionId,
          agreementFeeBps: commercialTerms.agreementFeeBps.toString(),
          quoteMarkupBps: commercialTerms.quoteMarkupBps.toString(),
          totalFeeBps: commercialTerms.totalFeeBps.toString(),
          fixedFeeAmountMinor:
            commercialTerms.fixedFeeAmountMinor?.toString() ?? null,
          fixedFeeCurrency: commercialTerms.fixedFeeCurrency ?? null,
        },
        quoteId: quote.id,
      },
      quoteMarkupAmountMinor: quoteMarkupAmountMinor.toString(),
      quoteMarkupBps: commercialTerms.quoteMarkupBps.toString(),
      quoteSnapshot: input.quoteSnapshot ?? undefined,
      referenceRateAsOf: null,
      referenceRateDen: null,
      referenceRateNum: null,
      referenceRateSource: null,
      rateDen: quote.rateDen.toString(),
      rateNum: quote.rateNum.toString(),
      rateSource: "fx_quote",
      totalAmountMinor: totalAmountMinor.toString(),
      totalFeeAmountInBaseMinor: totalFeeAmountInBaseMinor.toString(),
      totalFeeAmountMinor: totalFeeAmountMinor.toString(),
      totalFeeBps: commercialTerms.totalFeeBps.toString(),
      totalInBaseMinor: totalInBaseMinor.toString(),
      totalWithExpensesInBaseMinor: totalWithExpensesInBaseMinor.toString(),
    });
  }
}
