import type { AgreementsModule } from "@bedrock/agreements";
import type { CalculationsModule } from "@bedrock/calculations";
import type { CurrenciesService } from "@bedrock/currencies";
import { canDealWriteTreasuryOrFormalDocuments } from "@bedrock/deals";
import type { DealsModule as DealsModuleRoot } from "@bedrock/deals";
import type {
  DealOperationalPosition,
  DealTimelineEvent,
  DealType,
  DealWorkflowProjection,
} from "@bedrock/deals/contracts";
import type { DocumentsReadModel } from "@bedrock/documents/read-model";
import type { FilesModule } from "@bedrock/files";
import type { IamService } from "@bedrock/iam";
import type { PartiesModule as PartiesModuleRoot } from "@bedrock/parties";
import type {
  Counterparty,
  Customer,
} from "@bedrock/parties/contracts";
import type { ReconciliationService } from "@bedrock/reconciliation";
import type { ReconciliationOperationLinkDto } from "@bedrock/reconciliation/contracts";
import { MAX_QUERY_LIST_LIMIT } from "@bedrock/shared/core";
import {
  minorToAmountString,
  toMinorAmountString,
} from "@bedrock/shared/money";
import type { TreasuryModule } from "@bedrock/treasury";
import type {
  QuoteListItem,
  TreasuryInstruction,
} from "@bedrock/treasury/contracts";

import {
  deriveFinanceDealReadiness,
  deriveFinanceDealStage,
} from "./close-readiness";
import type {
  CrmDealByStatusItem,
  CrmDealBoardProjection,
  CrmDealBoardStage,
  CrmDealListItem,
  CrmDealWorkbenchProjection,
  CrmDealsByDayItem,
  CrmDealsByDayQuery,
  CrmDealsByStatus,
  CrmDealsListProjection,
  CrmDealsListQuery,
  CrmDealsStats,
  CrmDealsStatsQuery,
  CustomerLegalEntitySummary,
  CustomerWorkspaceSummary,
  FinanceDealQueue,
  FinanceDealQueueFilters,
  FinanceDealQueueProjection,
  FinanceDealQueueItem,
  FinanceProfitabilityAmount,
  FinanceDealWorkspaceProjection,
  FinanceProfitabilitySnapshot,
  PortalDealListProjection,
  PortalDealProjection,
} from "./contracts";
import { CrmDealsListQuerySchema } from "./contracts";

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

const DOWNSTREAM_LEG_KINDS = new Set([
  "payout",
  "settle_exporter",
  "transit_hold",
]);

export interface DealProjectionsWorkflowDeps {
  agreements: Pick<AgreementsModule, "agreements">;
  calculations: Pick<CalculationsModule, "calculations">;
  currencies: Pick<CurrenciesService, "findById">;
  deals: Pick<DealsModuleRoot, "deals">;
  documentsReadModel: Pick<DocumentsReadModel, "listDealTraceRowsByDealId">;
  files: Pick<FilesModule, "files">;
  iam: {
    queries: Pick<IamService["queries"], "findById">;
  };
  parties: Pick<
    PartiesModuleRoot,
    "counterparties" | "customers" | "organizations" | "requisites"
  >;
  reconciliation: Pick<ReconciliationService, "links">;
  treasury: Pick<TreasuryModule, "instructions" | "operations" | "quotes">;
}

export type ListFinanceDealQueuesInput = FinanceDealQueueFilters;
type CalculationDetailsLike = NonNullable<
  Awaited<ReturnType<CalculationsModule["calculations"]["queries"]["findById"]>>
>;
type CurrencyDetailsLike = Awaited<
  ReturnType<DealProjectionsWorkflowDeps["currencies"]["findById"]>
>;
type DealListRecord = Awaited<
  ReturnType<DealsModuleRoot["deals"]["queries"]["list"]>
>["data"][number];
type CustomerListItemLike = Awaited<
  ReturnType<PartiesModuleRoot["customers"]["queries"]["listByIds"]>
>[number];
type TreasuryQuoteRecord = Awaited<
  ReturnType<TreasuryModule["quotes"]["queries"]["listQuotes"]>
>["data"][number];
type TreasuryOperationRecord = Awaited<
  ReturnType<TreasuryModule["operations"]["queries"]["list"]>
>["data"][number];
type UserDetailsLike = Awaited<
  ReturnType<DealProjectionsWorkflowDeps["iam"]["queries"]["findById"]>
>;

function parseOptionalSet(value?: string): Set<string> | null {
  if (!value) {
    return null;
  }

  const items = value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  return items.length > 0 ? new Set(items) : null;
}

function parseDecimalOrZero(value: string | null | undefined): number {
  if (!value) {
    return 0;
  }

  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseMinorOrZero(
  value: string | bigint | null | undefined,
  precision: number | null | undefined,
): number {
  if (value == null || precision == null) {
    return 0;
  }

  return parseDecimalOrZero(minorToAmountString(value, { precision }));
}

function toMinorOrZero(
  value: string | null | undefined,
  currencyCode: string,
): bigint {
  return BigInt(toMinorAmountString(value ?? "0", currencyCode));
}

function compareBigInt(left: bigint, right: bigint): number {
  if (left === right) {
    return 0;
  }

  return left < right ? -1 : 1;
}

function compareNullableStrings(
  left: string | null | undefined,
  right: string | null | undefined,
): number {
  return (left ?? "").localeCompare(right ?? "", "ru");
}

function compareNullableDates(
  left: string | null | undefined,
  right: string | null | undefined,
): number {
  const leftValue = left ? new Date(left).getTime() : 0;
  const rightValue = right ? new Date(right).getTime() : 0;
  return leftValue - rightValue;
}

function toMap<K, V>(entries: readonly (readonly [K, V])[]): Map<K, V> {
  return new Map(entries);
}

function buildCrmDealMoneySummary(input: {
  deal: DealListRecord;
  calculation: CalculationDetailsLike | null;
  sourceCurrency: CurrencyDetailsLike | null;
  baseCurrency: CurrencyDetailsLike | null;
}) {
  const currencyCode = input.sourceCurrency?.code ?? "RUB";
  const sourcePrecision = input.sourceCurrency?.precision ?? 2;
  const amountMinor = toMinorOrZero(input.deal.amount, currencyCode);
  const amount = parseDecimalOrZero(input.deal.amount);

  const amountInBaseMinor =
    input.calculation && input.baseCurrency
      ? BigInt(input.calculation.currentSnapshot.totalInBaseMinor)
      : amountMinor;
  const amountInBase =
    input.calculation && input.baseCurrency
      ? parseMinorOrZero(
          input.calculation.currentSnapshot.totalInBaseMinor,
          input.baseCurrency.precision,
        )
      : parseMinorOrZero(amountMinor, sourcePrecision);
  const feePercentage = input.calculation
    ? parseMinorOrZero(input.calculation.currentSnapshot.feeBps, 2)
    : 0;

  return {
    amount,
    amountInBase,
    amountInBaseMinor,
    amountMinor,
    baseCurrencyCode: input.baseCurrency?.code ?? currencyCode,
    currencyCode,
    feePercentage,
  };
}

async function loadDealMoneyLookups(
  listedDeals: DealListRecord[],
  deps: Pick<DealProjectionsWorkflowDeps, "calculations" | "currencies">,
) {
  const calculationIds = [
    ...new Set(
      listedDeals
        .map((deal) => deal.calculationId)
        .filter((calculationId): calculationId is string => Boolean(calculationId)),
    ),
  ];
  const sourceCurrencyIds = [
    ...new Set(
      listedDeals
        .map((deal) => deal.currencyId)
        .filter((currencyId): currencyId is string => Boolean(currencyId)),
    ),
  ];

  const calculationsById = toMap(
    await Promise.all(
      calculationIds.map(
        async (
          calculationId,
        ): Promise<readonly [string, CalculationDetailsLike | null]> =>
          [
            calculationId,
            (await deps.calculations.calculations.queries.findById(calculationId)) ??
              null,
          ] as const,
      ),
    ),
  );
  const baseCurrencyIds = [
    ...new Set(
      Array.from(calculationsById.values())
        .map((calculation) => calculation?.currentSnapshot.baseCurrencyId ?? null)
        .filter((currencyId): currencyId is string => Boolean(currencyId)),
    ),
  ];

  const [currenciesById, baseCurrenciesById] = await Promise.all([
    Promise.all(
      sourceCurrencyIds.map(
        async (currencyId): Promise<readonly [string, CurrencyDetailsLike]> =>
          [currencyId, await deps.currencies.findById(currencyId)] as const,
      ),
    ).then(toMap),
    Promise.all(
      baseCurrencyIds.map(
        async (currencyId): Promise<readonly [string, CurrencyDetailsLike]> =>
          [currencyId, await deps.currencies.findById(currencyId)] as const,
      ),
    ).then(toMap),
  ]);

  return {
    baseCurrenciesById,
    calculationsById,
    currenciesById,
  };
}

function getCustomerParticipant(workflow: DealWorkflowProjection) {
  return workflow.participants.find(
    (participant) => participant.role === "customer",
  );
}

function getApplicantParticipant(workflow: DealWorkflowProjection) {
  return workflow.participants.find(
    (participant) => participant.role === "applicant",
  );
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
    workflow.attachmentIngestions.map((ingestion) => [
      ingestion.fileAssetId,
      ingestion,
    ]),
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
            : ingestion.status === "pending" ||
                ingestion.status === "processing"
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
    .sort(
      (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
    );
}

function buildPortalQuoteSummary(workflow: DealWorkflowProjection) {
  if (workflow.acceptedQuote) {
    return {
      expiresAt: workflow.acceptedQuote.expiresAt,
      quoteId: workflow.acceptedQuote.quoteId,
      status: workflow.acceptedQuote.quoteStatus,
    };
  }

  const activeOrLatestQuote = [...workflow.relatedResources.quotes].sort(
    (left, right) => {
      const leftTime = left.expiresAt?.getTime() ?? 0;
      const rightTime = right.expiresAt?.getTime() ?? 0;
      return rightTime - leftTime;
    },
  )[0];

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
  return (
    workflow.summary.status === "done" ||
    workflow.summary.status === "cancelled"
  );
}

function requiresExternalEvidence(type: DealType) {
  return type !== "currency_exchange";
}

function hasCustomerSafeAttachment(
  attachments: Awaited<
    ReturnType<FilesModule["files"]["queries"]["listDealAttachments"]>
  >,
) {
  return attachments.some(
    (attachment) => attachment.visibility === "customer_safe",
  );
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
  const matching = input.documents.filter(
    (document) => document.docType === input.docType,
  );

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
  const requirements: {
    activeDocumentId: string | null;
    blockingReasons: string[];
    createAllowed: boolean;
    docType: string;
    openAllowed: boolean;
    stage: "opening" | "closing";
    state: "in_progress" | "missing" | "not_required" | "ready";
  }[] = [];

  const openingDocType =
    OPENING_DOCUMENT_TYPE_BY_DEAL_TYPE[workflow.summary.type];
  const closingDocType =
    CLOSING_DOCUMENT_TYPE_BY_DEAL_TYPE[workflow.summary.type];
  const createAllowed = canDealWriteTreasuryOrFormalDocuments({
    status: workflow.summary.status,
    type: workflow.summary.type,
  });

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
      createAllowed: !document && createAllowed,
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
    bankInstructionSnapshot:
      candidate.normalizedPayload.bankInstructionSnapshot,
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
    canCreateQuote:
      isQuoteEligible(workflow) && !isDealInTerminalStatus(workflow),
    canEditIntake: !isDealInTerminalStatus(workflow),
    canReassignAssignee: true,
    canUploadAttachment: !isDealInTerminalStatus(workflow),
  };
}

function isExecutionRequestAllowed(workflow: DealWorkflowProjection) {
  if (
    workflow.summary.status === "awaiting_funds" ||
    workflow.summary.status === "awaiting_payment" ||
    workflow.summary.status === "closing_documents"
  ) {
    return true;
  }

  const readiness = workflow.transitionReadiness.find(
    (item) => item.targetStatus === "awaiting_funds",
  );

  return readiness?.allowed ?? false;
}

function getInstructionActions(input: {
  isBlockedWithoutInstruction: boolean;
  latestInstruction: TreasuryInstruction | null;
}) {
  const latestInstruction = input.latestInstruction;

  return {
    canPrepareInstruction:
      !latestInstruction && !input.isBlockedWithoutInstruction,
    canRequestReturn: latestInstruction?.state === "settled",
    canRetryInstruction:
      latestInstruction?.state === "failed" ||
      latestInstruction?.state === "returned",
    canSubmitInstruction: latestInstruction?.state === "prepared",
    canVoidInstruction:
      latestInstruction?.state === "prepared" ||
      latestInstruction?.state === "submitted",
  };
}

function getInstructionStatus(input: {
  isBlockedWithoutInstruction: boolean;
  latestInstruction: TreasuryInstruction | null;
}) {
  if (input.latestInstruction) {
    return input.latestInstruction.state;
  }

  if (input.isBlockedWithoutInstruction) {
    return "blocked" as const;
  }

  return "planned" as const;
}

function getAvailableOutcomeTransitions(
  latestInstruction: TreasuryInstruction | null,
): ("failed" | "returned" | "settled")[] {
  const submitTransitions: ("failed" | "returned" | "settled")[] = [
    "settled",
    "failed",
  ];
  const returnTransitions: ("failed" | "returned" | "settled")[] = [
    "returned",
  ];

  if (!latestInstruction) {
    return [];
  }

  if (latestInstruction.state === "submitted") {
    return submitTransitions;
  }

  if (latestInstruction.state === "return_requested") {
    return returnTransitions;
  }

  return [];
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

function buildFundingMessage(workflow: DealWorkflowProjection) {
  if (!workflow.executionPlan.some((leg) => leg.kind === "convert")) {
    return null;
  }

  if (
    workflow.fundingResolution.state === "resolved" &&
    workflow.fundingResolution.strategy === "existing_inventory"
  ) {
    const targetCurrency =
      workflow.fundingResolution.targetCurrency ?? "целевой валюте";

    return `Используем остаток ${targetCurrency} на казначейском счете`;
  }

  if (
    workflow.fundingResolution.state === "resolved" &&
    workflow.fundingResolution.strategy === "external_fx"
  ) {
    return "Требуется конвертация";
  }

  return null;
}

function buildFinanceQuoteRequestContext(workflow: DealWorkflowProjection) {
  if (workflow.summary.type === "payment") {
    return {
      fundingMessage: buildFundingMessage(workflow),
      fundingResolution: workflow.fundingResolution,
      quoteAmount: workflow.intake.incomingReceipt.expectedAmount ?? null,
      quoteAmountSide: "target" as const,
      sourceCurrencyId: workflow.intake.moneyRequest.sourceCurrencyId ?? null,
      targetCurrencyId: workflow.intake.moneyRequest.targetCurrencyId ?? null,
    };
  }

  return {
    fundingMessage: buildFundingMessage(workflow),
    fundingResolution: workflow.fundingResolution,
    quoteAmount: workflow.intake.moneyRequest.sourceAmount ?? null,
    quoteAmountSide: "source" as const,
    sourceCurrencyId: workflow.intake.moneyRequest.sourceCurrencyId ?? null,
    targetCurrencyId: workflow.intake.moneyRequest.targetCurrencyId ?? null,
  };
}

function getPositionByKind(
  workflow: DealWorkflowProjection,
  kind: string,
): DealOperationalPosition | null {
  return (
    workflow.operationalState.positions.find(
      (position) => position.kind === kind,
    ) ?? null
  );
}

function sumCalculationLineAmountsByCurrency(
  lines: CalculationDetailsLike["lines"],
  kind: string,
) {
  return lines.reduce((acc, line) => {
    if (line.kind !== kind) {
      return acc;
    }

    const nextAmount =
      (acc.get(line.currencyId) ?? 0n) + BigInt(line.amountMinor);

    acc.set(line.currencyId, nextAmount);
    return acc;
  }, new Map<string, bigint>());
}

function mergeProfitabilityAmountsByCurrency(
  ...groups: Array<Map<string, bigint>>
) {
  const totals = new Map<string, bigint>();

  for (const group of groups) {
    for (const [currencyId, amountMinor] of group.entries()) {
      totals.set(currencyId, (totals.get(currencyId) ?? 0n) + amountMinor);
    }
  }

  return totals;
}

async function resolveProfitabilityAmounts(
  currencyIdsToAmounts: Map<string, bigint>,
  deps: Pick<DealProjectionsWorkflowDeps, "currencies">,
): Promise<FinanceProfitabilityAmount[]> {
  if (currencyIdsToAmounts.size === 0) {
    return [];
  }

  const currencies = await Promise.all(
    Array.from(currencyIdsToAmounts.keys()).map(async (currencyId) => ({
      currency: await deps.currencies.findById(currencyId),
      currencyId,
    })),
  );

  const codeById = new Map(
    currencies.map(({ currency, currencyId }) => [
      currencyId,
      currency?.code ?? currencyId,
    ]),
  );

  return Array.from(currencyIdsToAmounts.entries())
    .sort(([leftId], [rightId]) => {
      const leftCode = codeById.get(leftId) ?? leftId;
      const rightCode = codeById.get(rightId) ?? rightId;
      return leftCode.localeCompare(rightCode);
    })
    .map(([currencyId, amountMinor]) => ({
      amountMinor: amountMinor.toString(),
      currencyCode: codeById.get(currencyId) ?? currencyId,
      currencyId,
    }));
}

async function buildProfitabilitySnapshot(
  calculation: Awaited<
    ReturnType<CalculationsModule["calculations"]["queries"]["findById"]>
  > | null,
  deps: Pick<DealProjectionsWorkflowDeps, "currencies">,
): Promise<FinanceProfitabilitySnapshot> {
  if (!calculation) {
    return null;
  }

  const feeRevenue = sumCalculationLineAmountsByCurrency(
    calculation.lines,
    "fee_revenue",
  );
  const providerFeeExpense = sumCalculationLineAmountsByCurrency(
    calculation.lines,
    "provider_fee_expense",
  );
  const spreadRevenue = sumCalculationLineAmountsByCurrency(
    calculation.lines,
    "spread_revenue",
  );
  const totalRevenue = mergeProfitabilityAmountsByCurrency(
    feeRevenue,
    spreadRevenue,
  );

  return {
    calculationId: calculation.id,
    feeRevenue: await resolveProfitabilityAmounts(feeRevenue, deps),
    providerFeeExpense: await resolveProfitabilityAmounts(
      providerFeeExpense,
      deps,
    ),
    spreadRevenue: await resolveProfitabilityAmounts(spreadRevenue, deps),
    totalRevenue: await resolveProfitabilityAmounts(totalRevenue, deps),
  };
}

function summarizeExecutionPlan(workflow: DealWorkflowProjection) {
  return {
    blockedLegCount: workflow.executionPlan.filter(
      (leg) => leg.state === "blocked",
    ).length,
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
        DOWNSTREAM_POSITION_KINDS.has(position.kind) &&
        position.state === "blocked",
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

function buildFinanceDealOperation(input: {
  latestInstruction: TreasuryInstruction | null;
  operation: TreasuryOperationRecord;
  queueBlocked: boolean;
}) {
  return {
    actions: getInstructionActions({
      isBlockedWithoutInstruction: input.queueBlocked,
      latestInstruction: input.latestInstruction,
    }),
    availableOutcomeTransitions: getAvailableOutcomeTransitions(
      input.latestInstruction,
    ),
    id: input.operation.id,
    instructionStatus: getInstructionStatus({
      isBlockedWithoutInstruction: input.queueBlocked,
      latestInstruction: input.latestInstruction,
    }),
    kind: input.operation.kind,
    latestInstruction: input.latestInstruction,
    operationHref: `/treasury/operations/${input.operation.id}`,
    sourceRef: input.operation.sourceRef,
    state: input.operation.state,
  };
}

function matchesTextFilter(
  value: string | null | undefined,
  filter: string | undefined,
) {
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

    const attachments =
      await deps.files.files.queries.listDealAttachments(dealId);
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
        .filter(
          (projection): projection is PortalDealProjection =>
            projection !== null,
        )
        .map(toPortalListItem),
      limit: deals.limit,
      offset: deals.offset,
      total: deals.total,
    };
  }

  async function listAllDeals(input?: {
    customerId?: string;
  }): Promise<DealListRecord[]> {
    const deals: DealListRecord[] = [];
    let offset = 0;
    let total = 0;

    do {
      const page = await deps.deals.deals.queries.list({
        customerId: input?.customerId,
        limit: MAX_QUERY_LIST_LIMIT,
        offset,
        sortBy: "createdAt",
        sortOrder: "desc",
      });

      deals.push(...page.data);
      total = page.total;
      offset += page.limit;
    } while (offset < total);

    return deals;
  }

  async function listCrmDeals(
    query: Partial<CrmDealsListQuery> = {},
  ): Promise<CrmDealsListProjection> {
    const normalizedQuery = CrmDealsListQuerySchema.parse(query);
    const requestedStatuses = parseOptionalSet(normalizedQuery.statuses);
    const requestedCurrencies = parseOptionalSet(normalizedQuery.currencies);
    const listedDeals = await listAllDeals({
      customerId: normalizedQuery.customerId,
    });

    const customerIds = [
      ...new Set(listedDeals.map((deal) => deal.customerId)),
    ];
    const agentIds = [
      ...new Set(
        listedDeals
          .map((deal) => deal.agentId)
          .filter((agentId): agentId is string => Boolean(agentId)),
      ),
    ];
    const [{ baseCurrenciesById, calculationsById, currenciesById }, customers, agentEntries] =
      await Promise.all([
        loadDealMoneyLookups(listedDeals, deps),
      deps.parties.customers.queries.listByIds(customerIds),
      Promise.all(
        agentIds.map(
          async (agentId): Promise<readonly [string, UserDetailsLike]> =>
            [agentId, await deps.iam.queries.findById(agentId)] as const,
        ),
      ),
    ]);

    const agentsById = toMap(agentEntries);
    const customersById = toMap(
      customers.map(
        (customer): readonly [string, CustomerListItemLike] =>
          [customer.id, customer] as const,
      ),
    );

    const enrichedDeals = listedDeals.map(
      (
        deal,
      ): CrmDealListItem & {
        agentId: string | null;
        amountInBaseMinor: bigint;
        amountMinor: bigint;
        createdAtDate: number;
      } => {
        const customer = customersById.get(deal.customerId) ?? null;
        const calculation = deal.calculationId
          ? (calculationsById.get(deal.calculationId) ?? null)
          : null;
        const sourceCurrency = deal.currencyId
          ? (currenciesById.get(deal.currencyId) ?? null)
          : null;
        const baseCurrency = calculation
          ? (baseCurrenciesById.get(
              calculation.currentSnapshot.baseCurrencyId,
            ) ?? null)
          : null;
        const agent = deal.agentId
          ? (agentsById.get(deal.agentId) ?? null)
          : null;
        const monetary = buildCrmDealMoneySummary({
          deal,
          calculation,
          sourceCurrency,
          baseCurrency,
        });
        const closedAt =
          deal.status === "done" || deal.status === "cancelled"
            ? deal.updatedAt.toISOString()
            : null;
        const comment =
          deal.comment ?? deal.intakeComment ?? deal.reason ?? undefined;

        return {
          agentId: deal.agentId,
          agentName: agent?.name ?? "",
          amount: monetary.amount,
          amountInBase: monetary.amountInBase,
          amountInBaseMinor: monetary.amountInBaseMinor,
          amountMinor: monetary.amountMinor,
          baseCurrencyCode: monetary.baseCurrencyCode,
          client: customer?.displayName ?? "—",
          clientId: deal.customerId,
          closedAt,
          comment,
          createdAt: deal.createdAt.toISOString(),
          createdAtDate: deal.createdAt.getTime(),
          currency: monetary.currencyCode,
          feePercentage: monetary.feePercentage,
          id: deal.id,
          status: deal.status,
          updatedAt: deal.updatedAt.toISOString(),
        };
      },
    );

    const filteredDeals = enrichedDeals.filter((deal) => {
      if (requestedStatuses && !requestedStatuses.has(deal.status)) {
        return false;
      }
      if (requestedCurrencies && !requestedCurrencies.has(deal.currency)) {
        return false;
      }
      if (normalizedQuery.agentId && deal.agentId !== normalizedQuery.agentId) {
        return false;
      }
      if (
        normalizedQuery.dateFrom &&
        deal.createdAtDate < normalizedQuery.dateFrom.getTime()
      ) {
        return false;
      }
      if (
        normalizedQuery.dateTo &&
        deal.createdAtDate > normalizedQuery.dateTo.getTime()
      ) {
        return false;
      }
      if (
        normalizedQuery.qClient &&
        !deal.client
          .toLowerCase()
          .includes(normalizedQuery.qClient.toLowerCase())
      ) {
        return false;
      }
      if (
        normalizedQuery.qComment &&
        !(deal.comment ?? "")
          .toLowerCase()
          .includes(normalizedQuery.qComment.toLowerCase())
      ) {
        return false;
      }

      return true;
    });

    filteredDeals.sort((left, right) => {
      let comparison = 0;

      switch (normalizedQuery.sortBy) {
        case "id":
          comparison = left.id.localeCompare(right.id);
          break;
        case "client":
          comparison = compareNullableStrings(left.client, right.client);
          break;
        case "amount":
          comparison = compareBigInt(left.amountMinor, right.amountMinor);
          break;
        case "amountInBase":
          comparison = compareBigInt(
            left.amountInBaseMinor,
            right.amountInBaseMinor,
          );
          break;
        case "closedAt":
          comparison = compareNullableDates(left.closedAt, right.closedAt);
          break;
        case "agentName":
          comparison = compareNullableStrings(left.agentName, right.agentName);
          break;
        case "createdAt":
        default:
          comparison = left.createdAtDate - right.createdAtDate;
          break;
      }

      return normalizedQuery.sortOrder === "asc" ? comparison : -comparison;
    });

    const pagedDeals = filteredDeals
      .slice(
        normalizedQuery.offset,
        normalizedQuery.offset + normalizedQuery.limit,
      )
      .map(
        ({
          agentId: _agentId,
          amountInBaseMinor: _amountInBaseMinor,
          amountMinor: _amountMinor,
          createdAtDate: _createdAtDate,
          ...deal
        }) => deal,
      );

    return {
      data: pagedDeals,
      limit: normalizedQuery.limit,
      offset: normalizedQuery.offset,
      total: filteredDeals.length,
    };
  }

  async function getCrmDealsStats(
    input: CrmDealsStatsQuery,
  ): Promise<CrmDealsStats> {
    const listedDeals = await listAllDeals();
    const currenciesById = toMap(
      await Promise.all(
        [
          ...new Set(
            listedDeals
              .map((deal) => deal.currencyId)
              .filter((currencyId): currencyId is string =>
                Boolean(currencyId),
              ),
          ),
        ].map(
          async (currencyId): Promise<readonly [string, CurrencyDetailsLike]> =>
            [currencyId, await deps.currencies.findById(currencyId)] as const,
        ),
      ),
    );
    const from = new Date(`${input.dateFrom}T00:00:00Z`);
    const to = new Date(`${input.dateTo}T23:59:59.999Z`);
    let totalCount = 0;
    let totalAmount = 0n;
    const byStatus: Record<string, number> = {};

    for (const deal of listedDeals) {
      if (deal.createdAt < from || deal.createdAt > to) {
        continue;
      }

      totalCount += 1;
      byStatus[deal.status] = (byStatus[deal.status] ?? 0) + 1;

      const currencyCode =
        (deal.currencyId
          ? currenciesById.get(deal.currencyId)?.code
          : undefined) ?? "RUB";
      totalAmount += BigInt(
        toMinorAmountString(deal.amount ?? "0", currencyCode),
      );
    }

    return {
      byStatus,
      totalAmount: totalAmount.toString(),
      totalCount,
    };
  }

  async function listCrmDealsByStatus(): Promise<CrmDealsByStatus> {
    const PENDING_STATUSES = ["awaiting_funds"] as const;
    const IN_PROGRESS_STATUSES = [
      "draft",
      "submitted",
      "preparing_documents",
      "awaiting_payment",
    ] as const;
    const DONE_STATUSES = ["closing_documents", "done"] as const;

    const listedDeals = await listAllDeals();
    const customerIds = [
      ...new Set(listedDeals.map((deal) => deal.customerId)),
    ];

    const [{ baseCurrenciesById, calculationsById, currenciesById }, customers] =
      await Promise.all([
        loadDealMoneyLookups(listedDeals, deps),
      deps.parties.customers.queries.listByIds(customerIds),
    ]);

    const customersById = toMap(
      customers.map(
        (customer): readonly [string, CustomerListItemLike] =>
          [customer.id, customer] as const,
      ),
    );

    function toDealItem(deal: DealListRecord): CrmDealByStatusItem {
      const comment =
        deal.comment ?? deal.intakeComment ?? deal.reason ?? undefined;
      const calculation = deal.calculationId
        ? (calculationsById.get(deal.calculationId) ?? null)
        : null;
      const sourceCurrency = deal.currencyId
        ? (currenciesById.get(deal.currencyId) ?? null)
        : null;
      const baseCurrency = calculation
        ? (baseCurrenciesById.get(calculation.currentSnapshot.baseCurrencyId) ?? null)
        : null;
      const monetary = buildCrmDealMoneySummary({
        deal,
        calculation,
        sourceCurrency,
        baseCurrency,
      });

      return {
        amount: monetary.amount,
        amountInBase: monetary.amountInBase,
        baseCurrencyCode: monetary.baseCurrencyCode,
        client: customersById.get(deal.customerId)?.displayName ?? "—",
        createdAt: deal.createdAt.toISOString(),
        currency: monetary.currencyCode,
        id: deal.id,
        status: deal.status,
        ...(comment ? { comment } : {}),
      };
    }

    return {
      done: listedDeals
        .filter((deal) =>
          (DONE_STATUSES as readonly string[]).includes(deal.status),
        )
        .map(toDealItem),
      inProgress: listedDeals
        .filter((deal) =>
          (IN_PROGRESS_STATUSES as readonly string[]).includes(deal.status),
        )
        .map(toDealItem),
      pending: listedDeals
        .filter((deal) =>
          (PENDING_STATUSES as readonly string[]).includes(deal.status),
        )
        .map(toDealItem),
    };
  }

  async function listCrmDealsByDay(
    query: CrmDealsByDayQuery = {},
  ): Promise<CrmDealsByDayItem[]> {
    const listedDeals = await listAllDeals({ customerId: query.customerId });
    const requestedStatuses = parseOptionalSet(query.statuses);
    const requestedCurrencies = parseOptionalSet(query.currencies);
    const currenciesById = toMap(
      await Promise.all(
        [
          ...new Set(
            listedDeals
              .map((deal) => deal.currencyId)
              .filter((currencyId): currencyId is string =>
                Boolean(currencyId),
              ),
          ),
        ].map(
          async (currencyId): Promise<readonly [string, CurrencyDetailsLike]> =>
            [currencyId, await deps.currencies.findById(currencyId)] as const,
        ),
      ),
    );
    const precisionByCode = new Map(
      Array.from(currenciesById.values())
        .filter((currency): currency is NonNullable<typeof currency> => Boolean(currency))
        .map((currency) => [currency.code, currency.precision] as const),
    );

    const dayMap = new Map<
      string,
      {
        closedCount: number;
        count: number;
        date: string;
        totalsByCurrency: Map<string, bigint>;
        closedTotalsByCurrency: Map<string, bigint>;
      }
    >();

    for (const deal of listedDeals) {
      if (query.dateFrom && deal.createdAt < new Date(query.dateFrom)) {
        continue;
      }
      if (query.dateTo && deal.createdAt > new Date(query.dateTo)) {
        continue;
      }
      if (query.agentId && deal.agentId !== query.agentId) {
        continue;
      }
      if (requestedStatuses && !requestedStatuses.has(deal.status)) {
        continue;
      }

      const currencyCode =
        (deal.currencyId
          ? currenciesById.get(deal.currencyId)?.code
          : undefined) ?? "RUB";

      if (requestedCurrencies && !requestedCurrencies.has(currencyCode)) {
        continue;
      }

      const date = deal.createdAt.toISOString().slice(0, 10);
      const totalMinor = toMinorOrZero(deal.amount, currencyCode);

      if (!dayMap.has(date)) {
        dayMap.set(date, {
          closedCount: 0,
          count: 0,
          date,
          closedTotalsByCurrency: new Map<string, bigint>(),
          totalsByCurrency: new Map<string, bigint>(),
        });
      }

      const day = dayMap.get(date)!;
      day.count += 1;
      day.totalsByCurrency.set(
        currencyCode,
        (day.totalsByCurrency.get(currencyCode) ?? 0n) + totalMinor,
      );

      if (deal.status === "done") {
        day.closedCount += 1;
        day.closedTotalsByCurrency.set(
          currencyCode,
          (day.closedTotalsByCurrency.get(currencyCode) ?? 0n) + totalMinor,
        );
      }
    }

    return Array.from(dayMap.values()).map((day) => {
      const totalsByCurrency = Array.from(day.totalsByCurrency.entries()).map(
        ([currencyCode, amountMinor]) => {
          return [
            currencyCode,
            parseMinorOrZero(amountMinor, precisionByCode.get(currencyCode) ?? 2),
          ] as const;
        },
      );
      const totalsObject = Object.fromEntries(totalsByCurrency);
      const reportCurrencyCode = query.reportCurrencyCode?.trim().toUpperCase();
      const amount = reportCurrencyCode
        ? ((totalsObject[reportCurrencyCode] as number | undefined) ?? 0)
        : totalsByCurrency.length === 1
          ? totalsByCurrency[0]?.[1] ?? 0
          : 0;
      const closedAmount = reportCurrencyCode
        ? parseMinorOrZero(
            day.closedTotalsByCurrency.get(reportCurrencyCode) ?? 0n,
            precisionByCode.get(reportCurrencyCode) ?? 2,
          )
        : day.closedTotalsByCurrency.size === 1
          ? parseMinorOrZero(
              Array.from(day.closedTotalsByCurrency.values())[0] ?? 0n,
              precisionByCode.get(
                Array.from(day.closedTotalsByCurrency.keys())[0] ?? "",
              ) ?? 2,
            )
          : 0;

      return {
        amount,
        closedAmount,
        closedCount: day.closedCount,
        count: day.count,
        date: day.date,
        ...totalsObject,
      };
    });
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

    const [
      agreement,
      applicant,
      calculationsHistory,
      customer,
      internalEntity,
    ] = await Promise.all([
      deps.agreements.agreements.queries.findById(workflow.summary.agreementId),
      applicantCounterpartyId
        ? deps.parties.counterparties.queries.findById(applicantCounterpartyId)
        : Promise.resolve(null),
      deps.deals.deals.queries.listCalculationHistory(dealId),
      customerId
        ? deps.parties.customers.queries.findById(customerId)
        : Promise.resolve(null),
      internalEntityOrganizationId
        ? deps.parties.organizations.queries.findById(
            internalEntityOrganizationId,
          )
        : Promise.resolve(null),
    ]);

    const [
      legalEntitiesResult,
      currentCalculation,
      internalEntityRequisite,
      quotesResult,
    ] = await Promise.all([
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
        ? deps.parties.requisites.queries.findById(
            agreement.organizationRequisiteId,
          )
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
      comment: detail.comment,
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
        applicantDisplayName:
          getApplicantParticipant(workflow)?.displayName ?? null,
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

  async function getFinanceDealWorkspaceProjection(
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
      quotesResult,
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
      deps.treasury.quotes.queries.listQuotes({
        dealId,
        limit: MAX_QUERY_LIST_LIMIT,
        offset: 0,
        sortBy: "createdAt",
        sortOrder: "desc",
      }),
    ]);

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
    const latestInstructions =
      await deps.treasury.instructions.queries.listLatestByOperationIds(
        operationsResult.data.map((operation) => operation.id),
      );
    const latestInstructionByOperationId = new Map(
      latestInstructions.map((instruction) => [
        instruction.operationId,
        instruction,
      ] as const),
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
      reconciliationExceptions,
      reconciliationSummary,
    } = deriveFinanceDealReadiness({
      latestInstructionByOperationId,
      reconciliationLinksByOperationId,
      workflow,
    });
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

    return {
      acceptedQuote: workflow.acceptedQuote,
      acceptedQuoteDetails,
      actions: {
        canCloseDeal: closeReadiness.ready,
        canCreateCalculation: actions.canCreateCalculation,
        canCreateQuote: actions.canCreateQuote,
        canRequestExecution:
          !hasAnyMaterializedOperations && isExecutionRequestAllowed(workflow),
        canResolveExecutionBlocker:
          workflow.executionPlan.some((leg) => leg.state === "blocked") ||
          workflow.operationalState.capabilities.some(
            (capability) => capability.status !== "enabled",
          ),
        canUploadAttachment: actions.canUploadAttachment,
      },
      attachmentRequirements,
      closeReadiness,
      executionPlan: workflow.executionPlan.map((leg) => ({
        ...leg,
        actions: {
          canCreateLegOperation:
            hasAnyMaterializedOperations &&
            leg.operationRefs.length === 0 &&
            leg.state !== "blocked" &&
            leg.state !== "skipped" &&
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
      })),
      formalDocumentRequirements,
      instructionSummary,
      nextAction: workflow.nextAction,
      operationalState: workflow.operationalState,
      pricing: {
        ...buildFinanceQuoteRequestContext(workflow),
        quoteEligibility: isQuoteEligible(workflow),
      },
      profitabilitySnapshot: await buildProfitabilitySnapshot(
        currentCalculation,
        deps,
      ),
      queueContext,
      reconciliationSummary,
      relatedResources: {
        attachments,
        formalDocuments: workflow.relatedResources.formalDocuments,
        operations: operationsResult.data.map((operation) =>
          buildFinanceDealOperation({
            latestInstruction:
              latestInstructionByOperationId.get(operation.id) ?? null,
            operation,
            queueBlocked,
          }),
        ),
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
      listedDeals.data.map(
        async (deal): Promise<FinanceDealQueueItem | null> => {
          const workflow = await deps.deals.deals.queries.findWorkflowById(
            deal.id,
          );

          if (!workflow) {
            return null;
          }

          const customerId = getCustomerParticipant(workflow)?.customerId ?? null;
          const internalEntityName =
            getInternalEntityParticipant(workflow)?.displayName ?? null;

          const customer = customerId
            ? await deps.parties.customers.queries.findById(customerId)
            : null;
          const applicantName =
            customer?.displayName ??
            getApplicantParticipant(workflow)?.displayName ??
            null;

          if (
            !matchesTextFilter(applicantName, filters.applicant) ||
            !matchesTextFilter(internalEntityName, filters.internalEntity)
          ) {
            return null;
          }

          const [agreement, operationsResult] = await Promise.all([
            deps.agreements.agreements.queries.findById(workflow.summary.agreementId),
            deps.treasury.operations.queries.list({
              dealId: deal.id,
              limit: MAX_QUERY_LIST_LIMIT,
              offset: 0,
              sortBy: "createdAt",
              sortOrder: "desc",
            }),
          ]);
          const queueContext = classifyFinanceQueue(workflow);
          const latestInstructions =
            await deps.treasury.instructions.queries.listLatestByOperationIds(
              operationsResult.data.map((operation) => operation.id),
            );
          const latestInstructionByOperationId = new Map(
            latestInstructions.map((instruction) => [
              instruction.operationId,
              instruction,
            ] as const),
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
          const { closeReadiness, reconciliationSummary } =
            deriveFinanceDealReadiness({
              latestInstructionByOperationId,
              reconciliationLinksByOperationId,
              workflow,
            });
          const { stage, stageReason } = deriveFinanceDealStage({
            agreementOrganizationId: agreement?.organizationId ?? null,
            closeReadiness,
            internalEntityOrganizationId:
              getInternalEntityParticipant(workflow)?.organizationId ?? null,
            latestInstructionByOperationId,
            reconciliationSummary,
            workflow,
          });

          const [attachments, currentCalculation] = await Promise.all([
            deps.files.files.queries.listDealAttachments(deal.id),
            workflow.summary.calculationId
              ? deps.calculations.calculations.queries.findById(
                  workflow.summary.calculationId,
                )
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

  return {
    getCrmDealsStats,
    getPortalDealProjection,
    listCrmDeals,
    listCrmDealBoard,
    listCrmDealsByDay,
    listCrmDealsByStatus,
    getCrmDealWorkbenchProjection,
    getFinanceDealWorkspaceProjection,
    listFinanceDealQueues,
    listPortalDeals,
  };
}

export type DealProjectionsWorkflow = ReturnType<
  typeof createDealProjectionsWorkflow
>;
