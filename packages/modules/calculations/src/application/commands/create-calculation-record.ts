import type { ModuleRuntime } from "@bedrock/shared/core";

import { buildCalculationLineDrafts } from "../../domain/line-builder";
import { CalculationNotFoundError } from "../../errors";
import type { NormalizedCreateCalculationInput } from "../contracts/commands";
import type { CalculationDetails } from "../contracts/dto";
import type { CalculationsCommandTx } from "../ports/calculations.uow";

export async function persistCalculation(input: {
  normalized: NormalizedCreateCalculationInput;
  runtime: ModuleRuntime;
  tx: CalculationsCommandTx;
}): Promise<CalculationDetails> {
  const calculationId = input.runtime.generateUuid();
  const snapshotId = input.runtime.generateUuid();
  const lines = buildCalculationLineDrafts(input.normalized);

  await input.tx.calculationStore.createCalculationRoot({
    id: calculationId,
  });

  await input.tx.calculationStore.createCalculationSnapshot({
    id: snapshotId,
    calculationId,
    snapshotNumber: 1,
    calculationCurrencyId: input.normalized.calculationCurrencyId,
    originalAmountMinor: input.normalized.originalAmountMinor,
    feeBps: input.normalized.feeBps,
    feeAmountMinor: input.normalized.feeAmountMinor,
    totalAmountMinor: input.normalized.totalAmountMinor,
    baseCurrencyId: input.normalized.baseCurrencyId,
    feeAmountInBaseMinor: input.normalized.feeAmountInBaseMinor,
    totalInBaseMinor: input.normalized.totalInBaseMinor,
    additionalExpensesCurrencyId: input.normalized.additionalExpensesCurrencyId,
    additionalExpensesAmountMinor:
      input.normalized.additionalExpensesAmountMinor,
    additionalExpensesInBaseMinor:
      input.normalized.additionalExpensesInBaseMinor,
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
  });

  await input.tx.calculationStore.createCalculationLines(
    lines.map((line) => ({
      id: input.runtime.generateUuid(),
      calculationSnapshotId: snapshotId,
      idx: line.idx,
      kind: line.kind,
      currencyId: line.currencyId,
      amountMinor: line.amountMinor,
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
