import type { ModuleRuntime } from "@bedrock/shared/core";
import { ValidationError } from "@bedrock/shared/core/errors";
import { mulDivRoundHalfUp } from "@bedrock/shared/money";

import { CalculationNotFoundError } from "../../errors";
import type { NormalizedCreateCalculationInput } from "../contracts/commands";
import type { CalculationDetails } from "../contracts/dto";
import type { CalculationsCommandTx } from "../ports/calculations.uow";

function inferLineClassification(input: {
  kind: NormalizedCreateCalculationInput["financialLines"][number]["kind"];
}) {
  switch (input.kind) {
    case "fee_revenue":
    case "spread_revenue":
      return "revenue" as const;
    case "provider_fee_expense":
      return "expense" as const;
    case "pass_through":
      return "pass_through" as const;
    case "adjustment":
      return "adjustment" as const;
    default:
      return null;
  }
}

function toBaseMinor(input: {
  amountMinor: bigint;
  baseCurrencyId: string;
  calculationCurrencyId: string;
  currencyId: string;
  rateDen: bigint;
  rateNum: bigint;
}) {
  if (input.currencyId === input.baseCurrencyId) {
    return input.amountMinor;
  }

  if (input.currencyId === input.calculationCurrencyId) {
    return mulDivRoundHalfUp(input.amountMinor, input.rateNum, input.rateDen);
  }

  throw new ValidationError(
    `Cannot derive base-denominated aggregates for currency ${input.currencyId}`,
  );
}

function deriveSnapshotEconomics(input: {
  normalized: NormalizedCreateCalculationInput;
}) {
  if (
    input.normalized.grossRevenueInBaseMinor !== null &&
    input.normalized.expenseAmountInBaseMinor !== null &&
    input.normalized.passThroughAmountInBaseMinor !== null &&
    input.normalized.netMarginInBaseMinor !== null
  ) {
    return {
      expenseAmountInBaseMinor: input.normalized.expenseAmountInBaseMinor,
      grossRevenueInBaseMinor: input.normalized.grossRevenueInBaseMinor,
      netMarginInBaseMinor: input.normalized.netMarginInBaseMinor,
      passThroughAmountInBaseMinor:
        input.normalized.passThroughAmountInBaseMinor,
    };
  }

  let grossRevenueInBaseMinor = 0n;
  let expenseAmountInBaseMinor = 0n;
  let passThroughAmountInBaseMinor = 0n;
  let netMarginInBaseMinor = 0n;

  for (const line of input.normalized.financialLines) {
    const classification = line.classification ?? inferLineClassification(line);

    if (!classification) {
      continue;
    }

    const baseMinor = toBaseMinor({
      amountMinor: line.amountMinor,
      baseCurrencyId: input.normalized.baseCurrencyId,
      calculationCurrencyId: input.normalized.calculationCurrencyId,
      currencyId: line.currencyId,
      rateDen: input.normalized.rateDen,
      rateNum: input.normalized.rateNum,
    });

    if (classification === "revenue") {
      grossRevenueInBaseMinor += baseMinor;
      netMarginInBaseMinor += baseMinor;
      continue;
    }

    if (classification === "expense") {
      expenseAmountInBaseMinor += baseMinor;
      netMarginInBaseMinor -= baseMinor;
      continue;
    }

    if (classification === "pass_through") {
      passThroughAmountInBaseMinor += baseMinor;
      continue;
    }

    if (classification === "adjustment") {
      netMarginInBaseMinor += baseMinor;
    }
  }

  return {
    expenseAmountInBaseMinor,
    grossRevenueInBaseMinor,
    netMarginInBaseMinor,
    passThroughAmountInBaseMinor,
  };
}

export async function persistCalculation(input: {
  normalized: NormalizedCreateCalculationInput;
  runtime: ModuleRuntime;
  tx: CalculationsCommandTx;
}): Promise<CalculationDetails> {
  const calculationId = input.runtime.generateUuid();
  const snapshotId = input.runtime.generateUuid();
  const lines = input.normalized.financialLines;
  const economics = deriveSnapshotEconomics({ normalized: input.normalized });

  await input.tx.calculationStore.createCalculationRoot({
    id: calculationId,
  });

  await input.tx.calculationStore.createCalculationSnapshot({
    id: snapshotId,
    calculationId,
    snapshotNumber: 1,
    agreementVersionId: input.normalized.agreementVersionId ?? null,
    agreementFeeBps: input.normalized.agreementFeeBps,
    agreementFeeAmountMinor: input.normalized.agreementFeeAmountMinor,
    calculationCurrencyId: input.normalized.calculationCurrencyId,
    originalAmountMinor: input.normalized.originalAmountMinor,
    totalFeeBps: input.normalized.totalFeeBps,
    totalFeeAmountMinor: input.normalized.totalFeeAmountMinor,
    totalAmountMinor: input.normalized.totalAmountMinor,
    baseCurrencyId: input.normalized.baseCurrencyId,
    totalFeeAmountInBaseMinor: input.normalized.totalFeeAmountInBaseMinor,
    totalInBaseMinor: input.normalized.totalInBaseMinor,
    dealId: input.normalized.dealId,
    dealSnapshot: input.normalized.dealSnapshot,
    additionalExpensesCurrencyId: input.normalized.additionalExpensesCurrencyId,
    additionalExpensesAmountMinor:
      input.normalized.additionalExpensesAmountMinor,
    additionalExpensesInBaseMinor:
      input.normalized.additionalExpensesInBaseMinor,
    fixedFeeAmountMinor: input.normalized.fixedFeeAmountMinor,
    fixedFeeCurrencyId: input.normalized.fixedFeeCurrencyId,
    quoteMarkupBps: input.normalized.quoteMarkupBps,
    quoteMarkupAmountMinor: input.normalized.quoteMarkupAmountMinor,
    grossRevenueInBaseMinor: economics.grossRevenueInBaseMinor,
    expenseAmountInBaseMinor: economics.expenseAmountInBaseMinor,
    passThroughAmountInBaseMinor: economics.passThroughAmountInBaseMinor,
    netMarginInBaseMinor: economics.netMarginInBaseMinor,
    routeVersionId: input.normalized.routeVersionId,
    routeSnapshot: input.normalized.routeSnapshot,
    referenceRateSource: input.normalized.referenceRateSource,
    referenceRateNum: input.normalized.referenceRateNum,
    referenceRateDen: input.normalized.referenceRateDen,
    referenceRateAsOf: input.normalized.referenceRateAsOf,
    pricingProvenance: input.normalized.pricingProvenance,
    totalWithExpensesInBaseMinor:
      input.normalized.totalWithExpensesInBaseMinor,
    rateSource: input.normalized.rateSource,
    rateNum: input.normalized.rateNum,
    rateDen: input.normalized.rateDen,
    additionalExpensesRateSource:
      input.normalized.additionalExpensesRateSource,
    additionalExpensesRateNum: input.normalized.additionalExpensesRateNum,
    additionalExpensesRateDen: input.normalized.additionalExpensesRateDen,
    calculationTimestamp: input.normalized.calculationTimestamp,
    fxQuoteId: input.normalized.fxQuoteId,
    quoteSnapshot: input.normalized.quoteSnapshot ?? null,
    state: input.normalized.state,
  });

  await input.tx.calculationStore.createCalculationLines(
    lines.map((line, idx) => ({
      id: input.runtime.generateUuid(),
      calculationSnapshotId: snapshotId,
      dealId: line.dealId ?? input.normalized.dealId,
      routeVersionId: line.routeVersionId ?? input.normalized.routeVersionId,
      routeLegId: line.routeLegId,
      routeComponentId: line.routeComponentId,
      componentCode: line.componentCode ?? line.kind,
      componentFamily: line.componentFamily ?? line.kind,
      classification: line.classification ?? inferLineClassification(line),
      idx,
      kind: line.kind,
      formulaType: line.formulaType,
      basisType: line.basisType,
      currencyId: line.currencyId,
      amountMinor: line.amountMinor,
      basisAmountMinor: line.basisAmountMinor,
      inputBps: line.inputBps,
      inputFixedAmountMinor: line.inputFixedAmountMinor,
      inputPerMillion: line.inputPerMillion,
      inputManualAmountMinor: line.inputManualAmountMinor,
      sourceKind: line.sourceKind,
    })),
  );

  await input.tx.calculationStore.setCurrentSnapshot({
    calculationId,
    currentSnapshotId: snapshotId,
  });

  const created = await input.tx.calculationReads.findById(calculationId);

  if (!created) {
    throw new CalculationNotFoundError(calculationId);
  }

  input.runtime.log.info("Calculation created", {
    calculationId,
    fxQuoteId: input.normalized.fxQuoteId,
  });

  return created;
}
