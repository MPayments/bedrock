import { z } from "zod";

import type { ModuleRuntime } from "@bedrock/shared/core";
import { NotFoundError } from "@bedrock/shared/core/errors";

import {
  DealCalculationInactiveError,
  DealNotFoundError,
} from "../../errors";
import {
  AttachDealCalculationInputSchema,
  type AttachDealCalculationInput,
} from "../contracts/commands";
import type { DealDetails } from "../contracts/dto";
import type { DealsCommandUnitOfWork } from "../ports/deals.uow";
import type { DealReferencesPort } from "../ports/references.port";

const AttachDealCalculationCommandInputSchema =
  AttachDealCalculationInputSchema.extend({
    actorUserId: z.string().trim().min(1),
    dealId: z.uuid(),
  });

type AttachDealCalculationCommandInput = AttachDealCalculationInput & {
  actorUserId: string;
  dealId: string;
};

export class AttachDealCalculationCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly commandUow: DealsCommandUnitOfWork,
    private readonly references: DealReferencesPort,
  ) {}

  async execute(raw: AttachDealCalculationCommandInput): Promise<DealDetails> {
    const validated = AttachDealCalculationCommandInputSchema.parse(raw);
    const calculation = await this.references.findCalculationById(
      validated.calculationId,
    );

    if (!calculation) {
      throw new NotFoundError("Calculation", validated.calculationId);
    }

    if (!calculation.isActive) {
      throw new DealCalculationInactiveError(validated.calculationId);
    }

    return this.commandUow.run(async (tx) => {
      const existing = await tx.dealReads.findById(validated.dealId);
      if (!existing) {
        throw new DealNotFoundError(validated.dealId);
      }

      await tx.dealStore.updateDealRoot({
        dealId: validated.dealId,
        calculationId: validated.calculationId,
      });
      await tx.dealStore.createDealCalculationLinks([
        {
          id: this.runtime.generateUuid(),
          calculationId: validated.calculationId,
          dealId: validated.dealId,
        },
      ]);

      const updated = await tx.dealReads.findById(validated.dealId);
      if (!updated) {
        throw new DealNotFoundError(validated.dealId);
      }

      return updated;
    });
  }
}
