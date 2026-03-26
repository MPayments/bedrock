import type {
  ClientDocument,
  UploadClientDocumentInput,
} from "../contracts/document-dto";

export interface ClientDocumentStore {
  create(input: UploadClientDocumentInput): Promise<ClientDocument>;
  delete(id: number): Promise<void>;
}
