import { eq } from "drizzle-orm";

import type { Queryable, Transaction } from "@bedrock/platform/persistence";
import type { PersistenceSession } from "@bedrock/shared/core/persistence";

import { treasuryOperations } from "./schema";
import type {
  TreasuryOperationRecord,
  TreasuryOperationsRepository,
  TreasuryOperationWriteModel,
} from "../../application/ports/operations.repository";

export class DrizzleTreasuryOperationsRepository
  implements TreasuryOperationsRepository
{
  constructor(private readonly db: Queryable) {}

  async findOperationById(
    id: string,
    tx?: PersistenceSession,
  ): Promise<TreasuryOperationRecord | undefined> {
    const database = (tx as Transaction | undefined) ?? this.db;
    const [operation] = await database
      .select()
      .from(treasuryOperations)
      .where(eq(treasuryOperations.id, id))
      .limit(1);

    return operation as TreasuryOperationRecord | undefined;
  }

  async findOperationBySourceRef(
    sourceRef: string,
    tx?: PersistenceSession,
  ): Promise<TreasuryOperationRecord | undefined> {
    const database = (tx as Transaction | undefined) ?? this.db;
    const [operation] = await database
      .select()
      .from(treasuryOperations)
      .where(eq(treasuryOperations.sourceRef, sourceRef))
      .limit(1);

    return operation as TreasuryOperationRecord | undefined;
  }

  async insertOperation(
    input: TreasuryOperationWriteModel,
    tx?: PersistenceSession,
  ): Promise<TreasuryOperationRecord | null> {
    const database = (tx as Transaction | undefined) ?? this.db;
    const inserted = await database
      .insert(treasuryOperations)
      .values(input)
      .onConflictDoNothing({
        target: treasuryOperations.sourceRef,
      })
      .returning();

    return (inserted[0] as TreasuryOperationRecord | undefined) ?? null;
  }
}
