import { and, asc, eq, inArray } from "drizzle-orm";

import { DocumentValidationError } from "@bedrock/core/documents";
import { serializeOccurredAt } from "@bedrock/core/documents/module-kit";
import { schema as documentsSchema } from "@bedrock/core/documents/schema";
import { schema as ledgerSchema } from "@bedrock/core/ledger/schema";

import {
  type TransferIntercompanyInput,
  type TransferIntercompanyPayload,
  type TransferIntraInput,
  type TransferIntraPayload,
} from "../../validation";
import type {
  CounterpartyAccountBinding,
  CounterpartyAccountsService,
  IfrsDocumentDb,
} from "./types";

const TRANSFER_DOC_TYPES = ["transfer_intra", "transfer_intercompany"] as const;
const schema = {
  ...documentsSchema,
  ...ledgerSchema,
};

export function normalizeTransferPayload(
  input: TransferIntraInput | TransferIntercompanyInput,
  bindings: {
    source: CounterpartyAccountBinding;
    destination: CounterpartyAccountBinding;
  },
): TransferIntraPayload | TransferIntercompanyPayload {
  return {
    ...serializeOccurredAt(input),
    sourceCounterpartyId: bindings.source.counterpartyId,
    destinationCounterpartyId: bindings.destination.counterpartyId,
    memo: input.memo,
  };
}

export async function resolveTransferBindings(
  counterpartyAccountsService: CounterpartyAccountsService,
  input: {
    sourceCounterpartyAccountId: string;
    destinationCounterpartyAccountId: string;
  },
) {
  const [source, destination] =
    await counterpartyAccountsService.resolveTransferBindings({
      accountIds: [
        input.sourceCounterpartyAccountId,
        input.destinationCounterpartyAccountId,
      ],
    });

  if (!source || !destination) {
    throw new DocumentValidationError("Counterparty account binding is missing");
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

export function resolvePendingTransferBookId(input: {
  sourceBookId: string;
  destinationBookId: string;
  pendingRef?: string | null;
}) {
  if (input.sourceBookId === input.destinationBookId) {
    return input.sourceBookId;
  }

  if (input.pendingRef?.endsWith(":source")) {
    return input.sourceBookId;
  }

  if (input.pendingRef?.endsWith(":destination")) {
    return input.destinationBookId;
  }

  throw new DocumentValidationError(
    `Pending transfer reference is ambiguous: ${input.pendingRef ?? "n/a"}`,
  );
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
