import { canDealCreateFormalDocuments } from "@bedrock/deals";
import {
  CLOSING_DOCUMENT_TYPE_BY_DEAL_TYPE,
  OPENING_DOCUMENT_TYPE_BY_DEAL_TYPE,
} from "@bedrock/deals/contracts";
import type { DealWorkflowProjection } from "@bedrock/deals/contracts";
import { minorToAmountString } from "@bedrock/shared/money";
import type { PaymentStep, QuoteListItem } from "@bedrock/treasury/contracts";

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

export { buildDealInvoiceBillingSplit } from "../documents/invoice-billing";

const EXTERNAL_EVIDENCE_REQUIRED_MESSAGE =
  "Загрузите подтверждающие документы по сделке";
const PAYMENT_INVOICE_REQUIRED_MESSAGE = "Инвойс по сделке не загружен";
const FINAL_PAYOUT_EVIDENCE_PURPOSES = new Set([
  "swift_mt103",
  "settlement_confirmation",
  "bank_confirmation",
]);

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
    const invoiceDocument = findRelatedFormalDocument({
      docType: "invoice",
      documents: input.workflow.relatedResources.formalDocuments,
    });
    const hasReadyInvoiceDocument = invoiceDocument
      ? isFormalDocumentReady({
          approvalStatus: invoiceDocument.approvalStatus,
          lifecycleStatus: invoiceDocument.lifecycleStatus,
          postingStatus: invoiceDocument.postingStatus,
          submissionStatus: invoiceDocument.submissionStatus,
        })
      : false;
    const hasInvoice =
      hasAttachmentPurpose(input.attachments, "invoice") ||
      hasReadyInvoiceDocument;
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

type FeeBillingMode =
  | "included_in_principal_invoice"
  | "separate_fee_invoice";
type InvoicePurpose = "combined" | "principal" | "agency_fee";

function resolveOpeningInvoicePurposes(mode: FeeBillingMode | null | undefined) {
  return mode === "separate_fee_invoice"
    ? (["principal", "agency_fee"] as InvoicePurpose[])
    : (["combined"] as InvoicePurpose[]);
}

function isPaymentFinalPayoutStep(input: {
  step: PaymentStep;
  workflow: DealWorkflowProjection;
}) {
  if (input.step.kind !== "payout" || input.step.state !== "completed") {
    return false;
  }

  const payoutLegs = input.workflow.executionPlan
    .filter((leg) => leg.kind === "payout")
    .sort((left, right) => right.idx - left.idx);
  const finalPayoutLeg = payoutLegs[0] ?? null;

  if (!finalPayoutLeg) {
    return false;
  }

  return (
    (finalPayoutLeg.id !== null &&
      input.step.origin.planLegId === finalPayoutLeg.id) ||
    input.step.origin.sequence === finalPayoutLeg.idx
  );
}

function hasFinalPayoutEvidence(input: {
  paymentSteps?: PaymentStep[];
  workflow: DealWorkflowProjection;
}) {
  return Boolean(
    input.paymentSteps?.some(
      (step) =>
        isPaymentFinalPayoutStep({ step, workflow: input.workflow }) &&
        step.artifacts.some((artifact) =>
          FINAL_PAYOUT_EVIDENCE_PURPOSES.has(artifact.purpose),
        ),
    ),
  );
}

export function buildCrmDocumentRequirements(
  workflow: DealWorkflowProjection,
  options: {
    feeBillingMode?: FeeBillingMode | null;
    paymentSteps?: PaymentStep[];
  } = {},
) {
  const requirements: {
    activeDocumentId: string | null;
    blockingReasons: string[];
    createAllowed: boolean;
    docType: string;
    invoicePurpose: InvoicePurpose | null;
    openAllowed: boolean;
    stage: "opening" | "closing";
    state: "in_progress" | "missing" | "not_required" | "ready";
  }[] = [];

  const openingDocType =
    OPENING_DOCUMENT_TYPE_BY_DEAL_TYPE[workflow.summary.type];
  const closingDocType =
    CLOSING_DOCUMENT_TYPE_BY_DEAL_TYPE[workflow.summary.type];
  const createAllowed = canDealCreateFormalDocuments({
    status: workflow.summary.status,
    type: workflow.summary.type,
  });
  const finalPayoutEvidenceReady =
    workflow.summary.type === "payment"
      ? hasFinalPayoutEvidence({
          paymentSteps: options.paymentSteps,
          workflow,
        })
      : true;
  const hasCurrentAcceptedQuote =
    Boolean(workflow.acceptedQuote) && !workflow.acceptedQuote?.revokedAt;

  const entries: {
    docType: string | null;
    invoicePurpose: InvoicePurpose | null;
    stage: "opening" | "closing";
  }[] =
    workflow.summary.type === "payment"
      ? [
          { docType: "application", invoicePurpose: null, stage: "opening" },
          ...resolveOpeningInvoicePurposes(options.feeBillingMode).map(
            (invoicePurpose) => ({
              docType: "invoice",
              invoicePurpose,
              stage: "opening" as const,
            }),
          ),
          {
            docType: closingDocType,
            invoicePurpose: null,
            stage: "closing",
          },
        ]
      : [
          ...(openingDocType === "invoice"
            ? resolveOpeningInvoicePurposes(options.feeBillingMode).map(
                (invoicePurpose) => ({
                  docType: openingDocType,
                  invoicePurpose,
                  stage: "opening" as const,
                }),
              )
            : [
                {
                  docType: openingDocType,
                  invoicePurpose: null,
                  stage: "opening" as const,
                },
              ]),
          {
            docType: closingDocType,
            invoicePurpose: null,
            stage: "closing" as const,
          },
        ];
  const readyByKey = new Map<string, boolean>();

  for (const { docType, invoicePurpose, stage } of entries) {
    if (!docType) {
      continue;
    }

    const document = findRelatedFormalDocument({
      docType,
      invoicePurpose: docType === "invoice" ? invoicePurpose : undefined,
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
    readyByKey.set(`${docType}:${invoicePurpose ?? "default"}`, ready);

    const applicationReady = readyByKey.get("application:default") === true;
    const principalInvoiceReady =
      readyByKey.get("invoice:combined") === true ||
      readyByKey.get("invoice:principal") === true;
    const paymentCreateAllowed =
      workflow.summary.type !== "payment"
        ? createAllowed
        : docType === "application"
          ? createAllowed &&
            hasCurrentAcceptedQuote &&
            Boolean(workflow.summary.calculationId)
          : docType === "invoice"
            ? createAllowed && applicationReady
            : docType === "acceptance"
              ? createAllowed &&
                workflow.summary.status === "closing_documents" &&
                applicationReady &&
                principalInvoiceReady &&
                finalPayoutEvidenceReady
              : createAllowed;

    requirements.push({
      activeDocumentId: document?.id ?? null,
      blockingReasons: document
        ? ready
          ? []
          : ["Формальный документ еще не готов к использованию"]
        : ["Формальный документ еще не создан"],
      createAllowed: !document && paymentCreateAllowed,
      docType,
      invoicePurpose: docType === "invoice" ? invoicePurpose : null,
      openAllowed: Boolean(document?.id),
      stage,
      state: !document ? "missing" : ready ? "ready" : "in_progress",
    });
  }

  return requirements;
}
