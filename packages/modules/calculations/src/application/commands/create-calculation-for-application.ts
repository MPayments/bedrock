import type { IdempotencyPort } from "@bedrock/platform/idempotency";
import type { ModuleRuntime } from "@bedrock/shared/core";
import { NotFoundError } from "@bedrock/shared/core/errors";
import { z } from "zod";

import { CALCULATIONS_CREATE_FOR_APPLICATION_IDEMPOTENCY_SCOPE } from "../../domain/constants";
import {
  CreateCalculationInputSchema,
  normalizeCreateCalculationInput,
  type CreateCalculationInput,
} from "../contracts/commands";
import type { CalculationDetails } from "../contracts/dto";
import type { CalculationsCommandUnitOfWork } from "../ports/calculations.uow";
import type { CalculationReferencesPort } from "../ports/references.port";
import {
  persistCalculation,
} from "./create-calculation-record";
import {
  validateCurrencyReferences,
  validateQuoteProvenance,
} from "./create-calculation";

const CreateCalculationForApplicationCommandInputSchema =
  CreateCalculationInputSchema.extend({
    actorUserId: z.string().trim().min(1),
    applicationId: z.coerce.number().int(),
    idempotencyKey: z.string().trim().min(1).max(255),
  });

type CreateCalculationForApplicationCommandInput = CreateCalculationInput & {
  actorUserId: string;
  applicationId: number;
  idempotencyKey: string;
};

export class CreateCalculationForApplicationCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly commandUow: CalculationsCommandUnitOfWork,
    private readonly idempotency: IdempotencyPort,
    private readonly references: CalculationReferencesPort,
  ) {}

  async execute(
    raw: CreateCalculationForApplicationCommandInput,
  ): Promise<CalculationDetails> {
    const validated =
      CreateCalculationForApplicationCommandInputSchema.parse(raw);
    const normalized = normalizeCreateCalculationInput(validated);

    await validateCurrencyReferences(normalized, this.references);
    await validateQuoteProvenance(normalized, this.references);

    return this.commandUow.run((tx) =>
      this.idempotency.withIdempotencyTx({
        tx: tx.transaction,
        scope: CALCULATIONS_CREATE_FOR_APPLICATION_IDEMPOTENCY_SCOPE,
        idempotencyKey: validated.idempotencyKey,
        request: {
          applicationId: validated.applicationId,
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
            throw new NotFoundError("Calculation", calculationId);
          }

          return replayed;
        },
        handler: async () =>
          persistCalculation({
            applicationId: validated.applicationId,
            normalized,
            runtime: this.runtime,
            tx,
          }),
      }),
    );
  }
}
