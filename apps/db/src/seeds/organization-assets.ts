import { eq } from "drizzle-orm";
import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";

import { S3ObjectStorageAdapter } from "@bedrock/platform/object-storage";
import { noopLogger } from "@bedrock/platform/observability";

import type { Database, Transaction } from "../client";
import { schema } from "../schema-registry";
import { ORGANIZATIONS } from "./fixtures";

const ORGANIZATION_ASSETS_DIR = resolve(
  import.meta.dirname,
  "assets",
  "organizations",
);

function createSeedObjectStorage() {
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

async function uploadOrganizationAsset(input: {
  fileName: string;
  key: string;
  objectStorage: S3ObjectStorageAdapter;
}) {
  if (extname(input.fileName).toLowerCase() !== ".png") {
    throw new Error(
      `[seed:organization-assets] Expected PNG asset, got ${input.fileName}`,
    );
  }

  const buffer = await readFile(resolve(ORGANIZATION_ASSETS_DIR, input.fileName));
  await input.objectStorage.upload(input.key, buffer, "image/png");
  return input.key;
}

export async function seedOrganizationAssets(db: Database | Transaction) {
  const objectStorage = createSeedObjectStorage();

  if (!objectStorage) {
    console.warn(
      "[seed:organization-assets] S3 storage is not configured; skipping organization signature/seal upload",
    );
    return;
  }

  let updatedOrganizations = 0;

  for (const organization of ORGANIZATIONS) {
    const signatureKey = organization.signatureAssetFileName
      ? await uploadOrganizationAsset({
          fileName: organization.signatureAssetFileName,
          key: `organizations/${organization.id}/signature.png`,
          objectStorage,
        })
      : null;
    const sealKey = organization.sealAssetFileName
      ? await uploadOrganizationAsset({
          fileName: organization.sealAssetFileName,
          key: `organizations/${organization.id}/seal.png`,
          objectStorage,
        })
      : null;

    if (!signatureKey && !sealKey) {
      continue;
    }

    await db
      .update(schema.organizations)
      .set({
        ...(signatureKey ? { signatureKey } : {}),
        ...(sealKey ? { sealKey } : {}),
      })
      .where(eq(schema.organizations.id, organization.id));

    updatedOrganizations += 1;
  }

  console.log(
    `[seed:organization-assets] Uploaded and backfilled files for ${updatedOrganizations} organizations`,
  );
}
