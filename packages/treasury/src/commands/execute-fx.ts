import { and, eq, sql } from "drizzle-orm";
import { makePlanKey } from "@bedrock/kernel";
import { schema } from "@bedrock/db/schema";
import { PlanType } from "@bedrock/ledger";
import { TransferCodes } from "@bedrock/kernel/constants";

import { AmountMismatchError, CurrencyMismatchError, InvalidStateError, NotFoundError, ValidationError } from "../errors";
import { type ExecuteFxInput, validateExecuteFxInput } from "../validation";
import { ExecuteFxAllowedFrom, TreasuryOrderStatus, isOrderStatusIn, isSameEntryInAllowedState } from "../state-machine";
import { SYSTEM_LEDGER_ORG_ID, type TreasuryServiceContext } from "../internal/context";
import { consumeFxQuoteForExecution } from "../internal/fx-quote";

export function createExecuteFxHandler(context: TreasuryServiceContext) {
    const { db, ledger, feesService, log, keys } = context;

    return async function executeFx(rawInput: ExecuteFxInput) {
        const input = validateExecuteFxInput(rawInput);
        log.debug("executeFx start", { orderId: input.orderId, quoteRef: input.quoteRef });

        return db.transaction(async (tx: any) => {
            const [order] = await tx
                .select()
                .from(schema.paymentOrders)
                .where(eq(schema.paymentOrders.id, input.orderId))
                .limit(1);

            if (!order) throw new NotFoundError("Order", input.orderId);

            if (input.payInCurrency !== order.payInCurrency) {
                throw new CurrencyMismatchError("payInCurrency", order.payInCurrency, input.payInCurrency);
            }
            if (input.payOutCurrency !== order.payOutCurrency) {
                throw new CurrencyMismatchError("payOutCurrency", order.payOutCurrency, input.payOutCurrency);
            }

            if (input.principalMinor !== order.payInExpectedMinor) {
                throw new AmountMismatchError("principalMinor (payInExpectedMinor)", order.payInExpectedMinor, input.principalMinor);
            }
            if (input.payOutAmountMinor !== order.payOutAmountMinor) {
                throw new AmountMismatchError("payOutAmountMinor", order.payOutAmountMinor, input.payOutAmountMinor);
            }
            if (input.customerId !== order.customerId) {
                throw new ValidationError(`customerId mismatch: expected ${order.customerId}, got ${input.customerId}`);
            }
            if (input.branchOrgId !== order.payInOrgId && input.branchOrgId !== order.payOutOrgId) {
                throw new ValidationError(
                    `branchOrgId mismatch: expected one of [${order.payInOrgId}, ${order.payOutOrgId}], got ${input.branchOrgId}`
                );
            }

            if (!isOrderStatusIn(order.status, ExecuteFxAllowedFrom)) {
                throw new InvalidStateError(`Order must be ${TreasuryOrderStatus.FUNDING_SETTLED} (posted), got ${order.status}`);
            }

            const quote = await consumeFxQuoteForExecution(tx, input);
            const persistedQuoteLegs = await tx
                .select()
                .from(schema.fxQuoteLegs)
                .where(eq(schema.fxQuoteLegs.quoteId, quote.id))
                .limit(2048);
            persistedQuoteLegs.sort((a: any, b: any) => a.idx - b.idx);

            if (!persistedQuoteLegs.length && (quote.pricingMode ?? "auto_cross") === "explicit_route") {
                throw new InvalidStateError(`Quote ${quote.id} has explicit_route pricingMode but no persisted legs`);
            }

            const routeLegs = persistedQuoteLegs.length
                ? persistedQuoteLegs
                : [{
                    idx: 1,
                    fromCurrency: quote.fromCurrency,
                    toCurrency: quote.toCurrency,
                    fromAmountMinor: quote.fromAmountMinor,
                    toAmountMinor: quote.toAmountMinor,
                    rateNum: quote.rateNum,
                    rateDen: quote.rateDen,
                    sourceKind: "derived",
                    sourceRef: null,
                    asOf: input.occurredAt,
                    executionOrgId: null,
                    createdAt: input.occurredAt,
                    id: quote.id,
                    quoteId: quote.id,
                }];

            if (routeLegs[0]!.fromCurrency !== input.payInCurrency) {
                throw new CurrencyMismatchError("route[0].fromCurrency", routeLegs[0]!.fromCurrency, input.payInCurrency);
            }
            if (routeLegs[routeLegs.length - 1]!.toCurrency !== input.payOutCurrency) {
                throw new CurrencyMismatchError(
                    "route[last].toCurrency",
                    routeLegs[routeLegs.length - 1]!.toCurrency,
                    input.payOutCurrency
                );
            }
            if (routeLegs[0]!.fromAmountMinor !== input.principalMinor) {
                throw new AmountMismatchError("route[0].fromAmountMinor", routeLegs[0]!.fromAmountMinor, input.principalMinor);
            }
            if (routeLegs[routeLegs.length - 1]!.toAmountMinor !== input.payOutAmountMinor) {
                throw new AmountMismatchError(
                    "route[last].toAmountMinor",
                    routeLegs[routeLegs.length - 1]!.toAmountMinor,
                    input.payOutAmountMinor
                );
            }

            const chain = `fx:${input.quoteRef}`;
            const transfers: any[] = [];
            const separateFeeOrders: Array<{
                componentId: string;
                kind: string;
                bucket: string;
                currency: string;
                amountMinor: bigint;
                memo: string | null | undefined;
                metadata: Record<string, string> | undefined;
            }> = [];

            transfers.push({
                type: PlanType.CREATE,
                chain,
                planKey: makePlanKey("fx_principal", {
                    quoteRef: input.quoteRef,
                    orderId: input.orderId,
                    currency: input.payInCurrency,
                    amount: input.principalMinor.toString(),
                }),
                debitKey: keys.customerWallet(input.customerId, input.payInCurrency),
                creditKey: keys.orderInventory(input.orderId, input.payInCurrency),
                currency: input.payInCurrency,
                amount: input.principalMinor,
                code: TransferCodes.FX_PRINCIPAL,
                memo: "FX principal",
            });

            for (const leg of routeLegs) {
                const executionOrgId = leg.executionOrgId ?? input.branchOrgId;

                transfers.push({
                    type: PlanType.CREATE,
                    chain,
                    planKey: makePlanKey("fx_leg_out", {
                        quoteRef: input.quoteRef,
                        orderId: input.orderId,
                        idx: leg.idx,
                        executionOrgId,
                        fromCurrency: leg.fromCurrency,
                        amount: leg.fromAmountMinor.toString(),
                    }),
                    debitKey: keys.orderInventory(input.orderId, leg.fromCurrency),
                    creditKey: keys.intercompanyNet(executionOrgId, leg.fromCurrency),
                    currency: leg.fromCurrency,
                    amount: leg.fromAmountMinor,
                    code: TransferCodes.FX_LEG_OUT,
                    memo: `FX leg ${leg.idx} out`,
                });

                transfers.push({
                    type: PlanType.CREATE,
                    chain,
                    planKey: makePlanKey("fx_leg_in", {
                        quoteRef: input.quoteRef,
                        orderId: input.orderId,
                        idx: leg.idx,
                        executionOrgId,
                        toCurrency: leg.toCurrency,
                        amount: leg.toAmountMinor.toString(),
                    }),
                    debitKey: keys.intercompanyNet(executionOrgId, leg.toCurrency),
                    creditKey: keys.orderInventory(input.orderId, leg.toCurrency),
                    currency: leg.toCurrency,
                    amount: leg.toAmountMinor,
                    code: TransferCodes.FX_LEG_IN,
                    memo: `FX leg ${leg.idx} in`,
                });
            }

            const quoteFeeComponents = await feesService.getQuoteFeeComponents({ quoteId: quote.id }, tx);
            const mergedFeeComponents = feesService.mergeFeeComponents({
                computed: quoteFeeComponents,
                manual: input.fees,
            });

            const { inLedger, separatePaymentOrder } = feesService.partitionFeeComponents(mergedFeeComponents);

            const inLedgerFeePlans = feesService.buildFeeTransferPlans({
                components: inLedger,
                chain,
                makePlanKey: (component, idx) =>
                    makePlanKey("fx_fee_component", {
                        quoteRef: input.quoteRef,
                        orderId: input.orderId,
                        idx,
                        componentId: component.id,
                        kind: component.kind,
                        currency: component.currency,
                        amount: component.amountMinor.toString(),
                    }),
                resolvePosting: (component) => {
                    const defaults = feesService.getComponentDefaults(component.kind);

                    if (component.debitAccountKey && component.creditAccountKey) {
                        return {
                            debitKey: component.debitAccountKey,
                            creditKey: component.creditAccountKey,
                            code: component.transferCode ?? defaults.transferCode,
                            memo: component.memo ?? defaults.memo,
                        };
                    }

                    const debitKey = keys.customerWallet(input.customerId, component.currency);
                    const creditKey =
                        component.kind === "fx_fee"
                            ? keys.revenueFee(component.currency)
                            : component.kind === "fx_spread"
                                ? keys.revenueSpread(component.currency)
                                : keys.feeRevenueBucket(defaults.bucket, component.currency);

                    return {
                        debitKey,
                        creditKey,
                        code: component.transferCode ?? defaults.transferCode,
                        memo: component.memo ?? defaults.memo,
                    };
                },
            });

            for (const plan of inLedgerFeePlans) {
                transfers.push({
                    type: PlanType.CREATE,
                    chain: plan.chain,
                    planKey: plan.planKey,
                    debitKey: plan.debitKey,
                    creditKey: plan.creditKey,
                    currency: plan.currency,
                    amount: plan.amount,
                    code: plan.code,
                    memo: plan.memo ?? undefined,
                });
            }

            const reserveComponents = separatePaymentOrder.map((component) => ({
                ...component,
                settlementMode: "in_ledger" as const,
            }));

            const reserveFeePlans = feesService.buildFeeTransferPlans({
                components: reserveComponents,
                chain,
                makePlanKey: (component, idx) =>
                    makePlanKey("fx_fee_reserve", {
                        quoteRef: input.quoteRef,
                        orderId: input.orderId,
                        idx,
                        componentId: component.id,
                        kind: component.kind,
                        currency: component.currency,
                        amount: component.amountMinor.toString(),
                    }),
                resolvePosting: (component) => {
                    const defaults = feesService.getComponentDefaults(component.kind);

                    if (component.debitAccountKey && component.creditAccountKey) {
                        return {
                            debitKey: component.debitAccountKey,
                            creditKey: component.creditAccountKey,
                            code: component.transferCode ?? TransferCodes.FEE_SEPARATE_PAYMENT_RESERVE,
                            memo: component.memo ?? "Fee reserved for separate payment order",
                        };
                    }

                    return {
                        debitKey: keys.customerWallet(input.customerId, component.currency),
                        creditKey: keys.feeClearing(defaults.bucket, component.currency),
                        code: component.transferCode ?? TransferCodes.FEE_SEPARATE_PAYMENT_RESERVE,
                        memo: component.memo ?? "Fee reserved for separate payment order",
                    };
                },
            });

            for (const plan of reserveFeePlans) {
                transfers.push({
                    type: PlanType.CREATE,
                    chain: plan.chain,
                    planKey: plan.planKey,
                    debitKey: plan.debitKey,
                    creditKey: plan.creditKey,
                    currency: plan.currency,
                    amount: plan.amount,
                    code: plan.code,
                    memo: plan.memo ?? undefined,
                });
                separateFeeOrders.push({
                    componentId: plan.component.id,
                    kind: plan.component.kind,
                    bucket: feesService.getComponentDefaults(plan.component.kind).bucket,
                    currency: plan.component.currency,
                    amountMinor: plan.component.amountMinor,
                    memo: plan.memo,
                    metadata: plan.component.metadata,
                });
            }

            const mergedAdjustments = feesService.mergeAdjustmentComponents({
                manual: input.adjustments,
            });
            const partitionedAdjustments = feesService.partitionAdjustmentComponents(mergedAdjustments);

            const inLedgerAdjustmentPlans = feesService.buildAdjustmentTransferPlans({
                components: partitionedAdjustments.inLedger,
                chain,
                makePlanKey: (component, idx) =>
                    makePlanKey("fx_adjustment_component", {
                        quoteRef: input.quoteRef,
                        orderId: input.orderId,
                        idx,
                        componentId: component.id,
                        kind: component.kind,
                        effect: component.effect,
                        currency: component.currency,
                        amount: component.amountMinor.toString(),
                    }),
                resolvePosting: (component) => {
                    if (component.debitAccountKey && component.creditAccountKey) {
                        return {
                            debitKey: component.debitAccountKey,
                            creditKey: component.creditAccountKey,
                            code: component.transferCode ??
                                (component.effect === "increase_charge" ? TransferCodes.ADJUSTMENT_CHARGE : TransferCodes.ADJUSTMENT_REFUND),
                            memo: component.memo ?? (component.effect === "increase_charge" ? "Adjustment charge" : "Adjustment refund"),
                        };
                    }

                    const bucket = component.kind;
                    if (component.effect === "increase_charge") {
                        return {
                            debitKey: keys.customerWallet(input.customerId, component.currency),
                            creditKey: keys.adjustmentRevenue(bucket, component.currency),
                            code: component.transferCode ?? TransferCodes.ADJUSTMENT_CHARGE,
                            memo: component.memo ?? "Adjustment charge",
                        };
                    }

                    return {
                        debitKey: keys.adjustmentExpense(bucket, component.currency),
                        creditKey: keys.customerWallet(input.customerId, component.currency),
                        code: component.transferCode ?? TransferCodes.ADJUSTMENT_REFUND,
                        memo: component.memo ?? "Adjustment refund",
                    };
                },
            });

            for (const plan of inLedgerAdjustmentPlans) {
                transfers.push({
                    type: PlanType.CREATE,
                    chain: plan.chain,
                    planKey: plan.planKey,
                    debitKey: plan.debitKey,
                    creditKey: plan.creditKey,
                    currency: plan.currency,
                    amount: plan.amount,
                    code: plan.code,
                    memo: plan.memo ?? undefined,
                });
            }

            const reserveAdjustments = partitionedAdjustments.separatePaymentOrder.map((component) => ({
                ...component,
                settlementMode: "in_ledger" as const,
            }));

            const reserveAdjustmentPlans = feesService.buildAdjustmentTransferPlans({
                components: reserveAdjustments,
                chain,
                makePlanKey: (component, idx) =>
                    makePlanKey("fx_adjustment_reserve", {
                        quoteRef: input.quoteRef,
                        orderId: input.orderId,
                        idx,
                        componentId: component.id,
                        kind: component.kind,
                        effect: component.effect,
                        currency: component.currency,
                        amount: component.amountMinor.toString(),
                    }),
                resolvePosting: (component) => {
                    const bucket = `adjustment:${component.kind}`;
                    if (component.debitAccountKey && component.creditAccountKey) {
                        return {
                            debitKey: component.debitAccountKey,
                            creditKey: component.creditAccountKey,
                            code: component.transferCode ?? TransferCodes.FEE_SEPARATE_PAYMENT_RESERVE,
                            memo: component.memo ?? "Adjustment reserved for separate payment order",
                        };
                    }

                    if (component.effect === "increase_charge") {
                        return {
                            debitKey: keys.customerWallet(input.customerId, component.currency),
                            creditKey: keys.feeClearing(bucket, component.currency),
                            code: component.transferCode ?? TransferCodes.FEE_SEPARATE_PAYMENT_RESERVE,
                            memo: component.memo ?? "Adjustment reserved for separate payment order",
                        };
                    }

                    return {
                        debitKey: keys.adjustmentExpense(component.kind, component.currency),
                        creditKey: keys.feeClearing(bucket, component.currency),
                        code: component.transferCode ?? TransferCodes.FEE_SEPARATE_PAYMENT_RESERVE,
                        memo: component.memo ?? "Adjustment reserved for separate payment order",
                    };
                },
            });

            for (const plan of reserveAdjustmentPlans) {
                transfers.push({
                    type: PlanType.CREATE,
                    chain: plan.chain,
                    planKey: plan.planKey,
                    debitKey: plan.debitKey,
                    creditKey: plan.creditKey,
                    currency: plan.currency,
                    amount: plan.amount,
                    code: plan.code,
                    memo: plan.memo ?? undefined,
                });
                separateFeeOrders.push({
                    componentId: plan.component.id,
                    kind: `adjustment:${plan.component.kind}`,
                    bucket: `adjustment:${plan.component.kind}`,
                    currency: plan.component.currency,
                    amountMinor: plan.component.amountMinor,
                    memo: plan.memo,
                    metadata: {
                        ...(plan.component.metadata ?? {}),
                        effect: plan.component.effect,
                    },
                });
            }

            transfers.push({
                type: PlanType.CREATE,
                chain,
                planKey: makePlanKey("fx_obligation", {
                    quoteRef: input.quoteRef,
                    orderId: input.orderId,
                    payOutOrgId: order.payOutOrgId,
                    currency: input.payOutCurrency,
                    amount: input.payOutAmountMinor.toString(),
                }),
                debitKey: keys.orderInventory(input.orderId, input.payOutCurrency),
                creditKey: keys.payoutObligation(input.orderId, input.payOutCurrency),
                currency: input.payOutCurrency,
                amount: input.payOutAmountMinor,
                code: TransferCodes.FX_PAYOUT_OBLIGATION,
                memo: "Create payout obligation",
            });

            const { entryId } = await ledger.createEntryTx(tx, {
                orgId: SYSTEM_LEDGER_ORG_ID,
                source: { type: "order/fx_executed", id: input.orderId },
                idempotencyKey: `fx:${input.quoteRef}`,
                postingDate: input.occurredAt,
                transfers,
            });

            if (separateFeeOrders.length) {
                await tx
                    .insert(schema.feePaymentOrders)
                    .values(
                        separateFeeOrders.map((item) => ({
                            parentOrderId: input.orderId,
                            quoteId: quote.id,
                            componentId: item.componentId,
                            idempotencyKey: `fee_order:${input.orderId}:${item.kind}:${item.componentId}`,
                            kind: item.kind,
                            bucket: item.bucket,
                            currency: item.currency,
                            amountMinor: item.amountMinor,
                            memo: item.memo ?? null,
                            metadata: item.metadata ?? null,
                            reserveEntryId: entryId,
                            status: "reserved",
                        }))
                    )
                    .onConflictDoNothing({
                        target: schema.feePaymentOrders.idempotencyKey,
                    });
            }

            const moved = await tx
                .update(schema.paymentOrders)
                .set({ status: TreasuryOrderStatus.FX_EXECUTED_PENDING_POSTING, ledgerEntryId: entryId, updatedAt: sql`now()` })
                .where(and(eq(schema.paymentOrders.id, input.orderId), eq(schema.paymentOrders.status, TreasuryOrderStatus.FUNDING_SETTLED)))
                .returning({ id: schema.paymentOrders.id });

            if (!moved.length) {
                const current = await tx
                    .select({ status: schema.paymentOrders.status, ledgerEntryId: schema.paymentOrders.ledgerEntryId })
                    .from(schema.paymentOrders)
                    .where(eq(schema.paymentOrders.id, input.orderId))
                    .limit(1);

                if (current.length && isSameEntryInAllowedState(
                    current[0]!.status as string,
                    current[0]!.ledgerEntryId,
                    entryId,
                    [TreasuryOrderStatus.FX_EXECUTED_PENDING_POSTING, TreasuryOrderStatus.FX_EXECUTED]
                )) {
                    log.debug("executeFx idempotent", { orderId: input.orderId });
                    return entryId;
                }

                throw new InvalidStateError(
                    `Failed to update order status: concurrent modification detected. ` +
                    `Current status: ${current[0]?.status ?? "unknown"}`
                );
            }

            log.info("executeFx ok", { orderId: input.orderId, entryId, quoteRef: input.quoteRef });
            return entryId;
        });
    };
}
