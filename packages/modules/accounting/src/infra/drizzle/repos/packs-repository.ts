import { and, desc, eq, lte } from "drizzle-orm";

import type { Queryable } from "@bedrock/platform/persistence";

import type { AccountingPacksRepository } from "../../../application/packs/ports";
import { schema } from "../schema";

export function createDrizzleAccountingPacksRepository(
  db: Queryable,
): AccountingPacksRepository {
  return {
    findPackVersion: async ({ packKey, version }) => {
      const [row] = await db
        .select({
          checksum: schema.accountingPackVersions.checksum,
          compiledJson: schema.accountingPackVersions.compiledJson,
        })
        .from(schema.accountingPackVersions)
        .where(
          and(
            eq(schema.accountingPackVersions.packKey, packKey),
            eq(schema.accountingPackVersions.version, version),
          ),
        )
        .limit(1);

      return row ?? null;
    },
    insertPackVersion: async (input) => {
      await db.insert(schema.accountingPackVersions).values(input);
    },
    updatePackVersion: async (input) => {
      await db
        .update(schema.accountingPackVersions)
        .set({
          checksum: input.checksum,
          compiledJson: input.compiledJson,
          compiledAt: input.compiledAt,
        })
        .where(
          and(
            eq(schema.accountingPackVersions.packKey, input.packKey),
            eq(schema.accountingPackVersions.version, input.version),
          ),
        );
    },
    hasAssignmentsForPackChecksum: async (checksum) => {
      const [assignment] = await db
        .select({ id: schema.accountingPackAssignments.id })
        .from(schema.accountingPackAssignments)
        .where(eq(schema.accountingPackAssignments.packChecksum, checksum))
        .limit(1);

      return Boolean(assignment);
    },
    findPackByChecksum: async (checksum) => {
      const [row] = await db
        .select({
          checksum: schema.accountingPackVersions.checksum,
          compiledJson: schema.accountingPackVersions.compiledJson,
        })
        .from(schema.accountingPackVersions)
        .where(eq(schema.accountingPackVersions.checksum, checksum))
        .limit(1);

      return row ?? null;
    },
    insertPackAssignment: async (input) => {
      await db.insert(schema.accountingPackAssignments).values(input);
    },
    findActivePackAssignment: async ({ scopeType, scopeId, effectiveAt }) => {
      const [assignment] = await db
        .select({
          packChecksum: schema.accountingPackAssignments.packChecksum,
        })
        .from(schema.accountingPackAssignments)
        .where(
          and(
            eq(schema.accountingPackAssignments.scopeType, scopeType),
            eq(schema.accountingPackAssignments.scopeId, scopeId),
            lte(schema.accountingPackAssignments.effectiveAt, effectiveAt),
          ),
        )
        .orderBy(desc(schema.accountingPackAssignments.effectiveAt))
        .limit(1);

      return assignment ?? null;
    },
  };
}
