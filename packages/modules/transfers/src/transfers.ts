import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import {
  DOCUMENT_MODULE_ID,
  OPERATION_CODE,
  POSTING_TEMPLATE_KEY,
} from "@bedrock/accounting-contracts";
import { schema } from "@bedrock/db/schema";
import type { DocumentModule } from "@bedrock/documents";
import {
  DocumentGraphError,
  DocumentValidationError,
} from "@bedrock/documents";
import {
  amountMinorSchema,
  buildDocumentDraft,
  buildDocumentPostIdempotencyKey,
  parseDocumentPayload,
  serializeOccurredAt,
} from "@bedrock/documents/module-kit";
import {
  buildDocumentPostingPlan,
  buildDocumentPostingRequest,
} from "@bedrock/documents/module-kit";
import { DAY_IN_SECONDS } from "@bedrock/kernel/constants";

const TransferCreateSchema = z.object({
  sourceOperationalAccountId: z.uuid(),
  destinationOperationalAccountId: z.uuid(),
  amountMinor: amountMinorSchema,
  memo: z.string().max(1000).optional(),
  settlementMode: z.enum(["immediate", "pending"]).default("immediate"),
  timeoutSeconds: z.coerce
    .number()
    .int()
    .positive()
    .max(7 * 24 * 60 * 60)
    .optional(),
  occurredAt: z.coerce.date(),
});

const TransferPayloadSchema = TransferCreateSchema.extend({
  currency: z.string().min(2).max(16),
  kind: z.enum(["intra_org", "cross_org"]),
  sourceCounterpartyId: z.uuid(),
  destinationCounterpartyId: z.uuid(),
  sourceBookId: z.uuid().optional(),
  destinationBookId: z.uuid().optional(),
});

const TransferPendingActionSchema = z.object({
  transferDocumentId: z.uuid(),
  eventIdempotencyKey: z.string().trim().min(1).max(255),
  externalRef: z.string().max(255).optional(),
  occurredAt: z.coerce.date(),
});

type TransferPayload = z.infer<typeof TransferPayloadSchema>;
type TransferPendingActionPayload = z.infer<typeof TransferPendingActionSchema>;

interface TransferAccountBinding {
  accountId: string;
  bookId: string;
  counterpartyId: string;
  currencyId: string;
  currencyCode: string;
  stableKey: string;
}

interface TransferOperationalAccountsService {
  resolveTransferBindings: (input: {
    accountIds: string[];
  }) => Promise<TransferAccountBinding[]>;
}

function normalizeTransferPayload(payload: TransferPayload) {
  return {
    ...serializeOccurredAt(payload),
    memo: payload.memo ?? null,
  };
}

function normalizeTransferPendingActionPayload(
  payload: TransferPendingActionPayload,
) {
  return {
    ...serializeOccurredAt(payload),
    externalRef: payload.externalRef ?? null,
  };
}

async function getAvailableBalanceByOperationalAccount(
  db: Parameters<DocumentModule["canPost"]>[0]["db"],
  operationalAccountId: string,
  currency: string,
): Promise<bigint> {
  const rows = await db
    .select({
      available: sql<string>`coalesce(sum(${schema.balancePositions.available}), 0)::text`,
    })
    .from(schema.balancePositions)
    .where(
      and(
        eq(schema.balancePositions.subjectType, "operational_account"),
        eq(schema.balancePositions.subjectId, operationalAccountId),
        eq(schema.balancePositions.currency, currency),
      ),
    );

  return BigInt(rows[0]?.available ?? "0");
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

async function resolveTransferBookIds(
  operationalAccountsService: TransferOperationalAccountsService,
  payload: Pick<
    TransferPayload,
    | "sourceOperationalAccountId"
    | "destinationOperationalAccountId"
    | "sourceBookId"
    | "destinationBookId"
  >,
) {
  if (payload.sourceBookId && payload.destinationBookId) {
    return {
      sourceBookId: payload.sourceBookId,
      destinationBookId: payload.destinationBookId,
    };
  }

  const [sourceBinding, destinationBinding] =
    await operationalAccountsService.resolveTransferBindings({
      accountIds: [
        payload.sourceOperationalAccountId,
        payload.destinationOperationalAccountId,
      ],
    });

  const source = requireBinding(sourceBinding, "Source");
  const destination = requireBinding(destinationBinding, "Destination");

  return {
    sourceBookId: source.bookId,
    destinationBookId: destination.bookId,
  };
}

function resolvePendingTransferBookId(input: {
  kind: TransferPayload["kind"];
  sourceBookId: string;
  destinationBookId: string;
  pendingRef?: string | null;
}) {
  if (input.kind === "intra_org") {
    return input.sourceBookId;
  }

  if (input.pendingRef?.endsWith(":source")) {
    return input.sourceBookId;
  }

  if (input.pendingRef?.endsWith(":destination")) {
    return input.destinationBookId;
  }

  throw new DocumentValidationError(
    `Pending transfer reference is missing routing book for ${input.pendingRef ?? "unknown ref"}`,
  );
}

function requireBinding<T>(value: T | undefined, label: string): T {
  if (!value) {
    throw new DocumentValidationError(`${label} binding is missing`);
  }

  return value;
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

async function ensureNoPendingResolution(
  db: Parameters<DocumentModule["canPost"]>[0]["db"],
  transferDocumentId: string,
) {
  const rows = await db
    .select({
      docType: schema.documents.docType,
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
        eq(schema.documentLinks.toDocumentId, transferDocumentId),
        eq(schema.documentLinks.linkType, "depends_on"),
        inArray(schema.documents.docType, ["transfer_settle", "transfer_void"]),
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
      `Transfer ${transferDocumentId} already has a pending resolution document`,
    );
  }
}

export function createTransferDocumentModule(deps: {
  operationalAccountsService: TransferOperationalAccountsService;
}): DocumentModule<
  z.infer<typeof TransferCreateSchema>,
  z.infer<typeof TransferCreateSchema>
> {
  const { operationalAccountsService } = deps;

  function resolveTransferOperationCode(payload: TransferPayload) {
    if (payload.kind === "intra_org") {
      return payload.settlementMode === "pending"
        ? OPERATION_CODE.TRANSFER_APPROVE_PENDING_INTRA
        : OPERATION_CODE.TRANSFER_APPROVE_IMMEDIATE_INTRA;
    }

    return payload.settlementMode === "pending"
      ? OPERATION_CODE.TRANSFER_APPROVE_PENDING_CROSS
      : OPERATION_CODE.TRANSFER_APPROVE_IMMEDIATE_CROSS;
  }

  return {
    moduleId: DOCUMENT_MODULE_ID.TRANSFER,
    docType: "transfer",
    docNoPrefix: "TRN",
    payloadVersion: 1,
    createSchema: TransferCreateSchema,
    updateSchema: TransferCreateSchema,
    payloadSchema: TransferPayloadSchema.transform(normalizeTransferPayload),
    postingRequired: true,
    approvalRequired() {
      return true;
    },
    async createDraft(_context, input) {
      if (
        input.sourceOperationalAccountId ===
        input.destinationOperationalAccountId
      ) {
        throw new DocumentValidationError(
          "sourceOperationalAccountId and destinationOperationalAccountId must be different",
        );
      }

      const [sourceBinding, destinationBinding] =
        await operationalAccountsService.resolveTransferBindings({
          accountIds: [
            input.sourceOperationalAccountId,
            input.destinationOperationalAccountId,
          ],
        });
      const source = requireBinding(sourceBinding, "Source");
      const destination = requireBinding(destinationBinding, "Destination");

      if (source.currencyCode !== destination.currencyCode) {
        throw new DocumentValidationError(
          "Source and destination accounts must have the same currency",
        );
      }

      return buildDocumentDraft(
        input,
        normalizeTransferPayload({
          ...input,
          currency: source.currencyCode,
          kind:
            source.counterpartyId === destination.counterpartyId
              ? "intra_org"
              : "cross_org",
          sourceBookId: source.bookId,
          destinationBookId: destination.bookId,
          sourceCounterpartyId: source.counterpartyId,
          destinationCounterpartyId: destination.counterpartyId,
        }),
      );
    },
    async updateDraft(context, _document, input) {
      return this.createDraft(context, input);
    },
    deriveSummary(document) {
      const payload = parseDocumentPayload(TransferPayloadSchema, document);
      return {
        title: `Transfer ${payload.currency}`,
        amountMinor: BigInt(payload.amountMinor),
        currency: payload.currency,
        memo: payload.memo ?? null,
        counterpartyId: payload.sourceCounterpartyId,
        operationalAccountId: payload.sourceOperationalAccountId,
        searchText: [
          document.docNo,
          payload.currency,
          payload.kind,
          payload.settlementMode,
          payload.memo ?? "",
          payload.sourceOperationalAccountId,
          payload.destinationOperationalAccountId,
          payload.sourceCounterpartyId,
          payload.destinationCounterpartyId,
        ]
          .filter(Boolean)
          .join(" "),
      };
    },
    async canCreate() {},
    async canEdit() {},
    async canSubmit() {},
    async canReject() {},
    async canCancel() {},
    async canApprove(context, document) {
      if (document.createdBy === context.actorUserId) {
        throw new DocumentValidationError(
          "Maker and checker must be different users",
        );
      }
    },
    async canPost(context, document) {
      const payload = parseDocumentPayload(TransferPayloadSchema, document);

      await context.db
        .select({ id: schema.operationalAccounts.id })
        .from(schema.operationalAccounts)
        .where(
          eq(schema.operationalAccounts.id, payload.sourceOperationalAccountId),
        )
        .for("update")
        .limit(1);

      const [sourceBinding, destinationBinding] =
        await operationalAccountsService.resolveTransferBindings({
          accountIds: [
            payload.sourceOperationalAccountId,
            payload.destinationOperationalAccountId,
          ],
        });
      const source = requireBinding(sourceBinding, "Source");
      const destination = requireBinding(destinationBinding, "Destination");

      if (source.currencyCode !== payload.currency) {
        throw new DocumentValidationError(
          `Source currency mismatch: expected ${source.currencyCode}, got ${payload.currency}`,
        );
      }
      if (destination.currencyCode !== payload.currency) {
        throw new DocumentValidationError(
          `Destination currency mismatch: expected ${destination.currencyCode}, got ${payload.currency}`,
        );
      }

      const availableBalance = await getAvailableBalanceByOperationalAccount(
        context.db,
        payload.sourceOperationalAccountId,
        payload.currency,
      );

      if (availableBalance < BigInt(payload.amountMinor)) {
        throw new DocumentValidationError(
          `Insufficient funds on account ${payload.sourceOperationalAccountId}`,
        );
      }
    },
    async buildPostingPlan(_context, document) {
      const payload = parseDocumentPayload(TransferPayloadSchema, document);
      const { sourceBookId, destinationBookId } = await resolveTransferBookIds(
        operationalAccountsService,
        payload,
      );
      const refs = {
        transferDocumentId: document.id,
        settlementMode: payload.settlementMode,
      };
      const requests =
        payload.kind === "intra_org"
          ? [
              buildDocumentPostingRequest(document, {
                templateKey:
                  payload.settlementMode === "pending"
                    ? POSTING_TEMPLATE_KEY.TRANSFER_INTRA_PENDING
                    : POSTING_TEMPLATE_KEY.TRANSFER_INTRA_IMMEDIATE,
                currency: payload.currency,
                amountMinor: BigInt(payload.amountMinor),
                bookId: sourceBookId,
                dimensions: {
                  sourceOperationalAccountId:
                    payload.sourceOperationalAccountId,
                  destinationOperationalAccountId:
                    payload.destinationOperationalAccountId,
                },
                refs,
                pending:
                  payload.settlementMode === "pending"
                    ? {
                        timeoutSeconds:
                          payload.timeoutSeconds ?? DAY_IN_SECONDS,
                        ref: `transfer:${document.id}:source`,
                      }
                    : null,
                memo: payload.memo ?? null,
              }),
            ]
          : [
              buildDocumentPostingRequest(document, {
                templateKey:
                  payload.settlementMode === "pending"
                    ? POSTING_TEMPLATE_KEY.TRANSFER_CROSS_SOURCE_PENDING
                    : POSTING_TEMPLATE_KEY.TRANSFER_CROSS_SOURCE_IMMEDIATE,
                currency: payload.currency,
                amountMinor: BigInt(payload.amountMinor),
                bookId: sourceBookId,
                dimensions: {
                  sourceOperationalAccountId:
                    payload.sourceOperationalAccountId,
                  destinationCounterpartyId: payload.destinationCounterpartyId,
                },
                refs,
                pending:
                  payload.settlementMode === "pending"
                    ? {
                        timeoutSeconds:
                          payload.timeoutSeconds ?? DAY_IN_SECONDS,
                        ref: `transfer:${document.id}:source`,
                      }
                    : null,
                memo: payload.memo ?? null,
              }),
              buildDocumentPostingRequest(document, {
                templateKey:
                  payload.settlementMode === "pending"
                    ? POSTING_TEMPLATE_KEY.TRANSFER_CROSS_DESTINATION_PENDING
                    : POSTING_TEMPLATE_KEY.TRANSFER_CROSS_DESTINATION_IMMEDIATE,
                currency: payload.currency,
                amountMinor: BigInt(payload.amountMinor),
                bookId: destinationBookId,
                dimensions: {
                  destinationOperationalAccountId:
                    payload.destinationOperationalAccountId,
                  sourceCounterpartyId: payload.sourceCounterpartyId,
                },
                refs,
                pending:
                  payload.settlementMode === "pending"
                    ? {
                        timeoutSeconds:
                          payload.timeoutSeconds ?? DAY_IN_SECONDS,
                        ref: `transfer:${document.id}:destination`,
                      }
                    : null,
                memo: payload.memo ?? null,
              }),
            ];

      return buildDocumentPostingPlan({
        operationCode: resolveTransferOperationCode(payload),
        payload: {
          ...payload,
          amountMinor: payload.amountMinor,
          memo: payload.memo ?? null,
        },
        requests,
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

function createTransferResolutionModule(
  deps: {
    operationalAccountsService: TransferOperationalAccountsService;
  },
  eventType: "settle" | "void",
): DocumentModule<TransferPendingActionPayload, TransferPendingActionPayload> {
  const { operationalAccountsService } = deps;
  const docType = eventType === "settle" ? "transfer_settle" : "transfer_void";
  const docNoPrefix = eventType === "settle" ? "TRS" : "TRV";

  return {
    moduleId:
      eventType === "settle"
        ? DOCUMENT_MODULE_ID.TRANSFER_SETTLE
        : DOCUMENT_MODULE_ID.TRANSFER_VOID,
    docType,
    docNoPrefix,
    payloadVersion: 1,
    createSchema: TransferPendingActionSchema,
    updateSchema: TransferPendingActionSchema,
    payloadSchema: TransferPendingActionSchema.transform(
      normalizeTransferPendingActionPayload,
    ),
    postingRequired: true,
    approvalRequired() {
      return false;
    },
    async createDraft(_context, input) {
      return buildDocumentDraft(
        input,
        normalizeTransferPendingActionPayload(input),
      );
    },
    async updateDraft(_context, _document, input) {
      return buildDocumentDraft(
        input,
        normalizeTransferPendingActionPayload(input),
      );
    },
    deriveSummary(document) {
      const payload = parseDocumentPayload(
        TransferPendingActionSchema,
        document,
      );
      return {
        title: `Transfer ${eventType}`,
        memo: payload.externalRef ?? null,
        searchText: [
          document.docNo,
          docType,
          payload.transferDocumentId,
          payload.eventIdempotencyKey,
          payload.externalRef ?? "",
        ]
          .filter(Boolean)
          .join(" "),
      };
    },
    async canCreate() {},
    async canEdit() {},
    async canSubmit() {},
    async canApprove() {},
    async canReject() {},
    async canCancel() {},
    async canPost(context, document) {
      const payload = parseDocumentPayload(
        TransferPendingActionSchema,
        document,
      );
      const dependency = await getDependencyDocument(context.db, document.id);
      if (!dependency || dependency.id !== payload.transferDocumentId) {
        throw new DocumentGraphError(
          `${docType} must have depends_on link to transfer ${payload.transferDocumentId}`,
        );
      }
      if (dependency.docType !== "transfer") {
        throw new DocumentValidationError(
          "Dependency must point to a transfer document",
        );
      }
      if (dependency.postingStatus !== "posted") {
        throw new DocumentValidationError(
          "Transfer must be posted before settle/void",
        );
      }

      const transferPayload = parseDocumentPayload(
        TransferPayloadSchema,
        dependency,
      );

      if (transferPayload.settlementMode !== "pending") {
        throw new DocumentValidationError(
          "settle/void is only allowed for pending transfers",
        );
      }

      const pendingTransfers = await getPendingTransferIdsForDocument(
        context.db,
        dependency.id,
      );
      if (pendingTransfers.length === 0) {
        throw new DocumentValidationError(
          "Pending transfer is missing pending transfer identifiers",
        );
      }

      await ensureNoPendingResolution(context.db, dependency.id);
    },
    async buildPostingPlan(context, document) {
      const payload = parseDocumentPayload(
        TransferPendingActionSchema,
        document,
      );
      const dependency = await getDependencyDocument(context.db, document.id);
      if (!dependency) {
        throw new DocumentValidationError(
          `${docType} is missing dependency transfer`,
        );
      }

      const transferPayload = parseDocumentPayload(
        TransferPayloadSchema,
        dependency,
      );
      const { sourceBookId, destinationBookId } = await resolveTransferBookIds(
        operationalAccountsService,
        transferPayload,
      );
      const pendingTransfers = await getPendingTransferIdsForDocument(
        context.db,
        dependency.id,
      );

      return buildDocumentPostingPlan({
        operationCode:
          eventType === "settle"
            ? OPERATION_CODE.TRANSFER_SETTLE_PENDING
            : OPERATION_CODE.TRANSFER_VOID_PENDING,
        payload: {
          transferDocumentId: dependency.id,
          eventIdempotencyKey: payload.eventIdempotencyKey,
          externalRef: payload.externalRef ?? null,
        },
        requests: pendingTransfers.map((item, index) =>
          buildDocumentPostingRequest(document, {
            templateKey:
              eventType === "settle"
                ? POSTING_TEMPLATE_KEY.TRANSFER_PENDING_SETTLE
                : POSTING_TEMPLATE_KEY.TRANSFER_PENDING_VOID,
            currency: transferPayload.currency,
            amountMinor: 0n,
            bookId: resolvePendingTransferBookId({
              kind: transferPayload.kind,
              sourceBookId,
              destinationBookId,
              pendingRef: item.pendingRef,
            }),
            dimensions: {},
            refs: {
              transferDocumentId: dependency.id,
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
    buildPostIdempotencyKey(document) {
      return buildDocumentPostIdempotencyKey(document);
    },
    async buildInitialLinks(_context, document) {
      const payload = parseDocumentPayload(
        TransferPendingActionSchema,
        document,
      );
      return [
        {
          toDocumentId: payload.transferDocumentId,
          linkType: "depends_on",
        },
      ];
    },
  };
}

export function createTransferSettleDocumentModule(deps: {
  operationalAccountsService: TransferOperationalAccountsService;
}) {
  return createTransferResolutionModule(deps, "settle");
}

export function createTransferVoidDocumentModule(deps: {
  operationalAccountsService: TransferOperationalAccountsService;
}) {
  return createTransferResolutionModule(deps, "void");
}
