import { eq } from "drizzle-orm";

import type { Queryable } from "@bedrock/platform/persistence";

import { opsClientDocuments } from "../../../infra/drizzle/schema";
import type { ClientDocument } from "../../application/contracts/document-dto";
import type { UploadClientDocumentInput } from "../../application/contracts/document-dto";
import type { ClientDocumentStore } from "../../application/ports/client-document.store";

export class DrizzleClientDocumentStore implements ClientDocumentStore {
  constructor(private readonly db: Queryable) {}

  async create(input: UploadClientDocumentInput): Promise<ClientDocument> {
    const [row] = await this.db
      .insert(opsClientDocuments)
      .values({
        clientId: input.clientId,
        fileName: input.fileName,
        fileSize: input.fileSize,
        mimeType: input.mimeType,
        s3Key: input.s3Key,
        uploadedBy: input.uploadedBy,
        description: input.description ?? null,
      })
      .returning();
    return row as unknown as ClientDocument;
  }

  async delete(id: number): Promise<void> {
    await this.db
      .delete(opsClientDocuments)
      .where(eq(opsClientDocuments.id, id));
  }
}
