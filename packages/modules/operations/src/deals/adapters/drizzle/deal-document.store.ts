import { eq } from "drizzle-orm";

import type { Queryable } from "@bedrock/platform/persistence";

import { opsDealDocuments } from "../../../infra/drizzle/schema";
import type { DealDocument } from "../../application/contracts/dto";
import type { UploadDealDocumentInput } from "../../application/ports/deal-document.store";
import type { DealDocumentStore } from "../../application/ports/deal-document.store";

export class DrizzleDealDocumentStore implements DealDocumentStore {
  constructor(private readonly db: Queryable) {}

  async create(input: UploadDealDocumentInput): Promise<DealDocument> {
    const [row] = await this.db
      .insert(opsDealDocuments)
      .values({
        dealId: input.dealId,
        fileName: input.fileName,
        fileSize: input.fileSize,
        mimeType: input.mimeType,
        s3Key: input.s3Key,
        uploadedBy: input.uploadedBy,
        description: input.description ?? null,
      })
      .returning();
    return row as unknown as DealDocument;
  }

  async delete(id: number): Promise<void> {
    await this.db
      .delete(opsDealDocuments)
      .where(eq(opsDealDocuments.id, id));
  }
}
