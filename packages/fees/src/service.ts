import { and, asc, eq, isNull, lte, or, sql } from "drizzle-orm";
import { type Database } from "@bedrock/db";
import { schema } from "@bedrock/db/schema";
import { type Logger, makePlanKey, normalizeCurrency } from "@bedrock/kernel";
import { BPS_SCALE, TransferCodes } from "@bedrock/kernel/constants";
import {
    validateFeeComponent,
    validateFxExecutionFee,
    validateFxQuoteFeeCalculation,
    validateGetQuoteFeeComponentsInput,
    validateResolveFeeRulesInput,
    validateSaveQuoteFeeComponentsInput,
    validateUpsertFeeRuleInput,
} from "./validation";
import type {
    BuildFeeTransferPlanInput,
    BuildFxExecutionFeeComponentsInput,
    CalculateFxQuoteFeeComponentsInput,
    FeeComponentDefaults,
    FeeComponent,
    FeeTransferPlan,
    FeesService,
    MergeFeeComponentsInput,
    PartitionedFeeComponents,
    ResolveFeeRulesInput,
    SaveQuoteFeeComponentsInput,
    GetQuoteFeeComponentsInput,
    UpsertFeeRuleInput,
} from "./types";
import { FeeValidationError } from "./errors";

export type CreateFeesServiceDeps = {
    db: Database;
    logger?: Logger;
};

function normalizeComponent(input: FeeComponent): FeeComponent {
    const validated = validateFeeComponent(input);
    return {
        ...validated,
        settlementMode: validated.settlementMode ?? "in_ledger",
    };
}

function componentAggregateKey(component: FeeComponent): string {
    return [
        component.kind,
        component.currency,
        component.source,
        component.settlementMode ?? "in_ledger",
        component.debitAccountKey ?? "",
        component.creditAccountKey ?? "",
        String(component.transferCode ?? ""),
        component.memo ?? "",
    ].join("|");
}

export function createFeesService(deps: CreateFeesServiceDeps): FeesService {
    const { db, logger } = deps;
    const log = logger?.child({ svc: "fees" });

    function calculateBpsAmount(amountMinor: bigint, bps: number): bigint {
        if (amountMinor < 0n) throw new FeeValidationError("amountMinor must be non-negative");
        if (!Number.isInteger(bps) || bps < 0 || bps > 10000) {
            throw new FeeValidationError("bps must be an integer between 0 and 10000");
        }

        return (amountMinor * BigInt(bps)) / BPS_SCALE;
    }

    function getComponentDefaults(kind: string): FeeComponentDefaults {
        switch (kind) {
            case "fx_fee":
                return {
                    bucket: "fx_fee",
                    transferCode: TransferCodes.FEE_REVENUE,
                    memo: "Fee revenue",
                };
            case "fx_spread":
                return {
                    bucket: "fx_spread",
                    transferCode: TransferCodes.SPREAD_REVENUE,
                    memo: "FX spread revenue",
                };
            case "bank_fee":
                return {
                    bucket: "bank",
                    transferCode: TransferCodes.BANK_FEE_REVENUE,
                    memo: "Bank fee revenue",
                };
            case "blockchain_fee":
                return {
                    bucket: "blockchain",
                    transferCode: TransferCodes.BLOCKCHAIN_FEE_REVENUE,
                    memo: "Blockchain fee revenue",
                };
            case "manual_fee":
                return {
                    bucket: "manual",
                    transferCode: TransferCodes.ARBITRARY_FEE_REVENUE,
                    memo: "Manual fee",
                };
            default:
                return {
                    bucket: "custom",
                    transferCode: TransferCodes.ARBITRARY_FEE_REVENUE,
                    memo: "Fee revenue",
                };
        }
    }

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

        return db
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

    async function saveQuoteFeeComponents(input: SaveQuoteFeeComponentsInput, tx?: any): Promise<void> {
        const validated = validateSaveQuoteFeeComponentsInput(input);

        await db.delete(schema.fxQuoteFeeComponents).where(eq(schema.fxQuoteFeeComponents.quoteId, validated.quoteId));

        if (!validated.components.length) return;

        const rows = validated.components.map((raw, idx) => {
            const component = normalizeComponent(raw);
            return {
                quoteId: validated.quoteId,
                idx: idx + 1,
                ruleId: component.ruleId,
                kind: component.kind,
                currency: component.currency,
                amountMinor: component.amountMinor,
                source: component.source,
                settlementMode: component.settlementMode ?? "in_ledger",
                debitAccountKey: component.debitAccountKey,
                creditAccountKey: component.creditAccountKey,
                transferCode: component.transferCode,
                memo: component.memo,
                metadata: component.metadata,
            };
        });

        await db.insert(schema.fxQuoteFeeComponents).values(rows);
    }

    async function getQuoteFeeComponents(input: GetQuoteFeeComponentsInput, tx?: any): Promise<FeeComponent[]> {
        const validated = validateGetQuoteFeeComponentsInput(input);

        const rows = await db
            .select()
            .from(schema.fxQuoteFeeComponents)
            .where(eq(schema.fxQuoteFeeComponents.quoteId, validated.quoteId))
            .limit(2048);

        rows.sort((a: (typeof rows)[number], b: (typeof rows)[number]) => a.idx - b.idx);

        return rows.map((row: (typeof rows)[number]) => ({
            id: `quote_component:${row.quoteId}:${row.idx}`,
            ruleId: row.ruleId ?? undefined,
            kind: row.kind,
            currency: row.currency,
            amountMinor: row.amountMinor,
            source: row.source,
            settlementMode: row.settlementMode,
            debitAccountKey: row.debitAccountKey ?? undefined,
            creditAccountKey: row.creditAccountKey ?? undefined,
            transferCode: row.transferCode ?? undefined,
            memo: row.memo ?? undefined,
            metadata: row.metadata ?? undefined,
        }));
    }

    function buildFxExecutionFeeComponents(input: BuildFxExecutionFeeComponentsInput): FeeComponent[] {
        const validated = validateFxExecutionFee(input);
        const metadata: Record<string, string> = {};

        if (validated.dealDirection) metadata.dealDirection = validated.dealDirection;
        if (validated.dealForm) metadata.dealForm = validated.dealForm;

        const result: FeeComponent[] = [];

        if (validated.feeMinor > 0n) {
            result.push({
                id: "fx_fee_quote",
                kind: "fx_fee",
                currency: validated.currency,
                amountMinor: validated.feeMinor,
                source: "policy",
                settlementMode: "in_ledger",
                memo: "Fee revenue",
                metadata,
            });
        }

        if (validated.spreadMinor > 0n) {
            result.push({
                id: "fx_spread_quote",
                kind: "fx_spread",
                currency: validated.currency,
                amountMinor: validated.spreadMinor,
                source: "policy",
                settlementMode: "in_ledger",
                memo: "FX spread revenue",
                metadata,
            });
        }

        return result;
    }

    function aggregateFeeComponents(components: FeeComponent[]): FeeComponent[] {
        const grouped = new Map<string, FeeComponent>();

        for (const raw of components) {
            const component = normalizeComponent(raw);
            if (component.amountMinor === 0n) continue;

            const key = componentAggregateKey(component);
            const existing = grouped.get(key);

            if (!existing) {
                grouped.set(key, component);
                continue;
            }

            grouped.set(key, {
                ...existing,
                amountMinor: existing.amountMinor + component.amountMinor,
            });
        }

        return Array.from(grouped.values());
    }

    function mergeFeeComponents(input: MergeFeeComponentsInput): FeeComponent[] {
        const computed = (input.computed ?? []).map(normalizeComponent);
        const manual = (input.manual ?? []).map(normalizeComponent);

        const merged = [...computed, ...manual].filter((component) => component.amountMinor > 0n);

        if (input.aggregate === false) return merged;
        return aggregateFeeComponents(merged);
    }

    function partitionFeeComponents(components: FeeComponent[]): PartitionedFeeComponents {
        const normalized = components.map(normalizeComponent);

        const inLedger: FeeComponent[] = [];
        const separatePaymentOrder: FeeComponent[] = [];

        for (const component of normalized) {
            if (component.settlementMode === "separate_payment_order") {
                separatePaymentOrder.push(component);
                continue;
            }

            inLedger.push(component);
        }

        return { inLedger, separatePaymentOrder };
    }

    function buildFeeTransferPlans(input: BuildFeeTransferPlanInput): FeeTransferPlan[] {
        const result: FeeTransferPlan[] = [];
        const includeZeroAmounts = Boolean(input.includeZeroAmounts);

        for (let idx = 0; idx < input.components.length; idx++) {
            const component = normalizeComponent(input.components[idx]!);

            if (component.settlementMode !== "in_ledger") continue;
            if (!includeZeroAmounts && component.amountMinor === 0n) continue;

            const posting = input.resolvePosting(component, idx + 1);

            const debitKey = posting.debitKey ?? component.debitAccountKey;
            const creditKey = posting.creditKey ?? component.creditAccountKey;

            if (!debitKey || !creditKey) {
                throw new FeeValidationError(
                    `Cannot build fee transfer plan for component ${component.id}: debit/credit account keys are missing`
                );
            }

            const planKey = input.makePlanKey
                ? input.makePlanKey(component, idx + 1)
                : makePlanKey("fee_component", {
                    idx: idx + 1,
                    id: component.id,
                    kind: component.kind,
                    currency: component.currency,
                    amount: component.amountMinor.toString(),
                    settlementMode: component.settlementMode,
                });

            result.push({
                planKey,
                debitKey,
                creditKey,
                currency: component.currency,
                amount: component.amountMinor,
                code: posting.code ?? component.transferCode,
                memo: posting.memo ?? component.memo ?? null,
                chain: input.chain ?? null,
                component,
            });
        }

        return result;
    }

    return {
        calculateBpsAmount,
        getComponentDefaults,
        upsertRule,
        listApplicableRules,
        calculateFxQuoteFeeComponents,
        saveQuoteFeeComponents,
        getQuoteFeeComponents,
        buildFxExecutionFeeComponents,
        mergeFeeComponents,
        aggregateFeeComponents,
        partitionFeeComponents,
        buildFeeTransferPlans,
    };
}
