import { z } from "@hono/zod-openapi";

import type { FileAttachment } from "@bedrock/files/contracts";
import { NotFoundError } from "@bedrock/shared/core/errors";

import type { AppContext } from "../../context";

export const CompatibilityFileAttachmentSchema = z.object({
  id: z.string().uuid(),
  fileName: z.string(),
  fileSize: z.number().int(),
  mimeType: z.string(),
  uploadedBy: z.string().nullable(),
  description: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const GeneratedDocumentFormatSchema = z
  .enum(["docx", "pdf"])
  .default("docx");

export const GeneratedDocumentLangSchema = z.enum(["ru", "en"]).default("ru");

export function serializeCompatibilityFileAttachment(
  file: FileAttachment,
): z.infer<typeof CompatibilityFileAttachmentSchema> {
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

export async function resolveClientCounterpartyIdOrThrow(
  ctx: AppContext,
  clientId: number,
) {
  const client = await ctx.operationsModule.clients.queries.findById(clientId);

  if (!client || !client.counterpartyId) {
    throw new NotFoundError("Client counterparty", String(clientId));
  }

  return client.counterpartyId;
}

export function resolveGeneratedDealLinkKind(type: "acceptance" | "application" | "invoice") {
  switch (type) {
    case "application":
      return "deal_application" as const;
    case "invoice":
      return "deal_invoice" as const;
    case "acceptance":
      return "deal_acceptance" as const;
  }
}
