import { z } from "zod";

export const CreateDocumentInputSchema = z.object({
  createIdempotencyKey: z.string().trim().min(1).max(255),
  input: z.unknown(),
});

export const UpdateDocumentInputSchema = z.object({
  input: z.unknown(),
});

export type CreateDocumentInput = z.infer<typeof CreateDocumentInputSchema>;
export type UpdateDocumentInput = z.infer<typeof UpdateDocumentInputSchema>;
