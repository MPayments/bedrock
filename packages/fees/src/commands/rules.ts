import { and, asc, eq, isNull, lte, or, sql } from "drizzle-orm";
import { schema } from "@bedrock/db/schema";
import { normalizeCurrency } from "@bedrock/kernel";

import {
    validateFxQuoteFeeCalculation,
    validateResolveFeeRulesInput,
    validateUpsertFeeRuleInput,
} from "../validation";
import type {
    CalculateFxQuoteFeeComponentsInput,
    FeeComponent,
    ResolveFeeRulesInput,
    UpsertFeeRuleInput,
} from "../types";
import { type FeesServiceContext } from "../internal/context";
import { calculateBpsAmount } from "../internal/math";

export function createRuleHandlers(context: FeesServiceContext) {
    const { db, log } = context;

    async function upsertRule(input: UpsertFeeRuleInput): Promise<string> {
        const validated = validateUpsertFeeRuleInput(input);

        const inserted = await db
            .insert(schema.feeRules)
            .values({
                name: validated.name,
                operationKind: validated.operationKind,
                feeKind: validated.feeKind,
                calcMethod: validated.calcMethod,
                bps: validated.bps,
                fixedAmountMinor: validated.fixedAmountMinor,
                fixedCurrency: validated.fixedCurrency,
                settlementMode: validated.settlementMode ?? "in_ledger",
                dealDirection: validated.dealDirection,
                dealForm: validated.dealForm,
                fromCurrency: validated.fromCurrency,
                toCurrency: validated.toCurrency,
                priority: validated.priority ?? 100,
                isActive: validated.isActive ?? true,
                effectiveFrom: validated.effectiveFrom ?? new Date(),
                effectiveTo: validated.effectiveTo,
                debitAccountKey: validated.debitAccountKey,
                creditAccountKey: validated.creditAccountKey,
                transferCode: validated.transferCode,
                memo: validated.memo,
                metadata: validated.metadata,
            })
            .returning({ id: schema.feeRules.id });

        log?.info("Fee rule persisted", {
            ruleId: inserted[0]!.id,
            operationKind: validated.operationKind,
            feeKind: validated.feeKind,
            calcMethod: validated.calcMethod,
        });

        return inserted[0]!.id;
    }

    async function listApplicableRules(input: ResolveFeeRulesInput, tx?: any) {
        const validated = validateResolveFeeRulesInput(input);
        const executor = tx ?? db;

        const directionCond = validated.dealDirection
            ? or(isNull(schema.feeRules.dealDirection), eq(schema.feeRules.dealDirection, validated.dealDirection))
            : isNull(schema.feeRules.dealDirection);

        const formCond = validated.dealForm
            ? or(isNull(schema.feeRules.dealForm), eq(schema.feeRules.dealForm, validated.dealForm))
            : isNull(schema.feeRules.dealForm);

        const fromCond = validated.fromCurrency
            ? or(isNull(schema.feeRules.fromCurrency), eq(schema.feeRules.fromCurrency, validated.fromCurrency))
            : isNull(schema.feeRules.fromCurrency);

        const toCond = validated.toCurrency
            ? or(isNull(schema.feeRules.toCurrency), eq(schema.feeRules.toCurrency, validated.toCurrency))
            : isNull(schema.feeRules.toCurrency);

        return executor
            .select()
            .from(schema.feeRules)
            .where(
                and(
                    eq(schema.feeRules.operationKind, validated.operationKind),
                    eq(schema.feeRules.isActive, true),
                    lte(schema.feeRules.effectiveFrom, validated.at),
                    or(isNull(schema.feeRules.effectiveTo), sql`${schema.feeRules.effectiveTo} > ${validated.at}`),
                    directionCond,
                    formCond,
                    fromCond,
                    toCond
                )
            )
            .orderBy(asc(schema.feeRules.priority), asc(schema.feeRules.createdAt));
    }

    async function calculateFxQuoteFeeComponents(input: CalculateFxQuoteFeeComponentsInput, tx?: any): Promise<FeeComponent[]> {
        const validated = validateFxQuoteFeeCalculation(input);

        const rules = await listApplicableRules(
            {
                operationKind: "fx_quote",
                at: validated.at,
                fromCurrency: validated.fromCurrency,
                toCurrency: validated.toCurrency,
                dealDirection: validated.dealDirection,
                dealForm: validated.dealForm,
            },
            tx
        );

        const result: FeeComponent[] = [];

        for (const rule of rules) {
            let amountMinor = 0n;

            if (rule.calcMethod === "bps") {
                if (rule.bps === null) continue;
                amountMinor = calculateBpsAmount(validated.principalMinor, rule.bps);
            } else {
                amountMinor = rule.fixedAmountMinor ?? 0n;
            }

            if (amountMinor <= 0n) continue;

            const currency = rule.calcMethod === "fixed"
                ? normalizeCurrency(rule.fixedCurrency ?? validated.fromCurrency)
                : validated.fromCurrency;

            result.push({
                id: `rule:${rule.id}`,
                ruleId: rule.id,
                kind: rule.feeKind,
                currency,
                amountMinor,
                source: "policy",
                settlementMode: rule.settlementMode,
                debitAccountKey: rule.debitAccountKey ?? undefined,
                creditAccountKey: rule.creditAccountKey ?? undefined,
                transferCode: rule.transferCode ?? undefined,
                memo: rule.memo ?? undefined,
                metadata: rule.metadata ?? undefined,
            });
        }

        return result;
    }

    return {
        upsertRule,
        listApplicableRules,
        calculateFxQuoteFeeComponents,
    };
}
