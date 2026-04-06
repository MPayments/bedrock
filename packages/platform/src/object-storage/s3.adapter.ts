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

type S3ErrorLike = Error & {
  $metadata?: {
    extendedRequestId?: string;
    httpStatusCode?: number;
    requestId?: string;
  };
  $response?: {
    body?: unknown;
    headers?: unknown;
    statusCode?: number;
  };
  name?: string;
};

const GENERIC_S3_ERROR_MESSAGES = new Set(["UnknownError", "Unknown"]);

export interface S3ObjectStorageConfig {
  endpoint: string;
  publicEndpoint?: string;
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
  private readonly publicClient: S3Client;
  private readonly bucket: string;
  private readonly endpoint: string;
  private readonly publicEndpoint: string;
  private readonly logger: Logger;
  private bucketEnsured = false;

  constructor(config: S3ObjectStorageConfig, logger: Logger) {
    this.bucket = config.bucket;
    this.endpoint = config.endpoint;
    this.publicEndpoint = config.publicEndpoint ?? config.endpoint;
    this.logger = logger.child({ component: "S3ObjectStorageAdapter" });

    this.client = new S3Client({
      endpoint: this.endpoint,
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      forcePathStyle: config.forcePathStyle ?? true,
    });

    this.publicClient = new S3Client({
      endpoint: this.publicEndpoint,
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
      const details = await describeS3Error(error);
      this.logger.error(`Failed to upload file: ${details.summary}`, {
        bucket: this.bucket,
        endpoint: this.endpoint,
        key,
        ...details.meta,
      });
      throw new Error(`Failed to upload file to S3: ${details.summary}`);
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
      const details = await describeS3Error(error);
      this.logger.error(`Failed to download file: ${details.summary}`, {
        bucket: this.bucket,
        endpoint: this.endpoint,
        key,
        ...details.meta,
      });
      throw new Error(`Failed to download file from S3: ${details.summary}`);
    }
  }

  async getSignedUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    await this.ensureBucketExists();

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      return await getSignedUrl(this.publicClient, command, {
        expiresIn: expiresInSeconds,
      });
    } catch (error) {
      const details = await describeS3Error(error);
      this.logger.error(`Failed to generate signed URL: ${details.summary}`, {
        bucket: this.bucket,
        endpoint: this.publicEndpoint,
        key,
        ...details.meta,
      });
      throw new Error(`Failed to generate signed URL: ${details.summary}`);
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
      const details = await describeS3Error(error);
      this.logger.error(`Failed to delete file: ${details.summary}`, {
        bucket: this.bucket,
        endpoint: this.endpoint,
        key,
        ...details.meta,
      });
      throw new Error(`Failed to delete file from S3: ${details.summary}`);
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
          const details = await describeS3Error(createError);
          this.logger.error(`Failed to create S3 bucket: ${details.summary}`, {
            bucket: this.bucket,
            endpoint: this.endpoint,
            ...details.meta,
          });
          throw new Error(`Failed to create S3 bucket: ${details.summary}`);
        }
      } else {
        const details = await describeS3Error(error);
        this.logger.error(`Failed to check S3 bucket: ${details.summary}`, {
          bucket: this.bucket,
          endpoint: this.endpoint,
          ...details.meta,
        });
        throw new Error(`Failed to check S3 bucket: ${details.summary}`);
      }
    }
  }
}

async function describeS3Error(
  error: unknown,
): Promise<{ meta: Record<string, unknown>; summary: string }> {
  const s3Error = error as S3ErrorLike;
  const response = isRecord(s3Error.$response) ? s3Error.$response : undefined;
  const bodyText = await readResponseBody(response?.body);
  const errorCode = extractXmlTag(bodyText, "Code") ?? normalizeErrorCode(s3Error.name);
  const errorMessage =
    extractXmlTag(bodyText, "Message") ?? normalizeErrorMessage(s3Error.message);
  const httpStatusCode =
    s3Error.$metadata?.httpStatusCode ??
    (typeof response?.statusCode === "number" ? response.statusCode : undefined);
  const headers = isRecord(response?.headers) ? response.headers : undefined;
  const requestId =
    normalizeHeaderValue(headers?.["x-amz-request-id"]) ??
    normalizeHeaderValue(headers?.["x-request-id"]) ??
    s3Error.$metadata?.requestId;
  const extendedRequestId =
    normalizeHeaderValue(headers?.["x-amz-id-2"]) ?? s3Error.$metadata?.extendedRequestId;
  const summaryParts = [errorCode ?? "S3Error"];

  if (errorMessage && errorMessage !== errorCode) {
    summaryParts.push(`: ${errorMessage}`);
  }

  const details: string[] = [];

  if (typeof httpStatusCode === "number") {
    details.push(`status=${httpStatusCode}`);
  }

  if (requestId) {
    details.push(`requestId=${requestId}`);
  }

  if (extendedRequestId) {
    details.push(`extendedRequestId=${extendedRequestId}`);
  }

  const responseBody = normalizeResponseBody(bodyText);
  const meta: Record<string, unknown> = {};

  if (errorCode) {
    meta.errorCode = errorCode;
  }

  if (errorMessage) {
    meta.errorMessage = errorMessage;
  }

  if (typeof httpStatusCode === "number") {
    meta.httpStatusCode = httpStatusCode;
  }

  if (requestId) {
    meta.requestId = requestId;
  }

  if (extendedRequestId) {
    meta.extendedRequestId = extendedRequestId;
  }

  if (responseBody) {
    meta.responseBody = responseBody;
  }

  let summary = summaryParts.join("");

  if (details.length > 0) {
    summary += ` (${details.join(" ")})`;
  }

  return { meta, summary };
}

function extractXmlTag(value: string | undefined, tag: string): string | undefined {
  if (!value) {
    return undefined;
  }

  const match = value.match(new RegExp(`<${tag}>([^<]+)</${tag}>`, "i"));
  return match?.[1]?.trim() || undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeErrorCode(value: string | undefined): string | undefined {
  if (!value || value === "Error" || value === "Unknown") {
    return undefined;
  }

  return value;
}

function normalizeErrorMessage(value: string | undefined): string | undefined {
  if (!value || GENERIC_S3_ERROR_MESSAGES.has(value)) {
    return undefined;
  }

  return value;
}

function normalizeHeaderValue(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value) && value.length > 0 && typeof value[0] === "string") {
    return value[0];
  }

  return undefined;
}

function normalizeResponseBody(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return undefined;
  }

  return normalized.length > 500 ? `${normalized.slice(0, 497)}...` : normalized;
}

async function readResponseBody(body: unknown): Promise<string | undefined> {
  if (typeof body === "string") {
    return body;
  }

  if (body instanceof Uint8Array) {
    return Buffer.from(body).toString("utf8");
  }

  if (!(body instanceof Readable) && !isAsyncIterable(body)) {
    return undefined;
  }

  try {
    const chunks: Buffer[] = [];

    for await (const chunk of body) {
      chunks.push(normalizeChunk(chunk));
    }

    return Buffer.concat(chunks).toString("utf8");
  } catch {
    return undefined;
  }
}

function normalizeChunk(chunk: unknown): Buffer {
  if (chunk instanceof Uint8Array) {
    return Buffer.from(chunk);
  }

  return Buffer.from(String(chunk), "utf8");
}

function isAsyncIterable(value: unknown): value is AsyncIterable<unknown> {
  return typeof value === "object" && value !== null && Symbol.asyncIterator in value;
}
