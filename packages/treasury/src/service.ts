import { and, eq, inArray, sql } from "drizzle-orm";
import { schema } from "@repo/db/schema";
import type { createLedgerEngine, Keyspace } from "@repo/ledger";
import { makePlanKey, PlanType, tbTransferIdForPlan } from "@repo/ledger";
import { Database } from "@repo/db";
import { InvalidStateError } from "./errors.js";
import { treasuryKeyspace } from "./keyspace.js";

type LedgerEngine = ReturnType<typeof createLedgerEngine>;

export function createTreasuryService(deps: {
    db: Database;
    ledger: LedgerEngine;
    treasuryOrgId: string;
    ks?: Keyspace<string, any>;
}) {
    const { db, ledger, treasuryOrgId } = deps;
    const ks = deps.ks ?? treasuryKeyspace;
    const K = ks.keys;

    async function fundingSettled(input: {
        orderId: string;
        branchOrgId: string;
        branchBankStableKey: string;
        customerId: string;

        currency: string;
        amountMinor: bigint;

        railRef: string;
        occurredAt: Date;
    }) {
        return db.transaction(async (tx: any) => {
            const pk = makePlanKey("funding_settled", {
                railRef: input.railRef,
                orderId: input.orderId,
                currency: input.currency,
                amount: input.amountMinor.toString(),
                branchOrgId: input.branchOrgId,
                branchBankStableKey: input.branchBankStableKey,
                customerId: input.customerId
            });

            const entryId = await ledger.createEntryTx(tx, {
                orgId: treasuryOrgId,
                source: { type: "order/funding_settled", id: input.orderId },
                idempotencyKey: `funding:${input.railRef}`,
                postingDate: input.occurredAt,
                transfers: [
                    {
                        type: PlanType.CREATE,
                        planKey: pk,
                        debitKey: K.bank(input.branchOrgId, input.branchBankStableKey, input.currency),
                        creditKey: K.customerWallet(input.customerId, input.currency),
                        currency: input.currency,
                        amount: input.amountMinor,
                        code: 1001,
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

            if (moved.length) return entryId;

            // already advanced -> idempotent no-op
            const existing = await tx
                .select({ status: schema.paymentOrders.status, ledgerEntryId: schema.paymentOrders.ledgerEntryId })
                .from(schema.paymentOrders)
                .where(and(eq(schema.paymentOrders.id, input.orderId), eq(schema.paymentOrders.treasuryOrgId, treasuryOrgId)))
                .limit(1);

            if (!existing.length) throw new Error("Order not found");

            const st = existing[0]!.status;
            const led = existing[0]!.ledgerEntryId;

            if (st.includes("funding_settled") || st.includes("fx_executed") || st.includes("payout_initiated") || st.includes("closed") || st.includes("failed")) {
                if (!led) throw new Error("Order in advanced state but ledgerEntryId missing");
                return led;
            }

            throw new InvalidStateError(`Cannot apply fundingSettled in state=${st}`);
        });
    }

    async function executeFx(input: {
        orderId: string;
        branchOrgId: string;
        customerId: string;

        payInCurrency: string;
        principalMinor: bigint;
        feeMinor: bigint;
        spreadMinor: bigint;

        payOutCurrency: string;
        payOutAmountMinor: bigint;

        occurredAt: Date;
        quoteRef: string;
    }) {
        return db.transaction(async (tx: any) => {
            const [o] = await tx
                .select()
                .from(schema.paymentOrders)
                .where(and(eq(schema.paymentOrders.id, input.orderId), eq(schema.paymentOrders.treasuryOrgId, treasuryOrgId)))
                .limit(1);

            if (!o) throw new Error("Order not found");
            if (o.status !== "funding_settled") {
                throw new InvalidStateError(`Order must be funding_settled (posted), got ${o.status}`);
            }

            const chain = `fx:${input.quoteRef}`;
            const transfers: any[] = [];

            transfers.push({
                type: "create",
                chain,
                planKey: makePlanKey("fx_principal", {
                    quoteRef: input.quoteRef,
                    orderId: input.orderId,
                    currency: input.payInCurrency,
                    amount: input.principalMinor.toString()
                }),
                debitKey: K.customerWallet(input.customerId, input.payInCurrency),
                creditKey: K.orderPayIn(input.orderId, input.payInCurrency),
                currency: input.payInCurrency,
                amount: input.principalMinor,
                code: 2001,
                memo: "FX principal"
            });

            if (input.feeMinor > 0n) {
                transfers.push({
                    type: "create",
                    chain,
                    planKey: makePlanKey("fx_fee", {
                        quoteRef: input.quoteRef,
                        orderId: input.orderId,
                        currency: input.payInCurrency,
                        amount: input.feeMinor.toString()
                    }),
                    debitKey: K.customerWallet(input.customerId, input.payInCurrency),
                    creditKey: K.revenueFee(treasuryOrgId, input.payInCurrency),
                    currency: input.payInCurrency,
                    amount: input.feeMinor,
                    code: 2002,
                    memo: "Fee revenue"
                });
            }

            if (input.spreadMinor > 0n) {
                transfers.push({
                    type: "create",
                    chain,
                    planKey: makePlanKey("fx_spread", {
                        quoteRef: input.quoteRef,
                        orderId: input.orderId,
                        currency: input.payInCurrency,
                        amount: input.spreadMinor.toString()
                    }),
                    debitKey: K.customerWallet(input.customerId, input.payInCurrency),
                    creditKey: K.revenueSpread(treasuryOrgId, input.payInCurrency),
                    currency: input.payInCurrency,
                    amount: input.spreadMinor,
                    code: 2003,
                    memo: "FX spread revenue"
                });
            }

            transfers.push({
                type: "create",
                chain,
                planKey: makePlanKey("fx_to_ic_payin", {
                    quoteRef: input.quoteRef,
                    orderId: input.orderId,
                    branchOrgId: input.branchOrgId,
                    currency: input.payInCurrency,
                    amount: input.principalMinor.toString()
                }),
                debitKey: K.orderPayIn(input.orderId, input.payInCurrency),
                creditKey: K.intercompanyNet(treasuryOrgId, input.branchOrgId, input.payInCurrency),
                currency: input.payInCurrency,
                amount: input.principalMinor,
                code: 2004,
                memo: "Commit pay-in to intercompany"
            });

            transfers.push({
                type: "create",
                chain,
                planKey: makePlanKey("fx_obligation", {
                    quoteRef: input.quoteRef,
                    orderId: input.orderId,
                    branchOrgId: input.branchOrgId,
                    currency: input.payOutCurrency,
                    amount: input.payOutAmountMinor.toString()
                }),
                debitKey: K.intercompanyNet(treasuryOrgId, input.branchOrgId, input.payOutCurrency),
                creditKey: K.payoutObligation(input.orderId, input.payOutCurrency),
                currency: input.payOutCurrency,
                amount: input.payOutAmountMinor,
                code: 2005,
                memo: "Create payout obligation"
            });

            const entryId = await ledger.createEntryTx(tx, {
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
                // someone raced and moved state; keep idempotent behaviour
                return entryId;
            }

            return entryId;
        });
    }

    async function initiatePayout(input: {
        orderId: string;

        payoutOrgId: string;
        payoutBankStableKey: string;

        payOutCurrency: string;
        amountMinor: bigint;

        railRef: string;
        timeoutSeconds?: number;
        occurredAt: Date;
    }) {
        return db.transaction(async (tx: any) => {
            const [o] = await tx
                .select()
                .from(schema.paymentOrders)
                .where(and(eq(schema.paymentOrders.id, input.orderId), eq(schema.paymentOrders.treasuryOrgId, treasuryOrgId)))
                .limit(1);

            if (!o) throw new Error("Order not found");
            if (o.status !== "fx_executed") throw new InvalidStateError(`Order must be fx_executed (posted), got ${o.status}`);

            const planKey = makePlanKey("payout_init", {
                railRef: input.railRef,
                orderId: input.orderId,
                currency: input.payOutCurrency,
                amount: input.amountMinor.toString(),
                payoutOrgId: input.payoutOrgId,
                payoutBankStableKey: input.payoutBankStableKey
            });

            const entryId = await ledger.createEntryTx(tx, {
                orgId: treasuryOrgId,
                source: { type: "order/payout_initiated", id: input.orderId },
                idempotencyKey: `payout:init:${input.railRef}`,
                postingDate: input.occurredAt,
                transfers: [
                    {
                        type: PlanType.CREATE,
                        planKey,
                        debitKey: K.payoutObligation(input.orderId, input.payOutCurrency),
                        creditKey: K.bank(input.payoutOrgId, input.payoutBankStableKey, input.payOutCurrency),
                        currency: input.payOutCurrency,
                        amount: input.amountMinor,
                        code: 3001,
                        pending: { timeoutSeconds: input.timeoutSeconds ?? 86400 },
                        memo: "Payout initiated (pending)"
                    }
                ]
            });

            const pendingTransferId = tbTransferIdForPlan(treasuryOrgId, entryId, 1, planKey);

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

            if (!moved.length) return { entryId, pendingTransferId };

            return { entryId, pendingTransferId };
        });
    }

    async function settlePayout(input: {
        orderId: string;
        payOutCurrency: string;
        railRef: string;
        occurredAt: Date;
    }) {
        return db.transaction(async (tx: any) => {
            const [o] = await tx
                .select()
                .from(schema.paymentOrders)
                .where(and(eq(schema.paymentOrders.id, input.orderId), eq(schema.paymentOrders.treasuryOrgId, treasuryOrgId)))
                .limit(1);

            if (!o) throw new Error("Order not found");
            if (o.status !== "payout_initiated") throw new InvalidStateError(`Order must be payout_initiated (posted), got ${o.status}`);
            if (!o.payoutPendingTransferId) throw new Error("Missing payoutPendingTransferId");

            const pk = makePlanKey("payout_settle", {
                railRef: input.railRef,
                orderId: input.orderId,
                currency: input.payOutCurrency,
                pendingId: o.payoutPendingTransferId.toString()
            });

            const entryId = await ledger.createEntryTx(tx, {
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

            if (!moved.length) return entryId;
            return entryId;
        });
    }

    async function voidPayout(input: {
        orderId: string;
        payOutCurrency: string;
        railRef: string;
        occurredAt: Date;
    }) {
        return db.transaction(async (tx: any) => {
            const [o] = await tx
                .select()
                .from(schema.paymentOrders)
                .where(and(eq(schema.paymentOrders.id, input.orderId), eq(schema.paymentOrders.treasuryOrgId, treasuryOrgId)))
                .limit(1);

            if (!o) throw new Error("Order not found");
            if (o.status !== "payout_initiated") throw new InvalidStateError(`Order must be payout_initiated (posted), got ${o.status}`);
            if (!o.payoutPendingTransferId) throw new Error("Missing payoutPendingTransferId");

            const pk = makePlanKey("payout_void", {
                railRef: input.railRef,
                orderId: input.orderId,
                currency: input.payOutCurrency,
                pendingId: o.payoutPendingTransferId.toString()
            });

            const entryId = await ledger.createEntryTx(tx, {
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

            if (!moved.length) return entryId;
            return entryId;
        });
    }

    return {
        ks,
        fundingSettled,
        executeFx,
        initiatePayout,
        settlePayout,
        voidPayout
    };
}
