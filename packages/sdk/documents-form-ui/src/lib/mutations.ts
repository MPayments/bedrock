import { z } from "zod";

export const DocumentMutationSchema = z.object({
  id: z.uuid(),
  docType: z.string(),
  docNo: z.string(),
  submissionStatus: z.string().optional(),
  approvalStatus: z.string().optional(),
  postingStatus: z.string().optional(),
  lifecycleStatus: z.string().optional(),
  allowedActions: z
    .array(
      z.enum(["edit", "submit", "approve", "reject", "post", "cancel", "repost"]),
    )
    .optional(),
});

export type DocumentMutationDto = z.infer<typeof DocumentMutationSchema>;

export type DocumentMutationResult<T = DocumentMutationDto> =
  | { ok: true; data: T }
  | { ok: false; message: string };

export type DocumentDraftMutator = (input: {
  payload: unknown;
  idempotencyKey: string;
}) => Promise<DocumentMutationResult>;

export type DocumentUpdateMutator = (input: {
  documentId: string;
  payload: unknown;
}) => Promise<DocumentMutationResult>;

export type DocumentTransitionMutator = (input: {
  docType: string;
  documentId: string;
  payload?: unknown;
  idempotencyKey?: string;
}) => Promise<DocumentMutationResult>;

export interface DocumentTransitionMutators {
  submit?: DocumentTransitionMutator;
  approve?: DocumentTransitionMutator;
  reject?: DocumentTransitionMutator;
  post?: DocumentTransitionMutator;
  cancel?: DocumentTransitionMutator;
  repost?: DocumentTransitionMutator;
}
