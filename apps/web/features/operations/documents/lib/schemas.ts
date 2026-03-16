import { z } from "zod";

import { createPaginatedResponseSchema } from "@/lib/api/schemas";
import { OperationDetailsSchema } from "@/features/operations/journal/lib/queries";

export const DocumentSchema = z.object({
  id: z.uuid(),
  docType: z.string(),
  docNo: z.string(),
  payloadVersion: z.number().int(),
  payload: z.record(z.string(), z.unknown()),
  title: z.string(),
  occurredAt: z.iso.datetime(),
  submissionStatus: z.enum(["draft", "submitted"]),
  approvalStatus: z.enum(["not_required", "pending", "approved", "rejected"]),
  postingStatus: z.enum([
    "not_required",
    "unposted",
    "posting",
    "posted",
    "failed",
  ]),
  lifecycleStatus: z.enum(["active", "cancelled"]),
  allowedActions: z.array(
    z.enum(["edit", "submit", "approve", "reject", "post", "cancel", "repost"]),
  ),
  createIdempotencyKey: z.string().nullable(),
  amount: z.string().nullable(),
  currency: z.string().nullable(),
  memo: z.string().nullable(),
  counterpartyId: z.string().nullable(),
  customerId: z.string().nullable(),
  organizationRequisiteId: z.string().nullable(),
  searchText: z.string(),
  createdBy: z.string(),
  submittedBy: z.string().nullable(),
  submittedAt: z.iso.datetime().nullable(),
  approvedBy: z.string().nullable(),
  approvedAt: z.iso.datetime().nullable(),
  rejectedBy: z.string().nullable(),
  rejectedAt: z.iso.datetime().nullable(),
  cancelledBy: z.string().nullable(),
  cancelledAt: z.iso.datetime().nullable(),
  postingStartedAt: z.iso.datetime().nullable(),
  postedAt: z.iso.datetime().nullable(),
  postingError: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  version: z.number().int(),
  postingOperationId: z.string().nullable(),
});

export const DocumentLinkSchema = z.object({
  id: z.uuid(),
  fromDocumentId: z.uuid(),
  toDocumentId: z.uuid(),
  linkType: z.enum(["parent", "depends_on", "compensates", "related"]),
  role: z.string().nullable(),
  createdAt: z.iso.datetime(),
});

export const DocumentOperationSchema = z.object({
  id: z.uuid(),
  documentId: z.uuid(),
  operationId: z.uuid(),
  kind: z.string(),
  createdAt: z.iso.datetime(),
});

export const DocumentsListResponseSchema =
  createPaginatedResponseSchema(DocumentSchema);

export const DocumentDetailsSchema = z.object({
  document: DocumentSchema,
  links: z.array(DocumentLinkSchema),
  parent: DocumentSchema.nullable(),
  children: z.array(DocumentSchema),
  dependsOn: z.array(DocumentSchema),
  compensates: z.array(DocumentSchema),
  documentOperations: z.array(DocumentOperationSchema),
  ledgerOperations: z.array(OperationDetailsSchema.nullable()),
  computed: z.unknown().optional(),
  extra: z.unknown().optional(),
});

export type DocumentDto = z.infer<typeof DocumentSchema>;
export type DocumentLinkDto = z.infer<typeof DocumentLinkSchema>;
export type DocumentOperationDto = z.infer<typeof DocumentOperationSchema>;
export type DocumentsListResponseDto = z.infer<typeof DocumentsListResponseSchema>;
export type DocumentDetailsDto = z.infer<typeof DocumentDetailsSchema>;
