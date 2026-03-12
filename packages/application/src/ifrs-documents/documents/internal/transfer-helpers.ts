import { and, asc, eq, inArray } from "drizzle-orm";

import { DocumentValidationError } from "@bedrock/application/documents";
import { serializeOccurredAt } from "@bedrock/application/documents/module-kit";
import { schema as documentsSchema } from "@bedrock/application/documents/schema";
import { schema as ledgerSchema } from "@bedrock/application/ledger/schema";

import type {
  OrganizationRequisiteBinding,
  RequisitesService,
  IfrsDocumentDb,
} from "./types";
import {
  type TransferIntercompanyInput,
  type TransferIntercompanyPayload,
  type TransferIntraInput,
  type TransferIntraPayload,
} from "../../validation";

const TRANSFER_DOC_TYPES = ["transfer_intra", "transfer_intercompany"] as const;
const schema = {
  ...documentsSchema,
  ...ledgerSchema,
};

export { resolvePendingTransferBookId } from "@bedrock/application/documents/module-kit";

export function normalizeTransferIntraPayload(
  input: TransferIntraInput,
  bindings: {
    source: OrganizationRequisiteBinding;
    destination: OrganizationRequisiteBinding;
  }): TransferIntraPayload {
  return {
    ...serializeOccurredAt(input),
    organizationId: bindings.source.organizationId,
    sourceRequisiteId: input.sourceRequisiteId,
    destinationRequisiteId: input.destinationRequisiteId,
    timeoutSeconds: input.timeoutSeconds,
    currency: input.currency,
    amountMinor: input.amountMinor,
    memo: input.memo,
  };
}

export function normalizeTransferIntercompanyPayload(
  input: TransferIntercompanyInput,
  bindings: {
    source: OrganizationRequisiteBinding;
    destination: OrganizationRequisiteBinding;
  },
): TransferIntercompanyPayload {
  return {
    ...serializeOccurredAt(input),
    sourceOrganizationId: bindings.source.organizationId,
    sourceRequisiteId: input.sourceRequisiteId,
    destinationOrganizationId: bindings.destination.organizationId,
    destinationRequisiteId: input.destinationRequisiteId,
    timeoutSeconds: input.timeoutSeconds,
    currency: input.currency,
    amountMinor: input.amountMinor,
    memo: input.memo,
  };
}

export async function resolveTransferBindings(
  requisitesService: RequisitesService,
  input: {
    sourceRequisiteId: string;
    destinationRequisiteId: string;
  },
) {
  const [source, destination] =
    await requisitesService.resolveBindings({
      requisiteIds: [
        input.sourceRequisiteId,
        input.destinationRequisiteId,
      ],
    });

  if (!source || !destination) {
    throw new DocumentValidationError(
      "Organization requisite binding is missing",
    );
  }

  return { source, destination };
}

export function ensureTransferCurrencies(input: {
  payloadCurrency: string;
  sourceCurrency: string;
  destinationCurrency: string;
}) {
  if (
    input.payloadCurrency !== input.sourceCurrency ||
    input.payloadCurrency !== input.destinationCurrency
  ) {
    throw new DocumentValidationError(
      `Currency mismatch: payload=${input.payloadCurrency}, source=${input.sourceCurrency}, destination=${input.destinationCurrency}`,
    );
  }
}

export async function resolveTransferDependencyDocument(
  db: IfrsDocumentDb,
  transferDocumentId: string,
) {
  const [dependency] = await db
    .select({
      document: schema.documents,
    })
    .from(schema.documents)
    .where(
      and(
        eq(schema.documents.id, transferDocumentId),
        inArray(schema.documents.docType, [...TRANSFER_DOC_TYPES]),
      ),
    )
    .limit(1);

  if (!dependency) {
    throw new DocumentValidationError(
      `Transfer document ${transferDocumentId} was not found`,
    );
  }

  return dependency.document;
}

export async function listPendingTransfers(
  db: IfrsDocumentDb,
  transferDocumentId: string,
) {
  const rows = await db
    .select({
      transferId: schema.tbTransferPlans.transferId,
      pendingRef: schema.tbTransferPlans.pendingRef,
      amountMinor: schema.tbTransferPlans.amount,
    })
    .from(schema.documentOperations)
    .innerJoin(
      schema.tbTransferPlans,
      eq(schema.tbTransferPlans.operationId, schema.documentOperations.operationId),
    )
    .where(
      and(
        eq(schema.documentOperations.documentId, transferDocumentId),
        eq(schema.documentOperations.kind, "post"),
        eq(schema.tbTransferPlans.isPending, true),
      ),
    )
    .orderBy(asc(schema.tbTransferPlans.lineNo));

  if (rows.length === 0) {
    throw new DocumentValidationError(
      `Transfer document ${transferDocumentId} does not have pending transfers`,
    );
  }

  return rows;
}
