import type { ReconciliationOperationLinkDto } from "@bedrock/reconciliation/contracts";
import { MAX_QUERY_LIST_LIMIT } from "@bedrock/shared/core";
import type { PaymentStep } from "@bedrock/treasury/contracts";

import {
  deriveFinanceDealReadiness,
  deriveFinanceDealStage,
} from "../close-readiness";
import type {
  FinanceDealQueueFilters,
  FinanceDealQueueItem,
  FinanceDealQueueProjection,
} from "../contracts";
import { buildProfitabilitySnapshot } from "./profitability";
import {
  classifyFinanceQueue,
  summarizeExecutionPlan,
} from "./queue-classify";
import type { DealProjectionsWorkflowDeps } from "../shared/deps";
import { buildPortalQuoteSummary } from "../shared/projection-builders";
import { matchesTextFilter } from "../shared/utils";
import {
  getApplicantParticipant,
  getCustomerParticipant,
  getInternalEntityParticipant,
} from "../shared/workflow-helpers";

export type ListFinanceDealQueuesInput = FinanceDealQueueFilters;

type FinanceQueueDeps = Pick<
  DealProjectionsWorkflowDeps,
  | "agreements"
  | "calculations"
  | "currencies"
  | "deals"
  | "files"
  | "parties"
  | "reconciliation"
  | "treasury"
>;

export async function listFinanceDealQueues(
  deps: FinanceQueueDeps,
  filters: ListFinanceDealQueuesInput = {},
): Promise<FinanceDealQueueProjection> {
  const listedDeals = await deps.deals.deals.queries.list({
    limit: MAX_QUERY_LIST_LIMIT,
    offset: 0,
    sortBy: "createdAt",
    sortOrder: "desc",
    status: filters.status,
    type: filters.type,
  });

  const queueItems = await Promise.all(
    listedDeals.data.map(
      async (deal): Promise<FinanceDealQueueItem | null> => {
        const workflow = await deps.deals.deals.queries.findWorkflowById(
          deal.id,
        );

        if (!workflow) {
          return null;
        }

        const customerId =
          getCustomerParticipant(workflow)?.customerId ?? null;
        const internalEntityName =
          getInternalEntityParticipant(workflow)?.displayName ?? null;

        const customer = customerId
          ? await deps.parties.customers.queries.findById(customerId)
          : null;
        const applicantName =
          customer?.name ??
          getApplicantParticipant(workflow)?.displayName ??
          null;

        if (
          !matchesTextFilter(applicantName, filters.applicant) ||
          !matchesTextFilter(internalEntityName, filters.internalEntity)
        ) {
          return null;
        }

        const [agreement, paymentStepsResult] = await Promise.all([
          deps.agreements.agreements.queries.findById(
            workflow.summary.agreementId,
          ),
          deps.treasury.paymentSteps.queries.list({
            dealId: deal.id,
            limit: 100,
            offset: 0,
            purpose: "deal_leg",
          }),
        ]);
        const queueContext = classifyFinanceQueue(workflow);
        const paymentStepByLegIdx = new Map<number, PaymentStep>();
        for (const step of paymentStepsResult.data) {
          if (step.dealLegIdx !== null) {
            paymentStepByLegIdx.set(step.dealLegIdx, step);
          }
        }
        const reconciliationLinks =
          paymentStepsResult.data.length > 0
            ? await deps.reconciliation.links.listOperationLinks({
                operationIds: paymentStepsResult.data.map((step) => step.id),
              })
            : [];
        const reconciliationLinksByStepId = new Map(
          reconciliationLinks.map(
            (link): readonly [string, ReconciliationOperationLinkDto] => [
              link.operationId,
              link,
            ],
          ),
        );
        const { closeReadiness, reconciliationSummary } =
          deriveFinanceDealReadiness({
            paymentStepByLegIdx,
            reconciliationLinksByStepId,
            workflow,
          });
        const { stage, stageReason } = deriveFinanceDealStage({
          agreementOrganizationId: agreement?.organizationId ?? null,
          closeReadiness,
          internalEntityOrganizationId:
            getInternalEntityParticipant(workflow)?.organizationId ?? null,
          paymentStepByLegIdx,
          reconciliationSummary,
          workflow,
        });

        const [attachments, currentCalculation, acceptedQuoteDetails] =
          await Promise.all([
            deps.files.files.queries.listDealAttachments(deal.id),
            workflow.summary.calculationId
              ? deps.calculations.calculations.queries.findById(
                  workflow.summary.calculationId,
                )
              : Promise.resolve(null),
            workflow.acceptedQuote?.quoteId
              ? deps.treasury.quotes.queries
                  .getQuoteDetails({ quoteRef: workflow.acceptedQuote.quoteId })
                  .catch(() => null)
              : Promise.resolve(null),
          ]);

        return {
          applicantName,
          blockingReasons: queueContext.blockers,
          createdAt: workflow.summary.createdAt,
          dealId: workflow.summary.id,
          documentSummary: {
            attachmentCount: attachments.length,
            formalDocumentCount:
              workflow.relatedResources.formalDocuments.length,
          },
          executionSummary: summarizeExecutionPlan(workflow),
          internalEntityName,
          nextAction: workflow.nextAction,
          operationalState: workflow.operationalState,
          profitabilitySnapshot: await buildProfitabilitySnapshot(
            currentCalculation,
            deps,
            { acceptedQuoteDetails },
          ),
          queue: queueContext.queue,
          queueReason: queueContext.queueReason,
          stage,
          stageReason,
          quoteSummary: buildPortalQuoteSummary(workflow),
          status: workflow.summary.status,
          type: workflow.summary.type,
        };
      },
    ),
  );

  const filteredItems = queueItems.filter(
    (item): item is FinanceDealQueueItem => item !== null,
  );

  const counts = filteredItems.reduce(
    (acc, item) => {
      acc[item.queue] += 1;
      return acc;
    },
    {
      execution: 0,
      failed_instruction: 0,
      funding: 0,
    },
  );

  return {
    counts,
    filters,
    items: filteredItems.filter((item) => {
      if (filters.queue && item.queue !== filters.queue) {
        return false;
      }

      if (filters.stage && item.stage !== filters.stage) {
        return false;
      }

      return true;
    }),
  };
}
