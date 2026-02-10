import { and, eq, inArray, sql } from "drizzle-orm";
import { type Logger, makePlanKey, noopLogger } from "@repo/kernel";
import { schema } from "@repo/db/schema";
import { type Database } from "@repo/db";
import { type LedgerEngine, PlanType } from "@repo/ledger";

import {
    InvalidStateError,
    NotFoundError,
    ValidationError,
    AmountMismatchError,
    CurrencyMismatchError
} from "./errors";
import { treasuryKeyspace } from "./keyspace";
import { TransferCodes } from "@repo/kernel/constants";
import {
    validateFundingSettledInput,
    validateExecuteFxInput,
    validateInitiatePayoutInput,
    validateSettlePayoutInput,
    validateVoidPayoutInput,
    type FundingSettledInput,
    type ExecuteFxInput,
    type InitiatePayoutInput,
    type SettlePayoutInput,
    type VoidPayoutInput,
} from "./validation";

export function createTreasuryService(deps: {
    db: Database;
    ledger: LedgerEngine;
    treasuryOrgId: string;
    logger?: Logger;
}) {
    const { db, ledger, treasuryOrgId } = deps;
    const log = deps.logger?.child({ svc: "treasury" }) ?? noopLogger;
    const { keys } = treasuryKeyspace;

    async function fetchOrderState(tx: any, orderId: string) {
        const [row] = await tx
            .select({
                id: schema.paymentOrders.id,
                status: schema.paymentOrders.status,
                ledgerEntryId: schema.paymentOrders.ledgerEntryId,
                payoutPendingTransferId: schema.paymentOrders.payoutPendingTransferId,
                treasuryOrgId: schema.paymentOrders.treasuryOrgId,
            })
            .from(schema.paymentOrders)
            .where(and(eq(schema.paymentOrders.id, orderId), eq(schema.paymentOrders.treasuryOrgId, treasuryOrgId)))
            .limit(1);

        if (!row) throw new NotFoundError("Order", orderId);
        return row;
    }

    async function fundingSettled(rawInput: FundingSettledInput) {
        const input = validateFundingSettledInput(rawInput);
        log.debug("fundingSettled start", { orderId: input.orderId, railRef: input.railRef });

        return db.transaction(async (tx: any) => {
            // Fetch order first to validate inputs match
            const [order] = await tx
                .select()
                .from(schema.paymentOrders)
                .where(and(eq(schema.paymentOrders.id, input.orderId), eq(schema.paymentOrders.treasuryOrgId, treasuryOrgId)))
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
                orgId: treasuryOrgId,
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
                    status: "funding_settled_pending_posting",
                    ledgerEntryId: entryId,
                    updatedAt: sql`now()`
                })
                .where(
                    and(
                        eq(schema.paymentOrders.id, input.orderId),
                        eq(schema.paymentOrders.treasuryOrgId, treasuryOrgId),
                        inArray(schema.paymentOrders.status, ["quote", "funding_pending"])
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
            const st = current.status;
            const led = current.ledgerEntryId;

            // Use exact status matching instead of string includes for safety
            const advancedStatuses = [
                "funding_settled", "funding_settled_pending_posting",
                "fx_executed", "fx_executed_pending_posting",
                "payout_initiated", "payout_initiated_pending_posting",
                "closed", "closed_pending_posting",
                "failed", "failed_pending_posting"
            ];

            if (advancedStatuses.includes(st)) {
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
                .where(and(eq(schema.paymentOrders.id, input.orderId), eq(schema.paymentOrders.treasuryOrgId, treasuryOrgId)))
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

            if (order.status !== "funding_settled") {
                throw new InvalidStateError(`Order must be funding_settled (posted), got ${order.status}`);
            }

            const chain = `fx:${input.quoteRef}`;
            const transfers: any[] = [];

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
                creditKey: keys.orderPayIn(input.orderId, input.payInCurrency),
                currency: input.payInCurrency,
                amount: input.principalMinor,
                code: TransferCodes.FX_PRINCIPAL,
                memo: "FX principal"
            });

            if (input.feeMinor > 0n) {
                transfers.push({
                    type: PlanType.CREATE,
                    chain,
                    planKey: makePlanKey("fx_fee", {
                        quoteRef: input.quoteRef,
                        orderId: input.orderId,
                        currency: input.payInCurrency,
                        amount: input.feeMinor.toString()
                    }),
                    debitKey: keys.customerWallet(input.customerId, input.payInCurrency),
                    creditKey: keys.revenueFee(treasuryOrgId, input.payInCurrency),
                    currency: input.payInCurrency,
                    amount: input.feeMinor,
                    code: TransferCodes.FX_FEE_REVENUE,
                    memo: "Fee revenue"
                });
            }

            if (input.spreadMinor > 0n) {
                transfers.push({
                    type: PlanType.CREATE,
                    chain,
                    planKey: makePlanKey("fx_spread", {
                        quoteRef: input.quoteRef,
                        orderId: input.orderId,
                        currency: input.payInCurrency,
                        amount: input.spreadMinor.toString()
                    }),
                    debitKey: keys.customerWallet(input.customerId, input.payInCurrency),
                    creditKey: keys.revenueSpread(treasuryOrgId, input.payInCurrency),
                    currency: input.payInCurrency,
                    amount: input.spreadMinor,
                    code: TransferCodes.FX_SPREAD_REVENUE,
                    memo: "FX spread revenue"
                });
            }

            transfers.push({
                type: PlanType.CREATE,
                chain,
                planKey: makePlanKey("fx_to_ic_payin", {
                    quoteRef: input.quoteRef,
                    orderId: input.orderId,
                    branchOrgId: input.branchOrgId,
                    currency: input.payInCurrency,
                    amount: input.principalMinor.toString()
                }),
                debitKey: keys.orderPayIn(input.orderId, input.payInCurrency),
                creditKey: keys.intercompanyNet(treasuryOrgId, input.branchOrgId, input.payInCurrency),
                currency: input.payInCurrency,
                amount: input.principalMinor,
                code: TransferCodes.FX_INTERCOMPANY_COMMIT,
                memo: "Commit pay-in to intercompany"
            });

            transfers.push({
                type: PlanType.CREATE,
                chain,
                planKey: makePlanKey("fx_obligation", {
                    quoteRef: input.quoteRef,
                    orderId: input.orderId,
                    branchOrgId: input.branchOrgId,
                    currency: input.payOutCurrency,
                    amount: input.payOutAmountMinor.toString()
                }),
                debitKey: keys.intercompanyNet(treasuryOrgId, input.branchOrgId, input.payOutCurrency),
                creditKey: keys.payoutObligation(input.orderId, input.payOutCurrency),
                currency: input.payOutCurrency,
                amount: input.payOutAmountMinor,
                code: TransferCodes.FX_PAYOUT_OBLIGATION,
                memo: "Create payout obligation"
            });

            const { entryId } = await ledger.createEntryTx(tx, {
                orgId: treasuryOrgId,
                source: { type: "order/fx_executed", id: input.orderId },
                idempotencyKey: `fx:${input.quoteRef}`,
                postingDate: input.occurredAt,
                transfers
            });

            const moved = await tx
                .update(schema.paymentOrders)
                .set({ status: "fx_executed_pending_posting", ledgerEntryId: entryId, updatedAt: sql`now()` })
                .where(and(eq(schema.paymentOrders.id, input.orderId), eq(schema.paymentOrders.status, "funding_settled")))
                .returning({ id: schema.paymentOrders.id });

            if (!moved.length) {
                // Race condition: order status changed between SELECT and UPDATE
                // Check if this is an idempotent retry (order already has this entryId)
                const current = await tx
                    .select({ status: schema.paymentOrders.status, ledgerEntryId: schema.paymentOrders.ledgerEntryId })
                    .from(schema.paymentOrders)
                    .where(eq(schema.paymentOrders.id, input.orderId))
                    .limit(1);

                if (current.length && current[0]!.ledgerEntryId === entryId) {
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
                .where(and(eq(schema.paymentOrders.id, input.orderId), eq(schema.paymentOrders.treasuryOrgId, treasuryOrgId)))
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

            if (order.status !== "fx_executed") throw new InvalidStateError(`Order must be fx_executed (posted), got ${order.status}`);

            const planKey = makePlanKey("payout_init", {
                railRef: input.railRef,
                orderId: input.orderId,
                currency: input.payOutCurrency,
                amount: input.amountMinor.toString(),
                payoutOrgId: input.payoutOrgId,
                payoutBankStableKey: input.payoutBankStableKey
            });

            const { entryId, transferIds } = await ledger.createEntryTx(tx, {
                orgId: treasuryOrgId,
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
                    status: "payout_initiated_pending_posting",
                    ledgerEntryId: entryId,
                    payoutPendingTransferId: pendingTransferId,
                    updatedAt: sql`now()`
                })
                .where(and(eq(schema.paymentOrders.id, input.orderId), eq(schema.paymentOrders.status, "fx_executed")))
                .returning({ id: schema.paymentOrders.id });

            if (moved.length) {
                log.info("initiatePayout ok", { orderId: input.orderId, entryId, pendingTransferId });
                return { entryId, pendingTransferId };
            }

            const current = await fetchOrderState(tx, input.orderId);
            const st = current.status;

            // If order is already advanced and points at our entry, treat as idempotent retry.
            if (current.ledgerEntryId === entryId) {
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
                .where(and(eq(schema.paymentOrders.id, input.orderId), eq(schema.paymentOrders.treasuryOrgId, treasuryOrgId)))
                .limit(1);

            if (!o) throw new NotFoundError("Order", input.orderId);

            // Validate currency matches order
            if (input.payOutCurrency !== o.payOutCurrency) {
                throw new CurrencyMismatchError("payOutCurrency", o.payOutCurrency, input.payOutCurrency);
            }

            if (o.status !== "payout_initiated") throw new InvalidStateError(`Order must be payout_initiated (posted), got ${o.status}`);
            if (!o.payoutPendingTransferId) throw new InvalidStateError("Missing payoutPendingTransferId - order state is inconsistent");

            const pk = makePlanKey("payout_settle", {
                railRef: input.railRef,
                orderId: input.orderId,
                currency: input.payOutCurrency,
                pendingId: o.payoutPendingTransferId.toString()
            });

            const { entryId } = await ledger.createEntryTx(tx, {
                orgId: treasuryOrgId,
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
                .set({ status: "closed_pending_posting", ledgerEntryId: entryId, updatedAt: sql`now()` })
                .where(and(eq(schema.paymentOrders.id, input.orderId), eq(schema.paymentOrders.status, "payout_initiated")))
                .returning({ id: schema.paymentOrders.id });

            if (moved.length) {
                log.info("settlePayout ok", { orderId: input.orderId, entryId });
                return entryId;
            }

            const current = await fetchOrderState(tx, input.orderId);
            const st = current.status;

            if (current.ledgerEntryId === entryId && (st === "closed_pending_posting" || st === "closed")) {
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
                .where(and(eq(schema.paymentOrders.id, input.orderId), eq(schema.paymentOrders.treasuryOrgId, treasuryOrgId)))
                .limit(1);

            if (!o) throw new NotFoundError("Order", input.orderId);

            // Validate currency matches order
            if (input.payOutCurrency !== o.payOutCurrency) {
                throw new CurrencyMismatchError("payOutCurrency", o.payOutCurrency, input.payOutCurrency);
            }

            if (o.status !== "payout_initiated") throw new InvalidStateError(`Order must be payout_initiated (posted), got ${o.status}`);
            if (!o.payoutPendingTransferId) throw new InvalidStateError("Missing payoutPendingTransferId - order state is inconsistent");

            const pk = makePlanKey("payout_void", {
                railRef: input.railRef,
                orderId: input.orderId,
                currency: input.payOutCurrency,
                pendingId: o.payoutPendingTransferId.toString()
            });

            const { entryId } = await ledger.createEntryTx(tx, {
                orgId: treasuryOrgId,
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
                .set({ status: "failed_pending_posting", ledgerEntryId: entryId, updatedAt: sql`now()` })
                .where(and(eq(schema.paymentOrders.id, input.orderId), eq(schema.paymentOrders.status, "payout_initiated")))
                .returning({ id: schema.paymentOrders.id });

            if (moved.length) {
                log.info("voidPayout ok", { orderId: input.orderId, entryId });
                return entryId;
            }

            const current = await fetchOrderState(tx, input.orderId);
            const st = current.status;

            if (current.ledgerEntryId === entryId && (st === "failed_pending_posting" || st === "failed")) {
                log.debug("voidPayout idempotent", { orderId: input.orderId, status: st });
                return entryId;
            }

            throw new InvalidStateError(
                `Failed to update order status: concurrent modification detected. Current status: ${st}`
            );
        });
    }

    return {
        keys,
        fundingSettled,
        executeFx,
        initiatePayout,
        settlePayout,
        voidPayout
    };
}
