import { z } from "@hono/zod-openapi";

import type { FileAttachment } from "@bedrock/files/contracts";

export const CustomerFileAttachmentSchema = z.object({
  id: z.string().uuid(),
  fileName: z.string(),
  fileSize: z.number().int(),
  mimeType: z.string(),
  uploadedBy: z.string().nullable(),
  description: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export function serializeCustomerFileAttachment(
  file: FileAttachment,
): z.infer<typeof CustomerFileAttachmentSchema> {
  return {
    id: file.id,
    fileName: file.fileName,
    fileSize: file.fileSize,
    mimeType: file.mimeType,
    uploadedBy: file.uploadedBy,
    description: file.description,
    createdAt: file.createdAt.toISOString(),
    updatedAt: file.updatedAt.toISOString(),
  };
}
