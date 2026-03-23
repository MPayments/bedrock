import { and, asc, eq, isNull, lte, or, sql } from "drizzle-orm";

import type { Database } from "@bedrock/platform/persistence";

import { schema } from "./schema";
import type {
  FeeRuleCandidateQuery,
  FeeRuleRepository,
  FeeRulesReads,
  FeeRulesStore,
} from "../../application/ports/fee-rules.repository";
import type { FeeRuleSnapshot } from "../../domain/fee-rule";

export class DrizzleTreasuryFeeRulesRepository
  implements FeeRulesStore, FeeRulesReads, FeeRuleRepository
{
  constructor(private readonly db: Database) {}

  async insertRule(input: FeeRuleSnapshot) {
    await this.db
      .insert(schema.feeRules)
      .values({
        id: input.id,
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
      .onConflictDoNothing({
        target: schema.feeRules.id,
      });
  }

  async listCandidateRules(input: FeeRuleCandidateQuery) {
    const rows = await this.db
      .select({
        id: schema.feeRules.id,
        name: schema.feeRules.name,
        operationKind: schema.feeRules.operationKind,
        feeKind: schema.feeRules.feeKind,
        calcMethod: schema.feeRules.calcMethod,
        bps: schema.feeRules.bps,
        fixedAmountMinor: schema.feeRules.fixedAmountMinor,
        fixedCurrencyId: schema.feeRules.fixedCurrencyId,
        settlementMode: schema.feeRules.settlementMode,
        accountingTreatment: schema.feeRules.accountingTreatment,
        dealDirection: schema.feeRules.dealDirection,
        dealForm: schema.feeRules.dealForm,
        fromCurrencyId: schema.feeRules.fromCurrencyId,
        toCurrencyId: schema.feeRules.toCurrencyId,
        priority: schema.feeRules.priority,
        isActive: schema.feeRules.isActive,
        effectiveFrom: schema.feeRules.effectiveFrom,
        effectiveTo: schema.feeRules.effectiveTo,
        memo: schema.feeRules.memo,
        metadata: schema.feeRules.metadata,
        createdAt: schema.feeRules.createdAt,
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
        ),
      )
      .orderBy(asc(schema.feeRules.priority), asc(schema.feeRules.createdAt));

    return rows as FeeRuleSnapshot[];
  }
}
