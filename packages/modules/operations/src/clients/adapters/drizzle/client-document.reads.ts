import { desc, eq } from "drizzle-orm";

import type { Queryable } from "@bedrock/platform/persistence";

import { opsClientDocuments } from "../../../infra/drizzle/schema";
import type { ClientDocument } from "../../application/contracts/document-dto";
import type { ClientDocumentReads } from "../../application/ports/client-document.reads";

export class DrizzleClientDocumentReads implements ClientDocumentReads {
  constructor(private readonly db: Queryable) {}

  async listByClientId(clientId: number): Promise<ClientDocument[]> {
    const rows = await this.db
      .select()
      .from(opsClientDocuments)
      .where(eq(opsClientDocuments.clientId, clientId))
      .orderBy(desc(opsClientDocuments.createdAt));
    return rows as unknown as ClientDocument[];
  }

  async findById(id: number): Promise<ClientDocument | null> {
    const [row] = await this.db
      .select()
      .from(opsClientDocuments)
      .where(eq(opsClientDocuments.id, id))
      .limit(1);
    return (row as unknown as ClientDocument) ?? null;
  }
}
