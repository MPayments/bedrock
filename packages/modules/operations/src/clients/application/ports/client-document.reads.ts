import type { ClientDocument } from "../contracts/document-dto";

export interface ClientDocumentReads {
  listByClientId(clientId: number): Promise<ClientDocument[]>;
  findById(id: number): Promise<ClientDocument | null>;
}
