import type { DealDocument } from "../contracts/dto";

export interface UploadDealDocumentInput {
  dealId: number;
  fileName: string;
  fileSize: number;
  mimeType: string;
  s3Key: string;
  uploadedBy: number;
  description?: string | null;
}

export interface DealDocumentStore {
  create(input: UploadDealDocumentInput): Promise<DealDocument>;
  delete(id: number): Promise<void>;
}
