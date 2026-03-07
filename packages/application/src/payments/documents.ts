import { and, eq, inArray } from "drizzle-orm";

import type { DocumentModule } from "@bedrock/core/documents";
import {
  DocumentGraphError,
  DocumentValidationError,
} from "@bedrock/core/documents";
import {
  buildDocumentDraft,
  buildDocumentPostIdempotencyKey,
  parseDocumentPayload,
  resolvePendingTransferBookId,
  serializeOccurredAt,
} from "@bedrock/core/documents/module-kit";
import {
  buildDocumentPostingPlan,
  buildDocumentPostingRequest,
} from "@bedrock/core/documents/module-kit";
import { schema as documentsSchema } from "@bedrock/core/documents/schema";
import { schema as ledgerSchema } from "@bedrock/core/ledger/schema";
import {
  ACCOUNTING_SOURCE_ID,
  OPERATION_CODE,
  POSTING_TEMPLATE_KEY,
} from "@bedrock/kernel/accounting-contracts";
import { DAY_IN_SECONDS } from "@bedrock/kernel/constants";

import {
  PaymentIntentInputSchema,
  PaymentIntentPayloadSchema,
  PaymentResolutionPayloadSchema,
  type PaymentIntentPayload,
  type PaymentResolutionPayload,
} from "./validation";

const schema = {
  ...documentsSchema,
  ...ledgerSchema,
};

interface PaymentBinding {
  requisiteId: string;
  bookId: string;
  organizationId: string;
  currencyCode: string;
}

interface PaymentOrganizationRequisitesService {
  resolveBindings: (input: {
    requisiteIds: string[];
  }) => Promise<PaymentBinding[]>;
}

function resolvePaymentDirectionLabel(
  direction: PaymentIntentPayload["direction"],
) {
  switch (direction) {
    case "payin":
      return "Входящий";
    case "payout":
      return "Исходящий";
  }
}

function resolvePaymentResolutionLabel(
  resolutionType: PaymentResolutionPayload["resolutionType"],
) {
  switch (resolutionType) {
    case "settle":
      return "Исполнение";
    case "void":
      return "Аннулирование";
    case "fail":
      return "Ошибка";
  }
}

function normalizePaymentIntentPayload(payload: PaymentIntentPayload) {
  return {
    ...serializeOccurredAt(payload),
    memo: payload.memo ?? null,
    providerConstraint: payload.providerConstraint ?? null,
    countryFrom: payload.countryFrom ?? null,
    countryTo: payload.countryTo ?? null,
    riskScore: payload.riskScore ?? null,
    timeoutSeconds: payload.timeoutSeconds ?? null,
  };
}

function normalizePaymentResolutionPayload(payload: PaymentResolutionPayload) {
  return {
    ...serializeOccurredAt(payload),
    externalRef: payload.externalRef ?? null,
  };
}

function requireBinding<T>(value: T | undefined, label: string): T {
  if (!value) {
    throw new DocumentValidationError(`${label} binding is missing`);
  }
  return value;
}

async function resolveBindings(
  organizationRequisitesService: PaymentOrganizationRequisitesService,
  payload: Pick<
    PaymentIntentPayload,
    "sourceCounterpartyAccountId" | "destinationCounterpartyAccountId"
  >,
) {
  const [sourceBinding, destinationBinding] =
    await organizationRequisitesService.resolveBindings({
      requisiteIds: [
        payload.sourceCounterpartyAccountId,
        payload.destinationCounterpartyAccountId,
      ],
    });

  return {
    source: requireBinding(sourceBinding, "Source"),
    destination: requireBinding(destinationBinding, "Destination"),
  };
}

async function getDependencyDocument(
  db: Parameters<DocumentModule["canPost"]>[0]["db"],
  documentId: string,
) {
  const [dependency] = await db
    .select({
      document: schema.documents,
    })
    .from(schema.documentLinks)
    .innerJoin(
      schema.documents,
      eq(schema.documents.id, schema.documentLinks.toDocumentId),
    )
    .where(
      and(
        eq(schema.documentLinks.fromDocumentId, documentId),
        eq(schema.documentLinks.linkType, "depends_on"),
      ),
    )
    .limit(1);

  return dependency?.document ?? null;
}

async function getPendingTransferIdsForDocument(
  db: Parameters<DocumentModule["canPost"]>[0]["db"],
  documentId: string,
) {
  const [operation] = await db
    .select({ operationId: schema.documentOperations.operationId })
    .from(schema.documentOperations)
    .where(
      and(
        eq(schema.documentOperations.documentId, documentId),
        eq(schema.documentOperations.kind, "post"),
      ),
    )
    .limit(1);

  if (!operation) {
    return [];
  }

  const plans = await db
    .select({
      transferId: schema.tbTransferPlans.transferId,
      pendingRef: schema.tbTransferPlans.pendingRef,
    })
    .from(schema.tbTransferPlans)
    .where(
      and(
        eq(schema.tbTransferPlans.operationId, operation.operationId),
        eq(schema.tbTransferPlans.isPending, true),
      ),
    );

  return plans.map((plan) => ({
    pendingId: plan.transferId,
    pendingRef: plan.pendingRef,
  }));
}

async function ensureNoPendingResolution(
  db: Parameters<DocumentModule["canPost"]>[0]["db"],
  intentDocumentId: string,
) {
  const rows = await db
    .select({
      postingStatus: schema.documents.postingStatus,
      lifecycleStatus: schema.documents.lifecycleStatus,
    })
    .from(schema.documentLinks)
    .innerJoin(
      schema.documents,
      eq(schema.documents.id, schema.documentLinks.fromDocumentId),
    )
    .where(
      and(
        eq(schema.documentLinks.toDocumentId, intentDocumentId),
        eq(schema.documentLinks.linkType, "depends_on"),
        inArray(schema.documents.docType, ["payment_resolution"]),
      ),
    );

  const blocking = rows.find(
    (row) =>
      row.lifecycleStatus === "active" &&
      row.postingStatus !== "failed" &&
      row.postingStatus !== "not_required",
  );
  if (blocking) {
    throw new DocumentValidationError(
      `Payment intent ${intentDocumentId} already has a pending resolution`,
    );
  }
}

export function createPaymentIntentDocumentModule(deps: {
  organizationRequisitesService: PaymentOrganizationRequisitesService;
}): DocumentModule<PaymentIntentPayload, PaymentIntentPayload> {
  const { organizationRequisitesService } = deps;

  return {
    moduleId: "payment_intent",
    accountingSourceId: ACCOUNTING_SOURCE_ID.PAYMENT_CASE,
    docType: "payment_intent",
    docNoPrefix: "PMT",
    payloadVersion: 1,
    createSchema: PaymentIntentInputSchema,
    updateSchema: PaymentIntentInputSchema,
    payloadSchema: PaymentIntentPayloadSchema.transform(
      normalizePaymentIntentPayload,
    ),
    postingRequired: true,
    approvalRequired: () => false,
    async createDraft(_context, input) {
      return buildDocumentDraft(input, normalizePaymentIntentPayload(input));
    },
    async updateDraft(_context, _document, input) {
      return buildDocumentDraft(input, normalizePaymentIntentPayload(input));
    },
    deriveSummary(document) {
      const payload = parseDocumentPayload(
        PaymentIntentPayloadSchema,
        document,
      );
      return {
        title: `Платеж ${resolvePaymentDirectionLabel(payload.direction)} ${payload.currency}`,
        amountMinor: payload.amountMinor,
        currency: payload.currency,
        memo: payload.memo ?? null,
        counterpartyId: null,
        counterpartyAccountId: payload.sourceCounterpartyAccountId,
        searchText: [
          document.docNo,
          payload.direction,
          payload.currency,
          payload.sourceCounterpartyAccountId,
          payload.destinationCounterpartyAccountId,
          payload.corridor,
          payload.providerConstraint ?? "",
          payload.memo ?? "",
        ]
          .filter(Boolean)
          .join(" "),
      };
    },
    async canCreate(_context, input) {
      const bindings = await resolveBindings(
        organizationRequisitesService,
        input,
      );
      if (
        bindings.source.currencyCode !== input.currency ||
        bindings.destination.currencyCode !== input.currency
      ) {
        throw new DocumentValidationError(
          `currency mismatch: expected ${bindings.source.currencyCode}/${bindings.destination.currencyCode}, got ${input.currency}`,
        );
      }
    },
    async canEdit() {},
    async canSubmit() {},
    async canApprove() {},
    async canReject() {},
    async canCancel() {},
    async canPost(_context, document) {
      const payload = parseDocumentPayload(
        PaymentIntentPayloadSchema,
        document,
      );
      const bindings = await resolveBindings(
        organizationRequisitesService,
        payload,
      );
      if (
        bindings.source.currencyCode !== payload.currency ||
        bindings.destination.currencyCode !== payload.currency
      ) {
        throw new DocumentValidationError(
          `currency mismatch: expected ${bindings.source.currencyCode}/${bindings.destination.currencyCode}, got ${payload.currency}`,
        );
      }
    },
    async buildPostingPlan(_context, document) {
      const payload = parseDocumentPayload(
        PaymentIntentPayloadSchema,
        document,
      );
      const bindings = await resolveBindings(
        organizationRequisitesService,
        payload,
      );
      const sourceBookId = bindings.source.bookId;
      const destinationBookId = bindings.destination.bookId;
      const timeoutSeconds = payload.timeoutSeconds ?? DAY_IN_SECONDS;

      if (sourceBookId === destinationBookId) {
        return buildDocumentPostingPlan({
          operationCode: OPERATION_CODE.TRANSFER_APPROVE_PENDING_INTRA,
          payload: {
            ...payload,
            memo: payload.memo ?? null,
          },
          requests: [
            buildDocumentPostingRequest(document, {
              templateKey: POSTING_TEMPLATE_KEY.TRANSFER_INTRA_PENDING,
              currency: payload.currency,
              amountMinor: payload.amountMinor,
              bookId: sourceBookId,
              dimensions: {
                sourceCounterpartyAccountId:
                  payload.sourceCounterpartyAccountId,
                destinationCounterpartyAccountId:
                  payload.destinationCounterpartyAccountId,
                sourceCounterpartyId: bindings.source.organizationId,
                destinationCounterpartyId: bindings.destination.organizationId,
                direction: payload.direction,
                corridor: payload.corridor,
              },
              refs: {
                sourceCounterpartyAccountId:
                  payload.sourceCounterpartyAccountId,
                destinationCounterpartyAccountId:
                  payload.destinationCounterpartyAccountId,
                direction: payload.direction,
              },
              pending: {
                timeoutSeconds,
                ref: `payment_intent:${document.id}:intra`,
              },
              memo: payload.memo ?? null,
            }),
          ],
        });
      }

      return buildDocumentPostingPlan({
        operationCode: OPERATION_CODE.TRANSFER_APPROVE_PENDING_CROSS,
        payload: {
          ...payload,
          memo: payload.memo ?? null,
        },
        requests: [
          buildDocumentPostingRequest(document, {
            templateKey: POSTING_TEMPLATE_KEY.TRANSFER_CROSS_SOURCE_PENDING,
            currency: payload.currency,
            amountMinor: payload.amountMinor,
            bookId: sourceBookId,
            dimensions: {
              sourceCounterpartyAccountId: payload.sourceCounterpartyAccountId,
              destinationCounterpartyAccountId:
                payload.destinationCounterpartyAccountId,
              destinationCounterpartyId: bindings.destination.organizationId,
              direction: payload.direction,
              corridor: payload.corridor,
            },
            refs: {
              sourceCounterpartyAccountId: payload.sourceCounterpartyAccountId,
              destinationCounterpartyAccountId:
                payload.destinationCounterpartyAccountId,
              direction: payload.direction,
            },
            pending: {
              timeoutSeconds,
              ref: `payment_intent:${document.id}:source`,
            },
            memo: payload.memo ?? null,
          }),
          buildDocumentPostingRequest(document, {
            templateKey:
              POSTING_TEMPLATE_KEY.TRANSFER_CROSS_DESTINATION_PENDING,
            currency: payload.currency,
            amountMinor: payload.amountMinor,
            bookId: destinationBookId,
            dimensions: {
              sourceCounterpartyAccountId: payload.sourceCounterpartyAccountId,
              destinationCounterpartyAccountId:
                payload.destinationCounterpartyAccountId,
              sourceCounterpartyId: bindings.source.organizationId,
              direction: payload.direction,
              corridor: payload.corridor,
            },
            refs: {
              sourceCounterpartyAccountId: payload.sourceCounterpartyAccountId,
              destinationCounterpartyAccountId:
                payload.destinationCounterpartyAccountId,
              direction: payload.direction,
            },
            pending: {
              timeoutSeconds,
              ref: `payment_intent:${document.id}:destination`,
            },
            memo: payload.memo ?? null,
          }),
        ],
      });
    },
    buildPostIdempotencyKey(document) {
      return buildDocumentPostIdempotencyKey(document);
    },
    async buildDetails(context, document) {
      const pendingTransfers = await getPendingTransferIdsForDocument(
        context.db,
        document.id,
      );

      return {
        computed: {
          pendingTransferIds: pendingTransfers.map((item) =>
            item.pendingId.toString(),
          ),
          pendingRefs: pendingTransfers
            .map((item) => item.pendingRef)
            .filter((item): item is string => Boolean(item)),
        },
      };
    },
  };
}

export function createPaymentResolutionDocumentModule(deps: {
  organizationRequisitesService: PaymentOrganizationRequisitesService;
}): DocumentModule<PaymentResolutionPayload, PaymentResolutionPayload> {
  const { organizationRequisitesService } = deps;

  return {
    moduleId: "payment_resolution",
    accountingSourceId: ACCOUNTING_SOURCE_ID.PAYMENT_CASE,
    docType: "payment_resolution",
    docNoPrefix: "PMR",
    payloadVersion: 1,
    createSchema: PaymentResolutionPayloadSchema,
    updateSchema: PaymentResolutionPayloadSchema,
    payloadSchema: PaymentResolutionPayloadSchema.transform(
      normalizePaymentResolutionPayload,
    ),
    postingRequired: true,
    approvalRequired() {
      return false;
    },
    async createDraft(_context, input) {
      return buildDocumentDraft(
        input,
        normalizePaymentResolutionPayload(input),
      );
    },
    async updateDraft(_context, _document, input) {
      return buildDocumentDraft(
        input,
        normalizePaymentResolutionPayload(input),
      );
    },
    deriveSummary(document) {
      const payload = parseDocumentPayload(
        PaymentResolutionPayloadSchema,
        document,
      );
      return {
        title: `Результат платежа: ${resolvePaymentResolutionLabel(payload.resolutionType)}`,
        memo: payload.externalRef ?? null,
        searchText: [
          document.docNo,
          payload.resolutionType,
          payload.intentDocumentId,
          payload.eventIdempotencyKey,
          payload.externalRef ?? "",
        ]
          .filter(Boolean)
          .join(" "),
      };
    },
    async canCreate(context, input) {
      const [intentDocument] = await context.db
        .select({ id: schema.documents.id, docType: schema.documents.docType })
        .from(schema.documents)
        .where(eq(schema.documents.id, input.intentDocumentId))
        .limit(1);
      if (!intentDocument || intentDocument.docType !== "payment_intent") {
        throw new DocumentValidationError(
          `payment_intent not found: ${input.intentDocumentId}`,
        );
      }
    },
    async canEdit() {},
    async canSubmit() {},
    async canApprove() {},
    async canReject() {},
    async canCancel() {},
    async canPost(context, document) {
      const payload = parseDocumentPayload(
        PaymentResolutionPayloadSchema,
        document,
      );
      const dependency = await getDependencyDocument(context.db, document.id);
      if (!dependency || dependency.id !== payload.intentDocumentId) {
        throw new DocumentGraphError(
          `payment_resolution must have depends_on link to payment_intent ${payload.intentDocumentId}`,
        );
      }
      if (dependency.docType !== "payment_intent") {
        throw new DocumentValidationError(
          "Dependency must point to a payment_intent document",
        );
      }
      if (dependency.postingStatus !== "posted") {
        throw new DocumentValidationError(
          "payment_intent must be posted before payment_resolution",
        );
      }

      await ensureNoPendingResolution(context.db, dependency.id);
      const pendingTransfers = await getPendingTransferIdsForDocument(
        context.db,
        dependency.id,
      );
      if (pendingTransfers.length === 0) {
        throw new DocumentValidationError(
          "payment_intent is missing pending transfer identifiers",
        );
      }
    },
    async buildPostingPlan(context, document) {
      const payload = parseDocumentPayload(
        PaymentResolutionPayloadSchema,
        document,
      );
      const dependency = await getDependencyDocument(context.db, document.id);
      if (!dependency) {
        throw new DocumentValidationError(
          "payment_resolution is missing dependency payment_intent",
        );
      }

      const intentPayload = parseDocumentPayload(
        PaymentIntentPayloadSchema,
        dependency,
      );
      const bindings = await resolveBindings(
        organizationRequisitesService,
        intentPayload,
      );
      const pendingTransfers = await getPendingTransferIdsForDocument(
        context.db,
        dependency.id,
      );

      const templateKey =
        payload.resolutionType === "settle"
          ? POSTING_TEMPLATE_KEY.TRANSFER_PENDING_SETTLE
          : POSTING_TEMPLATE_KEY.TRANSFER_PENDING_VOID;
      const operationCode =
        payload.resolutionType === "settle"
          ? OPERATION_CODE.TRANSFER_SETTLE_PENDING
          : OPERATION_CODE.TRANSFER_VOID_PENDING;

      return buildDocumentPostingPlan({
        operationCode,
        payload: {
          intentDocumentId: payload.intentDocumentId,
          resolutionType: payload.resolutionType,
          eventIdempotencyKey: payload.eventIdempotencyKey,
          externalRef: payload.externalRef ?? null,
        },
        requests: pendingTransfers.map((item, index) =>
          buildDocumentPostingRequest(document, {
            templateKey,
            currency: intentPayload.currency,
            amountMinor: 0n,
            bookId: resolvePendingTransferBookId({
              sourceBookId: bindings.source.bookId,
              destinationBookId: bindings.destination.bookId,
              pendingRef: item.pendingRef,
              buildAmbiguousPendingRefMessage: (pendingRef) =>
                `Pending transfer reference is missing routing book for ${pendingRef ?? "unknown ref"}`,
            }),
            dimensions: {},
            refs: {
              intentDocumentId: payload.intentDocumentId,
              eventIdempotencyKey: payload.eventIdempotencyKey,
              pendingIndex: String(index + 1),
            },
            pending: {
              pendingId: item.pendingId,
              amountMinor: 0n,
            },
            memo: payload.externalRef ?? null,
          }),
        ),
      });
    },
    async buildInitialLinks(_context, document) {
      const payload = parseDocumentPayload(
        PaymentResolutionPayloadSchema,
        document,
      );
      return [
        {
          toDocumentId: payload.intentDocumentId,
          linkType: "depends_on",
        },
      ];
    },
    buildPostIdempotencyKey(document) {
      return buildDocumentPostIdempotencyKey(document);
    },
    resolveAccountingSourceId(_context, document) {
      parseDocumentPayload(PaymentResolutionPayloadSchema, document);
      return ACCOUNTING_SOURCE_ID.PAYMENT_CASE;
    },
  };
}
