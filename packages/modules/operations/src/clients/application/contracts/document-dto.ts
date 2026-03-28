import { z } from "zod";

export const ClientDocumentSchema = z.object({
  id: z.number().int(),
  clientId: z.number().int(),
  fileName: z.string(),
  fileSize: z.number().int(),
  mimeType: z.string(),
  s3Key: z.string(),
  uploadedBy: z.string().nullable(),
  description: z.string().nullable(),
  createdAt: z.string(),
});

export type ClientDocument = z.infer<typeof ClientDocumentSchema>;

export const UploadClientDocumentInputSchema = z.object({
  clientId: z.number().int(),
  fileName: z.string().min(1),
  fileSize: z.number().int().positive(),
  mimeType: z.string().min(1),
  s3Key: z.string().min(1),
  uploadedBy: z.string().nullable(),
  description: z.string().nullable().optional(),
});

export type UploadClientDocumentInput = z.infer<
  typeof UploadClientDocumentInputSchema
>;
