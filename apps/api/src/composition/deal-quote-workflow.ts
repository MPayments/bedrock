import type { AgreementsModule } from "@bedrock/agreements";
import type { AgreementDetails } from "@bedrock/agreements/contracts";
import type { CalculationsModule } from "@bedrock/calculations";
import type { CurrenciesService } from "@bedrock/currencies";
import {
  DealNotFoundError,
  DealQuoteInactiveError,
  DealQuoteNotAcceptedError,
  type DealsModule,
} from "@bedrock/deals";
import { NotFoundError, ValidationError } from "@bedrock/shared/core/errors";
import {
  BPS_SCALE,
  mulDivRoundHalfUp,
  toMinorAmountString,
} from "@bedrock/shared/money";
import type { TreasuryModule } from "@bedrock/treasury";

import { serializeQuoteDetails } from "../routes/internal/treasury-quote-dto";

type CanonicalCalculation = Awaited<
  ReturnType<CalculationsModule["calculations"]["commands"]["create"]>
>;
type TreasuryMarkQuoteUsedInput = Parameters<
  TreasuryModule["quotes"]["commands"]["markQuoteUsed"]
>[0];
type TreasuryQuoteRecord = Awaited<
  ReturnType<TreasuryModule["quotes"]["commands"]["markQuoteUsed"]>
>;
type ExpiredQuoteRecord = Awaited<
  ReturnType<TreasuryModule["quotes"]["commands"]["expireQuotes"]>
>[number];

type CalculationFeeOverrides = {
  agentFeePercent?: string | null;
  fixedFeeAmount?: string | null;
  fixedFeeCurrencyCode?: string | null;
};

export interface DealQuoteWorkflowDeps {
  agreements: Pick<AgreementsModule, "agreements">;
  calculations: Pick<CalculationsModule, "calculations">;
  currencies: Pick<CurrenciesService, "findByCode" | "findById">;
  deals: Pick<DealsModule, "deals">;
  treasury: Pick<TreasuryModule, "quotes">;
}

function normalizeOptionalDecimalString(
  value: string | null | undefined,
  field: string,
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const normalized = value.trim().replace(",", ".");
  if (!normalized) {
    return null;
  }

  if (!/^\d+(?:\.\d+)?$/u.test(normalized)) {
    throw new ValidationError(`${field} must be a non-negative decimal string`);
  }

  return normalized;
}

function parseDecimalParts(value: string, field: string) {
  const normalized = normalizeOptionalDecimalString(value, field);

  if (normalized === undefined || normalized === null) {
    throw new ValidationError(`${field} is required`);
  }

  const [wholeRaw = "0", fractionRaw = ""] = normalized.split(".");
  const whole = wholeRaw.replace(/^0+(?=\d)/u, "") || "0";
  const fraction = fractionRaw.replace(/0+$/u, "");
  const digits = `${whole}${fraction}`.replace(/^0+(?=\d)/u, "") || "0";

  return {
    digits: BigInt(digits),
    scale: fraction.length,
  };
}

function roundDecimalStringToInteger(value: string, field: string) {
  const parts = parseDecimalParts(value, field);

  if (parts.scale === 0) {
    return parts.digits;
  }

  const denominator = 10n ** BigInt(parts.scale);
  return (parts.digits + denominator / 2n) / denominator;
}

function percentStringToBps(value: string) {
  const parts = parseDecimalParts(value, "agentFeePercent");
  const denominator = 10n ** BigInt(parts.scale);

  return (parts.digits * 100n + denominator / 2n) / denominator;
}

function ratioToRoundedBps(numerator: bigint, denominator: bigint) {
  if (denominator === 0n) {
    return 0n;
  }

  return mulDivRoundHalfUp(numerator, BPS_SCALE, denominator);
}

function calculatePercentAmountMinorHalfUp(
  amountMinor: bigint,
  bps: bigint,
): bigint {
  // Contractual percentage fees round to the nearest minor unit.
  return mulDivRoundHalfUp(amountMinor, bps, BPS_SCALE);
}

function convertQuoteComponentToBaseMinorHalfUp(input: {
  amountMinor: bigint;
  quote: Awaited<
    ReturnType<TreasuryModule["quotes"]["queries"]["getQuoteDetails"]>
  >["quote"];
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
  quote: Awaited<
    ReturnType<TreasuryModule["quotes"]["queries"]["getQuoteDetails"]>
  >["quote"];
}) {
  if (input.amountMinor === 0n) {
    return {
      additionalExpensesAmountMinor: 0n,
      additionalExpensesCurrencyId: null,
      additionalExpensesInBaseMinor: 0n,
      additionalExpensesRateDen: null,
      additionalExpensesRateNum: null,
      additionalExpensesRateSource: null,
      calculationLineCurrencyId: null,
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
      calculationLineCurrencyId: input.quote.toCurrencyId,
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
      calculationLineCurrencyId: input.quote.fromCurrencyId,
    };
  }

  throw new ValidationError(
    `Additional expenses currency ${input.currencyCode} is unsupported for quote ${input.quote.id}`,
  );
}

function extractAgreementFeeDefaults(agreement: AgreementDetails) {
  let agentFeeBps: bigint | null = null;
  let fixedFeeAmount: string | null = null;
  let fixedFeeCurrencyCode: string | null = null;

  for (const rule of agreement.currentVersion.feeRules) {
    if (rule.kind === "agent_fee") {
      agentFeeBps = roundDecimalStringToInteger(rule.value, "agreement.agent_fee");
      continue;
    }

    if (rule.kind === "fixed_fee") {
      fixedFeeAmount = rule.value.trim();
      fixedFeeCurrencyCode = rule.currencyCode?.trim().toUpperCase() ?? null;
    }
  }

  return {
    agentFeeBps,
    fixedFeeAmount,
    fixedFeeCurrencyCode,
  };
}

async function resolveCalculationFees(input: {
  agreement: AgreementDetails;
  currencies: DealQuoteWorkflowDeps["currencies"];
  overrides: CalculationFeeOverrides;
  quote: Awaited<
    ReturnType<TreasuryModule["quotes"]["queries"]["getQuoteDetails"]>
  >["quote"];
  quoteAdditionalExpensesByCurrency: Map<string, bigint>;
  quoteFeeAmountMinor: bigint;
}) {
  const defaults = extractAgreementFeeDefaults(input.agreement);

  const normalizedAgentFeePercent = normalizeOptionalDecimalString(
    input.overrides.agentFeePercent,
    "agentFeePercent",
  );
  const normalizedFixedFeeAmount = normalizeOptionalDecimalString(
    input.overrides.fixedFeeAmount,
    "fixedFeeAmount",
  );
  const normalizedFixedFeeCurrencyCode = input.overrides.fixedFeeCurrencyCode
    ?.trim()
    .toUpperCase();

  const agreementFeeBps =
    normalizedAgentFeePercent === undefined
      ? (defaults.agentFeeBps ?? 0n)
      : normalizedAgentFeePercent === null
        ? 0n
        : percentStringToBps(normalizedAgentFeePercent);
  const agreementFeeAmountMinor =
    input.quote.fromAmountMinor === 0n
      ? 0n
      : calculatePercentAmountMinorHalfUp(
        input.quote.fromAmountMinor,
        agreementFeeBps,
      );
  const feeAmountMinor = input.quoteFeeAmountMinor + agreementFeeAmountMinor;

  let fixedFeeCurrencyCode =
    normalizedFixedFeeAmount === undefined
      ? (normalizedFixedFeeCurrencyCode ??
        defaults.fixedFeeCurrencyCode ??
        input.quote.toCurrency)
      : normalizedFixedFeeAmount === null
        ? null
        : (normalizedFixedFeeCurrencyCode ??
          defaults.fixedFeeCurrencyCode ??
          input.quote.toCurrency);
  const fixedFeeAmount =
    normalizedFixedFeeAmount === undefined
      ? defaults.fixedFeeAmount
      : normalizedFixedFeeAmount;

  if (fixedFeeCurrencyCode === null || fixedFeeAmount === null) {
    fixedFeeCurrencyCode = null;
  }

  const additionalExpensesByCurrency = new Map(
    input.quoteAdditionalExpensesByCurrency,
  );

  if (fixedFeeCurrencyCode && fixedFeeAmount) {
    const resolvedCurrencyCode =
      fixedFeeCurrencyCode === input.quote.fromCurrency
        ? input.quote.fromCurrency
        : fixedFeeCurrencyCode === input.quote.toCurrency
          ? input.quote.toCurrency
          : (await input.currencies.findByCode(fixedFeeCurrencyCode)).code;
    const fixedFeeAmountMinor = BigInt(
      toMinorAmountString(fixedFeeAmount, resolvedCurrencyCode),
    );

    additionalExpensesByCurrency.set(
      resolvedCurrencyCode,
      (additionalExpensesByCurrency.get(resolvedCurrencyCode) ?? 0n) +
        fixedFeeAmountMinor,
    );
  }

  const nonZeroAdditionalExpenses = Array.from(
    additionalExpensesByCurrency.entries(),
  ).filter(([, amountMinor]) => amountMinor !== 0n);

  if (nonZeroAdditionalExpenses.length > 1) {
    throw new ValidationError(
      "Additional expenses must use a single currency when creating a calculation from quote",
    );
  }

  if (nonZeroAdditionalExpenses.length === 0) {
    return {
      additionalExpensesAmountMinor: 0n,
      additionalExpensesCurrencyId: null,
      additionalExpensesInBaseMinor: 0n,
      additionalExpensesRateDen: null,
      additionalExpensesRateNum: null,
      additionalExpensesRateSource: null,
      feeAmountMinor,
      feeBps:
        ratioToRoundedBps(feeAmountMinor, input.quote.fromAmountMinor),
      feeLineAmountMinor: agreementFeeAmountMinor,
      fixedFeeCurrencyCode: null,
      fixedFeeLineAmountMinor: 0n,
      fixedFeeLineCurrencyId: null,
    };
  }

  const [additionalExpensesCurrencyCode, additionalExpensesAmountMinor] =
    nonZeroAdditionalExpenses[0]!;
  const additionalExpenses = resolveAdditionalExpensesInBaseMinor({
    amountMinor: additionalExpensesAmountMinor,
    currencyCode: additionalExpensesCurrencyCode,
    quote: input.quote,
  });

  return {
    ...additionalExpenses,
    feeAmountMinor,
    feeBps:
      ratioToRoundedBps(feeAmountMinor, input.quote.fromAmountMinor),
    feeLineAmountMinor: agreementFeeAmountMinor,
    fixedFeeCurrencyCode: additionalExpensesCurrencyCode,
    fixedFeeLineAmountMinor:
      fixedFeeCurrencyCode && fixedFeeAmount ? BigInt(
        toMinorAmountString(fixedFeeAmount, fixedFeeCurrencyCode),
      ) : 0n,
    fixedFeeLineCurrencyId: additionalExpenses.calculationLineCurrencyId,
  };
}

async function requireCurrentAcceptedQuote(input: {
  allowUsedDocumentId?: string | null;
  dealId: string;
  deals: DealQuoteWorkflowDeps["deals"];
  now: Date;
  quoteId: string;
}) {
  const workflow = await input.deals.deals.queries.findWorkflowById(input.dealId);

  if (!workflow) {
    throw new DealNotFoundError(input.dealId);
  }

  if (workflow.acceptedQuote?.quoteId !== input.quoteId) {
    throw new DealQuoteNotAcceptedError(input.dealId, input.quoteId);
  }

  const sameUsedDocument = isAcceptedQuoteUsedBySameDocument({
    acceptedQuote: workflow.acceptedQuote,
    usedDocumentId: input.allowUsedDocumentId,
  });

  if (workflow.acceptedQuote.quoteStatus !== "active" && !sameUsedDocument) {
    throw new DealQuoteInactiveError(
      input.quoteId,
      workflow.acceptedQuote.quoteStatus,
    );
  }

  if (
    !sameUsedDocument &&
    workflow.acceptedQuote.expiresAt &&
    workflow.acceptedQuote.expiresAt.getTime() <= input.now.getTime()
  ) {
    throw new DealQuoteInactiveError(input.quoteId, "expired");
  }

  return workflow;
}

function isAcceptedQuoteUsedBySameDocument(input: {
  acceptedQuote: {
    quoteStatus: string;
    usedDocumentId: string | null;
  };
  usedDocumentId?: string | null;
}) {
  return (
    input.acceptedQuote.quoteStatus === "used" &&
    input.usedDocumentId != null &&
    input.acceptedQuote.usedDocumentId === input.usedDocumentId
  );
}

export function createDealQuoteWorkflow(deps: DealQuoteWorkflowDeps) {
  return {
    async createCalculationFromAcceptedQuote(input: {
      agentFeePercent?: string | null;
      actorUserId: string;
      dealId: string;
      fixedFeeAmount?: string | null;
      fixedFeeCurrencyCode?: string | null;
      idempotencyKey: string;
      quoteId: string;
    }): Promise<CanonicalCalculation> {
      const workflow = await requireCurrentAcceptedQuote({
        dealId: input.dealId,
        deals: deps.deals,
        now: new Date(),
        quoteId: input.quoteId,
      });

      const quoteDetails = await deps.treasury.quotes.queries.getQuoteDetails({
        quoteRef: input.quoteId,
      });
      const quote = quoteDetails.quote;

      if (quote.dealId !== input.dealId) {
        throw new ValidationError(
          `Quote ${quote.id} is not linked to deal ${input.dealId}`,
        );
      }

      if (quote.status !== "active") {
        throw new DealQuoteInactiveError(quote.id, quote.status);
      }

      if (quote.expiresAt.getTime() <= Date.now()) {
        throw new DealQuoteInactiveError(quote.id, "expired");
      }

      if (!quote.fromCurrency || !quote.toCurrency) {
        throw new ValidationError(`Quote ${quote.id} is missing currency codes`);
      }

      const currencyCodes = new Set(
        quoteDetails.financialLines.map((line) => line.currency),
      );
      const currencies = await Promise.all(
        Array.from(currencyCodes).map((code) => deps.currencies.findByCode(code)),
      );
      const currencyIdByCode = new Map(
        currencies.map((currency) => [currency.code, currency.id]),
      );

      const quoteFeeAmountMinor = quoteDetails.financialLines.reduce(
        (total, line) =>
          line.bucket === "fee_revenue" && line.currency === quote.fromCurrency
            ? total + line.amountMinor
            : total,
        0n,
      );
      const quoteAdditionalExpensesByCurrency = quoteDetails.financialLines.reduce(
        (totals, line) => {
          if (line.bucket !== "pass_through") {
            return totals;
          }

          totals.set(
            line.currency,
            (totals.get(line.currency) ?? 0n) + line.amountMinor,
          );

          return totals;
        },
        new Map<string, bigint>(),
      );

      if (quoteFeeAmountMinor < 0n) {
        throw new ValidationError(
          `Quote ${quote.id} has negative fee_revenue total`,
        );
      }

      for (const amountMinor of quoteAdditionalExpensesByCurrency.values()) {
        if (amountMinor < 0n) {
          throw new ValidationError(
            `Quote ${quote.id} has negative pass_through total`,
          );
        }
      }

      const originalAmountMinor = quote.fromAmountMinor;
      const agreement = await deps.agreements.agreements.queries.findById(
        workflow.summary.agreementId,
      );

      if (!agreement) {
        throw new NotFoundError("Agreement", workflow.summary.agreementId);
      }

      const resolvedFees = await resolveCalculationFees({
        agreement,
        currencies: deps.currencies,
        overrides: {
          agentFeePercent: input.agentFeePercent,
          fixedFeeAmount: input.fixedFeeAmount,
          fixedFeeCurrencyCode: input.fixedFeeCurrencyCode,
        },
        quote,
        quoteAdditionalExpensesByCurrency,
        quoteFeeAmountMinor,
      });

      const feeBps = resolvedFees.feeBps;
      const feeAmountMinor = resolvedFees.feeAmountMinor;
      const totalAmountMinor = originalAmountMinor + feeAmountMinor;
      const feeAmountInBaseMinor = convertQuoteComponentToBaseMinorHalfUp({
        amountMinor: feeAmountMinor,
        quote,
      });
      const totalInBaseMinor = quote.toAmountMinor;
      const additionalExpensesAmountMinor =
        resolvedFees.additionalExpensesAmountMinor;
      const additionalExpensesCurrencyId =
        resolvedFees.additionalExpensesCurrencyId;
      const additionalExpensesInBaseMinor =
        resolvedFees.additionalExpensesInBaseMinor;
      const totalWithExpensesInBaseMinor =
        totalInBaseMinor + feeAmountInBaseMinor + additionalExpensesInBaseMinor;

      const financialLines = quoteDetails.financialLines
        .filter((line) => line.amountMinor !== 0n)
        .map((line) => {
          const currencyId = currencyIdByCode.get(line.currency);
          if (!currencyId) {
            throw new ValidationError(`Currency ${line.currency} is not configured`);
          }

          return {
            kind: line.bucket,
            currencyId,
            amountMinor: line.amountMinor.toString(),
          };
        });

      if (resolvedFees.feeLineAmountMinor > 0n) {
        financialLines.push({
          amountMinor: resolvedFees.feeLineAmountMinor.toString(),
          currencyId: quote.fromCurrencyId,
          kind: "fee_revenue",
        });
      }

      if (
        resolvedFees.fixedFeeLineAmountMinor > 0n &&
        resolvedFees.fixedFeeLineCurrencyId
      ) {
        financialLines.push({
          amountMinor: resolvedFees.fixedFeeLineAmountMinor.toString(),
          currencyId: resolvedFees.fixedFeeLineCurrencyId,
          kind: "pass_through",
        });
      }

      const calculation = await deps.calculations.calculations.commands.create({
        actorUserId: input.actorUserId,
        additionalExpensesAmountMinor:
          additionalExpensesAmountMinor.toString(),
        additionalExpensesCurrencyId,
        additionalExpensesInBaseMinor:
          additionalExpensesInBaseMinor.toString(),
        additionalExpensesRateDen: resolvedFees.additionalExpensesRateDen,
        additionalExpensesRateNum: resolvedFees.additionalExpensesRateNum,
        additionalExpensesRateSource: resolvedFees.additionalExpensesRateSource,
        baseCurrencyId: quote.toCurrencyId,
        calculationCurrencyId: quote.fromCurrencyId,
        calculationTimestamp: quote.createdAt,
        feeAmountInBaseMinor: feeAmountInBaseMinor.toString(),
        feeAmountMinor: feeAmountMinor.toString(),
        feeBps: feeBps.toString(),
        financialLines,
        fxQuoteId: quote.id,
        idempotencyKey: input.idempotencyKey,
        originalAmountMinor: originalAmountMinor.toString(),
        quoteSnapshot: serializeQuoteDetails(quoteDetails),
        rateDen: quote.rateDen.toString(),
        rateNum: quote.rateNum.toString(),
        rateSource: "fx_quote",
        totalAmountMinor: totalAmountMinor.toString(),
        totalInBaseMinor: totalInBaseMinor.toString(),
        totalWithExpensesInBaseMinor:
          totalWithExpensesInBaseMinor.toString(),
      });

      await deps.deals.deals.commands.linkCalculationFromAcceptedQuote({
        actorUserId: input.actorUserId,
        calculationId: calculation.id,
        dealId: input.dealId,
        quoteId: quote.id,
      });

      return calculation;
    },

    async expireQuotes(now: Date): Promise<ExpiredQuoteRecord[]> {
      const expiredQuotes = await deps.treasury.quotes.commands.expireQuotes(now);

      await Promise.all(
        expiredQuotes
          .filter((quote) => quote.dealId)
          .map(async (quote) => {
            await deps.deals.deals.commands.appendTimelineEvent({
              dealId: quote.dealId!,
              payload: {
                expiresAt: quote.expiresAt,
                quoteId: quote.id,
              },
              sourceRef: `quote:${quote.id}:expired`,
              type: "quote_expired",
              visibility: "internal",
            });
          }),
      );

      return expiredQuotes;
    },

    async markQuoteUsed(input: TreasuryMarkQuoteUsedInput): Promise<TreasuryQuoteRecord> {
      const dealId = input.dealId ?? null;

      if (dealId) {
        await requireCurrentAcceptedQuote({
          allowUsedDocumentId: input.usedDocumentId ?? null,
          dealId,
          deals: deps.deals,
          now: input.at,
          quoteId: input.quoteId,
        });
      }

      const quote = await deps.treasury.quotes.commands.markQuoteUsed(input);
      const linkedDealId = quote.dealId ?? dealId;

      if (linkedDealId) {
        await deps.deals.deals.commands.appendTimelineEvent({
          dealId: linkedDealId,
          payload: {
            quoteId: quote.id,
            usedAt: quote.usedAt,
            usedByRef: quote.usedByRef,
            usedDocumentId: quote.usedDocumentId,
          },
          sourceRef: `quote:${quote.id}:used:${quote.usedByRef ?? "unknown"}`,
          type: "quote_used",
          visibility: "internal",
        });
      }

      return quote;
    },
  };
}

export type DealQuoteWorkflow = ReturnType<typeof createDealQuoteWorkflow>;
