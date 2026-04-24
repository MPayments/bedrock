import { computeDealLegState } from "@bedrock/deals";
import { LEG_KIND_REQUIRED_DOC_TYPE } from "@bedrock/deals/contracts";
import type { DealLegKind } from "@bedrock/deals/contracts";
import type { ReconciliationOperationLinkDto } from "@bedrock/reconciliation/contracts";
import { MAX_QUERY_LIST_LIMIT } from "@bedrock/shared/core";
import { computeOperationProjectedState } from "@bedrock/treasury/contracts";

import { deriveFinanceDealReadiness } from "../close-readiness";
import type { FinanceDealWorkspaceProjection } from "../contracts";
import {
  buildFinanceDealOperation,
  isExecutionRequestAllowed,
  resolveAdjustmentDocumentDocType,
} from "./instructions";
import {
  buildCashflowSummary,
  buildProfitabilitySnapshot,
} from "./profitability";
import {
  buildFinanceQuoteRequestContext,
  classifyFinanceQueue,
} from "./queue-classify";
import { buildFinanceRouteAttachment } from "./route-attachment";
import type { DealProjectionsWorkflowDeps } from "../shared/deps";
import {
  buildCrmDocumentRequirements,
  buildCrmEvidenceRequirements,
  buildCrmWorkbenchActions,
  serializeCrmPricingQuote,
} from "../shared/projection-builders";
import {
  getApplicantParticipant,
  getInternalEntityParticipant,
  isDealInTerminalStatus,
  isQuoteEligible,
} from "../shared/workflow-helpers";

type FinanceWorkspaceDeps = Pick<
  DealProjectionsWorkflowDeps,
  | "calculations"
  | "currencies"
  | "deals"
  | "documentsReadModel"
  | "files"
  | "parties"
  | "reconciliation"
  | "treasury"
>;

export async function getFinanceDealWorkspaceProjection(
  deps: FinanceWorkspaceDeps,
  dealId: string,
): Promise<FinanceDealWorkspaceProjection | null> {
  const workflow = await deps.deals.deals.queries.findWorkflowById(dealId);

  if (!workflow) {
    return null;
  }

  const [
    attachments,
    currentCalculation,
    operationsResult,
    paymentStepsResult,
    quotesResult,
    dealTraceDocuments,
    pricingContext,
  ] = await Promise.all([
    deps.files.files.queries.listDealAttachments(dealId),
    workflow.summary.calculationId
      ? deps.calculations.calculations.queries.findById(
          workflow.summary.calculationId,
        )
      : Promise.resolve(null),
    deps.treasury.operations.queries.list({
      dealId,
      limit: MAX_QUERY_LIST_LIMIT,
      offset: 0,
      sortBy: "createdAt",
      sortOrder: "desc",
    }),
    deps.treasury.paymentSteps.queries.list({
      dealId,
      limit: 100,
      offset: 0,
      purpose: "deal_leg",
    }),
    deps.treasury.quotes.queries.listQuotes({
      dealId,
      limit: MAX_QUERY_LIST_LIMIT,
      offset: 0,
      sortBy: "createdAt",
      sortOrder: "desc",
    }),
    deps.documentsReadModel.listDealTraceRowsByDealId(dealId),
    deps.deals.deals.queries.findPricingContextByDealId({ dealId }),
  ]);

  const acceptedQuoteDetailsRecord = workflow.acceptedQuote?.quoteId
    ? await deps.treasury.quotes.queries
        .getQuoteDetails({
          quoteRef: workflow.acceptedQuote.quoteId,
        })
        .catch(() => null)
    : null;

  const financeRouteAttachment = await buildFinanceRouteAttachment({
    acceptedQuoteDetails: acceptedQuoteDetailsRecord,
    applicantCounterpartyId:
      workflow.intake.common.applicantCounterpartyId ?? null,
    beneficiaryCounterpartyId:
      workflow.intake.externalBeneficiary.beneficiaryCounterpartyId ?? null,
    currencies: deps.currencies,
    parties: deps.parties,
    pricingContext,
  });

  const postedDocuments = dealTraceDocuments
    .filter((row) => row.postingStatus === "posted")
    .map((row) => ({ docType: row.docType }));
  const postedDocTypes = new Set(postedDocuments.map((d) => d.docType));

  const actions = buildCrmWorkbenchActions(workflow);
  const attachmentRequirements = buildCrmEvidenceRequirements({
    attachments,
    workflow,
  });
  const formalDocumentRequirements = buildCrmDocumentRequirements(workflow);
  const openingInvoiceRequirement =
    formalDocumentRequirements.find(
      (requirement) =>
        requirement.stage === "opening" && requirement.docType === "invoice",
    ) ?? null;
  const activeExchangeDocument =
    workflow.relatedResources.formalDocuments.find(
      (document) => document.docType === "exchange",
    ) ?? null;
  const queueContext = classifyFinanceQueue(workflow);
  const operationIds = operationsResult.data.map((operation) => operation.id);
  const [latestInstructions, allInstructions] = await Promise.all([
    deps.treasury.instructions.queries.listLatestByOperationIds(operationIds),
    deps.treasury.instructions.queries.listByOperationIds({ operationIds }),
  ]);
  const operationsById = new Map(
    operationsResult.data.map(
      (operation) => [operation.id, operation] as const,
    ),
  );
  const latestInstructionByOperationId = new Map(
    latestInstructions.map(
      (instruction) => [instruction.operationId, instruction] as const,
    ),
  );
  const instructionById = new Map(
    allInstructions.map(
      (instruction) => [instruction.id, instruction] as const,
    ),
  );
  const legByOperationId = new Map<string, { idx: number; kind: string }>();
  for (const leg of workflow.executionPlan) {
    for (const ref of leg.operationRefs) {
      legByOperationId.set(ref.operationId, { idx: leg.idx, kind: leg.kind });
    }
  }
  const instructionArtifactRecords =
    allInstructions.length > 0
      ? await deps.treasury.instructions.queries.listArtifactsByInstructionIds(
          {
            instructionIds: allInstructions.map(
              (instruction) => instruction.id,
            ),
          },
        )
      : [];
  const artifactFileAssetIds = Array.from(
    new Set(
      instructionArtifactRecords.map((artifact) => artifact.fileAssetId),
    ),
  );
  const fileVersionsByAssetId = new Map(
    (
      await deps.files.files.queries.listCurrentFileVersionsByAssetIds(
        artifactFileAssetIds,
      )
    ).map((version) => [version.assetId, version] as const),
  );
  const instructionArtifacts = instructionArtifactRecords
    .map((artifact) => {
      const instruction = instructionById.get(artifact.instructionId);
      if (!instruction) return null;
      const legContext =
        legByOperationId.get(instruction.operationId) ?? null;
      const fileVersion = fileVersionsByAssetId.get(artifact.fileAssetId);
      if (!fileVersion) return null;
      return {
        fileAssetId: artifact.fileAssetId,
        fileName: fileVersion.fileName,
        fileSize: fileVersion.fileSize,
        id: artifact.id,
        instructionId: artifact.instructionId,
        legIdx: legContext?.idx ?? null,
        legKind: legContext?.kind ?? null,
        memo: artifact.memo,
        mimeType: fileVersion.mimeType,
        operationId: instruction.operationId,
        purpose: artifact.purpose,
        uploadedAt: artifact.uploadedAt.toISOString(),
        uploadedByUserId: artifact.uploadedByUserId,
      };
    })
    .filter((value): value is NonNullable<typeof value> => value !== null)
    .sort((left, right) => right.uploadedAt.localeCompare(left.uploadedAt));

  // Files uploaded through the instruction-artifact drawer create a deal
  // attachment link as a byproduct (the upload endpoint always links by
  // `deal_attachment`). Hide the deal-attachment row when the same file
  // asset already appears as an instruction artifact so each physical file
  // is listed exactly once — on its richer, leg-scoped artifact row.
  const artifactFileAssetIdSet = new Set(
    instructionArtifacts.map((artifact) => artifact.fileAssetId),
  );
  const dedupedAttachments = attachments.filter(
    (attachment) => !artifactFileAssetIdSet.has(attachment.id),
  );
  const reconciliationLinks =
    await deps.reconciliation.links.listOperationLinks({
      operationIds: operationsResult.data.map((operation) => operation.id),
    });
  const reconciliationLinksByOperationId = new Map(
    reconciliationLinks.map(
      (link): readonly [string, ReconciliationOperationLinkDto] => [
        link.operationId,
        link,
      ],
    ),
  );
  const {
    closeReadiness,
    instructionSummary,
    reconciliationExceptions: readinessReconciliationExceptions,
    reconciliationSummary,
  } = deriveFinanceDealReadiness({
    latestInstructionByOperationId,
    reconciliationLinksByOperationId,
    workflow,
  });
  const reconciliationExceptions = readinessReconciliationExceptions.map(
    (exception) => ({
      ...exception,
      actions: {
        adjustmentDocumentDocType: resolveAdjustmentDocumentDocType({
          operationKind:
            operationsById.get(exception.operationId)?.kind ?? null,
        }),
        canIgnore: exception.state === "open",
      },
    }),
  );
  const queueBlocked =
    queueContext.blockers.length > 0 ||
    workflow.executionPlan.some((leg) => leg.state === "blocked");
  const hasAnyMaterializedOperations = workflow.executionPlan.some(
    (leg) => leg.operationRefs.length > 0,
  );
  const acceptedQuoteDetails = workflow.acceptedQuote
    ? (quotesResult.data
        .map(serializeCrmPricingQuote)
        .find((quote) => quote.id === workflow.acceptedQuote?.quoteId) ??
      null)
    : null;
  const cashflowSummary = await buildCashflowSummary(
    operationsResult.data,
    latestInstructionByOperationId,
    deps,
  );

  return {
    acceptedQuote: workflow.acceptedQuote,
    acceptedQuoteDetails,
    actions: {
      canCloseDeal: closeReadiness.ready,
      canCreateCalculation: false,
      canCreateQuote: false,
      canRequestExecution:
        !hasAnyMaterializedOperations && isExecutionRequestAllowed(workflow),
      canRunReconciliation:
        instructionSummary.totalOperations > 0 &&
        instructionSummary.terminalOperations ===
          instructionSummary.totalOperations &&
        (reconciliationSummary.state === "pending" ||
          reconciliationSummary.state === "blocked"),
      canResolveExecutionBlocker: workflow.executionPlan.some(
        (leg) => leg.state === "blocked",
      ),
      canUploadAttachment: actions.canUploadAttachment,
    },
    attachmentRequirements,
    cashflowSummary,
    closeReadiness,
    executionPlan: workflow.executionPlan.map((leg) => {
      const manualOverride =
        leg.state === "blocked" || leg.state === "skipped" ? leg.state : null;
      const latestInstructionStateByOperationId = new Map(
        leg.operationRefs
          .map((ref) => {
            const instruction = latestInstructionByOperationId.get(
              ref.operationId,
            );
            return instruction
              ? ([ref.operationId, instruction.state] as const)
              : null;
          })
          .filter(
            (
              entry,
            ): entry is readonly [
              string,
              typeof entry extends readonly [string, infer S] ? S : never,
            ] => entry !== null,
          ),
      );
      const computedState = computeDealLegState({
        manualOverride,
        operationRefs: leg.operationRefs,
        latestInstructionStateByOperationId,
        requiredDocType: LEG_KIND_REQUIRED_DOC_TYPE[leg.kind as DealLegKind],
        postedDocTypes,
      });
      return {
        ...leg,
        state: computedState,
        actions: {
          canCreateLegOperation:
            hasAnyMaterializedOperations &&
            leg.operationRefs.length === 0 &&
            computedState !== "blocked" &&
            computedState !== "skipped" &&
            !isDealInTerminalStatus(workflow),
          exchangeDocument:
            leg.kind === "convert" &&
            workflow.fundingResolution.state === "resolved" &&
            workflow.fundingResolution.strategy === "external_fx" &&
            openingInvoiceRequirement
              ? {
                  activeDocumentId: activeExchangeDocument?.id ?? null,
                  createAllowed:
                    openingInvoiceRequirement.state === "ready" &&
                    Boolean(openingInvoiceRequirement.activeDocumentId) &&
                    Boolean(workflow.summary.calculationId) &&
                    !activeExchangeDocument &&
                    !isDealInTerminalStatus(workflow),
                  docType: "exchange",
                  openAllowed: Boolean(activeExchangeDocument),
                }
              : null,
        },
      };
    }),
    formalDocumentRequirements,
    instructionSummary,
    nextAction: workflow.nextAction,
    operationalState: workflow.operationalState,
    pricing: {
      ...buildFinanceQuoteRequestContext(workflow),
      quoteEligibility: isQuoteEligible(workflow),
      routeAttachment: financeRouteAttachment,
    },
    profitabilitySnapshot: await buildProfitabilitySnapshot(
      currentCalculation,
      deps,
      { acceptedQuoteDetails: acceptedQuoteDetailsRecord },
    ),
    queueContext,
    reconciliationSummary,
    relatedResources: {
      attachments: dedupedAttachments,
      formalDocuments: workflow.relatedResources.formalDocuments,
      instructionArtifacts,
      operations: operationsResult.data.map((operation) =>
        buildFinanceDealOperation({
          latestInstruction:
            latestInstructionByOperationId.get(operation.id) ?? null,
          operation,
          projectedState: computeOperationProjectedState({
            operationKind: operation.kind,
            postedDocuments,
          }),
          queueBlocked,
        }),
      ),
      paymentSteps: paymentStepsResult.data,
      quotes: workflow.relatedResources.quotes,
      reconciliationExceptions,
    },
    summary: {
      ...workflow.summary,
      applicantDisplayName:
        getApplicantParticipant(workflow)?.displayName ?? null,
      internalEntityDisplayName:
        getInternalEntityParticipant(workflow)?.displayName ?? null,
    },
    timeline: workflow.timeline,
    workflow,
  };
}
