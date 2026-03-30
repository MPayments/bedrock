import type { IdempotencyPort } from "@bedrock/platform/idempotency";
import type { ModuleRuntime } from "@bedrock/shared/core";
import { NotFoundError } from "@bedrock/shared/core/errors";
import { z } from "zod";

import { buildCalculationLineDrafts } from "../../domain/line-builder";
import { CALCULATIONS_CREATE_IDEMPOTENCY_SCOPE } from "../../domain/constants";
import {
  CalculationFxQuoteCurrencyMismatchError,
  CalculationFxQuoteRateMismatchError,
  CalculationNotFoundError,
} from "../../errors";
import {
  CreateCalculationInputSchema,
  normalizeCreateCalculationInput,
  type CreateCalculationInput,
  type NormalizedCreateCalculationInput,
} from "../contracts/commands";
import type { CalculationDetails } from "../contracts/dto";
import type { CalculationsCommandUnitOfWork } from "../ports/calculations.uow";
import type { CalculationReferencesPort } from "../ports/references.port";

const CreateCalculationCommandInputSchema = CreateCalculationInputSchema.extend({
  actorUserId: z.string().trim().min(1),
  idempotencyKey: z.string().trim().min(1).max(255),
});

type CreateCalculationCommandInput = CreateCalculationInput & {
  actorUserId: string;
  idempotencyKey: string;
};

async function validateCurrencyReferences(
  input: NormalizedCreateCalculationInput,
  references: CalculationReferencesPort,
) {
  const ids = new Set<string>([
    input.calculationCurrencyId,
    input.baseCurrencyId,
  ]);

  if (input.additionalExpensesCurrencyId) {
    ids.add(input.additionalExpensesCurrencyId);
  }

  await Promise.all(Array.from(ids).map((id) => references.assertCurrencyExists(id)));
}

async function validateQuoteProvenance(
  input: NormalizedCreateCalculationInput,
  references: CalculationReferencesPort,
) {
  if (!input.fxQuoteId) {
    return;
  }

  const quote = await references.findFxQuoteById(input.fxQuoteId);

  if (!quote) {
    throw new NotFoundError("FX quote", input.fxQuoteId);
  }

  if (
    input.rateSource === "fx_quote" &&
    (quote.fromCurrencyId !== input.calculationCurrencyId ||
      quote.toCurrencyId !== input.baseCurrencyId)
  ) {
    throw new CalculationFxQuoteCurrencyMismatchError(input.fxQuoteId, "primary");
  }

  if (
    input.rateSource === "fx_quote" &&
    (quote.rateNum !== input.rateNum || quote.rateDen !== input.rateDen)
  ) {
    throw new CalculationFxQuoteRateMismatchError(input.fxQuoteId, "primary");
  }

  if (input.additionalExpensesRateSource !== "fx_quote") {
    return;
  }

  if (
    input.additionalExpensesCurrencyId !== quote.fromCurrencyId ||
    input.baseCurrencyId !== quote.toCurrencyId
  ) {
    throw new CalculationFxQuoteCurrencyMismatchError(
      input.fxQuoteId,
      "additional_expenses",
    );
  }

  if (
    input.additionalExpensesRateNum !== quote.rateNum ||
    input.additionalExpensesRateDen !== quote.rateDen
  ) {
    throw new CalculationFxQuoteRateMismatchError(
      input.fxQuoteId,
      "additional_expenses",
    );
  }
}

export class CreateCalculationCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly commandUow: CalculationsCommandUnitOfWork,
    private readonly idempotency: IdempotencyPort,
    private readonly references: CalculationReferencesPort,
  ) {}

  async execute(raw: CreateCalculationCommandInput): Promise<CalculationDetails> {
    const validated = CreateCalculationCommandInputSchema.parse(raw);
    const normalized = normalizeCreateCalculationInput(validated);

    await validateCurrencyReferences(normalized, this.references);
    await validateQuoteProvenance(normalized, this.references);

    return this.commandUow.run((tx) =>
      this.idempotency.withIdempotencyTx({
        tx: tx.transaction,
        scope: CALCULATIONS_CREATE_IDEMPOTENCY_SCOPE,
        idempotencyKey: validated.idempotencyKey,
        request: {
          calculationCurrencyId: validated.calculationCurrencyId,
          originalAmountMinor: validated.originalAmountMinor,
          feeBps: validated.feeBps,
          feeAmountMinor: validated.feeAmountMinor,
          totalAmountMinor: validated.totalAmountMinor,
          baseCurrencyId: validated.baseCurrencyId,
          feeAmountInBaseMinor: validated.feeAmountInBaseMinor,
          totalInBaseMinor: validated.totalInBaseMinor,
          additionalExpensesCurrencyId:
            validated.additionalExpensesCurrencyId ?? null,
          additionalExpensesAmountMinor: validated.additionalExpensesAmountMinor,
          additionalExpensesInBaseMinor:
            validated.additionalExpensesInBaseMinor,
          totalWithExpensesInBaseMinor:
            validated.totalWithExpensesInBaseMinor,
          rateSource: validated.rateSource,
          rateNum: validated.rateNum,
          rateDen: validated.rateDen,
          additionalExpensesRateSource:
            validated.additionalExpensesRateSource ?? null,
          additionalExpensesRateNum:
            validated.additionalExpensesRateNum ?? null,
          additionalExpensesRateDen:
            validated.additionalExpensesRateDen ?? null,
          calculationTimestamp: validated.calculationTimestamp.toISOString(),
          fxQuoteId: validated.fxQuoteId ?? null,
        },
        actorId: validated.actorUserId,
        serializeResult: (result) => ({ calculationId: result.id }),
        loadReplayResult: async ({ storedResult }) => {
          const calculationId = String(storedResult?.calculationId ?? "");
          const replayed = await tx.calculationReads.findById(calculationId);

          if (!replayed) {
            throw new CalculationNotFoundError(calculationId);
          }

          return replayed;
        },
        handler: async () => {
          const calculationId = this.runtime.generateUuid();
          const snapshotId = this.runtime.generateUuid();
          const lines = buildCalculationLineDrafts(normalized);

          await tx.calculationStore.createCalculationRoot({
            id: calculationId,
          });

          await tx.calculationStore.createCalculationSnapshot({
            id: snapshotId,
            calculationId,
            snapshotNumber: 1,
            calculationCurrencyId: normalized.calculationCurrencyId,
            originalAmountMinor: normalized.originalAmountMinor,
            feeBps: normalized.feeBps,
            feeAmountMinor: normalized.feeAmountMinor,
            totalAmountMinor: normalized.totalAmountMinor,
            baseCurrencyId: normalized.baseCurrencyId,
            feeAmountInBaseMinor: normalized.feeAmountInBaseMinor,
            totalInBaseMinor: normalized.totalInBaseMinor,
            additionalExpensesCurrencyId:
              normalized.additionalExpensesCurrencyId,
            additionalExpensesAmountMinor:
              normalized.additionalExpensesAmountMinor,
            additionalExpensesInBaseMinor:
              normalized.additionalExpensesInBaseMinor,
            totalWithExpensesInBaseMinor:
              normalized.totalWithExpensesInBaseMinor,
            rateSource: normalized.rateSource,
            rateNum: normalized.rateNum,
            rateDen: normalized.rateDen,
            additionalExpensesRateSource:
              normalized.additionalExpensesRateSource,
            additionalExpensesRateNum: normalized.additionalExpensesRateNum,
            additionalExpensesRateDen: normalized.additionalExpensesRateDen,
            calculationTimestamp: normalized.calculationTimestamp,
            fxQuoteId: normalized.fxQuoteId,
          });

          await tx.calculationStore.createCalculationLines(
            lines.map((line) => ({
              id: this.runtime.generateUuid(),
              calculationSnapshotId: snapshotId,
              idx: line.idx,
              kind: line.kind,
              currencyId: line.currencyId,
              amountMinor: line.amountMinor,
            })),
          );

          await tx.calculationStore.setCurrentSnapshot({
            calculationId,
            currentSnapshotId: snapshotId,
          });

          const created = await tx.calculationReads.findById(calculationId);

          if (!created) {
            throw new CalculationNotFoundError(calculationId);
          }

          this.runtime.log.info("Calculation created", {
            calculationId,
            fxQuoteId: normalized.fxQuoteId,
          });

          return created;
        },
      }),
    );
  }
}
