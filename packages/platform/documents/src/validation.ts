import { z } from "zod";

import {
  createListQuerySchemaFromContract,
  type ListQueryContract,
} from "@bedrock/kernel/pagination";

import { DocumentValidationError } from "./errors";

export const DOCUMENT_SUBMISSION_STATUSES = ["draft", "submitted"] as const;
export const DOCUMENT_APPROVAL_STATUSES = [
  "not_required",
  "pending",
  "approved",
  "rejected",
] as const;
export const DOCUMENT_POSTING_STATUSES = [
  "not_required",
  "unposted",
  "posting",
  "posted",
  "failed",
] as const;
export const DOCUMENT_LIFECYCLE_STATUSES = [
  "active",
  "cancelled",
  "voided",
  "archived",
] as const;

export const CreateDocumentInputSchema = z.object({
  createIdempotencyKey: z.string().trim().min(1).max(255),
  input: z.unknown(),
});

export const UpdateDocumentInputSchema = z.object({
  input: z.unknown(),
});

const DOCUMENTS_SORTABLE_COLUMNS = [
  "createdAt",
  "occurredAt",
  "updatedAt",
  "postedAt",
] as const;

interface DocumentsFilters {
  query: { kind: "string"; cardinality: "single" };
  docType: { kind: "string"; cardinality: "multi" };
  submissionStatus: {
    kind: "string";
    cardinality: "multi";
    enumValues: typeof DOCUMENT_SUBMISSION_STATUSES;
  };
  approvalStatus: {
    kind: "string";
    cardinality: "multi";
    enumValues: typeof DOCUMENT_APPROVAL_STATUSES;
  };
  postingStatus: {
    kind: "string";
    cardinality: "multi";
    enumValues: typeof DOCUMENT_POSTING_STATUSES;
  };
  lifecycleStatus: {
    kind: "string";
    cardinality: "multi";
    enumValues: typeof DOCUMENT_LIFECYCLE_STATUSES;
  };
  currency: { kind: "string"; cardinality: "multi" };
  counterpartyId: { kind: "string"; cardinality: "multi" };
  customerId: { kind: "string"; cardinality: "multi" };
  operationalAccountId: { kind: "string"; cardinality: "multi" };
  occurredAtFrom: { kind: "string"; cardinality: "single" };
  occurredAtTo: { kind: "string"; cardinality: "single" };
}

export const DOCUMENTS_LIST_CONTRACT: ListQueryContract<
  typeof DOCUMENTS_SORTABLE_COLUMNS,
  DocumentsFilters
> = {
  sortableColumns: DOCUMENTS_SORTABLE_COLUMNS,
  defaultSort: { id: "occurredAt", desc: true },
  filters: {
    query: { kind: "string", cardinality: "single" },
    docType: { kind: "string", cardinality: "multi" },
    submissionStatus: {
      kind: "string",
      cardinality: "multi",
      enumValues: DOCUMENT_SUBMISSION_STATUSES,
    },
    approvalStatus: {
      kind: "string",
      cardinality: "multi",
      enumValues: DOCUMENT_APPROVAL_STATUSES,
    },
    postingStatus: {
      kind: "string",
      cardinality: "multi",
      enumValues: DOCUMENT_POSTING_STATUSES,
    },
    lifecycleStatus: {
      kind: "string",
      cardinality: "multi",
      enumValues: DOCUMENT_LIFECYCLE_STATUSES,
    },
    currency: { kind: "string", cardinality: "multi" },
    counterpartyId: { kind: "string", cardinality: "multi" },
    customerId: { kind: "string", cardinality: "multi" },
    operationalAccountId: { kind: "string", cardinality: "multi" },
    occurredAtFrom: { kind: "string", cardinality: "single" },
    occurredAtTo: { kind: "string", cardinality: "single" },
  },
};

export const ListDocumentsQuerySchema = createListQuerySchemaFromContract(
  DOCUMENTS_LIST_CONTRACT,
).extend({
  occurredAtFrom: z.iso.datetime().optional(),
  occurredAtTo: z.iso.datetime().optional(),
});

export type ListDocumentsQuery = z.infer<typeof ListDocumentsQuerySchema>;

export function validateInput<T>(
  schema: z.ZodSchema<T>,
  input: unknown,
  context?: string,
): T {
  const result = schema.safeParse(input);

  if (!result.success) {
    const issue = result.error.issues[0];
    const path = issue?.path?.join(".");
    const prefix = context ? `${context}: ` : "";
    throw new DocumentValidationError(
      path
        ? `${prefix}${path}: ${issue?.message ?? result.error.message}`
        : `${prefix}${issue?.message ?? result.error.message}`,
    );
  }

  return result.data;
}
