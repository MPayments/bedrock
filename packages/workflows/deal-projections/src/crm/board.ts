import type { DealWorkflowProjection } from "@bedrock/deals/contracts";
import { MAX_QUERY_LIST_LIMIT } from "@bedrock/shared/core";

import type {
  CrmDealBoardProjection,
  CrmDealBoardStage,
} from "../contracts";
import type { DealProjectionsWorkflowDeps } from "../shared/deps";
import { buildPortalQuoteSummary } from "../shared/projection-builders";
import {
  collectBlockingReasons,
  getApplicantParticipant,
  getCustomerParticipant,
} from "../shared/workflow-helpers";

function classifyCrmBoardStage(workflow: DealWorkflowProjection): {
  blockingReasons: string[];
  stage: CrmDealBoardStage;
} {
  const blockingReasons = collectBlockingReasons(workflow);

  if (workflow.summary.status === "draft") {
    return { blockingReasons, stage: "drafts" };
  }

  if (
    workflow.nextAction === "Accept quote" ||
    workflow.nextAction === "Create calculation from accepted quote"
  ) {
    return { blockingReasons, stage: "pricing" };
  }

  if (
    workflow.executionPlan.some((leg) => leg.state === "blocked") ||
    workflow.operationalState.positions.some(
      (position) => position.state === "blocked",
    )
  ) {
    return { blockingReasons, stage: "execution_blocked" };
  }

  if (
    workflow.nextAction === "Prepare documents" ||
    workflow.nextAction === "Prepare closing documents" ||
    workflow.summary.status === "preparing_documents" ||
    workflow.summary.status === "closing_documents"
  ) {
    return { blockingReasons, stage: "documents" };
  }

  return { blockingReasons, stage: "active" };
}

type CrmBoardDeps = Pick<
  DealProjectionsWorkflowDeps,
  "deals" | "files" | "parties"
>;

export async function listCrmDealBoard(
  deps: CrmBoardDeps,
): Promise<CrmDealBoardProjection> {
  const listedDeals = await deps.deals.deals.queries.list({
    limit: MAX_QUERY_LIST_LIMIT,
    offset: 0,
    sortBy: "updatedAt",
    sortOrder: "desc",
  });

  const items = await Promise.all(
    listedDeals.data.map(async (deal) => {
      const [workflow, attachments] = await Promise.all([
        deps.deals.deals.queries.findWorkflowById(deal.id),
        deps.files.files.queries.listDealAttachments(deal.id),
      ]);

      if (!workflow) {
        return null;
      }

      const customerId = getCustomerParticipant(workflow)?.customerId ?? null;
      const customer = customerId
        ? await deps.parties.customers.queries.findById(customerId)
        : null;
      const stageContext = classifyCrmBoardStage(workflow);

      return {
        applicantName: getApplicantParticipant(workflow)?.displayName ?? null,
        assigneeUserId: workflow.summary.agentId,
        blockingReasons: stageContext.blockingReasons,
        customerName: customer?.name ?? null,
        documentSummary: {
          attachmentCount: attachments.length,
          formalDocumentCount:
            workflow.relatedResources.formalDocuments.length,
        },
        id: workflow.summary.id,
        nextAction: workflow.nextAction,
        quoteSummary: buildPortalQuoteSummary(workflow),
        stage: stageContext.stage,
        status: workflow.summary.status,
        type: workflow.summary.type,
        updatedAt: workflow.summary.updatedAt,
      };
    }),
  );

  const data = items.filter(
    (item): item is NonNullable<typeof item> => item !== null,
  );
  const counts = data.reduce(
    (acc, item) => {
      acc[item.stage] += 1;
      return acc;
    },
    {
      active: 0,
      documents: 0,
      drafts: 0,
      execution_blocked: 0,
      pricing: 0,
    },
  );

  return {
    counts,
    items: data,
  };
}
