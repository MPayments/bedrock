import { describe, expect, it, vi } from "vitest";

const uploadMock = vi.fn(async () => undefined);

vi.mock("@bedrock/platform/object-storage", () => ({
  S3ObjectStorageAdapter: vi.fn(function MockS3ObjectStorageAdapter() {
    return {
      upload: uploadMock,
    };
  }),
}));

import { schema } from "../../src/schema-registry";
import { seedOrganizationAssets } from "../../src/seeds/organization-assets";

describe("seedOrganizationAssets", () => {
  it("uploads organization files to S3 and backfills keys without reseeding organizations", async () => {
    const originalS3Endpoint = process.env.S3_ENDPOINT;
    const originalS3AccessKey = process.env.S3_ACCESS_KEY;
    const originalS3SecretKey = process.env.S3_SECRET_KEY;

    process.env.S3_ENDPOINT = "http://bedrock-rustfs:9000";
    process.env.S3_ACCESS_KEY = "rustfsadmin";
    process.env.S3_SECRET_KEY = "rustfsadmin";

    const updateSets: Record<string, unknown>[] = [];

    const db = {
      update: vi.fn((table: unknown) => {
        expect(table).toBe(schema.organizations);

        return {
          set: vi.fn((values: Record<string, unknown>) => {
            updateSets.push(values);

            return {
              where: vi.fn(async () => undefined),
            };
          }),
        };
      }),
    };

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    try {
      await expect(seedOrganizationAssets(db as never)).resolves.toBeUndefined();

      expect(uploadMock).toHaveBeenCalledTimes(4);
      expect(updateSets).toEqual([
        {
          sealKey: "organizations/00000000-0000-4000-8000-000000000310/seal.png",
          signatureKey:
            "organizations/00000000-0000-4000-8000-000000000310/signature.png",
        },
        {
          sealKey: "organizations/00000000-0000-4000-8000-000000000320/seal.png",
          signatureKey:
            "organizations/00000000-0000-4000-8000-000000000320/signature.png",
        },
      ]);
      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      uploadMock.mockClear();
      logSpy.mockRestore();
      warnSpy.mockRestore();

      if (originalS3Endpoint === undefined) {
        delete process.env.S3_ENDPOINT;
      } else {
        process.env.S3_ENDPOINT = originalS3Endpoint;
      }

      if (originalS3AccessKey === undefined) {
        delete process.env.S3_ACCESS_KEY;
      } else {
        process.env.S3_ACCESS_KEY = originalS3AccessKey;
      }

      if (originalS3SecretKey === undefined) {
        delete process.env.S3_SECRET_KEY;
      } else {
        process.env.S3_SECRET_KEY = originalS3SecretKey;
      }
    }
  });
});
