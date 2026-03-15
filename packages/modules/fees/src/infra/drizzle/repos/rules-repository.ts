import { and, asc, eq, isNull, lte, or, sql } from "drizzle-orm";

import type { Database } from "@bedrock/platform/persistence";

import type {
  FeesDbExecutor,
  FeesRuleRecord,
  FeesRulesRepositoryPort,
  FeesRuleWriteModel,
} from "../../../application/ports";
import { schema } from "../schema";

export function createDrizzleFeesRulesRepository(input: {
  db: Database;
}): FeesRulesRepositoryPort {
  const { db } = input;

  async function insertRule(input: FeesRuleWriteModel): Promise<string> {
    const inserted = await db
      .insert(schema.feeRules)
      .values({
        name: input.name,
        operationKind: input.operationKind,
        feeKind: input.feeKind,
        calcMethod: input.calcMethod,
        bps: input.bps,
        fixedAmountMinor: input.fixedAmountMinor,
        fixedCurrencyId: input.fixedCurrencyId,
        settlementMode: input.settlementMode,
        accountingTreatment: input.accountingTreatment,
        dealDirection: input.dealDirection,
        dealForm: input.dealForm,
        fromCurrencyId: input.fromCurrencyId,
        toCurrencyId: input.toCurrencyId,
        priority: input.priority,
        isActive: input.isActive,
        effectiveFrom: input.effectiveFrom,
        effectiveTo: input.effectiveTo,
        debitAccountKey: null,
        creditAccountKey: null,
        transferCode: null,
        memo: input.memo,
        metadata: input.metadata,
      })
      .returning({ id: schema.feeRules.id });

    return inserted[0]!.id;
  }

  async function listApplicableRules(
    input: {
      operationKind: FeesRuleWriteModel["operationKind"];
      at: Date;
      dealDirection?: string;
      dealForm?: string;
      fromCurrencyId: string | null;
      toCurrencyId: string | null;
    },
    executor?: FeesDbExecutor,
  ): Promise<FeesRuleRecord[]> {
    const queryExecutor = executor ?? db;

    const directionCondition = input.dealDirection
      ? or(
          isNull(schema.feeRules.dealDirection),
          eq(schema.feeRules.dealDirection, input.dealDirection),
        )
      : isNull(schema.feeRules.dealDirection);

    const formCondition = input.dealForm
      ? or(
          isNull(schema.feeRules.dealForm),
          eq(schema.feeRules.dealForm, input.dealForm),
        )
      : isNull(schema.feeRules.dealForm);

    const fromCurrencyCondition = input.fromCurrencyId
      ? or(
          isNull(schema.feeRules.fromCurrencyId),
          eq(schema.feeRules.fromCurrencyId, input.fromCurrencyId),
        )
      : isNull(schema.feeRules.fromCurrencyId);

    const toCurrencyCondition = input.toCurrencyId
      ? or(
          isNull(schema.feeRules.toCurrencyId),
          eq(schema.feeRules.toCurrencyId, input.toCurrencyId),
        )
      : isNull(schema.feeRules.toCurrencyId);

    return queryExecutor
      .select({
        id: schema.feeRules.id,
        calcMethod: schema.feeRules.calcMethod,
        bps: schema.feeRules.bps,
        fixedAmountMinor: schema.feeRules.fixedAmountMinor,
        fixedCurrencyId: schema.feeRules.fixedCurrencyId,
        feeKind: schema.feeRules.feeKind,
        settlementMode: schema.feeRules.settlementMode,
        accountingTreatment: schema.feeRules.accountingTreatment,
        memo: schema.feeRules.memo,
        metadata: schema.feeRules.metadata,
      })
      .from(schema.feeRules)
      .where(
        and(
          eq(schema.feeRules.operationKind, input.operationKind),
          eq(schema.feeRules.isActive, true),
          lte(schema.feeRules.effectiveFrom, input.at),
          or(
            isNull(schema.feeRules.effectiveTo),
            sql`${schema.feeRules.effectiveTo} > ${input.at}`,
          ),
          directionCondition,
          formCondition,
          fromCurrencyCondition,
          toCurrencyCondition,
        ),
      )
      .orderBy(asc(schema.feeRules.priority), asc(schema.feeRules.createdAt));
  }

  return {
    insertRule,
    listApplicableRules,
  };
}
