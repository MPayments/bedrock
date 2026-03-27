import { ACCOUNTING_SOURCE_ID } from "@bedrock/accounting/posting-contracts";
import type {
  DocumentInitialLink,
  DocumentModule,
} from "@bedrock/plugin-documents-sdk";
import { DocumentValidationError } from "@bedrock/plugin-documents-sdk";
import {
  buildDocumentDraft,
  buildDocumentPostIdempotencyKey,
  parseDocumentPayload,
} from "@bedrock/plugin-documents-sdk/module-kit";
import { minorToAmountString } from "@bedrock/shared/money";

import { COMMERCIAL_DOCUMENT_METADATA } from "../metadata";
import {
  IncomingInvoicePayloadSchema,
  PaymentOrderInputSchema,
  PaymentOrderPayloadSchema,
  type IncomingInvoicePayload,
  type PaymentOrderInput,
  type PaymentOrderPayload,
} from "../validation";
import { requireDraftMetadata } from "./internal/draft-metadata";
import {
  buildPaymentOrderDetails,
  buildPaymentOrderPostingPlan,
  isPaymentOrderResolution,
  listIncomingInvoicePaymentOrders,
  listPaymentOrderResolutions,
  loadIncomingInvoice,
  loadPaymentOrder,
  parseIncomingInvoicePayload,
  parsePaymentOrderPayload,
  requirePostedDocument,
  resolveCommercialDocumentTitle,
  resolvePendingPaymentOrderTransfer,
  resolveOrganizationBinding,
  resolvePaymentOrderAccountingSourceId,
  sumAllocatedAmounts,
} from "./internal/helpers";
import type { CommercialDocumentRuntime, CommercialModuleDeps } from "./internal/types";

function buildPaymentOrderQuoteIdempotencyKey(input: {
  operationIdempotencyKey: string | null;
  incomingInvoiceDocumentId: string;
  fundingCurrency: string;
  allocatedCurrency: string;
  fundingAmountMinor: string;
}) {
  return [
    "documents",
    "payment_order",
    "quote",
    input.operationIdempotencyKey ?? input.incomingInvoiceDocumentId,
    input.fundingCurrency,
    input.allocatedCurrency,
    input.fundingAmountMinor,
  ].join(":");
}

function buildPaymentOrderSummary(input: {
  draft: { docNo: string; docType: string };
  payload: PaymentOrderPayload;
}) {
  return {
    title: resolveCommercialDocumentTitle({
      docType: "payment_order",
      contour: input.payload.contour,
    }),
    amountMinor: BigInt(input.payload.fundingAmountMinor),
    currency: input.payload.fundingCurrency,
    memo: input.payload.memo ?? null,
    counterpartyId: input.payload.counterpartyId,
    customerId: input.payload.customerId,
    organizationRequisiteId: input.payload.organizationRequisiteId,
    searchText: [
      input.draft.docNo,
      input.draft.docType,
      input.payload.incomingInvoiceDocumentId,
      input.payload.customerId,
      input.payload.counterpartyId,
      input.payload.counterpartyRequisiteId,
      input.payload.organizationId,
      input.payload.organizationRequisiteId,
      input.payload.fundingCurrency,
      input.payload.fundingAmount,
      input.payload.allocatedCurrency,
      input.payload.allocatedAmount,
      input.payload.executionStatus,
      input.payload.executionRef,
      input.payload.sourcePaymentOrderDocumentId,
      input.payload.quoteSnapshot?.quoteId,
      input.payload.quoteSnapshot?.quoteRef,
      input.payload.memo,
    ]
      .filter(Boolean)
      .join(" "),
  };
}

async function resolveIncomingInvoiceForPaymentOrder(
  deps: Pick<CommercialModuleDeps, "documentRelations">,
  runtime: CommercialDocumentRuntime,
  incomingInvoiceDocumentId: string,
  forUpdate = false,
) {
  const incomingInvoice = await loadIncomingInvoice(
    deps,
    runtime,
    incomingInvoiceDocumentId,
    forUpdate,
  );
  requirePostedDocument(incomingInvoice);

  return {
    document: incomingInvoice,
    payload: IncomingInvoicePayloadSchema.parse({
      ...incomingInvoice.payload,
      occurredAt: incomingInvoice.occurredAt,
    }),
  };
}

function assertPaymentOrderMatchesInvoice(input: {
  invoicePayload: IncomingInvoicePayload;
  paymentOrderInput: PaymentOrderInput;
  organizationId: string;
}) {
  if (input.paymentOrderInput.counterpartyId !== input.invoicePayload.counterpartyId) {
    throw new DocumentValidationError(
      "payment_order counterparty must match incoming_invoice counterparty",
    );
  }

  if (input.paymentOrderInput.allocatedCurrency !== input.invoicePayload.currency) {
    throw new DocumentValidationError(
      "payment_order allocatedCurrency must match incoming_invoice currency",
    );
  }

  if (input.paymentOrderInput.organizationId) {
    const invoiceOrganizationId = input.invoicePayload.organizationId ?? null;
    if (
      invoiceOrganizationId &&
      input.paymentOrderInput.organizationId !== invoiceOrganizationId
    ) {
      throw new DocumentValidationError(
        "payment_order organization must match incoming_invoice organization",
      );
    }
  }

  if (input.organizationId !== (input.paymentOrderInput.organizationId ?? input.organizationId)) {
    throw new DocumentValidationError(
      "payment_order organization must match organization requisite binding",
    );
  }
}

function assertPaymentOrderPostable(payload: PaymentOrderPayload) {
  if (payload.sourcePaymentOrderDocumentId) {
    throw new DocumentValidationError(
      "payment_order resolutions are no longer supported; use treasury execution events instead",
    );
  }

  if (payload.executionStatus !== "sent") {
    throw new DocumentValidationError(
      `payment_order executionStatus=${payload.executionStatus} is no longer postable; use treasury execution events for lifecycle updates`,
    );
  }
}

function resolveAllocatedMinorAmount(input: {
  paymentOrderInput: PaymentOrderInput;
  invoicePayload: IncomingInvoicePayload;
  quoteSnapshot: PaymentOrderPayload["quoteSnapshot"];
}) {
  if (!input.quoteSnapshot) {
    return {
      allocatedAmountMinor: input.paymentOrderInput.amountMinor,
      allocatedAmount: input.paymentOrderInput.amount,
    };
  }

  return {
    allocatedAmountMinor: input.quoteSnapshot.toAmountMinor,
    allocatedAmount: minorToAmountString(BigInt(input.quoteSnapshot.toAmountMinor), {
      currency: input.invoicePayload.currency,
    }),
  };
}

function resolveConsumesAllocation(payload: Pick<PaymentOrderPayload, "executionStatus">) {
  return payload.executionStatus !== "void" && payload.executionStatus !== "failed";
}

function assertPaymentOrderExecutionMode(input: {
  paymentOrderInput: PaymentOrderInput;
  hasSourcePaymentOrder: boolean;
}) {
  if (
    !input.hasSourcePaymentOrder &&
    (input.paymentOrderInput.executionStatus === "void" ||
      input.paymentOrderInput.executionStatus === "failed")
  ) {
    throw new DocumentValidationError(
      `payment_order with executionStatus=${input.paymentOrderInput.executionStatus} must reference sourcePaymentOrderDocumentId`,
    );
  }

  if (
    input.hasSourcePaymentOrder &&
    input.paymentOrderInput.executionStatus === "sent"
  ) {
    throw new DocumentValidationError(
      "payment_order resolution cannot use executionStatus=sent",
    );
  }
}

function assertPaymentOrderResolutionMatchesSource(input: {
  sourcePayload: PaymentOrderPayload;
  paymentOrder:
    | PaymentOrderInput
    | Pick<
        PaymentOrderPayload,
        | "allocatedCurrency"
        | "contour"
        | "counterpartyId"
        | "counterpartyRequisiteId"
        | "fundingAmount"
        | "fundingAmountMinor"
        | "fundingCurrency"
        | "incomingInvoiceDocumentId"
        | "organizationId"
        | "organizationRequisiteId"
      >;
}) {
  if (input.paymentOrder.contour !== input.sourcePayload.contour) {
    throw new DocumentValidationError(
      "payment_order resolution contour must match source payment_order contour",
    );
  }

  if (
    input.paymentOrder.incomingInvoiceDocumentId !==
    input.sourcePayload.incomingInvoiceDocumentId
  ) {
    throw new DocumentValidationError(
      "payment_order resolution must target the same incoming_invoice as the source payment_order",
    );
  }

  if (input.paymentOrder.counterpartyId !== input.sourcePayload.counterpartyId) {
    throw new DocumentValidationError(
      "payment_order resolution counterparty must match the source payment_order",
    );
  }

  if (
    input.paymentOrder.counterpartyRequisiteId !==
    input.sourcePayload.counterpartyRequisiteId
  ) {
    throw new DocumentValidationError(
      "payment_order resolution counterparty requisite must match the source payment_order",
    );
  }

  if (
    input.paymentOrder.organizationRequisiteId !==
    input.sourcePayload.organizationRequisiteId
  ) {
    throw new DocumentValidationError(
      "payment_order resolution organization requisite must match the source payment_order",
    );
  }

  const sourceOrganizationId = input.sourcePayload.organizationId ?? null;
  const paymentOrderOrganizationId = input.paymentOrder.organizationId ?? null;

  if (
    sourceOrganizationId &&
    paymentOrderOrganizationId &&
    paymentOrderOrganizationId !== sourceOrganizationId
  ) {
    throw new DocumentValidationError(
      "payment_order resolution organization must match the source payment_order",
    );
  }

  if (
    "fundingCurrency" in input.paymentOrder &&
    input.paymentOrder.fundingCurrency !== input.sourcePayload.fundingCurrency
  ) {
    throw new DocumentValidationError(
      "payment_order resolution funding currency must match the source payment_order",
    );
  }

  if (
    "currency" in input.paymentOrder &&
    input.paymentOrder.currency !== input.sourcePayload.fundingCurrency
  ) {
    throw new DocumentValidationError(
      "payment_order resolution funding currency must match the source payment_order",
    );
  }

  if (
    "fundingAmountMinor" in input.paymentOrder &&
    input.paymentOrder.fundingAmountMinor !==
      input.sourcePayload.fundingAmountMinor
  ) {
    throw new DocumentValidationError(
      "payment_order resolution funding amount must match the source payment_order",
    );
  }

  if (
    "amountMinor" in input.paymentOrder &&
    input.paymentOrder.amountMinor !== input.sourcePayload.fundingAmountMinor
  ) {
    throw new DocumentValidationError(
      "payment_order resolution funding amount must match the source payment_order",
    );
  }

  if (
    "fundingAmount" in input.paymentOrder &&
    input.paymentOrder.fundingAmount !== input.sourcePayload.fundingAmount
  ) {
    throw new DocumentValidationError(
      "payment_order resolution funding amount must match the source payment_order",
    );
  }

  if (
    "amount" in input.paymentOrder &&
    input.paymentOrder.amount !== input.sourcePayload.fundingAmount
  ) {
    throw new DocumentValidationError(
      "payment_order resolution funding amount must match the source payment_order",
    );
  }

  if (
    input.paymentOrder.allocatedCurrency !== input.sourcePayload.allocatedCurrency
  ) {
    throw new DocumentValidationError(
      "payment_order resolution allocated currency must match the source payment_order",
    );
  }
}

async function resolvePaymentOrderResolutionSource(input: {
  deps: Pick<CommercialModuleDeps, "documentRelations" | "ledgerRead">;
  runtime: CommercialDocumentRuntime;
  sourcePaymentOrderDocumentId: string;
  excludeDocumentId?: string;
}) {
  const sourceDocument = await loadPaymentOrder(
    input.deps,
    input.runtime,
    input.sourcePaymentOrderDocumentId,
  );
  requirePostedDocument(sourceDocument);

  const sourcePayload = parsePaymentOrderPayload(sourceDocument);
  if (isPaymentOrderResolution(sourcePayload)) {
    throw new DocumentValidationError(
      "payment_order resolution must reference a primary payment_order",
    );
  }

  if (sourcePayload.executionStatus !== "sent") {
    throw new DocumentValidationError(
      "payment_order resolution source must have executionStatus=sent",
    );
  }

  const existingResolutions = await listPaymentOrderResolutions(
    input.deps,
    input.runtime,
    sourceDocument.id,
  );
  const conflictingResolution = existingResolutions.find((document) => {
    if (
      document.id === input.excludeDocumentId ||
      document.lifecycleStatus !== "active"
    ) {
      return false;
    }

    return (
      parsePaymentOrderPayload(document).sourcePaymentOrderDocumentId ===
      sourceDocument.id
    );
  });

  if (conflictingResolution) {
    throw new DocumentValidationError(
      "payment_order source already has a resolution document",
    );
  }

  const pendingTransfer = await resolvePendingPaymentOrderTransfer({
    deps: input.deps,
    runtime: input.runtime,
    paymentOrderDocumentId: sourceDocument.id,
  });

  return {
    document: sourceDocument,
    payload: sourcePayload,
    pendingTransfer,
  };
}

async function assertPaymentOrderAllocationAvailable(input: {
  deps: Pick<CommercialModuleDeps, "documentRelations">;
  runtime: CommercialDocumentRuntime;
  incomingInvoiceDocumentId: string;
  invoicePayload: IncomingInvoicePayload;
  payload: PaymentOrderPayload;
  excludeDocumentId?: string;
}) {
  if (
    isPaymentOrderResolution(input.payload) ||
    !resolveConsumesAllocation(input.payload)
  ) {
    return;
  }

  const siblings = await listIncomingInvoicePaymentOrders(
    input.deps,
    input.runtime,
    input.incomingInvoiceDocumentId,
  );
  const totals = sumAllocatedAmounts({
    paymentOrders: siblings,
    excludeDocumentId: input.excludeDocumentId,
  });
  const nextAllocatedAmountMinor =
    totals.allocatedAmountMinor + BigInt(input.payload.allocatedAmountMinor);
  const invoiceAmountMinor = BigInt(input.invoicePayload.amountMinor);

  if (nextAllocatedAmountMinor > invoiceAmountMinor) {
    throw new DocumentValidationError(
      "payment_order allocated amount exceeds incoming_invoice available amount",
    );
  }
}

async function preparePaymentOrderPayload(input: {
  deps: CommercialModuleDeps;
  runtime: CommercialDocumentRuntime;
  now: Date;
  operationIdempotencyKey: string | null;
  paymentOrderInput: PaymentOrderInput;
  excludeDocumentId?: string;
}): Promise<PaymentOrderPayload> {
  const normalizedInput = PaymentOrderInputSchema.parse(input.paymentOrderInput);
  const { payload: invoicePayload } = await resolveIncomingInvoiceForPaymentOrder(
    input.deps,
    input.runtime,
    normalizedInput.incomingInvoiceDocumentId,
  );

  await input.deps.partyReferences.assertCustomerExists(invoicePayload.customerId);
  await input.deps.partyReferences.assertCounterpartyExists(
    normalizedInput.counterpartyId,
  );

  const binding = await resolveOrganizationBinding(
    input.deps,
    normalizedInput.organizationRequisiteId,
  );

  if (binding.currencyCode !== normalizedInput.currency) {
    throw new DocumentValidationError(
      `Currency mismatch: requisite=${binding.currencyCode}, payment_order=${normalizedInput.currency}`,
    );
  }

  assertPaymentOrderMatchesInvoice({
    invoicePayload,
    paymentOrderInput: normalizedInput,
    organizationId: binding.organizationId,
  });

  const resolutionSource = normalizedInput.sourcePaymentOrderDocumentId
    ? await resolvePaymentOrderResolutionSource({
        deps: input.deps,
        runtime: input.runtime,
        sourcePaymentOrderDocumentId: normalizedInput.sourcePaymentOrderDocumentId,
        excludeDocumentId: input.excludeDocumentId,
      })
    : null;

  assertPaymentOrderExecutionMode({
    paymentOrderInput: normalizedInput,
    hasSourcePaymentOrder: Boolean(resolutionSource),
  });

  if (resolutionSource) {
    assertPaymentOrderResolutionMatchesSource({
      sourcePayload: resolutionSource.payload,
      paymentOrder: normalizedInput,
    });
  }

  const quoteSnapshot =
    resolutionSource
      ? resolutionSource.payload.quoteSnapshot
      : normalizedInput.currency === invoicePayload.currency
      ? undefined
      : await input.deps.quoteSnapshot.createQuoteSnapshot({
          runtime: input.runtime,
          fromCurrency: normalizedInput.currency,
          toCurrency: invoicePayload.currency,
          fromAmountMinor: normalizedInput.amountMinor,
          asOf: input.now,
          idempotencyKey: buildPaymentOrderQuoteIdempotencyKey({
            operationIdempotencyKey: input.operationIdempotencyKey,
            incomingInvoiceDocumentId: normalizedInput.incomingInvoiceDocumentId,
            fundingCurrency: normalizedInput.currency,
            allocatedCurrency: invoicePayload.currency,
            fundingAmountMinor: normalizedInput.amountMinor,
          }),
        });

  if (quoteSnapshot) {
    if (
      quoteSnapshot.fromCurrency !== normalizedInput.currency ||
      quoteSnapshot.toCurrency !== invoicePayload.currency
    ) {
      throw new DocumentValidationError(
        "payment_order quote snapshot currencies do not match funding/allocation currencies",
      );
    }

    if (quoteSnapshot.fromAmountMinor !== normalizedInput.amountMinor) {
      throw new DocumentValidationError(
        "payment_order quote snapshot amount does not match funding amount",
      );
    }
  }

  const allocated = resolutionSource
    ? {
        allocatedAmountMinor: resolutionSource.payload.allocatedAmountMinor,
        allocatedAmount: resolutionSource.payload.allocatedAmount,
      }
    : resolveAllocatedMinorAmount({
        paymentOrderInput: normalizedInput,
        invoicePayload,
        quoteSnapshot,
      });

  const payload = PaymentOrderPayloadSchema.parse({
    occurredAt: normalizedInput.occurredAt.toISOString(),
    contour: normalizedInput.contour,
    incomingInvoiceDocumentId: normalizedInput.incomingInvoiceDocumentId,
    sourcePaymentOrderDocumentId:
      normalizedInput.sourcePaymentOrderDocumentId,
    customerId: invoicePayload.customerId,
    counterpartyId: normalizedInput.counterpartyId,
    counterpartyRequisiteId: normalizedInput.counterpartyRequisiteId,
    organizationId: normalizedInput.organizationId ?? binding.organizationId,
    organizationRequisiteId: normalizedInput.organizationRequisiteId,
    fundingAmount: normalizedInput.amount,
    fundingAmountMinor: normalizedInput.amountMinor,
    fundingCurrency: normalizedInput.currency,
    allocatedAmount: allocated.allocatedAmount,
    allocatedAmountMinor: allocated.allocatedAmountMinor,
    allocatedCurrency: invoicePayload.currency,
    executionStatus: normalizedInput.executionStatus,
    executionRef: normalizedInput.executionRef,
    quoteSnapshot,
    memo: normalizedInput.memo ?? undefined,
  });

  if (!resolutionSource) {
    await assertPaymentOrderAllocationAvailable({
      deps: input.deps,
      runtime: input.runtime,
      incomingInvoiceDocumentId: normalizedInput.incomingInvoiceDocumentId,
      invoicePayload,
      payload,
      excludeDocumentId: input.excludeDocumentId,
    });
  }

  return payload;
}

export function createPaymentOrderDocumentModule(
  deps: CommercialModuleDeps,
): DocumentModule<PaymentOrderInput, PaymentOrderInput> {
  return {
    moduleId: "payment_order",
    accountingSourceId: ACCOUNTING_SOURCE_ID.TREASURY_EXECUTION_SUBMITTED,
    docType: "payment_order",
    docNoPrefix: COMMERCIAL_DOCUMENT_METADATA.payment_order.docNoPrefix,
    payloadVersion: 1,
    createSchema: PaymentOrderInputSchema,
    updateSchema: PaymentOrderInputSchema,
    payloadSchema: PaymentOrderPayloadSchema,
    postingRequired: true,
    allowDirectPostFromDraft: false,
    approvalRequired: () => false,
    async createDraft(context, input) {
      const draft = requireDraftMetadata(context);
      const payload = await preparePaymentOrderPayload({
        deps,
        runtime: context.runtime,
        now: context.now,
        operationIdempotencyKey: context.operationIdempotencyKey,
        paymentOrderInput: input,
      });

      return buildDocumentDraft(
        input,
        payload,
        buildPaymentOrderSummary({
          draft,
          payload,
        }),
      );
    },
    async updateDraft(context, document, input) {
      const draft = requireDraftMetadata(context);
      const payload = await preparePaymentOrderPayload({
        deps,
        runtime: context.runtime,
        now: context.now,
        operationIdempotencyKey: context.operationIdempotencyKey,
        paymentOrderInput: input,
        excludeDocumentId: document.id,
      });

      return buildDocumentDraft(
        input,
        payload,
        buildPaymentOrderSummary({
          draft,
          payload,
        }),
      );
    },
    async canCreate(context, input) {
      const normalizedInput = PaymentOrderInputSchema.parse(input);
      const { payload: invoicePayload } = await resolveIncomingInvoiceForPaymentOrder(
        deps,
        context.runtime,
        normalizedInput.incomingInvoiceDocumentId,
      );
      const binding = await resolveOrganizationBinding(
        deps,
        normalizedInput.organizationRequisiteId,
      );

      await deps.partyReferences.assertCustomerExists(invoicePayload.customerId);
      await deps.partyReferences.assertCounterpartyExists(
        normalizedInput.counterpartyId,
      );

      if (binding.currencyCode !== normalizedInput.currency) {
        throw new DocumentValidationError(
          `Currency mismatch: requisite=${binding.currencyCode}, payment_order=${normalizedInput.currency}`,
        );
      }

      assertPaymentOrderMatchesInvoice({
        invoicePayload,
        paymentOrderInput: normalizedInput,
        organizationId: binding.organizationId,
      });

      const resolutionSource = normalizedInput.sourcePaymentOrderDocumentId
        ? await resolvePaymentOrderResolutionSource({
            deps,
            runtime: context.runtime,
            sourcePaymentOrderDocumentId:
              normalizedInput.sourcePaymentOrderDocumentId,
          })
        : null;

      assertPaymentOrderExecutionMode({
        paymentOrderInput: normalizedInput,
        hasSourcePaymentOrder: Boolean(resolutionSource),
      });

      if (resolutionSource) {
        assertPaymentOrderResolutionMatchesSource({
          sourcePayload: resolutionSource.payload,
          paymentOrder: normalizedInput,
        });
      }
    },
    async canEdit() {},
    async canSubmit() {},
    async canApprove() {},
    async canReject() {},
    async canCancel() {},
    async canPost(context, document) {
      const payload = parsePaymentOrderPayload(document);
      assertPaymentOrderPostable(payload);

      const { payload: invoicePayload } = await resolveIncomingInvoiceForPaymentOrder(
        deps,
        context.runtime,
        payload.incomingInvoiceDocumentId,
      );
      const binding = await resolveOrganizationBinding(
        deps,
        payload.organizationRequisiteId,
      );

      if (binding.currencyCode !== payload.fundingCurrency) {
        throw new DocumentValidationError(
          `Currency mismatch: requisite=${binding.currencyCode}, payment_order=${payload.fundingCurrency}`,
        );
      }

      await deps.partyReferences.assertCustomerExists(invoicePayload.customerId);
      await deps.partyReferences.assertCounterpartyExists(payload.counterpartyId);

      await assertPaymentOrderAllocationAvailable({
        deps,
        runtime: context.runtime,
        incomingInvoiceDocumentId: payload.incomingInvoiceDocumentId,
        invoicePayload,
        payload,
        excludeDocumentId: document.id,
      });
    },
    async buildPostingPlan(context, document) {
      const payload = parsePaymentOrderPayload(document);
      assertPaymentOrderPostable(payload);

      const binding = await resolveOrganizationBinding(
        deps,
        payload.organizationRequisiteId,
      );
      const { document: invoiceDocument } =
        await resolveIncomingInvoiceForPaymentOrder(
          deps,
          context.runtime,
          payload.incomingInvoiceDocumentId,
        );

      await deps.treasuryState.ensureIncomingInvoiceObligation({
        document: invoiceDocument,
      });
      await deps.treasuryState.ensurePaymentOrderPayout({ document });

      return buildPaymentOrderPostingPlan({
        deps,
        context,
        document,
        payload,
        bookId: binding.bookId,
      });
    },
    resolveAccountingSourceId: () =>
      ACCOUNTING_SOURCE_ID.TREASURY_EXECUTION_SUBMITTED,
    async buildInitialLinks(_context, document) {
      const payload = parsePaymentOrderPayload(document);
      const links: DocumentInitialLink[] = [
        {
          toDocumentId: payload.incomingInvoiceDocumentId,
          linkType: "parent",
        },
      ];

      if (payload.sourcePaymentOrderDocumentId) {
        links.push({
          toDocumentId: payload.sourcePaymentOrderDocumentId,
          linkType: "depends_on",
        });
      }

      return links;
    },
    buildPostIdempotencyKey(document) {
      return buildDocumentPostIdempotencyKey(document);
    },
    async buildDetails(_context, document) {
      const payload = parsePaymentOrderPayload(document);
      const treasuryState = await deps.treasuryState.getPaymentOrderStatus({
        documentId: document.id,
      });

      return {
        computed: buildPaymentOrderDetails(payload, treasuryState),
      };
    },
  };
}
