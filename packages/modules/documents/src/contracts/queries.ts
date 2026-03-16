import { z } from "zod";

import {
  createListQuerySchemaFromContract,
  type ListQueryContract,
} from "@bedrock/shared/core/pagination";

import {
  DOCUMENT_APPROVAL_STATUSES,
  DOCUMENT_LIFECYCLE_STATUSES,
  DOCUMENT_POSTING_STATUSES,
  DOCUMENT_SUBMISSION_STATUSES,
} from "./zod";

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
  organizationRequisiteId: { kind: "string"; cardinality: "multi" };
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
    organizationRequisiteId: { kind: "string", cardinality: "multi" },
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
