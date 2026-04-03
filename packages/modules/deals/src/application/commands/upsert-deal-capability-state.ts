import { z } from "zod";

import type { ModuleRuntime } from "@bedrock/shared/core";
import { ValidationError } from "@bedrock/shared/core/errors";

import { UpsertDealCapabilityStateInputSchema } from "../contracts/commands";
import type { DealCapabilityState } from "../contracts/dto";
import type { DealsCommandUnitOfWork } from "../ports/deals.uow";

const UpsertDealCapabilityStateCommandInputSchema =
  UpsertDealCapabilityStateInputSchema.extend({
    actorUserId: z.string().trim().min(1),
  });

type UpsertDealCapabilityStateCommandInput = z.infer<
  typeof UpsertDealCapabilityStateCommandInputSchema
>;

export class UpsertDealCapabilityStateCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly commandUow: DealsCommandUnitOfWork,
  ) {}

  async execute(
    raw: UpsertDealCapabilityStateCommandInput,
  ): Promise<DealCapabilityState> {
    const validated = UpsertDealCapabilityStateCommandInputSchema.parse(raw);

    return this.commandUow.run(async (tx) => {
      await tx.dealStore.upsertDealCapabilityState({
        applicantCounterpartyId: validated.applicantCounterpartyId,
        capabilityKind: validated.capabilityKind,
        dealType: validated.dealType,
        id: this.runtime.generateUuid(),
        internalEntityOrganizationId: validated.internalEntityOrganizationId,
        note: validated.note,
        reasonCode: validated.reasonCode,
        status: validated.status,
        updatedByUserId: validated.actorUserId,
      });

      const [updated] = await tx.dealReads.listCapabilityStates({
        applicantCounterpartyId: validated.applicantCounterpartyId,
        capabilityKind: validated.capabilityKind,
        dealType: validated.dealType,
        internalEntityOrganizationId: validated.internalEntityOrganizationId,
      });

      if (!updated) {
        throw new ValidationError("Capability state upsert did not persist");
      }

      return updated;
    });
  }
}
