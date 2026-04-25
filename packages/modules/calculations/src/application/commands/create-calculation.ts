import { z } from "zod";

import type { ModuleRuntime } from "@bedrock/shared/core";
import { NotFoundError } from "@bedrock/shared/core/errors";

import { persistCalculation } from "./create-calculation-record";
import { CALCULATIONS_CREATE_IDEMPOTENCY_SCOPE } from "../../domain/constants";
import {
  CalculationFxQuoteCurrencyMismatchError,
  CalculationFxQuoteRateMismatchError,
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

  for (const line of input.financialLines) {
    ids.add(line.currencyId);
  }

  await Promise.all(
    Array.from(ids).map((id) => references.assertCurrencyExists(id)),
  );
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
    private readonly references: CalculationReferencesPort,
  ) {}

  async execute(raw: CreateCalculationCommandInput): Promise<CalculationDetails> {
    const validated = CreateCalculationCommandInputSchema.parse(raw);
    const normalized = normalizeCreateCalculationInput(validated);

    await validateCurrencyReferences(normalized, this.references);
    await validateQuoteProvenance(normalized, this.references);

    return this.commandUow.run((tx) =>
      tx.idempotency.withIdempotency({
        scope: CALCULATIONS_CREATE_IDEMPOTENCY_SCOPE,
        idempotencyKey: validated.idempotencyKey,
        request: {
          agreementVersionId: validated.agreementVersionId ?? null,
          agreementFeeBps: validated.agreementFeeBps,
          agreementFeeAmountMinor: validated.agreementFeeAmountMinor,
          calculationCurrencyId: validated.calculationCurrencyId,
          originalAmountMinor: validated.originalAmountMinor,
          totalFeeBps: validated.totalFeeBps,
          totalFeeAmountMinor: validated.totalFeeAmountMinor,
          totalAmountMinor: validated.totalAmountMinor,
          baseCurrencyId: validated.baseCurrencyId,
          totalFeeAmountInBaseMinor: validated.totalFeeAmountInBaseMinor,
          totalInBaseMinor: validated.totalInBaseMinor,
          additionalExpensesCurrencyId:
            validated.additionalExpensesCurrencyId ?? null,
          additionalExpensesAmountMinor: validated.additionalExpensesAmountMinor,
          additionalExpensesInBaseMinor:
            validated.additionalExpensesInBaseMinor,
          fixedFeeAmountMinor: validated.fixedFeeAmountMinor,
          fixedFeeCurrencyId: validated.fixedFeeCurrencyId ?? null,
          quoteMarkupBps: validated.quoteMarkupBps,
          quoteMarkupAmountMinor: validated.quoteMarkupAmountMinor,
          referenceRateSource: validated.referenceRateSource ?? null,
          referenceRateNum: validated.referenceRateNum ?? null,
          referenceRateDen: validated.referenceRateDen ?? null,
          referenceRateAsOf:
            validated.referenceRateAsOf?.toISOString() ?? null,
          pricingProvenance: validated.pricingProvenance ?? null,
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
          financialLines: validated.financialLines ?? [],
          quoteSnapshot: validated.quoteSnapshot ?? null,
        },
        actorId: validated.actorUserId,
        serializeResult: (result) => ({ calculationId: result.id }),
        loadReplayResult: async ({ storedResult }) => {
          const calculationId = String(storedResult?.calculationId ?? "");
          const replayed = await tx.calculationReads.findById(calculationId);

          if (!replayed) {
            throw new NotFoundError("Calculation", calculationId);
          }

          return replayed;
        },
        handler: async () =>
          persistCalculation({
            normalized,
            runtime: this.runtime,
            tx,
          }),
      }),
    );
  }
}
