import { z } from "zod";

import type { ModuleRuntime } from "@bedrock/shared/core";
import { NotFoundError } from "@bedrock/shared/core/errors";

import {
  DealNotFoundError,
  DealRevisionConflictError,
} from "../../errors";
import {
  UpdateDealHeaderInputSchema,
  type UpdateDealHeaderInput,
} from "../contracts/commands";
import type { DealWorkflowProjection } from "../contracts/dto";
import type { DealsCommandUnitOfWork } from "../ports/deals.uow";
import type { DealReferencesPort } from "../ports/references.port";
import {
  buildDealLegRows,
  buildDealOperationalPositionRows,
  buildDealParticipantRows,
  createTimelinePayloadEvent,
  deriveDealRootState,
} from "../shared/workflow-state";

const UpdateDealHeaderCommandInputSchema = UpdateDealHeaderInputSchema.extend({
  actorLabel: z.string().trim().max(255).nullable().optional(),
  actorUserId: z.string().trim().min(1).nullable().optional(),
  dealId: z.uuid(),
}).superRefine((value, ctx) => {
  if (!value.actorUserId && !value.actorLabel) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Either actorUserId or actorLabel must be provided",
      path: ["actorUserId"],
    });
  }
});

type UpdateDealHeaderCommandInput = UpdateDealHeaderInput & {
  actorLabel?: string | null;
  actorUserId?: string | null;
  dealId: string;
};

function participantFingerprint(input: DealWorkflowProjection["header"]) {
  return JSON.stringify({
    applicantCounterpartyId: input.common.applicantCounterpartyId,
    beneficiaryCounterpartyId:
      input.externalBeneficiary.beneficiaryCounterpartyId,
    payerCounterpartyId: input.incomingReceipt.payerCounterpartyId,
  });
}

export class UpdateDealHeaderCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly commandUow: DealsCommandUnitOfWork,
    private readonly references: DealReferencesPort,
  ) {}

  async execute(
    raw: UpdateDealHeaderCommandInput,
  ): Promise<DealWorkflowProjection> {
    const validated = UpdateDealHeaderCommandInputSchema.parse(raw);

    return this.commandUow.run(async (tx) => {
      const existing = await tx.dealReads.findWorkflowById(validated.dealId);

      if (!existing) {
        throw new DealNotFoundError(validated.dealId);
      }

      const customerParticipant = existing.participants.find(
        (participant) => participant.role === "customer",
      );
      if (!customerParticipant?.customerId) {
        throw new DealNotFoundError(validated.dealId);
      }

      const agreement = await this.references.findAgreementById(
        existing.summary.agreementId,
      );
      if (!agreement) {
        throw new NotFoundError("Agreement", existing.summary.agreementId);
      }

      if (
        validated.header.common.applicantCounterpartyId &&
        !(await this.references.findCounterpartyById(
          validated.header.common.applicantCounterpartyId,
        ))
      ) {
        throw new NotFoundError(
          "Counterparty",
          validated.header.common.applicantCounterpartyId,
        );
      }

      if (
        validated.header.moneyRequest.sourceCurrencyId &&
        !(await this.references.findCurrencyById(
          validated.header.moneyRequest.sourceCurrencyId,
        ))
      ) {
        throw new NotFoundError(
          "Currency",
          validated.header.moneyRequest.sourceCurrencyId,
        );
      }

      if (
        validated.header.moneyRequest.targetCurrencyId &&
        !(await this.references.findCurrencyById(
          validated.header.moneyRequest.targetCurrencyId,
        ))
      ) {
        throw new NotFoundError(
          "Currency",
          validated.header.moneyRequest.targetCurrencyId,
        );
      }

      const nextRevision = validated.expectedRevision + 1;
      const rootState = await deriveDealRootState({
        calculationId: existing.summary.calculationId,
        header: validated.header,
        references: this.references,
        status: existing.summary.status,
      });
      const replaced = await tx.dealStore.replaceDealHeader({
        dealId: validated.dealId,
        expectedRevision: validated.expectedRevision,
        header: validated.header,
        nextRevision,
      });

      if (!replaced) {
        throw new DealRevisionConflictError(
          validated.dealId,
          validated.expectedRevision,
        );
      }

      await tx.dealStore.setDealRoot({
        dealId: validated.dealId,
        nextAction: rootState.nextAction,
        sourceAmountMinor: rootState.sourceAmountMinor,
        sourceCurrencyId: rootState.sourceCurrencyId,
        targetCurrencyId: rootState.targetCurrencyId,
      });
      await tx.dealStore.replaceDealLegs({
        dealId: validated.dealId,
        legs: buildDealLegRows({
          dealId: validated.dealId,
          existingLegs: existing.executionPlan,
          generateUuid: () => this.runtime.generateUuid(),
          header: validated.header,
        }),
      });
      await tx.dealStore.replaceDealParticipants({
        dealId: validated.dealId,
        participants: buildDealParticipantRows({
          agreement,
          customerId: customerParticipant.customerId,
          dealId: validated.dealId,
          generateUuid: () => this.runtime.generateUuid(),
          header: validated.header,
        }),
      });

      const now = this.runtime.now();
      const events = [
        createTimelinePayloadEvent({
          actorLabel: validated.actorLabel ?? null,
          actorUserId: validated.actorUserId,
          dealId: validated.dealId,
          generateUuid: () => this.runtime.generateUuid(),
          occurredAt: now,
          payload: { revision: nextRevision },
          type: "deal_header_updated",
          visibility: "internal",
        }),
      ];

      if (
        participantFingerprint(existing.header) !==
        participantFingerprint(validated.header)
      ) {
        events.push(
          createTimelinePayloadEvent({
            actorLabel: validated.actorLabel ?? null,
            actorUserId: validated.actorUserId,
            dealId: validated.dealId,
            generateUuid: () => this.runtime.generateUuid(),
            occurredAt: now,
            payload: { revision: nextRevision },
            type: "participant_changed",
            visibility: "internal",
          }),
        );
      }

      await tx.dealStore.createDealTimelineEvents(events);

      const updated = await tx.dealReads.findWorkflowById(validated.dealId);

      if (!updated) {
        throw new DealNotFoundError(validated.dealId);
      }

      await tx.dealStore.setDealRoot({
        dealId: validated.dealId,
        nextAction: updated.nextAction,
      });
      await tx.dealStore.replaceDealOperationalPositions({
        dealId: validated.dealId,
        positions: buildDealOperationalPositionRows({
          dealId: validated.dealId,
          generateUuid: () => this.runtime.generateUuid(),
          operationalState: updated.operationalState,
        }),
      });

      return updated;
    });
  }
}
