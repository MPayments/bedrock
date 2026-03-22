import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";
import { ZodError } from "zod";

import { noopLogger } from "@bedrock/platform/observability/logger";

import { rawPackDefinition } from "../src/packs/bedrock-core-default";
import { createPacksService } from "../src/packs/application";
import { createPeriodsService } from "../src/periods/application";

const runtime = {
  log: noopLogger,
  now: () => new Date("2026-03-01T00:00:00.000Z"),
  generateUuid: randomUUID,
  service: "accounting.validation.test",
} as const;

describe("accounting application validation", () => {
  it("validates pack activation input", async () => {
    const packsService = createPacksService({
      runtime,
      commandUow: {
        run: (work) =>
          work({
            packs: {
              findVersion: async () => null,
              insertVersion: async () => undefined,
              updateVersion: async () => undefined,
              hasAssignmentsForChecksum: async () => false,
              insertAssignment: async () => undefined,
            },
          }),
      },
      defaultPackDefinition: rawPackDefinition,
    });

    await expect(
      packsService.commands.activatePackForScope({
        scopeId: "",
        packChecksum: "",
      } as never),
    ).rejects.toBeInstanceOf(ZodError);
  });

  it("validates close period input", async () => {
    const periodsService = createPeriodsService({
      runtime,
      reads: {
        findClosedPeriodLock: async () => null,
        listClosedOrganizationIdsForPeriod: async () => [],
      },
      commandUow: {
        run: (work) =>
          work({
            periods: {
              findLatestClosePackage: async () => null,
              upsertClosedPeriodLock: async () => null as never,
              upsertReopenedPeriodLock: async () => null as never,
              markClosePackageSuperseded: async () => undefined,
            },
          }),
      },
      closePackageSnapshotPort: {
        generateClosePackageSnapshot: async () => null as never,
      },
    });

    await expect(
      periodsService.commands.closePeriod({
        organizationId: "not-a-uuid",
        periodStart: new Date("2026-03-01T00:00:00.000Z"),
        periodEnd: new Date("2026-04-01T00:00:00.000Z"),
        closedBy: "user-1",
        closeDocumentId: "not-a-uuid",
      } as never),
    ).rejects.toBeInstanceOf(ZodError);
  });
});
