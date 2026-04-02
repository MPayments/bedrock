import type { AgreementsModule } from "@bedrock/agreements";
import type { CalculationsModule } from "@bedrock/calculations";
import type {
  DealOperationalPosition,
  DealTimelineEvent,
  DealType,
  DealWorkflowProjection,
} from "@bedrock/deals/contracts";
import type { DealsModule as DealsModuleRoot } from "@bedrock/deals";
import type { DocumentsReadModel } from "@bedrock/documents/read-model";
import type { FilesModule } from "@bedrock/files";
import type {
  Counterparty,
  Customer,
  Organization,
  Requisite,
  RequisiteProvider,
} from "@bedrock/parties/contracts";
import type { PartiesModule as PartiesModuleRoot } from "@bedrock/parties";
import type { TreasuryModule } from "@bedrock/treasury";
import { MAX_QUERY_LIST_LIMIT } from "@bedrock/shared/core";

import type {
  CrmDealBoardProjection,
  CrmDealBoardStage,
  CrmDealWorkbenchProjection,
  CustomerLegalEntitySummary,
  CustomerWorkspaceSummary,
  FinanceDealQueue,
  FinanceDealQueueFilters,
  FinanceDealQueueProjection,
  FinanceDealQueueItem,
  FinanceDealWorkspaceProjection,
  FinanceProfitabilitySnapshot,
  PortalDealListProjection,
  PortalDealProjection,
} from "./contracts";

const CUSTOMER_SAFE_ATTACHMENT_REQUIRED_ACTION =
  "Загрузите подтверждающие документы";
const EXTERNAL_EVIDENCE_REQUIRED_MESSAGE =
  "Загрузите внешние подтверждающие документы по сделке";
const PORTAL_OWNED_SECTIONS_BY_TYPE: Record<DealType, string[]> = {
  currency_exchange: ["common", "moneyRequest"],
  currency_transit: ["common", "moneyRequest", "incomingReceipt"],
  exporter_settlement: ["common", "moneyRequest", "incomingReceipt"],
  payment: ["common", "moneyRequest"],
};

const OPENING_DOCUMENT_TYPE_BY_DEAL_TYPE: Record<DealType, string> = {
  currency_exchange: "exchange",
  currency_transit: "invoice",
  exporter_settlement: "invoice",
  payment: "invoice",
};

const CLOSING_DOCUMENT_TYPE_BY_DEAL_TYPE: Record<DealType, string | null> = {
  currency_exchange: null,
  currency_transit: "acceptance",
  exporter_settlement: "acceptance",
  payment: "acceptance",
};

const DOWNSTREAM_POSITION_KINDS = new Set([
  "exporter_expected_receivable",
  "in_transit",
  "provider_payable",
]);

const DOWNSTREAM_LEG_KINDS = new Set(["payout", "settle_exporter", "transit_hold"]);

export interface DealProjectionsWorkflowDeps {
  agreements: Pick<AgreementsModule, "agreements">;
  calculations: Pick<CalculationsModule, "calculations">;
  deals: Pick<DealsModuleRoot, "deals">;
  documentsReadModel: Pick<DocumentsReadModel, "listDealTraceRowsByDealId">;
  files: Pick<FilesModule, "files">;
  parties: Pick<
    PartiesModuleRoot,
    "counterparties" | "customers" | "organizations" | "requisites"
  >;
  treasury: Pick<TreasuryModule, "quotes">;
}

export type ListFinanceDealQueuesInput = FinanceDealQueueFilters;
type CalculationDetailsLike = NonNullable<
  Awaited<ReturnType<CalculationsModule["calculations"]["queries"]["findById"]>>
>;

function getCustomerParticipant(workflow: DealWorkflowProjection) {
  return workflow.participants.find((participant) => participant.role === "customer");
}

function getApplicantParticipant(workflow: DealWorkflowProjection) {
  return workflow.participants.find((participant) => participant.role === "applicant");
}

function getInternalEntityParticipant(workflow: DealWorkflowProjection) {
  return workflow.participants.find(
    (participant) => participant.role === "internal_entity",
  );
}

function getCustomerSafeTimeline(
  timeline: DealTimelineEvent[],
): DealTimelineEvent[] {
  return timeline.filter((event) => event.visibility === "customer_safe");
}

function buildCustomerSafeAttachments(
  timeline: DealTimelineEvent[],
  attachments: Awaited<
    ReturnType<FilesModule["files"]["queries"]["listDealAttachments"]>
  >,
) {
  const uploadedIds = new Map<
    string,
    {
      createdAt: Date;
      fileName: string;
      id: string;
    }
  >();

  for (const event of timeline) {
    if (event.type === "attachment_uploaded") {
      const attachmentId =
        typeof event.payload.attachmentId === "string"
          ? event.payload.attachmentId
          : null;
      const fileName =
        typeof event.payload.fileName === "string" ? event.payload.fileName : null;

      if (!attachmentId || !fileName) {
        continue;
      }

      uploadedIds.set(attachmentId, {
        createdAt: event.occurredAt,
        fileName,
        id: attachmentId,
      });
      continue;
    }

    if (event.type === "attachment_deleted") {
      const attachmentId =
        typeof event.payload.attachmentId === "string"
          ? event.payload.attachmentId
          : null;

      if (attachmentId) {
        uploadedIds.delete(attachmentId);
      }
    }
  }

  const attachmentsById = new Map(attachments.map((attachment) => [attachment.id, attachment]));

  return Array.from(uploadedIds.values())
    .filter((attachment) => {
      const current = attachmentsById.get(attachment.id);
      return current?.visibility === "customer_safe";
    })
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
}

function buildPortalQuoteSummary(workflow: DealWorkflowProjection) {
  if (workflow.acceptedQuote) {
    return {
      expiresAt: workflow.acceptedQuote.expiresAt,
      quoteId: workflow.acceptedQuote.quoteId,
      status: workflow.acceptedQuote.quoteStatus,
    };
  }

  const activeOrLatestQuote = [...workflow.relatedResources.quotes].sort((left, right) => {
    const leftTime = left.expiresAt?.getTime() ?? 0;
    const rightTime = right.expiresAt?.getTime() ?? 0;
    return rightTime - leftTime;
  })[0];

  if (!activeOrLatestQuote) {
    return null;
  }

  return {
    expiresAt: activeOrLatestQuote.expiresAt,
    quoteId: activeOrLatestQuote.id,
    status: activeOrLatestQuote.status,
  };
}

function buildPortalSubmissionCompleteness(
  workflow: DealWorkflowProjection,
) {
  const relevantSectionIds = new Set(PORTAL_OWNED_SECTIONS_BY_TYPE[workflow.intake.type]);
  const blockingReasons = workflow.sectionCompleteness
    .filter((section) => relevantSectionIds.has(section.sectionId))
    .flatMap((section) => section.blockingReasons);

  return {
    blockingReasons,
    complete: blockingReasons.length === 0,
  };
}

function isDealInTerminalStatus(workflow: DealWorkflowProjection) {
  return workflow.summary.status === "done" || workflow.summary.status === "cancelled";
}

function requiresExternalEvidence(type: DealType) {
  return type !== "currency_exchange";
}

function hasCustomerSafeAttachment(
  attachments: Awaited<
    ReturnType<FilesModule["files"]["queries"]["listDealAttachments"]>
  >,
) {
  return attachments.some((attachment) => attachment.visibility === "customer_safe");
}

function isFormalDocumentReady(input: {
  approvalStatus: string | null;
  lifecycleStatus: string | null;
  postingStatus: string | null;
  submissionStatus: string | null;
}) {
  return (
    input.lifecycleStatus === "active" &&
    input.submissionStatus === "submitted" &&
    (input.approvalStatus === "approved" ||
      input.approvalStatus === "not_required") &&
    (input.postingStatus === "posted" || input.postingStatus === "not_required")
  );
}

function findRelatedFormalDocument(input: {
  docType: string;
  documents: DealWorkflowProjection["relatedResources"]["formalDocuments"];
}) {
  const matching = input.documents.filter((document) => document.docType === input.docType);

  return (
    matching.find((document) => document.lifecycleStatus === "active") ??
    matching.sort((left, right) => {
      const leftTime =
        left.createdAt?.getTime() ?? left.occurredAt?.getTime() ?? 0;
      const rightTime =
        right.createdAt?.getTime() ?? right.occurredAt?.getTime() ?? 0;
      return rightTime - leftTime;
    })[0] ??
    null
  );
}

function buildCrmEvidenceRequirements(input: {
  attachments: Awaited<
    ReturnType<FilesModule["files"]["queries"]["listDealAttachments"]>
  >;
  workflow: DealWorkflowProjection;
}) {
  if (!requiresExternalEvidence(input.workflow.summary.type)) {
    return [
      {
        blockingReasons: [],
        code: "external_evidence",
        label: "Внешние подтверждающие документы",
        state: "not_required" as const,
      },
    ];
  }

  const evidenceProvided = hasCustomerSafeAttachment(input.attachments);

  return [
    {
      blockingReasons: evidenceProvided
        ? []
        : [EXTERNAL_EVIDENCE_REQUIRED_MESSAGE],
      code: "external_evidence",
      label: "Внешние подтверждающие документы",
      state: evidenceProvided ? ("provided" as const) : ("missing" as const),
    },
  ];
}

function buildCrmDocumentRequirements(workflow: DealWorkflowProjection) {
  const requirements: Array<{
    activeDocumentId: string | null;
    blockingReasons: string[];
    createAllowed: boolean;
    docType: string;
    openAllowed: boolean;
    stage: "opening" | "closing";
    state: "in_progress" | "missing" | "not_required" | "ready";
  }> = [];

  const openingDocType = OPENING_DOCUMENT_TYPE_BY_DEAL_TYPE[workflow.summary.type];
  const closingDocType = CLOSING_DOCUMENT_TYPE_BY_DEAL_TYPE[workflow.summary.type];

  for (const [stage, docType] of [
    ["opening", openingDocType] as const,
    ["closing", closingDocType] as const,
  ]) {
    if (!docType) {
      continue;
    }

    const document = findRelatedFormalDocument({
      docType,
      documents: workflow.relatedResources.formalDocuments,
    });
    const ready = document
      ? isFormalDocumentReady({
          approvalStatus: document.approvalStatus,
          lifecycleStatus: document.lifecycleStatus,
          postingStatus: document.postingStatus,
          submissionStatus: document.submissionStatus,
        })
      : false;

    requirements.push({
      activeDocumentId: document?.id ?? null,
      blockingReasons: document
        ? ready
          ? []
          : ["Формальный документ еще не готов к использованию"]
        : ["Формальный документ еще не создан"],
      createAllowed: false,
      docType,
      openAllowed: Boolean(document?.id),
      stage,
      state: !document ? "missing" : ready ? "ready" : "in_progress",
    });
  }

  return requirements;
}

function buildCrmWorkbenchActions(workflow: DealWorkflowProjection) {
  const hasAcceptedQuote =
    workflow.acceptedQuote?.quoteStatus === "active" &&
    (!workflow.acceptedQuote.expiresAt ||
      workflow.acceptedQuote.expiresAt.getTime() > Date.now());

  return {
    canAcceptQuote: workflow.relatedResources.quotes.some(
      (quote) => quote.status === "active",
    ),
    canChangeAgreement: workflow.summary.status === "draft",
    canCreateCalculation:
      isQuoteEligible(workflow) &&
      hasAcceptedQuote &&
      !workflow.summary.calculationId,
    canCreateFormalDocument: false,
    canCreateQuote: isQuoteEligible(workflow) && !isDealInTerminalStatus(workflow),
    canEditIntake: !isDealInTerminalStatus(workflow),
    canReassignAssignee: true,
    canUploadAttachment: !isDealInTerminalStatus(workflow),
  };
}

function buildCrmWorkbenchEditability(workflow: DealWorkflowProjection) {
  return {
    agreement: workflow.summary.status === "draft",
    assignee: true,
    intake: !isDealInTerminalStatus(workflow),
  };
}

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
    workflow.operationalState.positions.some((position) => position.state === "blocked")
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

function requiresCustomerAttachment(nextAction: string) {
  return (
    nextAction === "Prepare documents" ||
    nextAction === "Prepare closing documents"
  );
}

function mapPortalNextAction(input: {
  attachmentCount: number;
  nextAction: string;
}) {
  if (requiresCustomerAttachment(input.nextAction)) {
    if (input.attachmentCount === 0) {
      return CUSTOMER_SAFE_ATTACHMENT_REQUIRED_ACTION;
    }

    return "Ожидайте обработки документов";
  }

  const nextAction = input.nextAction;
  switch (nextAction) {
    case "Complete intake":
      return "Заполните обязательные поля заявки";
    case "Accept quote":
      return "Ожидайте или примите котировку";
    case "Create calculation from accepted quote":
      return "Ожидайте расчет по принятой котировке";
    default:
      return nextAction;
  }
}

function buildPortalRequiredActions(input: {
  attachmentCount: number;
  nextAction: string;
  submissionCompleteness: {
    blockingReasons: string[];
    complete: boolean;
  };
}) {
  const actions = new Set<string>();

  for (const blocker of input.submissionCompleteness.blockingReasons) {
    actions.add(blocker);
  }

  if (
    requiresCustomerAttachment(input.nextAction) &&
    input.attachmentCount === 0
  ) {
    actions.add(CUSTOMER_SAFE_ATTACHMENT_REQUIRED_ACTION);
  } else if (input.nextAction.trim().length > 0) {
    actions.add(
      mapPortalNextAction({
        attachmentCount: input.attachmentCount,
        nextAction: input.nextAction,
      }),
    );
  }

  return Array.from(actions);
}

function toPortalIntakeSummary(workflow: DealWorkflowProjection) {
  return {
    contractNumber: workflow.intake.incomingReceipt.contractNumber,
    customerNote: workflow.intake.common.customerNote,
    expectedAmount: workflow.intake.incomingReceipt.expectedAmount,
    expectedCurrencyId: workflow.intake.incomingReceipt.expectedCurrencyId,
    invoiceNumber: workflow.intake.incomingReceipt.invoiceNumber,
    purpose: workflow.intake.moneyRequest.purpose,
    requestedExecutionDate: workflow.intake.common.requestedExecutionDate,
    sourceAmount: workflow.intake.moneyRequest.sourceAmount,
    sourceCurrencyId: workflow.intake.moneyRequest.sourceCurrencyId,
    targetCurrencyId: workflow.intake.moneyRequest.targetCurrencyId,
  };
}

function buildPortalProjection(input: {
  attachments: Awaited<
    ReturnType<FilesModule["files"]["queries"]["listDealAttachments"]>
  >;
  workflow: DealWorkflowProjection;
}): PortalDealProjection {
  const customerSafeTimeline = getCustomerSafeTimeline(input.workflow.timeline);
  const attachments = buildCustomerSafeAttachments(
    customerSafeTimeline,
    input.attachments,
  );
  const submissionCompleteness = buildPortalSubmissionCompleteness(input.workflow);

  return {
    attachments,
    calculationSummary: input.workflow.summary.calculationId
      ? { id: input.workflow.summary.calculationId }
      : null,
    customerSafeIntake: toPortalIntakeSummary(input.workflow),
    nextAction: mapPortalNextAction({
      attachmentCount: attachments.length,
      nextAction: input.workflow.nextAction,
    }),
    quoteSummary: buildPortalQuoteSummary(input.workflow),
    requiredActions: buildPortalRequiredActions({
      attachmentCount: attachments.length,
      nextAction: input.workflow.nextAction,
      submissionCompleteness,
    }),
    submissionCompleteness,
    summary: {
      applicantDisplayName:
        getApplicantParticipant(input.workflow)?.displayName ?? null,
      createdAt: input.workflow.summary.createdAt,
      id: input.workflow.summary.id,
      status: input.workflow.summary.status,
      type: input.workflow.summary.type,
    },
    timeline: customerSafeTimeline,
  };
}

function toPortalListItem(projection: PortalDealProjection) {
  return {
    applicantDisplayName: projection.summary.applicantDisplayName,
    attachmentCount: projection.attachments.length,
    calculationSummary: projection.calculationSummary,
    createdAt: projection.summary.createdAt,
    id: projection.summary.id,
    nextAction: projection.nextAction,
    quoteExpiresAt: projection.quoteSummary?.expiresAt ?? null,
    status: projection.summary.status,
    submissionComplete: projection.submissionCompleteness.complete,
    type: projection.summary.type,
  };
}

function isDealOwnedByCustomer(
  workflow: DealWorkflowProjection,
  customerId: string,
) {
  return getCustomerParticipant(workflow)?.customerId === customerId;
}

function toCustomerLegalEntitySummary(
  counterparty: Counterparty,
): CustomerLegalEntitySummary {
  return {
    counterpartyId: counterparty.id,
    email: counterparty.email,
    fullName: counterparty.fullName,
    inn: counterparty.inn,
    orgName: counterparty.shortName,
    phone: counterparty.phone,
    position: counterparty.position,
    relationshipKind: counterparty.relationshipKind,
    shortName: counterparty.shortName,
  };
}

function toCustomerWorkspaceSummary(
  customer: Customer,
  legalEntities: Counterparty[],
): CustomerWorkspaceSummary {
  return {
    description: customer.description,
    displayName: customer.displayName,
    externalRef: customer.externalRef,
    id: customer.id,
    legalEntities: legalEntities.map(toCustomerLegalEntitySummary),
  };
}

function isQuoteEligible(workflow: DealWorkflowProjection) {
  return workflow.executionPlan.some((leg) => leg.kind === "convert");
}

function getPositionByKind(
  workflow: DealWorkflowProjection,
  kind: string,
): DealOperationalPosition | null {
  return (
    workflow.operationalState.positions.find((position) => position.kind === kind) ??
    null
  );
}

function sumCalculationLineAmounts(
  lines: CalculationDetailsLike["lines"],
  kind: string,
) {
  return lines.reduce((acc, line) => {
    if (line.kind !== kind) {
      return acc;
    }

    return acc + BigInt(line.amountMinor);
  }, 0n);
}

function buildProfitabilitySnapshot(
  calculation:
    | Awaited<ReturnType<CalculationsModule["calculations"]["queries"]["findById"]>>
    | null,
): FinanceProfitabilitySnapshot {
  if (!calculation) {
    return null;
  }

  const feeRevenueMinor = sumCalculationLineAmounts(calculation.lines, "fee_revenue");
  const spreadRevenueMinor = sumCalculationLineAmounts(
    calculation.lines,
    "spread_revenue",
  );

  return {
    calculationId: calculation.id,
    currencyId: calculation.currentSnapshot.baseCurrencyId,
    feeRevenueMinor: feeRevenueMinor.toString(),
    spreadRevenueMinor: spreadRevenueMinor.toString(),
    totalRevenueMinor: (feeRevenueMinor + spreadRevenueMinor).toString(),
  };
}

function summarizeExecutionPlan(workflow: DealWorkflowProjection) {
  return {
    blockedLegCount: workflow.executionPlan.filter((leg) => leg.state === "blocked")
      .length,
    doneLegCount: workflow.executionPlan.filter((leg) => leg.state === "done")
      .length,
    totalLegCount: workflow.executionPlan.length,
  };
}

function collectBlockingReasons(workflow: DealWorkflowProjection) {
  const messages = new Set<string>();

  for (const readiness of workflow.transitionReadiness) {
    for (const blocker of readiness.blockers) {
      messages.add(blocker.message);
    }
  }

  return Array.from(messages);
}

function classifyFinanceQueue(workflow: DealWorkflowProjection): {
  blockers: string[];
  queue: FinanceDealQueue;
  queueReason: string;
} {
  const downstreamBlocked =
    workflow.executionPlan.some(
      (leg) => DOWNSTREAM_LEG_KINDS.has(leg.kind) && leg.state === "blocked",
    ) ||
    workflow.operationalState.positions.some(
      (position) =>
        DOWNSTREAM_POSITION_KINDS.has(position.kind) && position.state === "blocked",
    );

  if (downstreamBlocked) {
    return {
      blockers: collectBlockingReasons(workflow),
      queue: "failed_instruction",
      queueReason: "Сделка заблокирована на этапе исполнения",
    };
  }

  const customerReceivable = getPositionByKind(workflow, "customer_receivable");
  const downstreamReady = workflow.operationalState.positions.some(
    (position) =>
      DOWNSTREAM_POSITION_KINDS.has(position.kind) &&
      (position.state === "in_progress" || position.state === "ready"),
  );

  if (
    workflow.summary.status === "awaiting_payment" ||
    workflow.summary.status === "closing_documents" ||
    downstreamReady
  ) {
    return {
      blockers: [],
      queue: "execution",
      queueReason: "Сделка ожидает исполнения",
    };
  }

  if (
    workflow.summary.status === "preparing_documents" ||
    workflow.summary.status === "awaiting_funds" ||
    customerReceivable?.state === "ready" ||
    customerReceivable?.state === "in_progress"
  ) {
    return {
      blockers: [],
      queue: "funding",
      queueReason: "Сделка находится на этапе фондирования",
    };
  }

  return {
    blockers: collectBlockingReasons(workflow),
    queue: "funding",
    queueReason: "Сделка ожидает следующий шаг на этапе фондирования",
  };
}

function matchesTextFilter(value: string | null | undefined, filter: string | undefined) {
  if (!filter) {
    return true;
  }

  const normalizedValue = (value ?? "").toLowerCase();
  const normalizedFilter = filter.toLowerCase();
  return normalizedValue.includes(normalizedFilter);
}

export function createDealProjectionsWorkflow(
  deps: DealProjectionsWorkflowDeps,
) {
  async function getPortalDealProjection(dealId: string, customerId: string) {
    const workflow = await deps.deals.deals.queries.findWorkflowById(dealId);

    if (!workflow || !isDealOwnedByCustomer(workflow, customerId)) {
      return null;
    }

    const attachments = await deps.files.files.queries.listDealAttachments(dealId);
    return buildPortalProjection({ attachments, workflow });
  }

  async function listPortalDeals(
    customerId: string,
    limit = 20,
    offset = 0,
  ): Promise<PortalDealListProjection> {
    const deals = await deps.deals.deals.queries.list({
      customerId,
      limit,
      offset,
      sortBy: "createdAt",
      sortOrder: "desc",
    });

    const projections = await Promise.all(
      deals.data.map((deal) => getPortalDealProjection(deal.id, customerId)),
    );

    return {
      data: projections
        .filter((projection): projection is PortalDealProjection => projection !== null)
        .map(toPortalListItem),
      limit: deals.limit,
      offset: deals.offset,
      total: deals.total,
    };
  }

  async function getCrmDealWorkbenchProjection(
    dealId: string,
  ): Promise<CrmDealWorkbenchProjection | null> {
    const [detail, workflow, attachments] = await Promise.all([
      deps.deals.deals.queries.findById(dealId),
      deps.deals.deals.queries.findWorkflowById(dealId),
      deps.files.files.queries.listDealAttachments(dealId),
    ]);

    if (!detail || !workflow) {
      return null;
    }

    const customerId = getCustomerParticipant(workflow)?.customerId ?? null;
    const applicantCounterpartyId =
      getApplicantParticipant(workflow)?.counterpartyId ??
      workflow.intake.common.applicantCounterpartyId;
    const internalEntityOrganizationId =
      getInternalEntityParticipant(workflow)?.organizationId ?? null;

    const [agreement, applicant, calculationsHistory, customer, internalEntity] =
      await Promise.all([
        deps.agreements.agreements.queries.findById(workflow.summary.agreementId),
        applicantCounterpartyId
          ? deps.parties.counterparties.queries.findById(applicantCounterpartyId)
          : Promise.resolve(null),
        deps.deals.deals.queries.listCalculationHistory(dealId),
        customerId
          ? deps.parties.customers.queries.findById(customerId)
          : Promise.resolve(null),
        internalEntityOrganizationId
          ? deps.parties.organizations.queries.findById(internalEntityOrganizationId)
          : Promise.resolve(null),
      ]);

    const [legalEntitiesResult, currentCalculation, internalEntityRequisite] =
      await Promise.all([
        customerId
          ? deps.parties.counterparties.queries.list({
              customerId,
              limit: MAX_QUERY_LIST_LIMIT,
              offset: 0,
              sortBy: "createdAt",
              sortOrder: "desc",
            })
          : Promise.resolve(null),
        workflow.summary.calculationId
          ? deps.calculations.calculations.queries.findById(
              workflow.summary.calculationId,
            )
          : Promise.resolve(null),
        agreement?.organizationRequisiteId
          ? deps.parties.requisites.queries.findById(agreement.organizationRequisiteId)
          : Promise.resolve(null),
      ]);

    const internalEntityRequisiteProvider = internalEntityRequisite?.providerId
      ? await deps.parties.requisites.queries.findProviderById(
          internalEntityRequisite.providerId,
        )
      : null;

    const actions = buildCrmWorkbenchActions(workflow);
    const editability = buildCrmWorkbenchEditability(workflow);
    const evidenceRequirements = buildCrmEvidenceRequirements({
      attachments,
      workflow,
    });
    const documentRequirements = buildCrmDocumentRequirements(workflow);

    return {
      acceptedQuote: workflow.acceptedQuote,
      actions,
      approvals: detail.approvals,
      assignee: {
        userId: workflow.summary.agentId,
      },
      context: {
        agreement,
        applicant,
        customer:
          customer && legalEntitiesResult
            ? toCustomerWorkspaceSummary(customer, legalEntitiesResult.data)
            : null,
        internalEntity,
        internalEntityRequisite,
        internalEntityRequisiteProvider,
      },
      documentRequirements,
      editability,
      evidenceRequirements,
      executionPlan: workflow.executionPlan,
      intake: workflow.intake,
      nextAction: workflow.nextAction,
      operationalState: workflow.operationalState,
      participants: workflow.participants,
      pricing: {
        calculationHistory: calculationsHistory,
        currentCalculation,
        quoteEligibility: isQuoteEligible(workflow),
        quotes: workflow.relatedResources.quotes,
      },
      relatedResources: {
        attachments,
        formalDocuments: workflow.relatedResources.formalDocuments,
      },
      sectionCompleteness: workflow.sectionCompleteness,
      summary: {
        ...workflow.summary,
        applicantDisplayName: getApplicantParticipant(workflow)?.displayName ?? null,
        customerDisplayName: customer?.displayName ?? null,
        internalEntityDisplayName:
          getInternalEntityParticipant(workflow)?.displayName ??
          internalEntity?.shortName ??
          null,
      },
      timeline: workflow.timeline,
      transitionReadiness: workflow.transitionReadiness,
      workflow,
    };
  }

  async function listCrmDealBoard(): Promise<CrmDealBoardProjection> {
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
          customerName: customer?.displayName ?? null,
          documentSummary: {
            attachmentCount: attachments.length,
            formalDocumentCount: workflow.relatedResources.formalDocuments.length,
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

    const data = items.filter((item): item is NonNullable<typeof item> => item !== null);
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

  async function getFinanceDealWorkspaceProjection(
    dealId: string,
  ): Promise<FinanceDealWorkspaceProjection | null> {
    const [workflow, attachments] = await Promise.all([
      deps.deals.deals.queries.findWorkflowById(dealId),
      deps.files.files.queries.listDealAttachments(dealId),
    ]);

    if (!workflow) {
      return null;
    }

    const currentCalculation = await (workflow.summary.calculationId
      ? deps.calculations.calculations.queries.findById(
          workflow.summary.calculationId,
        )
      : Promise.resolve(null));

    const queueContext = classifyFinanceQueue(workflow);

    return {
      acceptedQuote: workflow.acceptedQuote,
      executionPlan: workflow.executionPlan,
      operationalState: workflow.operationalState,
      profitabilitySnapshot: buildProfitabilitySnapshot(currentCalculation),
      queueContext,
      relatedResources: {
        attachments,
        formalDocuments: workflow.relatedResources.formalDocuments,
        quotes: workflow.relatedResources.quotes,
      },
      summary: {
        ...workflow.summary,
        applicantDisplayName: getApplicantParticipant(workflow)?.displayName ?? null,
        internalEntityDisplayName:
          getInternalEntityParticipant(workflow)?.displayName ?? null,
      },
      timeline: workflow.timeline,
      workflow,
    };
  }

  async function listFinanceDealQueues(
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
      listedDeals.data.map(async (deal): Promise<FinanceDealQueueItem | null> => {
        const workflow = await deps.deals.deals.queries.findWorkflowById(deal.id);

        if (!workflow) {
          return null;
        }

        const applicantName = getApplicantParticipant(workflow)?.displayName ?? null;
        const internalEntityName =
          getInternalEntityParticipant(workflow)?.displayName ?? null;

        if (
          !matchesTextFilter(applicantName, filters.applicant) ||
          !matchesTextFilter(internalEntityName, filters.internalEntity)
        ) {
          return null;
        }

        const currentCalculation = workflow.summary.calculationId
          ? await deps.calculations.calculations.queries.findById(
              workflow.summary.calculationId,
            )
          : null;

        const attachments = await deps.files.files.queries.listDealAttachments(deal.id);
        const queueContext = classifyFinanceQueue(workflow);

        return {
          applicantName,
          blockingReasons: queueContext.blockers,
          createdAt: workflow.summary.createdAt,
          dealId: workflow.summary.id,
          documentSummary: {
            attachmentCount: attachments.length,
            formalDocumentCount: workflow.relatedResources.formalDocuments.length,
          },
          executionSummary: summarizeExecutionPlan(workflow),
          internalEntityName,
          nextAction: workflow.nextAction,
          operationalState: workflow.operationalState,
          profitabilitySnapshot: buildProfitabilitySnapshot(currentCalculation),
          queue: queueContext.queue,
          queueReason: queueContext.queueReason,
          quoteSummary: buildPortalQuoteSummary(workflow),
          status: workflow.summary.status,
          type: workflow.summary.type,
        };
      }),
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
      items: filters.queue
        ? filteredItems.filter((item) => item.queue === filters.queue)
        : filteredItems,
    };
  }

  return {
    getPortalDealProjection,
    listCrmDealBoard,
    getCrmDealWorkbenchProjection,
    getFinanceDealWorkspaceProjection,
    listFinanceDealQueues,
    listPortalDeals,
  };
}

export type DealProjectionsWorkflow = ReturnType<
  typeof createDealProjectionsWorkflow
>;
