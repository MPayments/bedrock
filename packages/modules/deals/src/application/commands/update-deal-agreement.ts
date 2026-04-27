import { z } from "zod";

import type { ModuleRuntime } from "@bedrock/shared/core";
import { ValidationError } from "@bedrock/shared/core/errors";

import {
  DealAgreementCustomerMismatchError,
  DealAgreementInactiveError,
  DealNotFoundError,
} from "../../errors";
import { UpdateDealAgreementInputSchema } from "../contracts/commands";
import { type DealWorkflowProjection } from "../contracts/dto";
import type { DealsCommandUnitOfWork } from "../ports/deals.uow";
import type { DealReferencesPort } from "../ports/references.port";
import {
  buildDealParticipantRows,
  createTimelinePayloadEvent,
} from "../shared/workflow-state";

const UpdateDealAgreementCommandInputSchema =
  UpdateDealAgreementInputSchema.extend({
    actorUserId: z.string().trim().min(1),
    id: z.string().uuid(),
  });

type UpdateDealAgreementCommandInput = z.infer<
  typeof UpdateDealAgreementCommandInputSchema
>;

export class UpdateDealAgreementCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly commandUow: DealsCommandUnitOfWork,
    private readonly references: DealReferencesPort,
  ) {}

  async execute(
    input: UpdateDealAgreementCommandInput,
  ): Promise<DealWorkflowProjection> {
    const validated = UpdateDealAgreementCommandInputSchema.parse(input);

    return this.commandUow.run(async (tx) => {
      const existing = await tx.dealReads.findWorkflowById(validated.id);

      if (!existing) {
        throw new DealNotFoundError(validated.id);
      }

      if (existing.summary.status !== "draft") {
        throw new ValidationError(
          `Deal ${validated.id} agreement can only be changed while draft`,
        );
      }

      if (existing.summary.agreementId === validated.agreementId) {
        return existing;
      }

      const agreement = await this.references.findAgreementById(
        validated.agreementId,
      );

      if (!agreement) {
        throw new ValidationError(
          `Agreement ${validated.agreementId} was not found`,
        );
      }

      if (!agreement.isActive) {
        throw new DealAgreementInactiveError(agreement.id);
      }

      const customerId =
        existing.participants.find(
          (participant) => participant.role === "customer",
        )?.customerId ?? null;

      if (!customerId) {
        throw new ValidationError(
          `Deal ${validated.id} is missing the owning customer participant`,
        );
      }

      if (agreement.customerId !== customerId) {
        throw new DealAgreementCustomerMismatchError(agreement.id, customerId);
      }

      await tx.dealStore.setDealRoot({
        agreementId: agreement.id,
        dealId: validated.id,
      });
      await tx.dealStore.replaceDealParticipants({
        dealId: validated.id,
        participants: buildDealParticipantRows({
          agreement,
          customerId,
          dealId: validated.id,
          generateUuid: () => this.runtime.generateUuid(),
          intake: existing.intake,
        }),
      });
      await tx.dealStore.createDealTimelineEvents([
        createTimelinePayloadEvent({
          actorUserId: validated.actorUserId,
          dealId: validated.id,
          generateUuid: () => this.runtime.generateUuid(),
          occurredAt: this.runtime.now(),
          payload: {
            agreementId: agreement.id,
            previousAgreementId: existing.summary.agreementId,
          },
          type: "participant_changed",
          visibility: "internal",
        }),
      ]);

      const updated = await tx.dealReads.findWorkflowById(validated.id);

      if (!updated) {
        throw new ValidationError(
          `Deal ${validated.id} disappeared after agreement update`,
        );
      }

      await tx.dealStore.setDealRoot({
        dealId: validated.id,
        nextAction: updated.nextAction,
      });

      return updated;
    });
  }
}
