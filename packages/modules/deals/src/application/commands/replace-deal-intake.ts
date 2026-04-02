import { z } from "zod";

import type { ModuleRuntime } from "@bedrock/shared/core";
import { NotFoundError } from "@bedrock/shared/core/errors";

import {
  DealNotFoundError,
  DealRevisionConflictError,
} from "../../errors";
import {
  ReplaceDealIntakeInputSchema,
  type ReplaceDealIntakeInput,
} from "../contracts/commands";
import type { DealWorkflowProjection } from "../contracts/dto";
import {
  buildDealLegRows,
  buildDealOperationalPositionRows,
  buildDealParticipantRows,
  createTimelinePayloadEvent,
  deriveDealRootState,
} from "../shared/workflow-state";
import type { DealsCommandUnitOfWork } from "../ports/deals.uow";
import type { DealReferencesPort } from "../ports/references.port";

const ReplaceDealIntakeCommandInputSchema = ReplaceDealIntakeInputSchema.extend({
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

type ReplaceDealIntakeCommandInput = ReplaceDealIntakeInput & {
  actorLabel?: string | null;
  actorUserId?: string | null;
  dealId: string;
};

function participantFingerprint(input: DealWorkflowProjection["intake"]) {
  return JSON.stringify({
    applicantCounterpartyId: input.common.applicantCounterpartyId,
    beneficiaryCounterpartyId:
      input.externalBeneficiary.beneficiaryCounterpartyId,
    payerCounterpartyId: input.incomingReceipt.payerCounterpartyId,
  });
}

export class ReplaceDealIntakeCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly commandUow: DealsCommandUnitOfWork,
    private readonly references: DealReferencesPort,
  ) {}

  async execute(
    raw: ReplaceDealIntakeCommandInput,
  ): Promise<DealWorkflowProjection> {
    const validated = ReplaceDealIntakeCommandInputSchema.parse(raw);

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
        validated.intake.common.applicantCounterpartyId &&
        !(await this.references.findCounterpartyById(
          validated.intake.common.applicantCounterpartyId,
        ))
      ) {
        throw new NotFoundError(
          "Counterparty",
          validated.intake.common.applicantCounterpartyId,
        );
      }

      if (
        validated.intake.moneyRequest.sourceCurrencyId &&
        !(await this.references.findCurrencyById(
          validated.intake.moneyRequest.sourceCurrencyId,
        ))
      ) {
        throw new NotFoundError(
          "Currency",
          validated.intake.moneyRequest.sourceCurrencyId,
        );
      }

      if (
        validated.intake.moneyRequest.targetCurrencyId &&
        !(await this.references.findCurrencyById(
          validated.intake.moneyRequest.targetCurrencyId,
        ))
      ) {
        throw new NotFoundError(
          "Currency",
          validated.intake.moneyRequest.targetCurrencyId,
        );
      }

      const nextRevision = validated.expectedRevision + 1;
      const rootState = await deriveDealRootState({
        acceptance: null,
        calculationId: existing.summary.calculationId,
        intake: validated.intake,
        references: this.references,
        status: existing.summary.status,
      });
      const replaced = await tx.dealStore.replaceIntakeSnapshot({
        dealId: validated.dealId,
        expectedRevision: validated.expectedRevision,
        nextRevision,
        snapshot: validated.intake,
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
          intake: validated.intake,
        }),
      });
      await tx.dealStore.replaceDealParticipants({
        dealId: validated.dealId,
        participants: buildDealParticipantRows({
          agreement,
          customerId: customerParticipant.customerId,
          dealId: validated.dealId,
          generateUuid: () => this.runtime.generateUuid(),
          intake: validated.intake,
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
          type: "intake_saved",
          visibility: "internal",
        }),
      ];

      if (
        participantFingerprint(existing.intake) !==
        participantFingerprint(validated.intake)
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
