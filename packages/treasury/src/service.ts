import { and, eq, or, sql } from "drizzle-orm";
import { type Logger, makePlanKey, noopLogger } from "@bedrock/kernel";
import { schema } from "@bedrock/db/schema";
import { type Database } from "@bedrock/db";
import { type LedgerEngine, PlanType } from "@bedrock/ledger";
import { type FeesService } from "@bedrock/fees";

import {
    InvalidStateError,
    NotFoundError,
    ValidationError,
    AmountMismatchError,
    CurrencyMismatchError
} from "./errors";
import { treasuryKeyspace } from "./keyspace";
import { TransferCodes } from "@bedrock/kernel/constants";
import {
    validateFundingSettledInput,
    validateExecuteFxInput,
    validateInitiatePayoutInput,
    validateSettlePayoutInput,
    validateVoidPayoutInput,
    validateInitiateFeePaymentInput,
    validateSettleFeePaymentInput,
    validateVoidFeePaymentInput,
    type FundingSettledInput,
    type ExecuteFxInput,
    type InitiatePayoutInput,
    type SettlePayoutInput,
    type VoidPayoutInput,
    type InitiateFeePaymentInput,
    type SettleFeePaymentInput,
    type VoidFeePaymentInput,
} from "./validation";
import {
    AdvancedOrderStatuses,
    ExecuteFxAllowedFrom,
    FundingSettledAllowedFrom,
    InitiatePayoutAllowedFrom,
    ResolvePendingPayoutAllowedFrom,
    TreasuryOrderStatus,
    isOrderStatusIn,
    isSameEntryInAllowedState,
} from "./state-machine";

type TreasuryServiceDeps = {
    db: Database;
    ledger: LedgerEngine;
    feesService: FeesService;
    logger?: Logger;
};

const SYSTEM_LEDGER_ORG_ID = "00000000-0000-4000-8000-000000000001";

export function createTreasuryService(deps: TreasuryServiceDeps) {
    const { db, ledger, logger, feesService } = deps;
    const log = logger?.child({ svc: "treasury" }) ?? noopLogger;
    const { keys } = treasuryKeyspace;

    async function fetchOrderState(tx: any, orderId: string) {
        const [row] = await tx
            .select({
                id: schema.paymentOrders.id,
                status: schema.paymentOrders.status,
                ledgerEntryId: schema.paymentOrders.ledgerEntryId,
                payoutPendingTransferId: schema.paymentOrders.payoutPendingTransferId,
            })
            .from(schema.paymentOrders)
            .where(eq(schema.paymentOrders.id, orderId))
            .limit(1);

        if (!row) throw new NotFoundError("Order", orderId);
        return row;
    }

    async function fetchFeePaymentOrderState(tx: any, feePaymentOrderId: string) {
        const [row] = await tx
            .select()
            .from(schema.feePaymentOrders)
            .where(eq(schema.feePaymentOrders.id, feePaymentOrderId))
            .limit(1);

        if (!row) throw new NotFoundError("FeePaymentOrder", feePaymentOrderId);
        return row;
    }

    function assertInitiateFeePaymentReplayCompatible(feeOrder: any, input: InitiateFeePaymentInput) {
        if (feeOrder.railRef !== input.railRef) {
            throw new InvalidStateError(
                `FeePaymentOrder already initiated with different railRef (expected ${feeOrder.railRef ?? "null"}, got ${input.railRef})`
            );
        }
        if (feeOrder.payoutOrgId && feeOrder.payoutOrgId !== input.payoutOrgId) {
            throw new InvalidStateError(
                `FeePaymentOrder already initiated with different payoutOrgId (expected ${feeOrder.payoutOrgId}, got ${input.payoutOrgId})`
            );
        }
        if (feeOrder.payoutBankStableKey && feeOrder.payoutBankStableKey !== input.payoutBankStableKey) {
            throw new InvalidStateError(
                `FeePaymentOrder already initiated with different payoutBankStableKey (expected ${feeOrder.payoutBankStableKey}, got ${input.payoutBankStableKey})`
            );
        }
        if (!feeOrder.initiateEntryId || !feeOrder.pendingTransferId) {
            throw new InvalidStateError("FeePaymentOrder missing initiateEntryId/pendingTransferId");
        }
    }

    function quoteUsageRef(orderId: string): string {
        return `order:${orderId}:fx`;
    }

    function isUuidLike(value: string): boolean {
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
    }

    async function consumeFxQuoteForExecution(tx: any, input: ExecuteFxInput) {
        let quote: any | undefined;
        if (isUuidLike(input.quoteRef)) {
            const [byId] = await tx
                .select()
                .from(schema.fxQuotes)
                .where(eq(schema.fxQuotes.id, input.quoteRef))
                .limit(1);
            const [byIdempotency] = await tx
                .select()
                .from(schema.fxQuotes)
                .where(eq(schema.fxQuotes.idempotencyKey, input.quoteRef))
                .limit(1);

            if (byId && byIdempotency && byId.id !== byIdempotency.id) {
                throw new ValidationError(`quoteRef ${input.quoteRef} is ambiguous between quote ID and idempotency key`);
            }
            quote = byId ?? byIdempotency;
        } else {
            const [byIdempotency] = await tx
                .select()
                .from(schema.fxQuotes)
                .where(eq(schema.fxQuotes.idempotencyKey, input.quoteRef))
                .limit(1);
            quote = byIdempotency;
        }

        if (!quote) {
            throw new NotFoundError("FX quote", input.quoteRef);
        }

        if (quote.fromCurrency !== input.payInCurrency) {
            throw new CurrencyMismatchError("quote.fromCurrency", quote.fromCurrency, input.payInCurrency);
        }
        if (quote.toCurrency !== input.payOutCurrency) {
            throw new CurrencyMismatchError("quote.toCurrency", quote.toCurrency, input.payOutCurrency);
        }
        if (quote.fromAmountMinor !== input.principalMinor) {
            throw new AmountMismatchError("quote.fromAmountMinor", quote.fromAmountMinor, input.principalMinor);
        }
        if (quote.toAmountMinor !== input.payOutAmountMinor) {
            throw new AmountMismatchError("quote.toAmountMinor", quote.toAmountMinor, input.payOutAmountMinor);
        }
        const usageRef = quoteUsageRef(input.orderId);

        if (quote.status === "used") {
            if (quote.usedByRef === usageRef) {
                return quote;
            }
            throw new InvalidStateError(`Quote ${quote.id} is already used by ${quote.usedByRef ?? "unknown reference"}`);
        }

        if (quote.status !== "active") {
            throw new InvalidStateError(`Quote ${quote.id} is not active (status=${quote.status})`);
        }

        const consumedAt = new Date();
        if (quote.expiresAt.getTime() < consumedAt.getTime()) {
            throw new InvalidStateError(`Quote ${quote.id} expired at ${quote.expiresAt.toISOString()}`);
        }

        const updated = await tx
            .update(schema.fxQuotes)
            .set({
                status: "used",
                usedByRef: usageRef,
                usedAt: consumedAt,
            })
            .where(
                and(
                    eq(schema.fxQuotes.id, quote.id),
                    eq(schema.fxQuotes.status, "active"),
                    sql`${schema.fxQuotes.expiresAt} >= ${consumedAt}`
                )
            )
            .returning({ id: schema.fxQuotes.id, status: schema.fxQuotes.status, usedByRef: schema.fxQuotes.usedByRef });

        if (updated.length) {
            return quote;
        }

        // Concurrent consumer/update: re-check and allow idempotent same-order reuse.
        const [latest] = await tx
            .select({ id: schema.fxQuotes.id, status: schema.fxQuotes.status, usedByRef: schema.fxQuotes.usedByRef })
            .from(schema.fxQuotes)
            .where(eq(schema.fxQuotes.id, quote.id))
            .limit(1);

        if (latest?.status === "used" && latest.usedByRef === usageRef) {
            return quote;
        }

        throw new InvalidStateError(
            `Quote ${quote.id} could not be consumed atomically (status=${latest?.status ?? "unknown"})`
        );
    }

    async function fundingSettled(rawInput: FundingSettledInput) {
        const input = validateFundingSettledInput(rawInput);
        log.debug("fundingSettled start", { orderId: input.orderId, railRef: input.railRef });

        return db.transaction(async (tx: any) => {
            // Fetch order first to validate inputs match
            const [order] = await tx
                .select()
                .from(schema.paymentOrders)
                .where(eq(schema.paymentOrders.id, input.orderId))
                .limit(1);

            if (!order) throw new NotFoundError("Order", input.orderId);

            // Validate currency matches order's payInCurrency
            if (input.currency !== order.payInCurrency) {
                throw new CurrencyMismatchError("payInCurrency", order.payInCurrency, input.currency);
            }

            // Validate amount matches order's expected pay-in amount
            if (input.amountMinor !== order.payInExpectedMinor) {
                throw new AmountMismatchError("payInExpectedMinor", order.payInExpectedMinor, input.amountMinor);
            }

            // Validate customerId matches
            if (input.customerId !== order.customerId) {
                throw new ValidationError(`customerId mismatch: expected ${order.customerId}, got ${input.customerId}`);
            }
            if (input.branchOrgId !== order.payInOrgId) {
                throw new ValidationError(`branchOrgId mismatch: expected ${order.payInOrgId}, got ${input.branchOrgId}`);
            }

            const pk = makePlanKey("funding_settled", {
                railRef: input.railRef,
                orderId: input.orderId,
                currency: input.currency,
                amount: input.amountMinor.toString(),
                branchOrgId: input.branchOrgId,
                branchBankStableKey: input.branchBankStableKey,
                customerId: input.customerId
            });

            const { entryId } = await ledger.createEntryTx(tx, {
                orgId: SYSTEM_LEDGER_ORG_ID,
                source: { type: "order/funding_settled", id: input.orderId },
                idempotencyKey: `funding:${input.railRef}`,
                postingDate: input.occurredAt,
                transfers: [
                    {
                        type: PlanType.CREATE,
                        planKey: pk,
                        debitKey: keys.bank(input.branchOrgId, input.branchBankStableKey, input.currency),
                        creditKey: keys.customerWallet(input.customerId, input.currency),
                        currency: input.currency,
                        amount: input.amountMinor,
                        code: TransferCodes.FUNDING_SETTLED,
                        memo: "Funding settled"
                    }
                ]
            });

            // CAS transition
            const moved = await tx
                .update(schema.paymentOrders)
                .set({
                    status: TreasuryOrderStatus.FUNDING_SETTLED_PENDING_POSTING,
                    ledgerEntryId: entryId,
                    updatedAt: sql`now()`
                })
                .where(
                    and(
                        eq(schema.paymentOrders.id, input.orderId),
                        or(
                            eq(schema.paymentOrders.status, FundingSettledAllowedFrom[0]),
                            eq(schema.paymentOrders.status, FundingSettledAllowedFrom[1])
                        )
                    )
                )
                .returning({ id: schema.paymentOrders.id });

            if (moved.length) {
                log.info("fundingSettled ok", { orderId: input.orderId, entryId });
                return entryId;
            }

            // already advanced -> idempotent no-op
            // Re-check current status (order was fetched above but may have changed)
            const current = await fetchOrderState(tx, input.orderId);
            const st = current.status as string;
            const led = current.ledgerEntryId;

            if (isOrderStatusIn(st, AdvancedOrderStatuses)) {
                if (!led) throw new InvalidStateError(`Order in advanced state ${st} but ledgerEntryId missing`);
                if (led !== entryId) {
                    throw new InvalidStateError(
                        `Order advanced with different ledgerEntryId (expected ${entryId}, found ${led})`
                    );
                }
                log.debug("fundingSettled idempotent", { orderId: input.orderId, status: st });
                return led;
            }

            throw new InvalidStateError(`Cannot apply fundingSettled in state=${st}`);
        });
    }

    async function executeFx(rawInput: ExecuteFxInput) {
        const input = validateExecuteFxInput(rawInput);
        log.debug("executeFx start", { orderId: input.orderId, quoteRef: input.quoteRef });

        return db.transaction(async (tx: any) => {
            const [order] = await tx
                .select()
                .from(schema.paymentOrders)
                .where(eq(schema.paymentOrders.id, input.orderId))
                .limit(1);

            if (!order) throw new NotFoundError("Order", input.orderId);

            // Validate currencies match order
            if (input.payInCurrency !== order.payInCurrency) {
                throw new CurrencyMismatchError("payInCurrency", order.payInCurrency, input.payInCurrency);
            }
            if (input.payOutCurrency !== order.payOutCurrency) {
                throw new CurrencyMismatchError("payOutCurrency", order.payOutCurrency, input.payOutCurrency);
            }

            // Validate amounts match order
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
                    amount: input.principalMinor.toString()
                }),
                debitKey: keys.customerWallet(input.customerId, input.payInCurrency),
                creditKey: keys.orderInventory(input.orderId, input.payInCurrency),
                currency: input.payInCurrency,
                amount: input.principalMinor,
                code: TransferCodes.FX_PRINCIPAL,
                memo: "FX principal"
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

            // For banks/chains requiring separate payment order: reserve the fee in a clearing liability account.
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
                    amount: input.payOutAmountMinor.toString()
                }),
                debitKey: keys.orderInventory(input.orderId, input.payOutCurrency),
                creditKey: keys.payoutObligation(input.orderId, input.payOutCurrency),
                currency: input.payOutCurrency,
                amount: input.payOutAmountMinor,
                code: TransferCodes.FX_PAYOUT_OBLIGATION,
                memo: "Create payout obligation"
            });

            const { entryId } = await ledger.createEntryTx(tx, {
                orgId: SYSTEM_LEDGER_ORG_ID,
                source: { type: "order/fx_executed", id: input.orderId },
                idempotencyKey: `fx:${input.quoteRef}`,
                postingDate: input.occurredAt,
                transfers
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
                // Race condition: order status changed between SELECT and UPDATE
                // Check if this is an idempotent retry (order already has this entryId)
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
                    // Idempotent retry - order already has this entry
                    log.debug("executeFx idempotent", { orderId: input.orderId });
                    return entryId;
                }

                // Order moved to different state by another process
                throw new InvalidStateError(
                    `Failed to update order status: concurrent modification detected. ` +
                    `Current status: ${current[0]?.status ?? 'unknown'}`
                );
            }

            log.info("executeFx ok", { orderId: input.orderId, entryId, quoteRef: input.quoteRef });
            return entryId;
        });
    }

    async function initiatePayout(rawInput: InitiatePayoutInput) {
        const input = validateInitiatePayoutInput(rawInput);
        const timeoutSeconds = input.timeoutSeconds ?? 86400;
        log.debug("initiatePayout start", { orderId: input.orderId, railRef: input.railRef });

        return db.transaction(async (tx: any) => {
            const [order] = await tx
                .select()
                .from(schema.paymentOrders)
                .where(eq(schema.paymentOrders.id, input.orderId))
                .limit(1);

            if (!order) throw new NotFoundError("Order", input.orderId);

            // Validate currency matches order
            if (input.payOutCurrency !== order.payOutCurrency) {
                throw new CurrencyMismatchError("payOutCurrency", order.payOutCurrency, input.payOutCurrency);
            }

            // Validate amount matches order's payout amount
            if (input.amountMinor !== order.payOutAmountMinor) {
                throw new AmountMismatchError("payOutAmountMinor", order.payOutAmountMinor, input.amountMinor);
            }
            if (input.payoutOrgId !== order.payOutOrgId) {
                throw new ValidationError(`payoutOrgId mismatch: expected ${order.payOutOrgId}, got ${input.payoutOrgId}`);
            }

            if (!isOrderStatusIn(order.status, InitiatePayoutAllowedFrom)) {
                throw new InvalidStateError(`Order must be ${TreasuryOrderStatus.FX_EXECUTED} (posted), got ${order.status}`);
            }

            const planKey = makePlanKey("payout_init", {
                railRef: input.railRef,
                orderId: input.orderId,
                currency: input.payOutCurrency,
                amount: input.amountMinor.toString(),
                payoutOrgId: input.payoutOrgId,
                payoutBankStableKey: input.payoutBankStableKey
            });

            const { entryId, transferIds } = await ledger.createEntryTx(tx, {
                orgId: SYSTEM_LEDGER_ORG_ID,
                source: { type: "order/payout_initiated", id: input.orderId },
                idempotencyKey: `payout:init:${input.railRef}`,
                postingDate: input.occurredAt,
                transfers: [
                    {
                        type: PlanType.CREATE,
                        planKey,
                        debitKey: keys.payoutObligation(input.orderId, input.payOutCurrency),
                        creditKey: keys.bank(input.payoutOrgId, input.payoutBankStableKey, input.payOutCurrency),
                        currency: input.payOutCurrency,
                        amount: input.amountMinor,
                        code: TransferCodes.PAYOUT_INITIATED,
                        pending: {
                            timeoutSeconds
                        },
                        memo: "Payout initiated (pending)"
                    }
                ]
            });

            // Get the pending transfer ID from the first (and only) transfer
            const pendingTransferId = transferIds.get(1)!;

            const moved = await tx
                .update(schema.paymentOrders)
                .set({
                    status: TreasuryOrderStatus.PAYOUT_INITIATED_PENDING_POSTING,
                    ledgerEntryId: entryId,
                    payoutPendingTransferId: pendingTransferId,
                    updatedAt: sql`now()`
                })
                .where(and(eq(schema.paymentOrders.id, input.orderId), eq(schema.paymentOrders.status, TreasuryOrderStatus.FX_EXECUTED)))
                .returning({ id: schema.paymentOrders.id });

            if (moved.length) {
                log.info("initiatePayout ok", { orderId: input.orderId, entryId, pendingTransferId });
                return { entryId, pendingTransferId };
            }

            const current = await fetchOrderState(tx, input.orderId);
            const st = current.status;

            // If order is already advanced and points at our entry, treat as idempotent retry.
            if (isSameEntryInAllowedState(
                st as string,
                current.ledgerEntryId,
                entryId,
                [TreasuryOrderStatus.PAYOUT_INITIATED_PENDING_POSTING, TreasuryOrderStatus.PAYOUT_INITIATED]
            )) {
                if (!current.payoutPendingTransferId) {
                    throw new InvalidStateError(`Order in state ${st} but payoutPendingTransferId missing`);
                }
                log.debug("initiatePayout idempotent", { orderId: input.orderId, status: st });
                return { entryId, pendingTransferId: current.payoutPendingTransferId };
            }

            // Otherwise this indicates a concurrent modification or mismatched operation.
            throw new InvalidStateError(
                `Failed to update order status: concurrent modification detected. Current status: ${st}`
            );
        });
    }

    async function settlePayout(rawInput: SettlePayoutInput) {
        const input = validateSettlePayoutInput(rawInput);
        log.debug("settlePayout start", { orderId: input.orderId, railRef: input.railRef });

        return db.transaction(async (tx: any) => {
            const [o] = await tx
                .select()
                .from(schema.paymentOrders)
                .where(eq(schema.paymentOrders.id, input.orderId))
                .limit(1);

            if (!o) throw new NotFoundError("Order", input.orderId);

            // Validate currency matches order
            if (input.payOutCurrency !== o.payOutCurrency) {
                throw new CurrencyMismatchError("payOutCurrency", o.payOutCurrency, input.payOutCurrency);
            }

            if (!isOrderStatusIn(o.status, ResolvePendingPayoutAllowedFrom)) {
                throw new InvalidStateError(`Order must be ${TreasuryOrderStatus.PAYOUT_INITIATED} (posted), got ${o.status}`);
            }
            if (!o.payoutPendingTransferId) throw new InvalidStateError("Missing payoutPendingTransferId - order state is inconsistent");

            const pk = makePlanKey("payout_settle", {
                railRef: input.railRef,
                orderId: input.orderId,
                currency: input.payOutCurrency,
                pendingId: o.payoutPendingTransferId.toString()
            });

            const { entryId } = await ledger.createEntryTx(tx, {
                orgId: SYSTEM_LEDGER_ORG_ID,
                source: { type: "order/payout_settled", id: input.orderId },
                idempotencyKey: `payout:settle:${input.railRef}`,
                postingDate: input.occurredAt,
                transfers: [
                    {
                        type: PlanType.POST_PENDING,
                        planKey: pk,
                        currency: input.payOutCurrency,
                        pendingId: o.payoutPendingTransferId,
                        amount: 0n
                    }
                ]
            });

            const moved = await tx
                .update(schema.paymentOrders)
                .set({ status: TreasuryOrderStatus.CLOSED_PENDING_POSTING, ledgerEntryId: entryId, updatedAt: sql`now()` })
                .where(and(eq(schema.paymentOrders.id, input.orderId), eq(schema.paymentOrders.status, TreasuryOrderStatus.PAYOUT_INITIATED)))
                .returning({ id: schema.paymentOrders.id });

            if (moved.length) {
                log.info("settlePayout ok", { orderId: input.orderId, entryId });
                return entryId;
            }

            const current = await fetchOrderState(tx, input.orderId);
            const st = current.status;

            if (isSameEntryInAllowedState(
                st as string,
                current.ledgerEntryId,
                entryId,
                [TreasuryOrderStatus.CLOSED_PENDING_POSTING, TreasuryOrderStatus.CLOSED]
            )) {
                log.debug("settlePayout idempotent", { orderId: input.orderId, status: st });
                return entryId;
            }

            throw new InvalidStateError(
                `Failed to update order status: concurrent modification detected. Current status: ${st}`
            );
        });
    }

    async function voidPayout(rawInput: VoidPayoutInput) {
        const input = validateVoidPayoutInput(rawInput);
        log.debug("voidPayout start", { orderId: input.orderId, railRef: input.railRef });

        return db.transaction(async (tx: any) => {
            const [o] = await tx
                .select()
                .from(schema.paymentOrders)
                .where(eq(schema.paymentOrders.id, input.orderId))
                .limit(1);

            if (!o) throw new NotFoundError("Order", input.orderId);

            // Validate currency matches order
            if (input.payOutCurrency !== o.payOutCurrency) {
                throw new CurrencyMismatchError("payOutCurrency", o.payOutCurrency, input.payOutCurrency);
            }

            if (!isOrderStatusIn(o.status, ResolvePendingPayoutAllowedFrom)) {
                throw new InvalidStateError(`Order must be ${TreasuryOrderStatus.PAYOUT_INITIATED} (posted), got ${o.status}`);
            }
            if (!o.payoutPendingTransferId) throw new InvalidStateError("Missing payoutPendingTransferId - order state is inconsistent");

            const pk = makePlanKey("payout_void", {
                railRef: input.railRef,
                orderId: input.orderId,
                currency: input.payOutCurrency,
                pendingId: o.payoutPendingTransferId.toString()
            });

            const { entryId } = await ledger.createEntryTx(tx, {
                orgId: SYSTEM_LEDGER_ORG_ID,
                source: { type: "order/payout_failed", id: input.orderId },
                idempotencyKey: `payout:void:${input.railRef}`,
                postingDate: input.occurredAt,
                transfers: [
                    {
                        type: PlanType.VOID_PENDING,
                        planKey: pk,
                        currency: input.payOutCurrency,
                        pendingId: o.payoutPendingTransferId
                    }
                ]
            });

            const moved = await tx
                .update(schema.paymentOrders)
                .set({ status: TreasuryOrderStatus.FAILED_PENDING_POSTING, ledgerEntryId: entryId, updatedAt: sql`now()` })
                .where(and(eq(schema.paymentOrders.id, input.orderId), eq(schema.paymentOrders.status, TreasuryOrderStatus.PAYOUT_INITIATED)))
                .returning({ id: schema.paymentOrders.id });

            if (moved.length) {
                log.info("voidPayout ok", { orderId: input.orderId, entryId });
                return entryId;
            }

            const current = await fetchOrderState(tx, input.orderId);
            const st = current.status;

            if (isSameEntryInAllowedState(
                st as string,
                current.ledgerEntryId,
                entryId,
                [TreasuryOrderStatus.FAILED_PENDING_POSTING, TreasuryOrderStatus.FAILED]
            )) {
                log.debug("voidPayout idempotent", { orderId: input.orderId, status: st });
                return entryId;
            }

            throw new InvalidStateError(
                `Failed to update order status: concurrent modification detected. Current status: ${st}`
            );
        });
    }

    async function initiateFeePayment(rawInput: InitiateFeePaymentInput) {
        const input = validateInitiateFeePaymentInput(rawInput);
        const timeoutSeconds = input.timeoutSeconds ?? 86400;

        return db.transaction(async (tx: any) => {
            const feeOrder = await fetchFeePaymentOrderState(tx, input.feePaymentOrderId);

            if (feeOrder.status !== "reserved") {
                if (
                    feeOrder.status === "initiated_pending_posting"
                    || feeOrder.status === "initiated"
                    || feeOrder.status === "settled_pending_posting"
                    || feeOrder.status === "settled"
                    || feeOrder.status === "voided_pending_posting"
                    || feeOrder.status === "voided"
                ) {
                    assertInitiateFeePaymentReplayCompatible(feeOrder, input);
                    return {
                        entryId: feeOrder.initiateEntryId,
                        pendingTransferId: feeOrder.pendingTransferId,
                    };
                }
                throw new InvalidStateError(`FeePaymentOrder must be reserved, got ${feeOrder.status}`);
            }

            const planKey = makePlanKey("fee_payment_init", {
                feePaymentOrderId: input.feePaymentOrderId,
                railRef: input.railRef,
                currency: feeOrder.currency,
                amount: feeOrder.amountMinor.toString(),
                payoutOrgId: input.payoutOrgId,
                payoutBankStableKey: input.payoutBankStableKey,
            });

            const { entryId, transferIds } = await ledger.createEntryTx(tx, {
                orgId: SYSTEM_LEDGER_ORG_ID,
                source: { type: "fee_payment/initiated", id: input.feePaymentOrderId },
                idempotencyKey: `fee_payment:init:${input.feePaymentOrderId}:${input.railRef}`,
                postingDate: input.occurredAt,
                transfers: [
                    {
                        type: PlanType.CREATE,
                        planKey,
                        debitKey: keys.feeClearing(feeOrder.bucket, feeOrder.currency),
                        creditKey: keys.bank(input.payoutOrgId, input.payoutBankStableKey, feeOrder.currency),
                        currency: feeOrder.currency,
                        amount: feeOrder.amountMinor,
                        code: TransferCodes.FEE_PAYMENT_INITIATED,
                        pending: { timeoutSeconds },
                        memo: "Fee payment initiated (pending)",
                    },
                ],
            });

            const pendingTransferId = transferIds.get(1)!;

            const moved = await tx
                .update(schema.feePaymentOrders)
                .set({
                    status: "initiated_pending_posting",
                    initiateEntryId: entryId,
                    pendingTransferId,
                    payoutOrgId: input.payoutOrgId,
                    payoutBankStableKey: input.payoutBankStableKey,
                    railRef: input.railRef,
                    updatedAt: sql`now()`,
                })
                .where(
                    and(
                        eq(schema.feePaymentOrders.id, input.feePaymentOrderId),
                        eq(schema.feePaymentOrders.status, "reserved")
                    )
                )
                .returning({ id: schema.feePaymentOrders.id });

            if (moved.length) {
                return { entryId, pendingTransferId };
            }

            const current = await fetchFeePaymentOrderState(tx, input.feePaymentOrderId);
            if (
                current.initiateEntryId === entryId &&
                (current.status === "initiated_pending_posting" || current.status === "initiated")
            ) {
                if (!current.pendingTransferId) {
                    throw new InvalidStateError("FeePaymentOrder missing pendingTransferId");
                }
                return { entryId, pendingTransferId: current.pendingTransferId };
            }

            throw new InvalidStateError(
                `Failed to update fee payment order status: concurrent modification detected. Current status: ${current.status}`
            );
        });
    }

    async function settleFeePayment(rawInput: SettleFeePaymentInput) {
        const input = validateSettleFeePaymentInput(rawInput);

        return db.transaction(async (tx: any) => {
            const feeOrder = await fetchFeePaymentOrderState(tx, input.feePaymentOrderId);

            if (feeOrder.status !== "initiated") {
                if (feeOrder.status === "settled_pending_posting" || feeOrder.status === "settled") {
                    if (feeOrder.railRef !== input.railRef) {
                        throw new InvalidStateError(
                            `FeePaymentOrder already settled with different railRef (expected ${feeOrder.railRef ?? "null"}, got ${input.railRef})`
                        );
                    }
                    if (!feeOrder.resolveEntryId) {
                        throw new InvalidStateError("FeePaymentOrder missing resolveEntryId");
                    }
                    return feeOrder.resolveEntryId;
                }
                throw new InvalidStateError(`FeePaymentOrder must be initiated, got ${feeOrder.status}`);
            }
            if (!feeOrder.pendingTransferId) {
                throw new InvalidStateError("FeePaymentOrder missing pendingTransferId");
            }

            const planKey = makePlanKey("fee_payment_settle", {
                feePaymentOrderId: input.feePaymentOrderId,
                railRef: input.railRef,
                pendingId: feeOrder.pendingTransferId.toString(),
                currency: feeOrder.currency,
            });

            const { entryId } = await ledger.createEntryTx(tx, {
                orgId: SYSTEM_LEDGER_ORG_ID,
                source: { type: "fee_payment/settled", id: input.feePaymentOrderId },
                idempotencyKey: `fee_payment:settle:${input.feePaymentOrderId}:${input.railRef}`,
                postingDate: input.occurredAt,
                transfers: [
                    {
                        type: PlanType.POST_PENDING,
                        planKey,
                        currency: feeOrder.currency,
                        pendingId: feeOrder.pendingTransferId,
                        amount: 0n,
                    },
                ],
            });

            const moved = await tx
                .update(schema.feePaymentOrders)
                .set({
                    status: "settled_pending_posting",
                    resolveEntryId: entryId,
                    railRef: input.railRef,
                    updatedAt: sql`now()`,
                })
                .where(
                    and(
                        eq(schema.feePaymentOrders.id, input.feePaymentOrderId),
                        eq(schema.feePaymentOrders.status, "initiated")
                    )
                )
                .returning({ id: schema.feePaymentOrders.id });

            if (moved.length) {
                return entryId;
            }

            const current = await fetchFeePaymentOrderState(tx, input.feePaymentOrderId);
            if (
                current.resolveEntryId === entryId &&
                (current.status === "settled_pending_posting" || current.status === "settled")
            ) {
                return entryId;
            }

            throw new InvalidStateError(
                `Failed to update fee payment order status: concurrent modification detected. Current status: ${current.status}`
            );
        });
    }

    async function voidFeePayment(rawInput: VoidFeePaymentInput) {
        const input = validateVoidFeePaymentInput(rawInput);

        return db.transaction(async (tx: any) => {
            const feeOrder = await fetchFeePaymentOrderState(tx, input.feePaymentOrderId);

            if (feeOrder.status !== "initiated") {
                if (feeOrder.status === "voided_pending_posting" || feeOrder.status === "voided") {
                    if (feeOrder.railRef !== input.railRef) {
                        throw new InvalidStateError(
                            `FeePaymentOrder already voided with different railRef (expected ${feeOrder.railRef ?? "null"}, got ${input.railRef})`
                        );
                    }
                    if (!feeOrder.resolveEntryId) {
                        throw new InvalidStateError("FeePaymentOrder missing resolveEntryId");
                    }
                    return feeOrder.resolveEntryId;
                }
                throw new InvalidStateError(`FeePaymentOrder must be initiated, got ${feeOrder.status}`);
            }
            if (!feeOrder.pendingTransferId) {
                throw new InvalidStateError("FeePaymentOrder missing pendingTransferId");
            }

            const planKey = makePlanKey("fee_payment_void", {
                feePaymentOrderId: input.feePaymentOrderId,
                railRef: input.railRef,
                pendingId: feeOrder.pendingTransferId.toString(),
                currency: feeOrder.currency,
            });

            const { entryId } = await ledger.createEntryTx(tx, {
                orgId: SYSTEM_LEDGER_ORG_ID,
                source: { type: "fee_payment/voided", id: input.feePaymentOrderId },
                idempotencyKey: `fee_payment:void:${input.feePaymentOrderId}:${input.railRef}`,
                postingDate: input.occurredAt,
                transfers: [
                    {
                        type: PlanType.VOID_PENDING,
                        planKey,
                        currency: feeOrder.currency,
                        pendingId: feeOrder.pendingTransferId,
                    },
                ],
            });

            const moved = await tx
                .update(schema.feePaymentOrders)
                .set({
                    status: "voided_pending_posting",
                    resolveEntryId: entryId,
                    railRef: input.railRef,
                    updatedAt: sql`now()`,
                })
                .where(
                    and(
                        eq(schema.feePaymentOrders.id, input.feePaymentOrderId),
                        eq(schema.feePaymentOrders.status, "initiated")
                    )
                )
                .returning({ id: schema.feePaymentOrders.id });

            if (moved.length) {
                return entryId;
            }

            const current = await fetchFeePaymentOrderState(tx, input.feePaymentOrderId);
            if (
                current.resolveEntryId === entryId &&
                (current.status === "voided_pending_posting" || current.status === "voided")
            ) {
                return entryId;
            }

            throw new InvalidStateError(
                `Failed to update fee payment order status: concurrent modification detected. Current status: ${current.status}`
            );
        });
    }

    return {
        keys,
        fundingSettled,
        executeFx,
        initiatePayout,
        settlePayout,
        voidPayout,
        initiateFeePayment,
        settleFeePayment,
        voidFeePayment,
    };
}
