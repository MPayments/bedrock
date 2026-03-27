import { createHash } from "node:crypto";

import type { DocumentPostingPlanRequest } from "@bedrock/accounting/contracts";
import {
  ACCOUNTING_SOURCE_ID,
  OPERATION_CODE,
  POSTING_TEMPLATE_KEY,
} from "@bedrock/accounting/posting-contracts";
import type { LedgerOperationTbPlanRow } from "@bedrock/ledger/contracts";
import type {
  DocumentSnapshot,
  DocumentModuleContext,
} from "@bedrock/plugin-documents-sdk";
import { DocumentValidationError } from "@bedrock/plugin-documents-sdk";
import {
  buildDocumentPostingPlan,
  buildDocumentPostingRequest,
  parseDocumentPayload,
} from "@bedrock/plugin-documents-sdk/module-kit";
import { canonicalJson } from "@bedrock/shared/core/canon";
import { minorToAmountString } from "@bedrock/shared/money";

import type { CommercialDocumentRuntime, CommercialModuleDeps } from "./types";
import {
  IncomingInvoicePayloadSchema,
  OutgoingInvoicePayloadSchema,
  PaymentOrderPayloadSchema,
  QuoteSnapshotSchema,
  type CommercialContour,
  type IncomingInvoicePayload,
  type OutgoingInvoicePayload,
  type PaymentOrderExecutionStatus,
  type PaymentOrderPayload,
  type QuoteSnapshot,
} from "../../validation";

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

export async function resolveOrganizationBinding(
  deps: CommercialModuleDeps,
  organizationRequisiteId: string,
) {
  const binding = await deps.requisiteBindings.resolveBinding(
    organizationRequisiteId,
  );

  if (!binding) {
    throw new DocumentValidationError("Organization requisite binding is missing");
  }

  return binding;
}

export async function loadIncomingInvoice(
  deps: Pick<CommercialModuleDeps, "documentRelations">,
  runtime: CommercialDocumentRuntime,
  incomingInvoiceDocumentId: string,
  forUpdate = false,
): Promise<DocumentSnapshot> {
  return deps.documentRelations.loadIncomingInvoice({
    runtime,
    incomingInvoiceDocumentId,
    forUpdate,
  });
}

export async function loadPaymentOrder(
  deps: Pick<CommercialModuleDeps, "documentRelations">,
  runtime: CommercialDocumentRuntime,
  paymentOrderDocumentId: string,
  forUpdate = false,
): Promise<DocumentSnapshot> {
  return deps.documentRelations.loadPaymentOrder({
    runtime,
    paymentOrderDocumentId,
    forUpdate,
  });
}

export async function listIncomingInvoicePaymentOrders(
  deps: Pick<CommercialModuleDeps, "documentRelations">,
  runtime: CommercialDocumentRuntime,
  incomingInvoiceDocumentId: string,
) {
  return deps.documentRelations.listIncomingInvoicePaymentOrders({
    runtime,
    incomingInvoiceDocumentId,
  });
}

export async function listPaymentOrderResolutions(
  deps: Pick<CommercialModuleDeps, "documentRelations">,
  runtime: CommercialDocumentRuntime,
  paymentOrderDocumentId: string,
) {
  return deps.documentRelations.listPaymentOrderResolutions({
    runtime,
    paymentOrderDocumentId,
  });
}

export function requirePostedDocument(
  document: Pick<DocumentSnapshot, "docType" | "postingStatus" | "lifecycleStatus">,
) {
  if (
    document.lifecycleStatus !== "active" ||
    (document.postingStatus !== "posted" &&
      document.postingStatus !== "posting")
  ) {
    throw new DocumentValidationError(
      `${document.docType} must be active and posting or posted`,
    );
  }
}

export async function markQuoteUsedForPaymentOrder(input: {
  runtime: CommercialDocumentRuntime;
  deps: Pick<CommercialModuleDeps, "quoteUsage">;
  quoteId: string;
  paymentOrderDocumentId: string;
  at: Date;
}) {
  await input.deps.quoteUsage.markQuoteUsedForPaymentOrder({
    runtime: input.runtime,
    quoteId: input.quoteId,
    paymentOrderDocumentId: input.paymentOrderDocumentId,
    at: input.at,
  });
}

export function parseIncomingInvoicePayload(document: DocumentSnapshot) {
  return parseDocumentPayload(IncomingInvoicePayloadSchema, document);
}

export function parseOutgoingInvoicePayload(document: DocumentSnapshot) {
  return parseDocumentPayload(OutgoingInvoicePayloadSchema, document);
}

export function parsePaymentOrderPayload(document: DocumentSnapshot) {
  return parseDocumentPayload(PaymentOrderPayloadSchema, document);
}

export function isPaymentOrderResolution(
  payload: Pick<PaymentOrderPayload, "sourcePaymentOrderDocumentId">,
) {
  return Boolean(payload.sourcePaymentOrderDocumentId);
}

export function resolveCommercialDocumentTitle(input: {
  docType: "incoming_invoice" | "payment_order" | "outgoing_invoice";
  contour: CommercialContour;
}) {
  if (input.docType === "payment_order") {
    return input.contour === "rf" ? "Платежное поручение" : "Payment Order";
  }

  if (input.docType === "incoming_invoice") {
    return input.contour === "rf" ? "Счет на оплату" : "Invoice";
  }

  return input.contour === "rf" ? "Счет" : "Invoice";
}

export function buildIncomingInvoicePostingPlan(input: {
  document: DocumentSnapshot;
  payload: IncomingInvoicePayload;
  bookId: string;
}) {
  return buildDocumentPostingPlan({
    operationCode: OPERATION_CODE.TREASURY_OBLIGATION_OPENED,
    payload: {
      ...input.payload,
      memo: input.payload.memo ?? null,
    },
    requests: [
      buildDocumentPostingRequest(input.document, {
        templateKey: POSTING_TEMPLATE_KEY.COMMERCIAL_INCOMING_INVOICE_OPEN,
        bookId: input.bookId,
        currency: input.payload.currency,
        amountMinor: BigInt(input.payload.amountMinor),
        dimensions: {
          orderId: input.document.id,
          counterpartyId: input.payload.counterpartyId,
        },
        memo: input.payload.memo ?? null,
      }),
    ],
  });
}

export function buildOutgoingInvoicePostingPlan(input: {
  document: DocumentSnapshot;
  payload: OutgoingInvoicePayload;
  bookId: string;
}) {
  return buildDocumentPostingPlan({
    operationCode: OPERATION_CODE.TREASURY_OBLIGATION_OPENED,
    payload: {
      ...input.payload,
      memo: input.payload.memo ?? null,
    },
    requests: [
      buildDocumentPostingRequest(input.document, {
        templateKey: POSTING_TEMPLATE_KEY.COMMERCIAL_OUTGOING_INVOICE_OPEN,
        bookId: input.bookId,
        currency: input.payload.currency,
        amountMinor: BigInt(input.payload.amountMinor),
        dimensions: {
          orderId: input.document.id,
          counterpartyId: input.payload.counterpartyId,
        },
        memo: input.payload.memo ?? null,
      }),
    ],
  });
}

function buildPaymentOrderApClearRequest(input: {
  document: DocumentSnapshot;
  payload: PaymentOrderPayload;
  bookId: string;
}) {
  return buildDocumentPostingRequest(input.document, {
    templateKey: POSTING_TEMPLATE_KEY.COMMERCIAL_PAYMENT_ORDER_AP_CLEAR,
    bookId: input.bookId,
    currency: input.payload.allocatedCurrency,
    amountMinor: BigInt(input.payload.allocatedAmountMinor),
    dimensions: {
      customerId: input.payload.customerId,
      orderId: input.payload.incomingInvoiceDocumentId,
      counterpartyId: input.payload.counterpartyId,
    },
    memo: input.payload.memo ?? null,
  });
}

function buildPaymentOrderPrincipalRequest(input: {
  document: DocumentSnapshot;
  payload: PaymentOrderPayload;
  bookId: string;
  quoteRef: string;
  chainId: string;
}) {
  return buildDocumentPostingRequest(input.document, {
    templateKey: POSTING_TEMPLATE_KEY.PAYMENT_FX_PRINCIPAL,
    bookId: input.bookId,
    currency: input.payload.fundingCurrency,
    amountMinor: BigInt(input.payload.fundingAmountMinor),
    dimensions: {
      customerId: input.payload.customerId,
      orderId: input.payload.incomingInvoiceDocumentId,
    },
    refs: {
      quoteRef: input.quoteRef,
      chainId: input.chainId,
    },
    memo: input.payload.memo ?? null,
  });
}

function buildPaymentOrderFxRequests(input: {
  document: DocumentSnapshot;
  payload: PaymentOrderPayload;
  bookId: string;
  quoteRef: string;
  chainId: string;
}): DocumentPostingPlanRequest[] {
  if (!input.payload.quoteSnapshot) {
    return [];
  }

  const requests: DocumentPostingPlanRequest[] = [];

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
          orderId: input.payload.incomingInvoiceDocumentId,
          counterpartyId,
        },
        refs: {
          quoteRef: input.quoteRef,
          chainId: input.chainId,
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
          orderId: input.payload.incomingInvoiceDocumentId,
          counterpartyId,
        },
        refs: {
          quoteRef: input.quoteRef,
          chainId: input.chainId,
          legIndex: String(leg.idx),
        },
        memo: input.payload.memo ?? null,
      }),
    );
  }

  return requests;
}

function buildPaymentOrderObligationRequest(input: {
  document: DocumentSnapshot;
  payload: PaymentOrderPayload;
  bookId: string;
  quoteRef: string;
  chainId: string;
}) {
  return buildDocumentPostingRequest(input.document, {
    templateKey: POSTING_TEMPLATE_KEY.PAYMENT_FX_PAYOUT_OBLIGATION,
    bookId: input.bookId,
    currency: input.payload.allocatedCurrency,
    amountMinor: BigInt(input.payload.allocatedAmountMinor),
    dimensions: {
      orderId: input.payload.incomingInvoiceDocumentId,
    },
    refs: {
      quoteRef: input.quoteRef,
      chainId: input.chainId,
      payoutCounterpartyId: input.payload.counterpartyId,
    },
    memo: input.payload.memo ?? null,
  });
}

function buildPaymentOrderBankSendRequest(input: {
  document: DocumentSnapshot;
  payload: PaymentOrderPayload;
  bookId: string;
  executionStatus: PaymentOrderExecutionStatus;
}) {
  const railRef = input.payload.executionRef ?? input.document.id;
  const templateKey =
    input.executionStatus === "settled"
      ? POSTING_TEMPLATE_KEY.PAYMENT_PAYOUT_IMMEDIATE
      : POSTING_TEMPLATE_KEY.PAYMENT_PAYOUT_INITIATE;

  return buildDocumentPostingRequest(input.document, {
    templateKey,
    bookId: input.bookId,
    currency: input.payload.allocatedCurrency,
    amountMinor: BigInt(input.payload.allocatedAmountMinor),
    dimensions: {
      orderId: input.payload.incomingInvoiceDocumentId,
      organizationRequisiteId: input.payload.organizationRequisiteId,
    },
    refs: {
      railRef,
      payoutBankStableKey: input.payload.counterpartyRequisiteId,
    },
    pending:
      input.executionStatus === "settled"
        ? null
        : {
            timeoutSeconds: 86_400,
            ref: `payment_order:${input.document.id}`,
          },
    memo: input.payload.memo ?? null,
  });
}

export interface PaymentOrderPendingTransfer {
  transferId: bigint;
  pendingRef: string | null;
  amountMinor: bigint;
}

function buildPaymentOrderPendingResolutionRequest(input: {
  document: DocumentSnapshot;
  payload: PaymentOrderPayload;
  sourceDocumentId: string;
  sourcePayload: PaymentOrderPayload;
  pendingTransfer: PaymentOrderPendingTransfer;
  bookId: string;
}) {
  const settle = input.payload.executionStatus === "settled";
  const railRef =
    input.sourcePayload.executionRef ??
    input.payload.executionRef ??
    input.sourceDocumentId;

  return buildDocumentPostingRequest(input.document, {
    templateKey: settle
      ? POSTING_TEMPLATE_KEY.PAYMENT_PAYOUT_SETTLE
      : POSTING_TEMPLATE_KEY.PAYMENT_PAYOUT_VOID,
    bookId: input.bookId,
    currency: input.sourcePayload.allocatedCurrency,
    amountMinor: input.pendingTransfer.amountMinor,
    dimensions: {},
    refs: {
      orderId: input.sourcePayload.incomingInvoiceDocumentId,
      railRef,
    },
    pending: {
      pendingId: input.pendingTransfer.transferId,
      ref: input.pendingTransfer.pendingRef,
      amountMinor: settle ? input.pendingTransfer.amountMinor : 0n,
    },
    memo: input.payload.memo ?? null,
  });
}

export async function resolvePendingPaymentOrderTransfer(input: {
  deps: Pick<CommercialModuleDeps, "ledgerRead">;
  runtime: CommercialDocumentRuntime;
  paymentOrderDocumentId: string;
}): Promise<PaymentOrderPendingTransfer> {
  const operationId = await input.runtime.documents.getDocumentOperationId({
    documentId: input.paymentOrderDocumentId,
    kind: "post",
  });

  if (!operationId) {
    throw new DocumentValidationError(
      `payment_order ${input.paymentOrderDocumentId} is missing a posting operation`,
    );
  }

  const details = await input.deps.ledgerRead.getOperationDetails(operationId);

  if (!details) {
    throw new DocumentValidationError(
      `payment_order ${input.paymentOrderDocumentId} posting operation was not found`,
    );
  }

  const expectedPendingRef = `payment_order:${input.paymentOrderDocumentId}`;
  const isExpectedPendingPlan = (plan: LedgerOperationTbPlanRow) =>
    plan.isPending && plan.pendingRef === expectedPendingRef;
  const isAnyPendingPlan = (plan: LedgerOperationTbPlanRow) => plan.isPending;
  const pendingTransfer =
    details.tbPlans.find(isExpectedPendingPlan) ??
    details.tbPlans.find(isAnyPendingPlan);

  if (!pendingTransfer) {
    throw new DocumentValidationError(
      `payment_order ${input.paymentOrderDocumentId} has no pending payout transfer`,
    );
  }

  return {
    transferId: pendingTransfer.transferId,
    pendingRef: pendingTransfer.pendingRef,
    amountMinor: pendingTransfer.amount,
  };
}

export async function buildPaymentOrderPostingPlan(input: {
  deps: Pick<CommercialModuleDeps, "quoteUsage">;
  context: DocumentModuleContext;
  document: DocumentSnapshot;
  payload: PaymentOrderPayload;
  bookId: string;
  resolutionSource?: {
    document: DocumentSnapshot;
    payload: PaymentOrderPayload;
    pendingTransfer: PaymentOrderPendingTransfer;
  };
}) {
  if (input.payload.executionStatus === "prepared") {
    throw new DocumentValidationError(
      `payment_order executionStatus=${input.payload.executionStatus} cannot be posted`,
    );
  }

  if (input.resolutionSource) {
    if (input.payload.executionStatus === "sent") {
      throw new DocumentValidationError(
        "payment_order resolution cannot be posted with executionStatus=sent",
      );
    }

    const settle = input.payload.executionStatus === "settled";

    return buildDocumentPostingPlan({
      operationCode: settle
        ? OPERATION_CODE.TREASURY_EXECUTION_SETTLED
        : input.payload.executionStatus === "failed"
          ? OPERATION_CODE.TREASURY_EXECUTION_FAILED
          : OPERATION_CODE.TREASURY_EXECUTION_VOIDED,
      payload: {
        ...input.payload,
        memo: input.payload.memo ?? null,
      },
      requests: [
        buildPaymentOrderPendingResolutionRequest({
          document: input.document,
          payload: input.payload,
          sourceDocumentId: input.resolutionSource.document.id,
          sourcePayload: input.resolutionSource.payload,
          pendingTransfer: input.resolutionSource.pendingTransfer,
          bookId: input.bookId,
        }),
      ],
    });
  }

  if (
    input.payload.executionStatus === "void" ||
    input.payload.executionStatus === "failed"
  ) {
    throw new DocumentValidationError(
      `payment_order executionStatus=${input.payload.executionStatus} cannot be posted without a source payment_order`,
    );
  }

  const quoteRef = input.payload.quoteSnapshot?.quoteRef ?? `payment_order:${input.document.id}`;
  const chainId = `payment_order:${input.document.id}`;
  const requests: DocumentPostingPlanRequest[] = [
    buildPaymentOrderApClearRequest({
      document: input.document,
      payload: input.payload,
      bookId: input.bookId,
    }),
    buildPaymentOrderPrincipalRequest({
      document: input.document,
      payload: input.payload,
      bookId: input.bookId,
      quoteRef,
      chainId,
    }),
    ...buildPaymentOrderFxRequests({
      document: input.document,
      payload: input.payload,
      bookId: input.bookId,
      quoteRef,
      chainId,
    }),
    buildPaymentOrderObligationRequest({
      document: input.document,
      payload: input.payload,
      bookId: input.bookId,
      quoteRef,
      chainId,
    }),
  ];

  requests.push(
    buildPaymentOrderBankSendRequest({
      document: input.document,
      payload: input.payload,
      bookId: input.bookId,
      executionStatus: input.payload.executionStatus,
    }),
  );

  if (input.payload.quoteSnapshot?.quoteId) {
    await markQuoteUsedForPaymentOrder({
      runtime: input.context.runtime,
      deps: input.deps,
      quoteId: input.payload.quoteSnapshot.quoteId,
      paymentOrderDocumentId: input.document.id,
      at: input.context.now,
    });
  }

  const operationCode =
    input.payload.executionStatus === "settled"
      ? OPERATION_CODE.TREASURY_EXECUTION_SETTLED
      : OPERATION_CODE.TREASURY_EXECUTION_SUBMITTED;

  return buildDocumentPostingPlan({
    operationCode,
    payload: {
      ...input.payload,
      memo: input.payload.memo ?? null,
    },
    requests,
  });
}

export function resolvePaymentOrderAccountingSourceId(
  payload: PaymentOrderPayload,
) {
  if (payload.executionStatus === "settled") {
    return ACCOUNTING_SOURCE_ID.TREASURY_EXECUTION_SETTLED;
  }

  if (payload.executionStatus === "failed") {
    return ACCOUNTING_SOURCE_ID.TREASURY_EXECUTION_FAILED;
  }

  if (payload.executionStatus === "void") {
    return ACCOUNTING_SOURCE_ID.TREASURY_EXECUTION_VOIDED;
  }

  return ACCOUNTING_SOURCE_ID.TREASURY_EXECUTION_SUBMITTED;
}

export function buildPaymentOrderDetails(
  payload: PaymentOrderPayload,
  treasuryState?: {
    operationId: string | null;
    instructionId: string | null;
    operationStatus: string | null;
    instructionStatus: string | null;
    submittedEventId: string | null;
  } | null,
) {
  return {
    executionStatus: payload.executionStatus,
    sourcePaymentOrderDocumentId: payload.sourcePaymentOrderDocumentId ?? null,
    fundingAmount: payload.fundingAmount,
    fundingCurrency: payload.fundingCurrency,
    allocatedAmount: payload.allocatedAmount,
    allocatedCurrency: payload.allocatedCurrency,
    quoteId: payload.quoteSnapshot?.quoteId ?? null,
    quoteRef: payload.quoteSnapshot?.quoteRef ?? null,
    executionRef: payload.executionRef ?? null,
    treasuryOperationId: treasuryState?.operationId ?? null,
    treasuryInstructionId: treasuryState?.instructionId ?? null,
    treasuryOperationStatus: treasuryState?.operationStatus ?? null,
    treasuryInstructionStatus: treasuryState?.instructionStatus ?? null,
    treasurySubmittedEventId: treasuryState?.submittedEventId ?? null,
  };
}

export function sumAllocatedAmounts(input: {
  paymentOrders: DocumentSnapshot[];
  excludeDocumentId?: string;
}) {
  const activeDocuments = input.paymentOrders.filter(
    (document) =>
      document.id !== input.excludeDocumentId &&
      document.lifecycleStatus === "active",
  );
  const basePaymentOrders: {
    document: DocumentSnapshot;
    payload: PaymentOrderPayload;
  }[] = [];
  const resolutionsBySource = new Map<string, DocumentSnapshot[]>();

  for (const document of activeDocuments) {
    const payload = parsePaymentOrderPayload(document);

    if (isPaymentOrderResolution(payload)) {
      const sourceDocumentId = payload.sourcePaymentOrderDocumentId!;
      const bucket = resolutionsBySource.get(sourceDocumentId) ?? [];
      bucket.push(document);
      resolutionsBySource.set(sourceDocumentId, bucket);
      continue;
    }

    basePaymentOrders.push({ document, payload });
  }

  return basePaymentOrders.reduce(
    (total, entry) => {
      const allocatedAmountMinor = BigInt(entry.payload.allocatedAmountMinor);
      const resolutions = [...(resolutionsBySource.get(entry.document.id) ?? [])].sort(
        (left, right) => {
          const createdAtDiff =
            right.createdAt.getTime() - left.createdAt.getTime();

          if (createdAtDiff !== 0) {
            return createdAtDiff;
          }

          return right.occurredAt.getTime() - left.occurredAt.getTime();
        },
      );
      const latestResolution = resolutions[0]
        ? parsePaymentOrderPayload(resolutions[0])
        : null;

      if (
        latestResolution?.executionStatus === "void" ||
        latestResolution?.executionStatus === "failed"
      ) {
        return total;
      }

      return {
        allocatedAmountMinor: total.allocatedAmountMinor + allocatedAmountMinor,
        settledAmountMinor:
          total.settledAmountMinor +
          (latestResolution?.executionStatus === "settled" ||
          entry.payload.executionStatus === "settled"
            ? allocatedAmountMinor
            : 0n),
      };
    },
    {
      allocatedAmountMinor: 0n,
      settledAmountMinor: 0n,
    },
  );
}

export function buildIncomingInvoiceDetails(input: {
  payload: IncomingInvoicePayload;
  paymentOrders: DocumentSnapshot[];
}) {
  const totals = sumAllocatedAmounts({
    paymentOrders: input.paymentOrders,
  });
  const amountMinor = BigInt(input.payload.amountMinor);
  const availableAmountMinor = amountMinor - totals.allocatedAmountMinor;

  return {
    allocatedAmountMinor: totals.allocatedAmountMinor.toString(),
    settledAmountMinor: totals.settledAmountMinor.toString(),
    availableAmountMinor: availableAmountMinor.toString(),
    allocatedAmount: minorToAmountString(totals.allocatedAmountMinor, {
      currency: input.payload.currency,
    }),
    settledAmount: minorToAmountString(totals.settledAmountMinor, {
      currency: input.payload.currency,
    }),
    availableAmount: minorToAmountString(availableAmountMinor, {
      currency: input.payload.currency,
    }),
    timeline: input.paymentOrders.map((document) => {
      const payload = parsePaymentOrderPayload(document);
      return {
        id: document.id,
        docType: document.docType,
        docNo: document.docNo,
        postingStatus: document.postingStatus,
        executionStatus: payload.executionStatus,
        sourcePaymentOrderDocumentId: payload.sourcePaymentOrderDocumentId ?? null,
        allocatedAmount: payload.allocatedAmount,
        allocatedCurrency: payload.allocatedCurrency,
      };
    }),
  };
}
