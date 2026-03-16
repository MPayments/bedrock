import { and, desc, eq, lte } from "drizzle-orm";

import type { Database, Transaction } from "@bedrock/platform/persistence";

import type {
  AccountingPacksCommandTransaction,
  AccountingPacksCommandRepository,
  AccountingPacksQueryRepository,
} from "../../../application/packs/ports";
import { schema } from "../schema";

export function createDrizzleAccountingPacksQueryRepository(
  db: Database,
): AccountingPacksQueryRepository {
  return {
    async findPackByChecksum(checksum) {
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
    async findActivePackAssignment({ scopeType, scopeId, effectiveAt }) {
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

function selectPackVersion(
  tx: Transaction,
  input: {
    packKey: string;
    version: number;
  },
) {
  return tx
    .select({
      checksum: schema.accountingPackVersions.checksum,
      compiledJson: schema.accountingPackVersions.compiledJson,
    })
    .from(schema.accountingPackVersions)
    .where(
      and(
        eq(schema.accountingPackVersions.packKey, input.packKey),
        eq(schema.accountingPackVersions.version, input.version),
      ),
    )
    .limit(1);
}

function asTransaction(
  tx: AccountingPacksCommandTransaction,
): Transaction {
  return tx as unknown as Transaction;
}

export function createDrizzleAccountingPacksCommandRepository(
  _db: Database,
): AccountingPacksCommandRepository {
  return {
    async findPackVersion({ packKey, version, tx }) {
      const [row] = await selectPackVersion(asTransaction(tx), {
        packKey,
        version,
      });
      return row ?? null;
    },
    async insertPackVersion(input) {
      await asTransaction(input.tx).insert(schema.accountingPackVersions).values({
        packKey: input.packKey,
        version: input.version,
        checksum: input.checksum,
        compiledJson: input.compiledJson,
      });
    },
    async updatePackVersion(input) {
      await asTransaction(input.tx)
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
    async hasAssignmentsForPackChecksum({ checksum, tx }) {
      const [assignment] = await asTransaction(tx)
        .select({ id: schema.accountingPackAssignments.id })
        .from(schema.accountingPackAssignments)
        .where(eq(schema.accountingPackAssignments.packChecksum, checksum))
        .limit(1);

      return Boolean(assignment);
    },
    async insertPackAssignment(input) {
      await asTransaction(input.tx)
        .insert(schema.accountingPackAssignments)
        .values({
        scopeType: input.scopeType,
        scopeId: input.scopeId,
        packChecksum: input.packChecksum,
        effectiveAt: input.effectiveAt,
        });
    },
  };
}
