import { describe, expect, it, vi } from "vitest";

import { schema } from "../../src/schema-registry";
import { ORGANIZATIONS } from "../../src/seeds/fixtures";
import { seedOrganizations } from "../../src/seeds/organizations";

describe("seedOrganizations", () => {
  it("seeds organizations without S3 and preserves existing asset keys on update", async () => {
    const originalS3Endpoint = process.env.S3_ENDPOINT;
    const originalS3AccessKey = process.env.S3_ACCESS_KEY;
    const originalS3SecretKey = process.env.S3_SECRET_KEY;

    delete process.env.S3_ENDPOINT;
    delete process.env.S3_ACCESS_KEY;
    delete process.env.S3_SECRET_KEY;

    const organizationValues: Record<string, unknown>[] = [];
    const organizationUpdateSets: Record<string, unknown>[] = [];
    let profileInsertCount = 0;

    const db = {
      insert: vi.fn((table: unknown) => ({
        values: vi.fn((values: Record<string, unknown> | Record<string, unknown>[]) => {
          if (table === schema.organizations) {
            organizationValues.push(values as Record<string, unknown>);

            return {
              onConflictDoUpdate: vi.fn(
                async ({ set }: { set: Record<string, unknown> }) => {
                  organizationUpdateSets.push(set);
                  return undefined;
                },
              ),
            };
          }

          if (table === schema.partyProfiles) {
            return {
              onConflictDoUpdate: vi.fn(() => ({
                returning: vi.fn(async () => [
                  { id: `profile-${++profileInsertCount}` },
                ]),
              })),
            };
          }

          return Promise.resolve(undefined);
        }),
      })),
      delete: vi.fn(() => ({
        where: vi.fn(async () => undefined),
      })),
    };

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    try {
      await expect(seedOrganizations(db as never)).resolves.toBeUndefined();

      expect(organizationValues).toHaveLength(ORGANIZATIONS.length);
      expect(
        organizationValues.every(
          (values) => values.signatureKey === null && values.sealKey === null,
        ),
      ).toBe(true);
      expect(
        organizationUpdateSets.every(
          (values) =>
            !Object.hasOwn(values, "signatureKey") &&
            !Object.hasOwn(values, "sealKey"),
        ),
      ).toBe(true);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("S3 storage is not configured"),
      );
    } finally {
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
