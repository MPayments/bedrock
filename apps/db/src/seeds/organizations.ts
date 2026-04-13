import { eq } from "drizzle-orm";
import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";

import { S3ObjectStorageAdapter } from "@bedrock/platform/object-storage";
import { noopLogger } from "@bedrock/platform/observability";

import type { Database, Transaction } from "../client";
import { schema } from "../schema-registry";
import { ORGANIZATIONS } from "./fixtures";

export { ORGANIZATION_IDS } from "./fixtures";

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
      `[seed:organizations] Expected PNG asset, got ${input.fileName}`,
    );
  }

  const buffer = await readFile(resolve(ORGANIZATION_ASSETS_DIR, input.fileName));
  await input.objectStorage.upload(input.key, buffer, "image/png");
  return input.key;
}

export async function seedOrganizations(db: Database | Transaction) {
  const objectStorage = createSeedObjectStorage();
  const uploadAssets = Boolean(objectStorage);
  let seededFilesCount = 0;

  if (!uploadAssets) {
    const organizationsWithAssets = ORGANIZATIONS.filter(
      (organization) =>
        organization.signatureAssetFileName || organization.sealAssetFileName,
    ).length;

    if (organizationsWithAssets > 0) {
      console.warn(
        `[seed:organizations] S3 storage is not configured; seeding ${organizationsWithAssets} organizations without signature/seal files`,
      );
    }
  }

  for (const organization of ORGANIZATIONS) {
    const signatureKey =
      organization.signatureAssetFileName && objectStorage
        ? await uploadOrganizationAsset({
            fileName: organization.signatureAssetFileName,
            key: `organizations/${organization.id}/signature.png`,
            objectStorage,
          })
        : null;
    const sealKey =
      organization.sealAssetFileName && objectStorage
        ? await uploadOrganizationAsset({
            fileName: organization.sealAssetFileName,
            key: `organizations/${organization.id}/seal.png`,
            objectStorage,
          })
        : null;

    if (signatureKey || sealKey) {
      seededFilesCount += 1;
    }

    const organizationUpdateSet = {
      externalRef: organization.externalRef,
      shortName: organization.shortName,
      fullName: organization.fullName,
      description: organization.description ?? null,
      kind: organization.kind,
      country: organization.country ?? null,
      isActive: true,
      ...(uploadAssets ? { signatureKey, sealKey } : {}),
    };

    await db
      .insert(schema.organizations)
      .values({
        id: organization.id,
        externalRef: organization.externalRef,
        shortName: organization.shortName,
        fullName: organization.fullName,
        description: organization.description ?? null,
        kind: organization.kind,
        country: organization.country ?? null,
        isActive: true,
        signatureKey,
        sealKey,
      })
      .onConflictDoUpdate({
        target: schema.organizations.id,
        set: organizationUpdateSet,
      });

    const [profile] = await db
      .insert(schema.partyProfiles)
      .values({
        organizationId: organization.id,
        counterpartyId: null,
        fullName: organization.fullName,
        shortName: organization.shortName,
        fullNameI18n: organization.fullNameI18n ?? null,
        shortNameI18n: organization.shortNameI18n ?? null,
        legalFormCode: organization.orgType ?? null,
        legalFormLabel: organization.orgType ?? null,
        legalFormLabelI18n: organization.orgTypeI18n ?? null,
        countryCode: organization.country ?? null,
        businessActivityCode: null,
        businessActivityText: organization.description ?? null,
        businessActivityTextI18n: null,
      })
      .onConflictDoUpdate({
        target: schema.partyProfiles.organizationId,
        set: {
          fullName: organization.fullName,
          shortName: organization.shortName,
          fullNameI18n: organization.fullNameI18n ?? null,
          shortNameI18n: organization.shortNameI18n ?? null,
          legalFormCode: organization.orgType ?? null,
          legalFormLabel: organization.orgType ?? null,
          legalFormLabelI18n: organization.orgTypeI18n ?? null,
          countryCode: organization.country ?? null,
          businessActivityCode: null,
          businessActivityText: organization.description ?? null,
          businessActivityTextI18n: null,
        },
      })
      .returning({ id: schema.partyProfiles.id });
    const profileId = profile?.id;
    if (!profileId) {
      throw new Error(
        `[seed:organizations] Failed to upsert legal profile for ${organization.id}`,
      );
    }

    await db
      .delete(schema.partyIdentifiers)
      .where(eq(schema.partyIdentifiers.partyProfileId, profileId));
    await db
      .delete(schema.partyAddresses)
      .where(eq(schema.partyAddresses.partyProfileId, profileId));
    await db
      .delete(schema.partyContacts)
      .where(eq(schema.partyContacts.partyProfileId, profileId));
    await db
      .delete(schema.partyRepresentatives)
      .where(eq(schema.partyRepresentatives.partyProfileId, profileId));
    await db
      .delete(schema.partyLicenses)
      .where(eq(schema.partyLicenses.partyProfileId, profileId));

    const identifiers = [
      organization.inn
        ? {
            partyProfileId: profileId,
            scheme: "inn",
            value: organization.inn,
            normalizedValue: organization.inn,
          }
        : null,
      organization.taxId
        ? {
            partyProfileId: profileId,
            scheme: "tax_id",
            value: organization.taxId,
            normalizedValue: organization.taxId,
          }
        : null,
      organization.kpp
        ? {
            partyProfileId: profileId,
            scheme: "kpp",
            value: organization.kpp,
            normalizedValue: organization.kpp,
          }
        : null,
    ].filter((item) => item !== null);

    if (identifiers.length > 0) {
      await db.insert(schema.partyIdentifiers).values(identifiers);
    }

    if (organization.address) {
      await db.insert(schema.partyAddresses).values({
        partyProfileId: profileId,
        countryCode: organization.country ?? null,
        postalCode: null,
        city: organization.city ?? null,
        cityI18n: organization.cityI18n ?? null,
        streetAddress: null,
        streetAddressI18n: null,
        addressDetails: null,
        addressDetailsI18n: null,
        fullAddress: organization.address,
        fullAddressI18n: organization.addressI18n ?? null,
      });
    }

    if (organization.directorName) {
      await db.insert(schema.partyRepresentatives).values({
        partyProfileId: profileId,
        role: "director",
        fullName: organization.directorName,
        fullNameI18n: organization.directorNameI18n ?? null,
        title: organization.directorTitle ?? null,
        titleI18n: organization.directorTitleI18n ?? null,
        basisDocument: organization.directorBasis ?? null,
        basisDocumentI18n: organization.directorBasisI18n ?? null,
        isPrimary: true,
      });
    }
  }

  console.log(
    `[seed:organizations] Seeded ${ORGANIZATIONS.length} organizations (${seededFilesCount} with signature/seal files)`,
  );
}
