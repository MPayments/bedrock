import { createHash } from "node:crypto";

import type {
  DocumentPostingPlanRequest,
} from "@bedrock/accounting/contracts";
import {
  OPERATION_CODE,
  POSTING_TEMPLATE_KEY,
} from "@bedrock/accounting/posting-contracts";
import {
  normalizeFinancialLine,
  type FinancialLine,
} from "@bedrock/plugin-documents-commercial/contracts";
import {
  type Document,
  type DocumentModuleContext,
  DocumentValidationError,
} from "@bedrock/plugin-documents-sdk";
import {
  buildDocumentPostingPlan,
  buildDocumentPostingRequest,
  parseDocumentPayload,
} from "@bedrock/plugin-documents-sdk/module-kit";
import { canonicalJson } from "@bedrock/shared/core/canon";

import type { CommercialDocumentRuntime, CommercialModuleDeps } from "./types";
import {
  ApplicationPayloadSchema,
  InvoicePayloadSchema,
  QuoteSnapshotSchema,
  type ApplicationPayload,
  type ExchangePayload,
  type InvoiceCurrentPayload,
  type InvoicePayload,
  type InvoicePurpose,
  type QuoteSnapshot,
} from "../../validation";

const CUSTOMER_FEE_INVOICE_TITLE = "Счет на агентское вознаграждение";

export function buildQuoteSnapshotHash(snapshot: Omit<QuoteSnapshot, "snapshotHash">) {
  return createHash("sha256").update(canonicalJson(snapshot)).digest("hex");
}

export async function loadQuoteSnapshot(input: {
  runtime: CommercialDocumentRuntime;
  deps: Pick<CommercialModuleDeps, "quoteSnapshot">;
  quoteRef: string;
}): Promise<QuoteSnapshot> {
  return QuoteSnapshotSchema.parse(
    await input.deps.quoteSnapshot.loadQuoteSnapshot({
      runtime: input.runtime,
      quoteRef: input.quoteRef,
    }),
  );
}

export async function resolveInvoiceDealFxContext(
  deps: Pick<CommercialModuleDeps, "dealFx" | "documentBusinessLinks">,
  invoiceDocumentId: string,
) {
  const dealId =
    await deps.documentBusinessLinks.findDealIdByDocumentId(invoiceDocumentId);

  if (!dealId) {
    return null;
  }

  return deps.dealFx.resolveDealFxContext(dealId);
}

export function getInvoiceAmountMinor(payload: InvoicePayload) {
  return payload.amountMinor;
}

export function getInvoiceCurrency(payload: InvoicePayload) {
  return payload.currency;
}

export function getInvoicePurpose(payload: InvoicePayload): InvoicePurpose {
  return payload.invoicePurpose ?? "combined";
}

export function getInvoiceTitleByPurpose(payload: InvoicePayload) {
  return getInvoicePurpose(payload) === "agency_fee"
    ? CUSTOMER_FEE_INVOICE_TITLE
    : "Счёт на оплату";
}

function buildQuoteBillingSetRef(input: {
  dealId: string;
  quoteId: string;
}) {
  return `billing_set:${input.dealId}:${input.quoteId}`;
}

export async function resolveOrganizationBinding(
  deps: CommercialModuleDeps,
  organizationRequisiteId: string,
) {
  const binding = await deps.requisiteBindings.resolveBinding(
    organizationRequisiteId,
  );

  if (!binding) {
    throw new DocumentValidationError(
      "Organization requisite binding is missing",
    );
  }

  return binding;
}

export async function loadInvoice(
  deps: Pick<CommercialModuleDeps, "documentRelations">,
  runtime: CommercialDocumentRuntime,
  invoiceDocumentId: string,
  forUpdate = false,
): Promise<Document> {
  const invoice = await deps.documentRelations.loadInvoice({
    runtime,
    invoiceDocumentId,
    forUpdate,
  });

  if (!invoice) {
    throw new DocumentValidationError("invoice document is missing");
  }

  return invoice;
}

export async function loadApplication(
  deps: Pick<CommercialModuleDeps, "documentRelations">,
  runtime: CommercialDocumentRuntime,
  applicationDocumentId: string,
  forUpdate = false,
): Promise<Document> {
  const application = await deps.documentRelations.loadApplication({
    runtime,
    applicationDocumentId,
    forUpdate,
  });

  if (!application) {
    throw new DocumentValidationError("application document is missing");
  }

  return application;
}

export async function getApplicationAcceptanceChild(
  deps: Pick<CommercialModuleDeps, "documentRelations">,
  runtime: CommercialDocumentRuntime,
  applicationDocumentId: string,
): Promise<Document | null> {
  return deps.documentRelations.getApplicationAcceptanceChild({
    runtime,
    applicationDocumentId,
  });
}

export async function getInvoiceExchangeChild(
  deps: Pick<CommercialModuleDeps, "documentRelations">,
  runtime: CommercialDocumentRuntime,
  invoiceDocumentId: string,
): Promise<Document | null> {
  return deps.documentRelations.getInvoiceExchangeChild({
    runtime,
    invoiceDocumentId,
  });
}

export async function getInvoiceAcceptanceChild(
  deps: Pick<CommercialModuleDeps, "documentRelations">,
  runtime: CommercialDocumentRuntime,
  invoiceDocumentId: string,
): Promise<Document | null> {
  return deps.documentRelations.getInvoiceAcceptanceChild({
    runtime,
    invoiceDocumentId,
  });
}

export async function getExchangeAcceptance(
  deps: Pick<CommercialModuleDeps, "documentRelations">,
  runtime: CommercialDocumentRuntime,
  exchangeDocumentId: string,
): Promise<Document | null> {
  return deps.documentRelations.getExchangeAcceptance({
    runtime,
    exchangeDocumentId,
  });
}

export function requirePostedDocument(
  document: Pick<Document, "docType" | "postingStatus" | "lifecycleStatus">,
) {
  if (
    document.lifecycleStatus !== "active" ||
    document.postingStatus !== "posted"
  ) {
    throw new DocumentValidationError(
      `${document.docType} must be active and posted`,
    );
  }
}

export function requireReadyDocument(
  document: Pick<
    Document,
    "approvalStatus" | "docType" | "lifecycleStatus" | "postingStatus" | "submissionStatus"
  >,
) {
  if (
    document.lifecycleStatus !== "active" ||
    document.submissionStatus !== "submitted" ||
    !["approved", "not_required"].includes(document.approvalStatus) ||
    !["posted", "not_required"].includes(document.postingStatus)
  ) {
    throw new DocumentValidationError(
      `${document.docType} must be active and ready`,
    );
  }
}

export async function markQuoteUsedForInvoice(input: {
  runtime: CommercialDocumentRuntime;
  deps: Pick<CommercialModuleDeps, "quoteUsage">;
  quoteId: string;
  invoiceDocumentId: string;
  dealId?: string;
  billingSetRef?: string;
  at: Date;
}): Promise<void> {
  const splitBillingRef =
    input.billingSetRef ??
    (input.dealId
      ? buildQuoteBillingSetRef({
          dealId: input.dealId,
          quoteId: input.quoteId,
        })
      : null);

  await input.deps.quoteUsage.markQuoteUsedForInvoice({
    runtime: input.runtime,
    quoteId: input.quoteId,
    usedByRef: splitBillingRef ?? `invoice:${input.invoiceDocumentId}`,
    usedDocumentId: splitBillingRef ? null : input.invoiceDocumentId,
    at: input.at,
  });
}

type FinancialLinePostingPhase = "direct" | "reserve" | "finalize";

function isProviderExpenseBucket(bucket: FinancialLine["bucket"]) {
  return bucket === "provider_fee_expense" || bucket === "execution_expense";
}

function isFeeRevenueBucket(bucket: FinancialLine["bucket"]) {
  return bucket === "fee_revenue";
}

function isFeeRevenueLine(line: FinancialLine) {
  return isFeeRevenueBucket(line.bucket);
}

export function filterFinancialLinesForInvoicePurpose(input: {
  lines: FinancialLine[];
  purpose: InvoicePurpose;
}) {
  if (input.purpose === "agency_fee") {
    return input.lines.filter(isFeeRevenueLine);
  }

  if (input.purpose === "principal") {
    return input.lines.filter((line) => !isFeeRevenueLine(line));
  }

  return input.lines;
}

export function calculateDealLinkedInvoiceExpectedAmount(input: {
  dealFxContext: NonNullable<Awaited<ReturnType<typeof resolveInvoiceDealFxContext>>>;
  purpose: InvoicePurpose;
}) {
  const { calculationCurrency, totalAmountMinor } = input.dealFxContext;

  if (!calculationCurrency) {
    throw new DocumentValidationError(
      "linked FX deal does not have a resolved calculation currency",
    );
  }

  if (!totalAmountMinor) {
    throw new DocumentValidationError(
      "linked FX deal does not have a resolved invoice total amount",
    );
  }

  if (input.purpose === "combined") {
    return {
      amountMinor: BigInt(totalAmountMinor),
      currency: calculationCurrency,
    };
  }

  const feeRevenueLines = input.dealFxContext.financialLines.filter(
    isFeeRevenueLine,
  );
  const feeCurrencies = new Set(feeRevenueLines.map((line) => line.currency));

  if (feeCurrencies.size > 1 || (feeCurrencies.size === 1 && !feeCurrencies.has(calculationCurrency))) {
    throw new DocumentValidationError(
      "Split fee invoice requires all fee revenue lines to use the principal invoice currency",
    );
  }

  const feeRevenueMinor = feeRevenueLines.reduce(
    (total, line) => total + line.amountMinor,
    0n,
  );

  if (feeRevenueMinor <= 0n) {
    throw new DocumentValidationError(
      "Split fee invoice requires positive fee revenue lines",
    );
  }

  return {
    amountMinor:
      input.purpose === "agency_fee"
        ? feeRevenueMinor
        : BigInt(totalAmountMinor) - feeRevenueMinor,
    currency: calculationCurrency,
  };
}

function templateForLine(
  line: FinancialLine,
  postingPhase: FinancialLinePostingPhase,
): {
  templateKey: string;
  amountMinor: bigint;
} | null {
  if (isProviderExpenseBucket(line.bucket)) {
    return {
      templateKey:
        line.amountMinor > 0n
          ? POSTING_TEMPLATE_KEY.PAYMENT_FX_PROVIDER_FEE_EXPENSE
          : POSTING_TEMPLATE_KEY.PAYMENT_FX_PROVIDER_FEE_EXPENSE_REVERSAL,
      amountMinor: line.amountMinor > 0n ? line.amountMinor : -line.amountMinor,
    };
  }

  if (postingPhase === "reserve") {
    if (line.bucket === "commercial_discount") {
      return {
        templateKey:
          line.amountMinor > 0n
            ? POSTING_TEMPLATE_KEY.PAYMENT_FX_FEE_RESERVE_REVERSAL
            : POSTING_TEMPLATE_KEY.PAYMENT_FX_FEE_RESERVE,
        amountMinor: line.amountMinor > 0n ? line.amountMinor : -line.amountMinor,
      };
    }

    return {
      templateKey:
        line.amountMinor > 0n
          ? POSTING_TEMPLATE_KEY.PAYMENT_FX_FEE_RESERVE
          : POSTING_TEMPLATE_KEY.PAYMENT_FX_FEE_RESERVE_REVERSAL,
      amountMinor: line.amountMinor > 0n ? line.amountMinor : -line.amountMinor,
    };
  }

  if (line.bucket === "pass_through") {
    if (postingPhase === "finalize") {
      return null;
    }

    return {
      templateKey:
        line.amountMinor > 0n
          ? POSTING_TEMPLATE_KEY.PAYMENT_FX_FEE_RESERVE
          : POSTING_TEMPLATE_KEY.PAYMENT_FX_FEE_RESERVE_REVERSAL,
      amountMinor: line.amountMinor > 0n ? line.amountMinor : -line.amountMinor,
    };
  }

  if (postingPhase === "finalize") {
    if (line.bucket === "commercial_discount") {
      return {
        templateKey:
          line.amountMinor > 0n
            ? POSTING_TEMPLATE_KEY.PAYMENT_FX_ADJUSTMENT_REFUND_RESERVE
            : POSTING_TEMPLATE_KEY.PAYMENT_FX_FEE_INCOME_FROM_RESERVE,
        amountMinor: line.amountMinor > 0n ? line.amountMinor : -line.amountMinor,
      };
    }

    if (line.amountMinor > 0n) {
      return {
        templateKey:
          line.bucket === "spread_revenue"
            ? POSTING_TEMPLATE_KEY.PAYMENT_FX_SPREAD_INCOME_FROM_RESERVE
            : line.bucket === "adjustment"
              ? POSTING_TEMPLATE_KEY.PAYMENT_FX_ADJUSTMENT_CHARGE_FROM_RESERVE
              : POSTING_TEMPLATE_KEY.PAYMENT_FX_FEE_INCOME_FROM_RESERVE,
        amountMinor: line.amountMinor,
      };
    }

    return {
      templateKey: POSTING_TEMPLATE_KEY.PAYMENT_FX_ADJUSTMENT_REFUND_RESERVE,
      amountMinor: -line.amountMinor,
    };
  }

  if (line.bucket === "adjustment") {
    return {
      templateKey:
        line.amountMinor > 0n
          ? POSTING_TEMPLATE_KEY.PAYMENT_FX_ADJUSTMENT_CHARGE
          : POSTING_TEMPLATE_KEY.PAYMENT_FX_ADJUSTMENT_REFUND,
      amountMinor: line.amountMinor > 0n ? line.amountMinor : -line.amountMinor,
    };
  }

  if (line.bucket === "commercial_discount") {
    return {
      templateKey:
        line.amountMinor > 0n
          ? POSTING_TEMPLATE_KEY.PAYMENT_FX_ADJUSTMENT_REFUND
          : POSTING_TEMPLATE_KEY.PAYMENT_FX_FEE_INCOME,
      amountMinor: line.amountMinor > 0n ? line.amountMinor : -line.amountMinor,
    };
  }

  if (line.amountMinor > 0n) {
    return {
      templateKey:
        line.bucket === "spread_revenue"
          ? POSTING_TEMPLATE_KEY.PAYMENT_FX_SPREAD_INCOME
          : POSTING_TEMPLATE_KEY.PAYMENT_FX_FEE_INCOME,
      amountMinor: line.amountMinor,
    };
  }

  return {
    templateKey: POSTING_TEMPLATE_KEY.PAYMENT_FX_ADJUSTMENT_REFUND,
    amountMinor: -line.amountMinor,
  };
}

export function buildFinancialLineRequests(input: {
  document: Pick<Document, "id" | "occurredAt">;
  bookId: string;
  customerId: string;
  orderId: string;
  counterpartyId: string;
  quoteRef: string;
  chainId: string;
  lines: FinancialLine[];
  includeCustomerLines: boolean;
  includeProviderLines: boolean;
  postingPhase: FinancialLinePostingPhase;
}): DocumentPostingPlanRequest[] {
  const requests: DocumentPostingPlanRequest[] = [];

  input.lines.forEach((rawLine, index) => {
    const line = normalizeFinancialLine(rawLine);
    const providerExpense = isProviderExpenseBucket(line.bucket);
    if (providerExpense && !input.includeProviderLines) {
      return;
    }
    if (!providerExpense && !input.includeCustomerLines) {
      return;
    }

    const postingTemplate = templateForLine(line, input.postingPhase);
    if (!postingTemplate) {
      return;
    }

    const { templateKey, amountMinor } = postingTemplate;
    requests.push(
      buildDocumentPostingRequest(input.document, {
        templateKey: templateKey as any,
        bookId: input.bookId,
        currency: line.currency,
        amountMinor,
        dimensions: {
          customerId: input.customerId,
          orderId: input.orderId,
          feeBucket: line.bucket,
          ...(providerExpense
            ? {
                counterpartyId: input.counterpartyId,
              }
            : {}),
        },
        refs: {
          quoteRef: input.quoteRef,
          chainId: input.chainId,
          componentId: line.id,
          componentIndex: String(index + 1),
        },
        memo: line.memo ?? null,
      }),
    );
  });

  return requests;
}

export function buildDirectInvoicePostingPlan(input: {
  document: Document;
  payload: InvoiceCurrentPayload;
  bookId: string;
}) {
  const chainId = `invoice:${input.document.id}`;
  const quoteRef = `invoice:${input.document.id}`;

  return buildDocumentPostingPlan({
    operationCode: OPERATION_CODE.COMMERCIAL_INVOICE_DIRECT,
    payload: {
      ...input.payload,
      memo: input.payload.memo ?? null,
    },
    requests: [
      buildDocumentPostingRequest(input.document, {
        templateKey: POSTING_TEMPLATE_KEY.PAYMENT_FX_PRINCIPAL,
        bookId: input.bookId,
        currency: input.payload.currency,
        amountMinor: BigInt(input.payload.amountMinor),
        dimensions: {
          customerId: input.payload.customerId,
          orderId: input.document.id,
        },
        refs: {
          quoteRef,
          chainId,
        },
        memo: input.payload.memo ?? null,
      }),
      buildDocumentPostingRequest(input.document, {
        templateKey: POSTING_TEMPLATE_KEY.PAYMENT_FX_PAYOUT_OBLIGATION,
        bookId: input.bookId,
        currency: input.payload.currency,
        amountMinor: BigInt(input.payload.amountMinor),
        dimensions: {
          orderId: input.document.id,
        },
        refs: {
          quoteRef,
          chainId,
          payoutCounterpartyId: input.payload.counterpartyId,
        },
        memo: input.payload.memo ?? null,
      }),
    ],
  });
}

export async function buildDealLinkedInvoicePostingPlan(input: {
  deps: Pick<CommercialModuleDeps, "quoteUsage">;
  dealFxContext: NonNullable<
    Awaited<
      ReturnType<
        typeof resolveInvoiceDealFxContext
      >
    >
  >;
  context: DocumentModuleContext;
  document: Document;
  payload: InvoicePayload;
  bookId: string;
}) {
  if (
    !input.dealFxContext.quoteSnapshot ||
    !input.dealFxContext.originalAmountMinor ||
    !input.dealFxContext.calculationCurrency
  ) {
    throw new DocumentValidationError(
      "linked deal does not have an accepted FX calculation for invoice posting",
    );
  }

  const quoteSnapshot = input.dealFxContext.quoteSnapshot;
  const purpose = getInvoicePurpose(input.payload);
  const chainId =
    purpose === "combined"
      ? `invoice:${input.document.id}`
      : input.payload.billingSetRef ??
        buildQuoteBillingSetRef({
          dealId: input.dealFxContext.dealId,
          quoteId: quoteSnapshot.quoteId,
        });
  const financialLines = filterFinancialLinesForInvoicePurpose({
    lines: input.dealFxContext.financialLines.map((line) =>
      normalizeFinancialLine(line),
    ),
    purpose,
  });
  await markQuoteUsedForInvoice({
    runtime: input.context.runtime,
    deps: input.deps,
    quoteId: quoteSnapshot.quoteId,
    invoiceDocumentId: input.document.id,
    ...(purpose === "combined"
      ? {}
      : {
          billingSetRef: input.payload.billingSetRef,
          dealId: input.dealFxContext.dealId,
        }),
    at: input.context.now,
  });

  const requests: DocumentPostingPlanRequest[] = [];

  if (purpose !== "agency_fee") {
    requests.push(
      buildDocumentPostingRequest(input.document, {
        templateKey: POSTING_TEMPLATE_KEY.PAYMENT_FX_PRINCIPAL,
        bookId: input.bookId,
        currency: input.dealFxContext.calculationCurrency,
        amountMinor: BigInt(input.dealFxContext.originalAmountMinor),
        dimensions: {
          customerId: input.payload.customerId,
          orderId: input.document.id,
        },
        refs: {
          quoteRef: quoteSnapshot.quoteRef,
          chainId,
        },
        memo: input.payload.memo ?? null,
      }),
    );
  }

  requests.push(
    ...buildFinancialLineRequests({
      document: input.document,
      bookId: input.bookId,
      customerId: input.payload.customerId,
      orderId: input.document.id,
      counterpartyId: input.payload.counterpartyId,
      quoteRef: quoteSnapshot.quoteRef,
      chainId,
      lines: financialLines,
      includeCustomerLines: true,
      includeProviderLines: false,
      postingPhase: purpose === "agency_fee" ? "direct" : "reserve",
    }),
  );

  return buildDocumentPostingPlan({
    operationCode: OPERATION_CODE.COMMERCIAL_INVOICE_RESERVE,
    payload: {
      ...input.payload,
      memo: input.payload.memo ?? null,
    },
    requests,
  });
}

export async function buildInventoryFundedInvoicePostingPlan(input: {
  deps: Pick<CommercialModuleDeps, "quoteUsage">;
  dealFxContext: NonNullable<
    Awaited<ReturnType<typeof resolveInvoiceDealFxContext>>
  >;
  context: DocumentModuleContext;
  document: Document;
  payload: InvoicePayload;
  bookId: string;
}) {
  if (
    !input.dealFxContext.quoteSnapshot ||
    !input.dealFxContext.originalAmountMinor ||
    !input.dealFxContext.calculationCurrency
  ) {
    throw new DocumentValidationError(
      "linked deal does not have an accepted FX calculation for invoice posting",
    );
  }

  const quoteSnapshot = input.dealFxContext.quoteSnapshot;
  const purpose = getInvoicePurpose(input.payload);
  const chainId =
    purpose === "combined"
      ? `invoice:${input.document.id}`
      : input.payload.billingSetRef ??
        buildQuoteBillingSetRef({
          dealId: input.dealFxContext.dealId,
          quoteId: quoteSnapshot.quoteId,
        });
  const financialLines = filterFinancialLinesForInvoicePurpose({
    lines: input.dealFxContext.financialLines.map((line) =>
      normalizeFinancialLine(line),
    ),
    purpose,
  });
  await markQuoteUsedForInvoice({
    runtime: input.context.runtime,
    deps: input.deps,
    quoteId: quoteSnapshot.quoteId,
    invoiceDocumentId: input.document.id,
    ...(purpose === "combined"
      ? {}
      : {
          billingSetRef: input.payload.billingSetRef,
          dealId: input.dealFxContext.dealId,
        }),
    at: input.context.now,
  });

  const requests: DocumentPostingPlanRequest[] = [];

  if (purpose !== "agency_fee") {
    requests.push(
      buildDocumentPostingRequest(input.document, {
        templateKey: POSTING_TEMPLATE_KEY.PAYMENT_FX_PRINCIPAL,
        bookId: input.bookId,
        currency: input.dealFxContext.calculationCurrency,
        amountMinor: BigInt(input.dealFxContext.originalAmountMinor),
        dimensions: {
          customerId: input.payload.customerId,
          orderId: input.document.id,
        },
        refs: {
          quoteRef: quoteSnapshot.quoteRef,
          chainId,
        },
        memo: input.payload.memo ?? null,
      }),
      ...buildFinancialLineRequests({
        document: input.document,
        bookId: input.bookId,
        customerId: input.payload.customerId,
        orderId: input.document.id,
        counterpartyId: input.payload.counterpartyId,
        quoteRef: quoteSnapshot.quoteRef,
        chainId,
        lines: financialLines,
        includeCustomerLines: true,
        includeProviderLines: false,
        postingPhase: "reserve",
      }),
      buildDocumentPostingRequest(input.document, {
        templateKey: POSTING_TEMPLATE_KEY.PAYMENT_FX_PAYOUT_OBLIGATION,
        bookId: input.bookId,
        currency: quoteSnapshot.toCurrency,
        amountMinor: BigInt(quoteSnapshot.toAmountMinor),
        dimensions: {
          orderId: input.document.id,
        },
        refs: {
          quoteRef: quoteSnapshot.quoteRef,
          chainId,
          payoutCounterpartyId: input.payload.counterpartyId,
        },
        memo: input.payload.memo ?? null,
      }),
      ...buildFinancialLineRequests({
        document: input.document,
        bookId: input.bookId,
        customerId: input.payload.customerId,
        orderId: input.document.id,
        counterpartyId: input.payload.counterpartyId,
        quoteRef: quoteSnapshot.quoteRef,
        chainId,
        lines: financialLines,
        includeCustomerLines: true,
        includeProviderLines: true,
        postingPhase: "finalize",
      }),
    );
  } else {
    requests.push(
      ...buildFinancialLineRequests({
        document: input.document,
        bookId: input.bookId,
        customerId: input.payload.customerId,
        orderId: input.document.id,
        counterpartyId: input.payload.counterpartyId,
        quoteRef: quoteSnapshot.quoteRef,
        chainId,
        lines: financialLines,
        includeCustomerLines: true,
        includeProviderLines: false,
        postingPhase: "direct",
      }),
    );
  }

  return buildDocumentPostingPlan({
    operationCode: OPERATION_CODE.COMMERCIAL_INVOICE_INVENTORY_FINALIZE,
    payload: {
      ...input.payload,
      memo: input.payload.memo ?? null,
    },
    requests,
  });
}

export function buildExchangePostingPlan(input: {
  document: Document;
  financialLines?: NonNullable<
    Awaited<ReturnType<typeof resolveInvoiceDealFxContext>>
  >["financialLines"];
  payload: ExchangePayload;
  bookId: string;
}) {
  const chainId = `invoice:${input.payload.invoiceDocumentId}`;
  const requests: DocumentPostingPlanRequest[] = [];
  const financialLines =
    input.financialLines?.map((line) => normalizeFinancialLine(line)) ??
    input.payload.quoteSnapshot.financialLines.map((line) =>
      normalizeFinancialLine({
        ...line,
        amountMinor: BigInt(line.amountMinor),
      }),
    );

  for (const leg of input.payload.quoteSnapshot.legs) {
    const counterpartyId =
      leg.executionCounterpartyId ?? input.payload.counterpartyId;
    requests.push(
      buildDocumentPostingRequest(input.document, {
        templateKey: POSTING_TEMPLATE_KEY.PAYMENT_FX_LEG_OUT,
        bookId: input.bookId,
        currency: leg.fromCurrency,
        amountMinor: BigInt(leg.fromAmountMinor),
        dimensions: {
          orderId: input.payload.invoiceDocumentId,
          counterpartyId,
        },
        refs: {
          quoteRef: input.payload.quoteSnapshot.quoteRef,
          chainId,
          legIndex: String(leg.idx),
        },
        memo: input.payload.memo ?? null,
      }),
    );
    requests.push(
      buildDocumentPostingRequest(input.document, {
        templateKey: POSTING_TEMPLATE_KEY.PAYMENT_FX_LEG_IN,
        bookId: input.bookId,
        currency: leg.toCurrency,
        amountMinor: BigInt(leg.toAmountMinor),
        dimensions: {
          orderId: input.payload.invoiceDocumentId,
          counterpartyId,
        },
        refs: {
          quoteRef: input.payload.quoteSnapshot.quoteRef,
          chainId,
          legIndex: String(leg.idx),
        },
        memo: input.payload.memo ?? null,
      }),
    );
  }

  requests.push(
    buildDocumentPostingRequest(input.document, {
      templateKey: POSTING_TEMPLATE_KEY.PAYMENT_FX_PAYOUT_OBLIGATION,
      bookId: input.bookId,
      currency: input.payload.quoteSnapshot.toCurrency,
      amountMinor: BigInt(input.payload.quoteSnapshot.toAmountMinor),
      dimensions: {
        orderId: input.payload.invoiceDocumentId,
      },
      refs: {
        quoteRef: input.payload.quoteSnapshot.quoteRef,
        chainId,
        payoutCounterpartyId: input.payload.counterpartyId,
      },
      memo: input.payload.memo ?? null,
    }),
  );

  requests.push(
    ...buildFinancialLineRequests({
      document: input.document,
      bookId: input.bookId,
      customerId: input.payload.customerId,
      orderId: input.payload.invoiceDocumentId,
      counterpartyId: input.payload.counterpartyId,
      quoteRef: input.payload.quoteSnapshot.quoteRef,
      chainId,
      lines: financialLines,
      includeCustomerLines: true,
      includeProviderLines: true,
      postingPhase: "finalize",
    }),
  );

  return buildDocumentPostingPlan({
    operationCode: OPERATION_CODE.TREASURY_FX_EXECUTED,
    payload: {
      ...input.payload,
      memo: input.payload.memo ?? null,
    },
    requests,
  });
}

export function parseInvoicePayload(document: Document) {
  return parseDocumentPayload(InvoicePayloadSchema, document);
}

export function parseApplicationPayload(document: Document): ApplicationPayload {
  return parseDocumentPayload(ApplicationPayloadSchema, document);
}
