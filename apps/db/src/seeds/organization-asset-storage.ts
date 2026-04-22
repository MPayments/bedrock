import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";

import { S3ObjectStorageAdapter } from "@bedrock/platform/object-storage";
import { noopLogger } from "@bedrock/platform/observability";

const ORGANIZATION_ASSETS_DIR = resolve(
  import.meta.dirname,
  "assets",
  "organizations",
);

export function createSeedObjectStorage() {
  const endpoint = process.env.S3_ENDPOINT;
  const accessKeyId = process.env.S3_ACCESS_KEY;
  const secretAccessKey = process.env.S3_SECRET_KEY;

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    return undefined;
  }

  return new S3ObjectStorageAdapter(
    {
      endpoint,
      publicEndpoint: process.env.S3_PUBLIC_ENDPOINT,
      region: process.env.S3_REGION ?? "us-east-1",
      accessKeyId,
      secretAccessKey,
      bucket: process.env.S3_BUCKET ?? "bedrock-documents",
      forcePathStyle: true,
    },
    noopLogger,
  );
}

export function buildOrganizationAssetKey(input: {
  kind: "seal" | "signature";
  organizationId: string;
}) {
  return `organizations/${input.organizationId}/${input.kind}.png`;
}

export async function uploadOrganizationAsset(input: {
  fileName: string;
  key: string;
  logScope: string;
  objectStorage: S3ObjectStorageAdapter;
}) {
  if (extname(input.fileName).toLowerCase() !== ".png") {
    throw new Error(
      `[${input.logScope}] Expected PNG asset, got ${input.fileName}`,
    );
  }

  const buffer = await readFile(
    resolve(ORGANIZATION_ASSETS_DIR, input.fileName),
  );
  await input.objectStorage.upload(input.key, buffer, "image/png");
  return input.key;
}
