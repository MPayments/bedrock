import { and, eq } from "drizzle-orm";
import { IdempotencyConflictError } from "./errors";
import { tbLedgerForCurrency, tbTransferIdForPlan, sha256Hex } from "./ids";
import { PlanType, type CreateEntryInput, type TransferPlanLine, type CreateEntryResult } from "./types";
import { schema } from "@bedrock/db/schema";
import { type Database } from "@bedrock/db";
import { validateCreateEntryInput, validateChainBlocks } from "./validation";
import { stableStringify } from "@bedrock/kernel";

function computeLinkedFlags(transfers: TransferPlanLine[]): boolean[] {
    const linked = new Array(transfers.length).fill(false);
    for (let i = 0; i < transfers.length - 1; i++) {
        const a = transfers[i]!.chain;
        const b = transfers[i + 1]!.chain;
        if (a && b && a === b) linked[i] = true;
    }
    return linked;
}

function normalizeForFingerprint(t: TransferPlanLine) {
    switch (t.type) {
        case PlanType.CREATE:
            return {
                type: t.type,
                planKey: t.planKey,
                chain: t.chain ?? null,
                debitKey: t.debitKey,
                creditKey: t.creditKey,
                currency: t.currency,
                amount: t.amount.toString(),
                code: t.code ?? 1,
                pendingTimeoutSeconds: t.pending?.timeoutSeconds ?? 0
            };
        case PlanType.POST_PENDING:
            return {
                type: t.type,
                planKey: t.planKey,
                chain: t.chain ?? null,
                currency: t.currency,
                pendingId: t.pendingId.toString(),
                amount: (t.amount ?? 0n).toString(),
                code: t.code ?? 0
            };
        case PlanType.VOID_PENDING:
            return {
                type: t.type,
                planKey: t.planKey,
                chain: t.chain ?? null,
                currency: t.currency,
                pendingId: t.pendingId.toString(),
                amount: "0",
                code: t.code ?? 0
            };
    }
}

function computePlanFingerprint(transfers: TransferPlanLine[]): string {
    return sha256Hex(stableStringify(transfers.map(normalizeForFingerprint)));
}

export type LedgerEngine = ReturnType<typeof createLedgerEngine>;

export function createLedgerEngine(deps: { db: Database }) {
    const { db } = deps;

    async function createEntryTx(tx: any, input: CreateEntryInput): Promise<CreateEntryResult> {
        const validated = validateCreateEntryInput(input);

        validateChainBlocks(validated.transfers);

        const transfers = validated.transfers;
        const planFingerprint = computePlanFingerprint(transfers);
        const linkedFlags = computeLinkedFlags(transfers);

        const inserted = await tx
            .insert(schema.journalEntries)
            .values({
                orgId: validated.orgId,
                sourceType: validated.source.type,
                sourceId: validated.source.id,
                idempotencyKey: validated.idempotencyKey,
                planFingerprint,
                postingDate: validated.postingDate,
                status: "pending"
            })
            .onConflictDoNothing()
            .returning({ id: schema.journalEntries.id });

        let entryId: string;

        if (inserted.length) {
            entryId = inserted[0]!.id;
        } else {
            const existing = await tx
                .select({ id: schema.journalEntries.id, planFingerprint: schema.journalEntries.planFingerprint })
                .from(schema.journalEntries)
                .where(and(eq(schema.journalEntries.orgId, validated.orgId), eq(schema.journalEntries.idempotencyKey, validated.idempotencyKey)))
                .limit(1);

            if (!existing.length) throw new Error("Idempotency conflict but entry not found");
            entryId = existing[0]!.id;

            if (existing[0]!.planFingerprint !== planFingerprint) {
                throw new IdempotencyConflictError(
                    `Entry already exists with different plan fingerprint for idempotencyKey=${validated.idempotencyKey}`
                );
            }
        }

        const derived: Array<{
            orgId: string;
            entryId: string;
            lineNo: number;
            accountKey: string;
            side: "debit" | "credit";
            currency: string;
            amountMinor: bigint;
            memo: string | null;
        }> = [];

        let lineNo = 1;
        for (const t of transfers) {
            if (t.type !== PlanType.CREATE) continue;
            derived.push({
                orgId: validated.orgId,
                entryId,
                lineNo: lineNo++,
                accountKey: t.debitKey!,
                side: "debit",
                currency: t.currency,
                amountMinor: t.amount,
                memo: t.memo ?? null
            });
            derived.push({
                orgId: validated.orgId,
                entryId,
                lineNo: lineNo++,
                accountKey: t.creditKey!,
                side: "credit",
                currency: t.currency,
                amountMinor: t.amount,
                memo: t.memo ?? null
            });
        }
        if (derived.length) {
            await tx.insert(schema.journalLines).values(derived).onConflictDoNothing();
        }

        // Build transfer IDs map for return value
        const transferIds = new Map<number, bigint>();

        const planRows = transfers.map((t: TransferPlanLine, i: number) => {
            const idx = i + 1;
            const tbLedger = tbLedgerForCurrency(t.currency);
            const transferId = tbTransferIdForPlan(validated.orgId, entryId, idx, t.planKey);

            // Store transfer ID in map for return
            transferIds.set(idx, transferId);

            if (t.type === PlanType.CREATE) {
                return {
                    orgId: validated.orgId,
                    journalEntryId: entryId,
                    idx,
                    planKey: t.planKey,
                    type: PlanType.CREATE,
                    chainId: t.chain ?? null,
                    transferId,
                    debitKey: t.debitKey,
                    creditKey: t.creditKey,
                    currency: t.currency,
                    tbLedger,
                    amount: t.amount,
                    code: t.code ?? 1,
                    isLinked: linkedFlags[i]!,
                    isPending: !!t.pending,
                    timeoutSeconds: t.pending?.timeoutSeconds ?? 0,
                    pendingId: null,
                    status: "pending" as const
                };
            }

            if (t.type === PlanType.POST_PENDING) {
                return {
                    orgId: validated.orgId,
                    journalEntryId: entryId,
                    idx,
                    planKey: t.planKey,
                    type: PlanType.POST_PENDING,
                    chainId: t.chain ?? null,
                    transferId,
                    debitKey: null,
                    creditKey: null,
                    currency: t.currency,
                    tbLedger,
                    amount: t.amount ?? 0n,
                    code: t.code ?? 0,
                    isLinked: linkedFlags[i]!,
                    isPending: false,
                    timeoutSeconds: 0,
                    pendingId: t.pendingId,
                    status: "pending" as const
                };
            }

            return {
                orgId: validated.orgId,
                journalEntryId: entryId,
                idx,
                planKey: t.planKey,
                type: PlanType.VOID_PENDING,
                chainId: t.chain ?? null,
                transferId,
                debitKey: null,
                creditKey: null,
                currency: t.currency,
                tbLedger,
                amount: 0n,
                code: t.code ?? 0,
                isLinked: linkedFlags[i]!,
                isPending: false,
                timeoutSeconds: 0,
                pendingId: t.pendingId,
                status: "pending" as const
            };
        });

        await tx.insert(schema.tbTransferPlans).values(planRows).onConflictDoNothing();

        await tx
            .insert(schema.outbox)
            .values({ orgId: validated.orgId, kind: "post_journal", refId: entryId, status: "pending" })
            .onConflictDoNothing();

        return { entryId, transferIds };
    }

    async function createEntry(input: CreateEntryInput): Promise<CreateEntryResult> {
        return db.transaction(async (tx: any) => createEntryTx(tx, input));
    }

    return {
        createEntry,
        createEntryTx
    };
}
