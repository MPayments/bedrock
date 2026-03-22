import { and, eq } from "drizzle-orm";

import type { Queryable } from "@bedrock/platform/persistence";

import { schema } from "../../../schema";
import type { PackRepository } from "../../application/ports/pack.repository";

export class DrizzlePackRepository implements PackRepository {
  constructor(private readonly db: Queryable) {}

  async findVersion(input: { packKey: string; version: number }) {
    const [row] = await this.db
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

    return row ?? null;
  }

  async insertVersion(input: {
    packKey: string;
    version: number;
    checksum: string;
    compiledJson: Record<string, unknown>;
  }) {
    await this.db.insert(schema.accountingPackVersions).values({
      packKey: input.packKey,
      version: input.version,
      checksum: input.checksum,
      compiledJson: input.compiledJson,
    });
  }

  async updateVersion(input: {
    packKey: string;
    version: number;
    checksum: string;
    compiledJson: Record<string, unknown>;
    compiledAt: Date;
  }) {
    await this.db
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
  }

  async hasAssignmentsForChecksum(input: { checksum: string }) {
    const [assignment] = await this.db
      .select({ id: schema.accountingPackAssignments.id })
      .from(schema.accountingPackAssignments)
      .where(eq(schema.accountingPackAssignments.packChecksum, input.checksum))
      .limit(1);

    return Boolean(assignment);
  }

  async insertAssignment(input: {
    scopeType: string;
    scopeId: string;
    packChecksum: string;
    effectiveAt: Date;
  }) {
    await this.db.insert(schema.accountingPackAssignments).values({
      scopeType: input.scopeType,
      scopeId: input.scopeId,
      packChecksum: input.packChecksum,
      effectiveAt: input.effectiveAt,
    });
  }
}
