import { z } from "@hono/zod-openapi";

import type { GeneratedDocument } from "@bedrock/workflow-document-generation";

export const PrintFormFormatQuerySchema = z.object({
  format: z.enum(["docx", "pdf"]).default("pdf"),
});

export function writeGeneratedDocumentResponse(
  c: {
    body: (data: ArrayBuffer) => Response;
    header: (name: string, value: string) => void;
  },
  result: GeneratedDocument,
): Response {
  c.header("Content-Type", result.mimeType);
  c.header("Content-Disposition", `attachment; filename="${result.fileName}"`);
  return c.body(result.buffer as unknown as ArrayBuffer);
}
