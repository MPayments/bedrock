import { z } from "zod";

import { NotFoundError } from "@bedrock/shared/core/errors";

import {
  UpdateCalculationStateInputSchema,
  type UpdateCalculationStateInput,
} from "../contracts/commands";
import type { CalculationDetails } from "../contracts/dto";
import type { CalculationsCommandUnitOfWork } from "../ports/calculations.uow";

const UpdateCalculationStateCommandInputSchema =
  UpdateCalculationStateInputSchema.extend({
    actorUserId: z.string().trim().min(1),
  });

type UpdateCalculationStateCommandInput = UpdateCalculationStateInput & {
  actorUserId: string;
};

export class UpdateCalculationStateCommand {
  constructor(
    private readonly commandUow: CalculationsCommandUnitOfWork,
  ) {}

  async execute(
    raw: UpdateCalculationStateCommandInput,
  ): Promise<CalculationDetails> {
    const validated = UpdateCalculationStateCommandInputSchema.parse(raw);

    return this.commandUow.run(async (tx) => {
      const existing = await tx.calculationReads.findById(validated.calculationId);

      if (!existing) {
        throw new NotFoundError("Calculation", validated.calculationId);
      }

      await tx.calculationStore.setCurrentSnapshotState({
        calculationId: validated.calculationId,
        state: validated.state,
      });

      const updated = await tx.calculationReads.findById(validated.calculationId);

      if (!updated) {
        throw new NotFoundError("Calculation", validated.calculationId);
      }

      return updated;
    });
  }
}
