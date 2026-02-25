import { and, eq, sql } from "drizzle-orm";

import { OPERATION_CODE } from "@bedrock/accounting";
import { type Transaction } from "@bedrock/db";
import { schema } from "@bedrock/db/schema";
import { makePlanKey } from "@bedrock/kernel";
import { TransferCodes } from "@bedrock/kernel/constants";
import { PlanType } from "@bedrock/ledger";

import { AmountMismatchError, CurrencyMismatchError, InvalidStateError, NotFoundError, ValidationError } from "../errors";
import { SYSTEM_LEDGER_ORG_ID, type TreasuryServiceContext } from "../internal/context";
import { consumeFxQuoteForExecution } from "../internal/fx-quote";
import { buildTreasuryOperationInput, type KeyedTransferPlan } from "../internal/ledger-operation";
import { ExecuteFxAllowedFrom, TreasuryOrderStatus, isOrderStatusIn, isSameEntryInAllowedState } from "../state-machine";
import { type ExecuteFxInput, validateExecuteFxInput } from "../validation";

export function createExecuteFxHandler(context: TreasuryServiceContext) {
    const { db, ledger, feesService, currenciesService, log, keys } = context;

    return async function executeFx(input: ExecuteFxInput) {
        const validated = validateExecuteFxInput(input);
        log.debug("executeFx start", { orderId: validated.orderId, quoteRef: validated.quoteRef });

        return db.transaction(async (tx: Transaction) => {
            const [order] = await tx
                .select()
                .from(schema.paymentOrders)
                .where(eq(schema.paymentOrders.id, validated.orderId))
                .limit(1);

            if (!order) throw new NotFoundError("Order", validated.orderId);
            const { code: payInCurrency } = await currenciesService.findById(order.payInCurrencyId);
            const { code: payOutCurrency } = await currenciesService.findById(order.payOutCurrencyId);

            if (validated.payInCurrency !== payInCurrency) {
                throw new CurrencyMismatchError("payInCurrency", payInCurrency, validated.payInCurrency);
            }
            if (validated.payOutCurrency !== payOutCurrency) {
                throw new CurrencyMismatchError("payOutCurrency", payOutCurrency, validated.payOutCurrency);
            }

            if (validated.principalMinor !== order.payInExpectedMinor) {
                throw new AmountMismatchError("principalMinor (payInExpectedMinor)", order.payInExpectedMinor, validated.principalMinor);
            }
            if (validated.payOutAmountMinor !== order.payOutAmountMinor) {
                throw new AmountMismatchError("payOutAmountMinor", order.payOutAmountMinor, validated.payOutAmountMinor);
            }
            if (validated.customerId !== order.customerId) {
                throw new ValidationError(`customerId mismatch: expected ${order.customerId}, got ${validated.customerId}`);
            }
            if (validated.branchCounterpartyId !== order.payInCounterpartyId && validated.branchCounterpartyId !== order.payOutCounterpartyId) {
                throw new ValidationError(
                    `branchCounterpartyId mismatch: expected one of [${order.payInCounterpartyId}, ${order.payOutCounterpartyId}], got ${validated.branchCounterpartyId}`
                );
            }

            if (!isOrderStatusIn(order.status, ExecuteFxAllowedFrom)) {
                throw new InvalidStateError(`Order must be ${TreasuryOrderStatus.FUNDING_SETTLED} (posted), got ${order.status}`);
            }

            const quote = await consumeFxQuoteForExecution(tx, validated, currenciesService);
            const persistedQuoteLegRows = await tx
                .select()
                .from(schema.fxQuoteLegs)
                .where(eq(schema.fxQuoteLegs.quoteId, quote.id))
                .limit(2048);
            const legCurrencyIds = [...new Set(
                persistedQuoteLegRows
                    .flatMap((leg) => [
                        (leg as { fromCurrencyId?: string }).fromCurrencyId,
                        (leg as { toCurrencyId?: string }).toCurrencyId,
                    ])
                    .filter((id): id is string => Boolean(id)),
            )];
            const legCurrencyCodeById = new Map<string, string>();
            await Promise.all(
                legCurrencyIds.map(async (id) => {
                    const currency = await currenciesService.findById(id);
                    legCurrencyCodeById.set(id, currency.code);
                }),
            );
            const persistedQuoteLegs = persistedQuoteLegRows.map((leg) => ({
                ...leg,
                fromCurrency: legCurrencyCodeById.get((leg as { fromCurrencyId: string }).fromCurrencyId)!,
                toCurrency: legCurrencyCodeById.get((leg as { toCurrencyId: string }).toCurrencyId)!,
            }));
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
                    asOf: validated.occurredAt,
                    executionCounterpartyId: null,
                    createdAt: validated.occurredAt,
                    id: quote.id,
                    quoteId: quote.id,
                }];

            if (routeLegs[0]!.fromCurrency !== validated.payInCurrency) {
                throw new CurrencyMismatchError("route[0].fromCurrency", routeLegs[0]!.fromCurrency, validated.payInCurrency);
            }
            if (routeLegs[routeLegs.length - 1]!.toCurrency !== validated.payOutCurrency) {
                throw new CurrencyMismatchError(
                    "route[last].toCurrency",
                    routeLegs[routeLegs.length - 1]!.toCurrency,
                    validated.payOutCurrency
                );
            }
            if (routeLegs[0]!.fromAmountMinor !== validated.principalMinor) {
                throw new AmountMismatchError("route[0].fromAmountMinor", routeLegs[0]!.fromAmountMinor, validated.principalMinor);
            }
            if (routeLegs[routeLegs.length - 1]!.toAmountMinor !== validated.payOutAmountMinor) {
                throw new AmountMismatchError(
                    "route[last].toAmountMinor",
                    routeLegs[routeLegs.length - 1]!.toAmountMinor,
                    validated.payOutAmountMinor
                );
            }

            const chain = `fx:${validated.quoteRef}`;
            const transfers: KeyedTransferPlan[] = [];
            const separateFeeOrders: {
                componentId: string;
                kind: string;
                bucket: string;
                currency: string;
                amountMinor: bigint;
                memo: string | null | undefined;
                metadata: Record<string, string> | undefined;
            }[] = [];

            transfers.push({
                type: PlanType.CREATE,
                chain,
                planKey: makePlanKey("fx_principal", {
                    quoteRef: validated.quoteRef,
                    orderId: validated.orderId,
                    currency: validated.payInCurrency,
                    amount: validated.principalMinor.toString(),
                }),
                debitKey: keys.customerWallet(validated.customerId, validated.payInCurrency),
                creditKey: keys.orderInventory(validated.orderId, validated.payInCurrency),
                currency: validated.payInCurrency,
                amount: validated.principalMinor,
                code: TransferCodes.FX_PRINCIPAL,
                memo: "FX principal",
            });

            for (const leg of routeLegs) {
                const executionCounterpartyId = leg.executionCounterpartyId ?? validated.branchCounterpartyId;

                transfers.push({
                    type: PlanType.CREATE,
                    chain,
                    planKey: makePlanKey("fx_leg_out", {
                        quoteRef: validated.quoteRef,
                        orderId: validated.orderId,
                        idx: leg.idx,
                        executionCounterpartyId,
                        fromCurrency: leg.fromCurrency,
                        amount: leg.fromAmountMinor.toString(),
                    }),
                    debitKey: keys.orderInventory(validated.orderId, leg.fromCurrency),
                    creditKey: keys.intercompanyNet(executionCounterpartyId, leg.fromCurrency),
                    currency: leg.fromCurrency,
                    amount: leg.fromAmountMinor,
                    code: TransferCodes.FX_LEG_OUT,
                    memo: `FX leg ${leg.idx} out`,
                });

                transfers.push({
                    type: PlanType.CREATE,
                    chain,
                    planKey: makePlanKey("fx_leg_in", {
                        quoteRef: validated.quoteRef,
                        orderId: validated.orderId,
                        idx: leg.idx,
                        executionCounterpartyId,
                        toCurrency: leg.toCurrency,
                        amount: leg.toAmountMinor.toString(),
                    }),
                    debitKey: keys.intercompanyNet(executionCounterpartyId, leg.toCurrency),
                    creditKey: keys.orderInventory(validated.orderId, leg.toCurrency),
                    currency: leg.toCurrency,
                    amount: leg.toAmountMinor,
                    code: TransferCodes.FX_LEG_IN,
                    memo: `FX leg ${leg.idx} in`,
                });
            }

            const quoteFeeComponents = await feesService.getQuoteFeeComponents({ quoteId: quote.id }, tx);
            const mergedFeeComponents = feesService.mergeFeeComponents({
                computed: quoteFeeComponents,
                manual: validated.fees,
            });

            const { inLedger, separatePaymentOrder } = feesService.partitionFeeComponents(mergedFeeComponents);

            const inLedgerFeePlans = feesService.buildFeeTransferPlans({
                components: inLedger,
                chain,
                makePlanKey: (component, idx) =>
                    makePlanKey("fx_fee_component", {
                        quoteRef: validated.quoteRef,
                        orderId: validated.orderId,
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

                    const debitKey = keys.customerWallet(validated.customerId, component.currency);
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
                        quoteRef: validated.quoteRef,
                        orderId: validated.orderId,
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
                        debitKey: keys.customerWallet(validated.customerId, component.currency),
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
                manual: validated.adjustments,
            });
            const partitionedAdjustments = feesService.partitionAdjustmentComponents(mergedAdjustments);

            const inLedgerAdjustmentPlans = feesService.buildAdjustmentTransferPlans({
                components: partitionedAdjustments.inLedger,
                chain,
                makePlanKey: (component, idx) =>
                    makePlanKey("fx_adjustment_component", {
                        quoteRef: validated.quoteRef,
                        orderId: validated.orderId,
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
                            debitKey: keys.customerWallet(validated.customerId, component.currency),
                            creditKey: keys.adjustmentRevenue(bucket, component.currency),
                            code: component.transferCode ?? TransferCodes.ADJUSTMENT_CHARGE,
                            memo: component.memo ?? "Adjustment charge",
                        };
                    }

                    return {
                        debitKey: keys.adjustmentExpense(bucket, component.currency),
                        creditKey: keys.customerWallet(validated.customerId, component.currency),
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
                        quoteRef: validated.quoteRef,
                        orderId: validated.orderId,
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
                            debitKey: keys.customerWallet(validated.customerId, component.currency),
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
                    quoteRef: validated.quoteRef,
                    orderId: validated.orderId,
                    payOutCounterpartyId: order.payOutCounterpartyId,
                    currency: validated.payOutCurrency,
                    amount: validated.payOutAmountMinor.toString(),
                }),
                debitKey: keys.orderInventory(validated.orderId, validated.payOutCurrency),
                creditKey: keys.payoutObligation(validated.orderId, validated.payOutCurrency),
                currency: validated.payOutCurrency,
                amount: validated.payOutAmountMinor,
                code: TransferCodes.FX_PAYOUT_OBLIGATION,
                memo: "Create payout obligation",
            });

            const { operationId: entryId } = await ledger.createOperationTx(
                tx,
                buildTreasuryOperationInput({
                    source: { type: "order/fx_executed", id: validated.orderId },
                    operationCode: OPERATION_CODE.TREASURY_FX_EXECUTED,
                    payload: {
                        orderId: validated.orderId,
                        quoteRef: validated.quoteRef,
                        principalMinor: validated.principalMinor.toString(),
                        payOutAmountMinor: validated.payOutAmountMinor.toString(),
                        payInCurrency: validated.payInCurrency,
                        payOutCurrency: validated.payOutCurrency,
                    },
                    idempotencyKey: `fx:${validated.quoteRef}`,
                    postingDate: validated.occurredAt,
                    bookOrgId: SYSTEM_LEDGER_ORG_ID,
                    transfers,
                })
            );

            if (separateFeeOrders.length) {
                const uniqueFeeOrderCurrencies = [...new Set(separateFeeOrders.map((item) => item.currency))];
                const feeOrderCurrencyIdByCode = new Map<string, string>();
                await Promise.all(
                    uniqueFeeOrderCurrencies.map(async (code) => {
                        const currency = await currenciesService.findByCode(code);
                        feeOrderCurrencyIdByCode.set(currency.code, currency.id);
                    }),
                );

                await tx
                    .insert(schema.feePaymentOrders)
                    .values(
                        separateFeeOrders.map((item) => ({
                            parentOrderId: validated.orderId,
                            quoteId: quote.id,
                            componentId: item.componentId,
                            idempotencyKey: `fee_order:${validated.orderId}:${item.kind}:${item.componentId}`,
                            kind: item.kind,
                            bucket: item.bucket,
                            currencyId: feeOrderCurrencyIdByCode.get(item.currency)!,
                            amountMinor: item.amountMinor,
                            memo: item.memo ?? null,
                            metadata: item.metadata ?? null,
                            reserveOperationId: entryId,
                            status: "reserved" as const,
                        }))
                    )
                    .onConflictDoNothing({
                        target: schema.feePaymentOrders.idempotencyKey,
                    });
            }

            const moved = await tx
                .update(schema.paymentOrders)
                .set({ status: TreasuryOrderStatus.FX_EXECUTED_PENDING_POSTING, ledgerOperationId: entryId, updatedAt: sql`now()` })
                .where(and(eq(schema.paymentOrders.id, validated.orderId), eq(schema.paymentOrders.status, TreasuryOrderStatus.FUNDING_SETTLED)))
                .returning({ id: schema.paymentOrders.id });

            if (!moved.length) {
                const current = await tx
                    .select({ status: schema.paymentOrders.status, ledgerOperationId: schema.paymentOrders.ledgerOperationId })
                    .from(schema.paymentOrders)
                    .where(eq(schema.paymentOrders.id, validated.orderId))
                    .limit(1);
                const currentLedgerOperationId = current[0]?.ledgerOperationId ?? null;

                if (current.length && isSameEntryInAllowedState(
                    current[0]!.status as string,
                    currentLedgerOperationId,
                    entryId,
                    [TreasuryOrderStatus.FX_EXECUTED_PENDING_POSTING, TreasuryOrderStatus.FX_EXECUTED]
                )) {
                    log.debug("executeFx idempotent", { orderId: validated.orderId });
                    return entryId;
                }

                throw new InvalidStateError(
                    `Failed to update order status: concurrent modification detected. ` +
                    `Current status: ${current[0]?.status ?? "unknown"}`
                );
            }

            log.info("executeFx ok", { orderId: validated.orderId, entryId, quoteRef: validated.quoteRef });
            return entryId;
        });
    };
}
