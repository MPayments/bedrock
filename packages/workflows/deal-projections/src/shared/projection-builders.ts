import { canDealWriteTreasuryOrFormalDocuments } from "@bedrock/deals";
import {
  CLOSING_DOCUMENT_TYPE_BY_DEAL_TYPE,
  OPENING_DOCUMENT_TYPE_BY_DEAL_TYPE,
} from "@bedrock/deals/contracts";
import type { DealWorkflowProjection } from "@bedrock/deals/contracts";
import { minorToAmountString } from "@bedrock/shared/money";
import type { QuoteListItem } from "@bedrock/treasury/contracts";

import type { DealAttachmentRecord, TreasuryQuoteRecord } from "./deps";
import {
  findRelatedFormalDocument,
  hasAttachmentPurpose,
  hasCustomerSafeAttachment,
  isFormalDocumentReady,
  requiresExternalEvidence,
} from "./documents";
import { getDateTimeValue, toDateOrNull } from "./utils";
import { isDealInTerminalStatus, isQuoteEligible } from "./workflow-helpers";

const EXTERNAL_EVIDENCE_REQUIRED_MESSAGE =
  "Загрузите подтверждающие документы по сделке";
const PAYMENT_INVOICE_REQUIRED_MESSAGE = "Инвойс по сделке не загружен";

export function buildPortalQuoteSummary(workflow: DealWorkflowProjection) {
  if (workflow.acceptedQuote) {
    return {
      expiresAt: workflow.acceptedQuote.expiresAt,
      quoteId: workflow.acceptedQuote.quoteId,
      status: workflow.acceptedQuote.quoteStatus,
    };
  }

  const activeOrLatestQuote = [...workflow.relatedResources.quotes].sort(
    (left, right) => {
      const leftTime = getDateTimeValue(left.expiresAt);
      const rightTime = getDateTimeValue(right.expiresAt);
      return rightTime - leftTime;
    },
  )[0];

  if (!activeOrLatestQuote) {
    return null;
  }

  return {
    expiresAt: toDateOrNull(activeOrLatestQuote.expiresAt),
    quoteId: activeOrLatestQuote.id,
    status: activeOrLatestQuote.status,
  };
}

export function serializeCrmPricingQuote(
  quote: TreasuryQuoteRecord,
): QuoteListItem {
  const fromCurrency = quote.fromCurrency ?? "—";
  const toCurrency = quote.toCurrency ?? "—";

  return {
    createdAt: quote.createdAt.toISOString(),
    commercialTerms: quote.commercialTerms
      ? {
          agreementVersionId: quote.commercialTerms.agreementVersionId,
          agreementFeeBps: quote.commercialTerms.agreementFeeBps.toString(),
          quoteMarkupBps: quote.commercialTerms.quoteMarkupBps.toString(),
          totalFeeBps: quote.commercialTerms.totalFeeBps.toString(),
          fixedFeeAmountMinor:
            quote.commercialTerms.fixedFeeAmountMinor?.toString() ?? null,
          fixedFeeCurrency: quote.commercialTerms.fixedFeeCurrency ?? null,
        }
      : null,
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
    pricingFingerprint: quote.pricingFingerprint,
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

export function buildCrmWorkbenchActions(workflow: DealWorkflowProjection) {
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

export function buildCrmEvidenceRequirements(input: {
  attachments: DealAttachmentRecord[];
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
        state: hasContract
          ? ("provided" as const)
          : ("not_required" as const),
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

export function buildCrmDocumentRequirements(workflow: DealWorkflowProjection) {
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
