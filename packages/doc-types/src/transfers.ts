import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import {
  ACCOUNT_NO,
  buildTransferApproveTemplate,
  buildTransferPendingActionTemplate,
} from "@bedrock/accounting";
import { schema } from "@bedrock/db/schema";
import type { DocumentModule } from "@bedrock/documents";
import {
  DocumentGraphError,
  DocumentValidationError,
} from "@bedrock/documents";
import {
  DAY_IN_SECONDS,
  SYSTEM_LEDGER_ORG_ID,
} from "@bedrock/kernel/constants";

import {
  amountMinorSchema,
  buildDocumentDraft,
  buildDocumentPostIdempotencyKey,
  parseDocumentPayload,
  serializeOccurredAt,
} from "./internal/document-utils";

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
});

const TransferPendingActionSchema = z.object({
  transferDocumentId: z.uuid(),
  eventIdempotencyKey: z.string().trim().min(1).max(255),
  externalRef: z.string().max(255).optional(),
  occurredAt: z.coerce.date(),
});

type TransferPayload = z.infer<typeof TransferPayloadSchema>;
type TransferPendingActionPayload = z.infer<typeof TransferPendingActionSchema>;

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
  const result = await db.execute(sql`
    SELECT COALESCE(SUM(delta), 0)::text AS balance_minor
    FROM (
      SELECT p.amount_minor AS delta
      FROM ${schema.bookAccountInstances} inst
      JOIN ${schema.postings} p ON p.debit_instance_id = inst.id
      JOIN ${schema.ledgerOperations} lo ON lo.id = p.operation_id
      WHERE inst.account_no = ${ACCOUNT_NO.BANK}
        AND inst.currency = ${currency}
        AND inst.dimensions->>'operationalAccountId' = ${operationalAccountId}
        AND lo.status IN ('pending', 'posted')

      UNION ALL

      SELECT -p.amount_minor AS delta
      FROM ${schema.bookAccountInstances} inst
      JOIN ${schema.postings} p ON p.credit_instance_id = inst.id
      JOIN ${schema.ledgerOperations} lo ON lo.id = p.operation_id
      WHERE inst.account_no = ${ACCOUNT_NO.BANK}
        AND inst.currency = ${currency}
        AND inst.dimensions->>'operationalAccountId' = ${operationalAccountId}
        AND lo.status IN ('pending', 'posted')
    ) t
  `);

  const [row] = result.rows as { balance_minor: string }[];
  return BigInt(row?.balance_minor ?? "0");
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
  operationalAccountsService: {
    resolveTransferBindings: (input: { accountIds: string[] }) => Promise<
      {
        accountId: string;
        counterpartyId: string;
        currencyId: string;
        currencyCode: string;
        stableKey: string;
      }[]
    >;
  };
}): DocumentModule<
  z.infer<typeof TransferCreateSchema>,
  z.infer<typeof TransferCreateSchema>
> {
  const { operationalAccountsService } = deps;

  return {
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
    async buildIntent(_context, document) {
      const payload = parseDocumentPayload(TransferPayloadSchema, document);
      const template = buildTransferApproveTemplate({
        transferId: document.id,
        kind: payload.kind,
        settlementMode: payload.settlementMode,
        amountMinor: BigInt(payload.amountMinor),
        timeoutSeconds: payload.timeoutSeconds ?? DAY_IN_SECONDS,
        memo: payload.memo ?? null,
        source: {
          accountId: payload.sourceOperationalAccountId,
          counterpartyId: payload.sourceCounterpartyId,
          currencyCode: payload.currency,
        },
        destination: {
          accountId: payload.destinationOperationalAccountId,
          counterpartyId: payload.destinationCounterpartyId,
          currencyCode: payload.currency,
        },
      });

      return {
        operationCode: template.operationCode,
        operationVersion: 1,
        bookOrgId: SYSTEM_LEDGER_ORG_ID,
        payload: {
          ...payload,
          amountMinor: payload.amountMinor,
          memo: payload.memo ?? null,
        },
        lines: template.lines,
      };
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
  eventType: "settle" | "void",
): DocumentModule<TransferPendingActionPayload, TransferPendingActionPayload> {
  const docType = eventType === "settle" ? "transfer_settle" : "transfer_void";
  const docNoPrefix = eventType === "settle" ? "TRS" : "TRV";

  return {
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
      const payload = parseDocumentPayload(TransferPendingActionSchema, document);
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
      const payload = parseDocumentPayload(TransferPendingActionSchema, document);
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
    async buildIntent(context, document) {
      const payload = parseDocumentPayload(TransferPendingActionSchema, document);
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
      const pendingTransfers = await getPendingTransferIdsForDocument(
        context.db,
        dependency.id,
      );

      const template = buildTransferPendingActionTemplate({
        transferId: dependency.id,
        eventIdempotencyKey: payload.eventIdempotencyKey,
        eventType,
        currency: transferPayload.currency,
        pendingIds: pendingTransfers.map((item) => item.pendingId),
      });

      return {
        operationCode: template.operationCode,
        operationVersion: 1,
        bookOrgId: SYSTEM_LEDGER_ORG_ID,
        payload: {
          transferDocumentId: dependency.id,
          eventIdempotencyKey: payload.eventIdempotencyKey,
          externalRef: payload.externalRef ?? null,
        },
        lines: template.lines,
      };
    },
    buildPostIdempotencyKey(document) {
      return buildDocumentPostIdempotencyKey(document);
    },
    async buildInitialLinks(_context, document) {
      const payload = parseDocumentPayload(TransferPendingActionSchema, document);
      return [
        {
          toDocumentId: payload.transferDocumentId,
          linkType: "depends_on",
        },
      ];
    },
  };
}

export function createTransferSettleDocumentModule() {
  return createTransferResolutionModule("settle");
}

export function createTransferVoidDocumentModule() {
  return createTransferResolutionModule("void");
}
