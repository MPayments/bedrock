import { z } from "zod";

import type { ModuleRuntime } from "@bedrock/shared/core";
import { NotFoundError, ValidationError } from "@bedrock/shared/core/errors";

import { canDealWriteTreasuryOrFormalDocuments } from "../../domain/constants";
import {
  DealNotFoundError,
  DealPricingContextRevisionConflictError,
} from "../../errors";
import {
  SwapDealRouteTemplateInputSchema,
  type SwapDealRouteTemplateInput,
} from "../contracts/commands";
import type { DealWorkflowProjection } from "../contracts/dto";
import type { DealsCommandUnitOfWork } from "../ports/deals.uow";
import type { DealReferencesPort } from "../ports/references.port";
import {
  attachDealPricingRouteSnapshot,
  detachDealPricingRouteSnapshot,
} from "../shared/pricing-context";
import {
  buildDealOperationalPositionRows,
  createTimelinePayloadEvent,
} from "../shared/workflow-state";

const SwapDealRouteTemplateCommandInputSchema =
  SwapDealRouteTemplateInputSchema.extend({
    actorUserId: z.string().trim().min(1),
    dealId: z.uuid(),
  });

export type SwapDealRouteTemplateCommandInput = SwapDealRouteTemplateInput & {
  actorUserId: string;
  dealId: string;
};

export class SwapDealRouteTemplateCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly commandUow: DealsCommandUnitOfWork,
    private readonly references: DealReferencesPort,
  ) {}

  async execute(
    raw: SwapDealRouteTemplateCommandInput,
  ): Promise<DealWorkflowProjection> {
    const validated = SwapDealRouteTemplateCommandInputSchema.parse(raw);

    if (!this.references.findPaymentRouteTemplateById) {
      throw new ValidationError(
        "findPaymentRouteTemplateById reference lookup is not configured",
      );
    }
    const findRouteTemplate = this.references.findPaymentRouteTemplateById.bind(
      this.references,
    );

    return this.commandUow.run(async (tx) => {
      const workflow = await tx.dealReads.findWorkflowById(validated.dealId);
      if (!workflow) {
        throw new DealNotFoundError(validated.dealId);
      }

      if (
        !canDealWriteTreasuryOrFormalDocuments({
          status: workflow.summary.status,
          type: workflow.summary.type,
        })
      ) {
        throw new ValidationError(
          `Deal ${validated.dealId} in status ${workflow.summary.status} does not allow route swaps`,
        );
      }

      const inFlight = workflow.executionPlan.find(
        (leg) => leg.state === "in_progress",
      );
      if (inFlight) {
        throw new ValidationError(
          `Cannot swap route template: leg ${inFlight.idx} is in_progress (instruction already in flight)`,
        );
      }

      const existing = await tx.dealReads.findPricingContextByDealId(
        validated.dealId,
      );

      const currentTemplateId =
        existing.routeAttachment?.templateId ?? null;

      if (currentTemplateId === validated.newRouteTemplateId) {
        return workflow;
      }

      const template = await findRouteTemplate(validated.newRouteTemplateId);
      if (!template) {
        throw new NotFoundError(
          "PaymentRouteTemplate",
          validated.newRouteTemplateId,
        );
      }

      const now = this.runtime.now();

      if (existing.routeAttachment) {
        const detachedSnapshot = detachDealPricingRouteSnapshot(existing);
        const detached = await tx.dealStore.replaceDealPricingContext({
          dealId: validated.dealId,
          expectedRevision: existing.revision,
          nextRevision: existing.revision + 1,
          snapshot: detachedSnapshot,
        });
        if (!detached) {
          throw new DealPricingContextRevisionConflictError(
            validated.dealId,
            existing.revision,
          );
        }
      }

      const afterDetach = await tx.dealReads.findPricingContextByDealId(
        validated.dealId,
      );
      const attachedSnapshot = attachDealPricingRouteSnapshot({
        context: afterDetach,
        now,
        route: {
          snapshot: template.snapshot,
          templateId: template.id,
          templateName: template.name,
        },
      });
      const attached = await tx.dealStore.replaceDealPricingContext({
        dealId: validated.dealId,
        expectedRevision: afterDetach.revision,
        nextRevision: afterDetach.revision + 1,
        snapshot: attachedSnapshot,
      });
      if (!attached) {
        throw new DealPricingContextRevisionConflictError(
          validated.dealId,
          afterDetach.revision,
        );
      }

      const events: Parameters<
        typeof tx.dealStore.createDealTimelineEvents
      >[0] = [
        createTimelinePayloadEvent({
          actorUserId: validated.actorUserId,
          dealId: validated.dealId,
          generateUuid: () => this.runtime.generateUuid(),
          occurredAt: now,
          payload: {
            approvalStatus: "auto",
            memo: validated.memo ?? null,
            newTemplateId: template.id,
            newTemplateName: template.name,
            previousTemplateId: currentTemplateId,
            previousTemplateName:
              existing.routeAttachment?.templateName ?? null,
            reasonCode: validated.reasonCode,
          },
          type: "deal_route_template_swapped",
          visibility: "internal",
        }),
      ];

      if (workflow.acceptedQuote && !workflow.acceptedQuote.revokedAt) {
        const revoked = await tx.dealStore.revokeCurrentQuoteAcceptances({
          dealId: validated.dealId,
          revocationReason: "operator_route_swap",
          revokedAt: now,
        });

        if (revoked) {
          events.push(
            createTimelinePayloadEvent({
              actorUserId: validated.actorUserId,
              dealId: validated.dealId,
              generateUuid: () => this.runtime.generateUuid(),
              occurredAt: now,
              payload: {
                amendmentSource: "route_template_swap",
                approvalStatus: "auto",
                reasonCode: validated.reasonCode,
                revocationReason: "operator_route_swap",
              },
              type: "acceptance_revoked_by_operator",
              visibility: "internal",
            }),
          );
        }
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
