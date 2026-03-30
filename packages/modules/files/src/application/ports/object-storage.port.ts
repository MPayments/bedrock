export interface ObjectStoragePort {
  upload(key: string, data: Buffer, contentType: string): Promise<string>;
  getSignedUrl(key: string, expiresInSeconds?: number): Promise<string>;
  queueForDeletion(key: string): Promise<void>;
}
