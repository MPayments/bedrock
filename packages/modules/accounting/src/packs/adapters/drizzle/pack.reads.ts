import { and, desc, eq, lte } from "drizzle-orm";

import type { Queryable } from "@bedrock/platform/persistence";

import { schema } from "../../../schema";
import type { PackReads } from "../../application/ports/pack.reads";

export class DrizzlePackReads implements PackReads {
  constructor(private readonly db: Queryable) {}

  async findByChecksum(checksum: string) {
    const [row] = await this.db
      .select({
        checksum: schema.accountingPackVersions.checksum,
        compiledJson: schema.accountingPackVersions.compiledJson,
      })
      .from(schema.accountingPackVersions)
      .where(eq(schema.accountingPackVersions.checksum, checksum))
      .limit(1);

    return row ?? null;
  }

  async findActiveAssignment(input: {
    scopeType: string;
    scopeId: string;
    effectiveAt: Date;
  }) {
    const [assignment] = await this.db
      .select({
        packChecksum: schema.accountingPackAssignments.packChecksum,
      })
      .from(schema.accountingPackAssignments)
      .where(
        and(
          eq(schema.accountingPackAssignments.scopeType, input.scopeType),
          eq(schema.accountingPackAssignments.scopeId, input.scopeId),
          lte(schema.accountingPackAssignments.effectiveAt, input.effectiveAt),
        ),
      )
      .orderBy(desc(schema.accountingPackAssignments.effectiveAt))
      .limit(1);

    return assignment ?? null;
  }
}
