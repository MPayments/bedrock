import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Readable } from "node:stream";

import type { Logger } from "@bedrock/platform/observability";

export interface S3ObjectStorageConfig {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  forcePathStyle?: boolean;
}

/**
 * S3-compatible object storage adapter.
 *
 * Implements the ObjectStoragePort interface shape from operations.
 * Platform does not import from modules — composition layers handle type compatibility.
 */
export class S3ObjectStorageAdapter {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly logger: Logger;
  private bucketEnsured = false;

  constructor(config: S3ObjectStorageConfig, logger: Logger) {
    this.bucket = config.bucket;
    this.logger = logger.child({ component: "S3ObjectStorageAdapter" });

    this.client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      forcePathStyle: config.forcePathStyle ?? true,
    });
  }

  async upload(key: string, data: Buffer, contentType: string): Promise<string> {
    await this.ensureBucketExists();

    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: data,
          ContentType: contentType,
        }),
      );
      this.logger.info(`File uploaded successfully: ${key}`);
      return key;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to upload file: ${message}`);
      throw new Error(`Failed to upload file to S3: ${message}`);
    }
  }

  async download(key: string): Promise<Buffer> {
    await this.ensureBucketExists();

    try {
      const response = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );

      const stream = response.Body;

      if (!stream) {
        throw new Error(`Empty response body for key: ${key}`);
      }

      if (stream instanceof Readable) {
        const chunks: Buffer[] = [];
        return new Promise((resolve, reject) => {
          stream.on("data", (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
          stream.on("error", reject);
          stream.on("end", () => resolve(Buffer.concat(chunks)));
        });
      }

      // Fallback for non-Node stream types (e.g. Blob, ReadableStream)
      const bytes = await stream.transformToByteArray();
      return Buffer.from(bytes);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to download file: ${message}`);
      throw new Error(`Failed to download file from S3: ${message}`);
    }
  }

  async getSignedUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    await this.ensureBucketExists();

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      return await getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to generate signed URL: ${message}`);
      throw new Error(`Failed to generate signed URL: ${message}`);
    }
  }

  async delete(key: string): Promise<void> {
    await this.ensureBucketExists();

    try {
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
      this.logger.info(`File deleted successfully: ${key}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to delete file: ${message}`);
      throw new Error(`Failed to delete file from S3: ${message}`);
    }
  }

  async queueForDeletion(key: string): Promise<void> {
    this.logger.info(`Queueing file for deletion (immediate): ${key}`);
    await this.delete(key);
  }

  private async ensureBucketExists(): Promise<void> {
    if (this.bucketEnsured) {
      return;
    }

    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      this.logger.info(`S3 bucket "${this.bucket}" is ready`);
      this.bucketEnsured = true;
    } catch (error: unknown) {
      const s3Error = error as { name?: string; $metadata?: { httpStatusCode?: number } };

      if (s3Error.name === "NotFound" || s3Error.$metadata?.httpStatusCode === 404) {
        this.logger.info(`Creating S3 bucket "${this.bucket}"...`);
        try {
          await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
          this.logger.info(`S3 bucket "${this.bucket}" created successfully`);
          this.bucketEnsured = true;
        } catch (createError) {
          const message = createError instanceof Error ? createError.message : String(createError);
          this.logger.error(`Failed to create S3 bucket: ${message}`);
          throw new Error(`Failed to create S3 bucket: ${message}`);
        }
      } else {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`Failed to check S3 bucket: ${message}`);
        throw new Error(`Failed to check S3 bucket: ${message}`);
      }
    }
  }
}
