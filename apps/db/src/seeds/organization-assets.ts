import { eq } from "drizzle-orm";

import type { Database, Transaction } from "../client";
import { schema } from "../schema-registry";
import { ORGANIZATIONS } from "./fixtures";
import {
  buildOrganizationAssetKey,
  createSeedObjectStorage,
  uploadOrganizationAsset,
} from "./organization-asset-storage";

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
          key: buildOrganizationAssetKey({
            kind: "signature",
            organizationId: organization.id,
          }),
          logScope: "seed:organization-assets",
          objectStorage,
        })
      : null;
    const sealKey = organization.sealAssetFileName
      ? await uploadOrganizationAsset({
          fileName: organization.sealAssetFileName,
          key: buildOrganizationAssetKey({
            kind: "seal",
            organizationId: organization.id,
          }),
          logScope: "seed:organization-assets",
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
