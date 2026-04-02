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
import type { QuoteListItem } from "@bedrock/treasury/contracts";
import { MAX_QUERY_LIST_LIMIT } from "@bedrock/shared/core";
import { minorToAmountString } from "@bedrock/shared/money";

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

const CUSTOMER_SAFE_INVOICE_REQUIRED_ACTION = "Загрузите инвойс";
const EXTERNAL_EVIDENCE_REQUIRED_MESSAGE =
  "Загрузите подтверждающие документы по сделке";
const PAYMENT_INVOICE_REQUIRED_MESSAGE = "Инвойс по сделке не загружен";
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
type TreasuryQuoteRecord = Awaited<
  ReturnType<TreasuryModule["quotes"]["queries"]["listQuotes"]>
>["data"][number];

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

function serializeCrmPricingQuote(quote: TreasuryQuoteRecord): QuoteListItem {
  const fromCurrency = quote.fromCurrency ?? "—";
  const toCurrency = quote.toCurrency ?? "—";

  return {
    createdAt: quote.createdAt.toISOString(),
    dealDirection: quote.dealDirection,
    dealForm: quote.dealForm,
    dealId: quote.dealId,
    expiresAt: quote.expiresAt.toISOString(),
    fromAmount: minorToAmountString(quote.fromAmountMinor, {
      currency: fromCurrency,
    }),
    fromAmountMinor: quote.fromAmountMinor.toString(),
    fromCurrency,
    fromCurrencyId: quote.fromCurrencyId,
    id: quote.id,
    idempotencyKey: quote.idempotencyKey,
    pricingMode: quote.pricingMode,
    pricingTrace: quote.pricingTrace ?? {},
    rateDen: quote.rateDen.toString(),
    rateNum: quote.rateNum.toString(),
    status: quote.status,
    toAmount: minorToAmountString(quote.toAmountMinor, {
      currency: toCurrency,
    }),
    toAmountMinor: quote.toAmountMinor.toString(),
    toCurrency,
    toCurrencyId: quote.toCurrencyId,
    usedAt: quote.usedAt?.toISOString() ?? null,
    usedByRef: quote.usedByRef,
    usedDocumentId: quote.usedDocumentId,
  };
}

function getCustomerSafeTimeline(
  timeline: DealTimelineEvent[],
): DealTimelineEvent[] {
  return timeline.filter((event) => event.visibility === "customer_safe");
}

function buildCustomerSafeAttachments(
  attachments: Awaited<
    ReturnType<FilesModule["files"]["queries"]["listDealAttachments"]>
  >,
  workflow: DealWorkflowProjection,
) {
  const ingestionsByAttachmentId = new Map(
    workflow.attachmentIngestions.map((ingestion) => [ingestion.fileAssetId, ingestion]),
  );

  return attachments
    .filter((attachment) => attachment.visibility === "customer_safe")
    .map((attachment) => {
      const ingestion = ingestionsByAttachmentId.get(attachment.id) ?? null;
      const ingestionStatus =
        !attachment.purpose || attachment.purpose === "other"
          ? null
          : !ingestion
            ? null
            : ingestion.status === "pending" || ingestion.status === "processing"
              ? ("processing" as const)
              : ingestion.status === "processed"
                ? ("applied" as const)
                : ingestion.errorCode === "extractor_unconfigured" ||
                    ingestion.errorCode === "storage_unconfigured"
                  ? ("unavailable" as const)
                  : ("failed" as const);

      return {
        createdAt: attachment.createdAt,
        fileName: attachment.fileName,
        id: attachment.id,
        ingestionStatus,
        purpose: attachment.purpose,
      };
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

function hasAttachmentPurpose(
  attachments: Awaited<
    ReturnType<FilesModule["files"]["queries"]["listDealAttachments"]>
  >,
  purpose: "contract" | "invoice",
  visibility?: "customer_safe" | "internal",
) {
  return attachments.some(
    (attachment) =>
      attachment.purpose === purpose &&
      (visibility ? attachment.visibility === visibility : true),
  );
}

function buildPortalSubmissionCompleteness(input: {
  attachments: Awaited<
    ReturnType<FilesModule["files"]["queries"]["listDealAttachments"]>
  >;
  workflow: DealWorkflowProjection;
}) {
  const relevantSectionIds = new Set(
    PORTAL_OWNED_SECTIONS_BY_TYPE[input.workflow.intake.type],
  );
  const blockingReasons = input.workflow.sectionCompleteness
    .filter((section) => relevantSectionIds.has(section.sectionId))
    .flatMap((section) => section.blockingReasons);

  if (
    input.workflow.summary.type === "payment" &&
    !hasAttachmentPurpose(input.attachments, "invoice", "customer_safe")
  ) {
    blockingReasons.push(CUSTOMER_SAFE_INVOICE_REQUIRED_ACTION);
  }

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
  if (input.workflow.summary.type === "payment") {
    const hasInvoice = hasAttachmentPurpose(input.attachments, "invoice");
    const hasContract = hasAttachmentPurpose(input.attachments, "contract");

    return [
      {
        blockingReasons: hasInvoice ? [] : [PAYMENT_INVOICE_REQUIRED_MESSAGE],
        code: "invoice",
        label: "Инвойс",
        state: hasInvoice ? ("provided" as const) : ("missing" as const),
      },
      {
        blockingReasons: [],
        code: "contract",
        label: "Договор",
        state: hasContract ? ("provided" as const) : ("not_required" as const),
      },
    ];
  }

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

function countCounterpartySnapshotFields(
  snapshot: DealWorkflowProjection["intake"]["externalBeneficiary"]["beneficiarySnapshot"],
) {
  if (!snapshot) {
    return 0;
  }

  return [
    snapshot.country,
    snapshot.displayName,
    snapshot.inn,
    snapshot.legalName,
  ].filter((value) => Boolean(value)).length;
}

function countBankInstructionFields(
  snapshot: DealWorkflowProjection["intake"]["externalBeneficiary"]["bankInstructionSnapshot"],
) {
  if (!snapshot) {
    return 0;
  }

  return [
    snapshot.accountNo,
    snapshot.bankAddress,
    snapshot.bankCountry,
    snapshot.bankName,
    snapshot.beneficiaryName,
    snapshot.bic,
    snapshot.corrAccount,
    snapshot.iban,
    snapshot.label,
    snapshot.swift,
  ].filter((value) => Boolean(value)).length;
}

function buildCrmBeneficiaryDraft(input: {
  attachments: Awaited<
    ReturnType<FilesModule["files"]["queries"]["listDealAttachments"]>
  >;
  workflow: DealWorkflowProjection;
}) {
  if (input.workflow.intake.externalBeneficiary.beneficiaryCounterpartyId) {
    return null;
  }

  const attachmentById = new Map(
    input.attachments.map((attachment) => [attachment.id, attachment]),
  );
  const candidate = [...input.workflow.attachmentIngestions]
    .filter(
      (ingestion) =>
        ingestion.status === "processed" &&
        (ingestion.normalizedPayload?.beneficiarySnapshot ||
          ingestion.normalizedPayload?.bankInstructionSnapshot),
    )
    .sort((left, right) => {
      const leftAttachment = attachmentById.get(left.fileAssetId);
      const rightAttachment = attachmentById.get(right.fileAssetId);
      const leftRank = leftAttachment?.purpose === "invoice" ? 0 : 1;
      const rightRank = rightAttachment?.purpose === "invoice" ? 0 : 1;
      if (leftRank !== rightRank) {
        return leftRank - rightRank;
      }

      const leftTime = left.lastProcessedAt?.getTime() ?? 0;
      const rightTime = right.lastProcessedAt?.getTime() ?? 0;
      return rightTime - leftTime;
    })[0];

  if (!candidate?.normalizedPayload) {
    return null;
  }

  return {
    bankInstructionSnapshot: candidate.normalizedPayload.bankInstructionSnapshot,
    beneficiarySnapshot: candidate.normalizedPayload.beneficiarySnapshot,
    fieldPresence: {
      bankInstructionFields: countBankInstructionFields(
        candidate.normalizedPayload.bankInstructionSnapshot,
      ),
      beneficiaryFields: countCounterpartySnapshotFields(
        candidate.normalizedPayload.beneficiarySnapshot,
      ),
    },
    purpose: attachmentById.get(candidate.fileAssetId)?.purpose ?? null,
    sourceAttachmentId: candidate.fileAssetId,
  };
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
  hasRequiredInvoice: boolean;
  nextAction: string;
}) {
  if (requiresCustomerAttachment(input.nextAction)) {
    if (!input.hasRequiredInvoice) {
      return CUSTOMER_SAFE_INVOICE_REQUIRED_ACTION;
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
  hasRequiredInvoice: boolean;
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
    !input.hasRequiredInvoice
  ) {
    actions.add(CUSTOMER_SAFE_INVOICE_REQUIRED_ACTION);
  } else if (input.nextAction.trim().length > 0) {
    actions.add(
      mapPortalNextAction({
        hasRequiredInvoice: input.hasRequiredInvoice,
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
    input.attachments,
    input.workflow,
  );
  const hasRequiredInvoice =
    input.workflow.summary.type !== "payment" ||
    attachments.some((attachment) => attachment.purpose === "invoice");
  const submissionCompleteness = buildPortalSubmissionCompleteness({
    attachments: input.attachments,
    workflow: input.workflow,
  });

  return {
    attachments,
    calculationSummary: input.workflow.summary.calculationId
      ? { id: input.workflow.summary.calculationId }
      : null,
    customerSafeIntake: toPortalIntakeSummary(input.workflow),
    nextAction: mapPortalNextAction({
      hasRequiredInvoice,
      nextAction: input.workflow.nextAction,
    }),
    quoteSummary: buildPortalQuoteSummary(input.workflow),
    requiredActions: buildPortalRequiredActions({
      hasRequiredInvoice,
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

    const [legalEntitiesResult, currentCalculation, internalEntityRequisite, quotesResult] =
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
        deps.treasury.quotes.queries.listQuotes({
          dealId,
          limit: MAX_QUERY_LIST_LIMIT,
          offset: 0,
          sortBy: "createdAt",
          sortOrder: "desc",
        }),
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
    const beneficiaryDraft = buildCrmBeneficiaryDraft({
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
      beneficiaryDraft,
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
        quotes: quotesResult.data.map(serializeCrmPricingQuote),
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
    const [workflow, attachments, quotesResult] = await Promise.all([
      deps.deals.deals.queries.findWorkflowById(dealId),
      deps.files.files.queries.listDealAttachments(dealId),
      deps.treasury.quotes.queries.listQuotes({
        dealId,
        limit: MAX_QUERY_LIST_LIMIT,
        offset: 0,
        sortBy: "createdAt",
        sortOrder: "desc",
      }),
    ]);

    if (!workflow) {
      return null;
    }

    const currentCalculation = await (workflow.summary.calculationId
      ? deps.calculations.calculations.queries.findById(
          workflow.summary.calculationId,
        )
      : Promise.resolve(null));

    const actions = buildCrmWorkbenchActions(workflow);
    const attachmentRequirements = buildCrmEvidenceRequirements({
      attachments,
      workflow,
    });
    const formalDocumentRequirements = buildCrmDocumentRequirements(workflow);
    const queueContext = classifyFinanceQueue(workflow);
    const acceptedQuoteDetails = workflow.acceptedQuote
      ? quotesResult.data
          .map(serializeCrmPricingQuote)
          .find((quote) => quote.id === workflow.acceptedQuote?.quoteId) ?? null
      : null;

    return {
      acceptedQuote: workflow.acceptedQuote,
      acceptedQuoteDetails,
      actions: {
        canCreateCalculation: actions.canCreateCalculation,
        canCreateQuote: actions.canCreateQuote,
        canUploadAttachment: actions.canUploadAttachment,
      },
      attachmentRequirements,
      executionPlan: workflow.executionPlan,
      formalDocumentRequirements,
      nextAction: workflow.nextAction,
      operationalState: workflow.operationalState,
      pricing: {
        quoteEligibility: isQuoteEligible(workflow),
        requestedAmount: workflow.intake.moneyRequest.sourceAmount ?? null,
        requestedCurrencyId: workflow.intake.moneyRequest.sourceCurrencyId ?? null,
        targetCurrencyId: workflow.intake.moneyRequest.targetCurrencyId ?? null,
      },
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
