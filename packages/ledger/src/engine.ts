import { and, eq } from "drizzle-orm";
import { IdempotencyConflictError } from "./errors";
import { tbLedgerForCurrency, tbTransferIdForPlan, sha256Hex } from "./ids";
import { stableStringify } from "./canon";
import { PlanType, type CreateEntryInput, type TransferPlanLine } from "./types";
import { schema } from "@repo/db/schema";
import { type Database } from "@repo/db";

function normalizeCurrency(currency: string): string {
    const c = currency.trim().toUpperCase();
    if (!/^[A-Z0-9_]{2,16}$/.test(c)) {
        throw new Error(`Invalid currency format: "${currency}"`);
    }
    return c;
}

function validateChainBlocks(transfers: TransferPlanLine[]) {
    const pos = new Map<string, number[]>();
    for (let i = 0; i < transfers.length; i++) {
        const ch = transfers[i]!.chain;
        if (!ch) continue;
        const arr = pos.get(ch) ?? [];
        arr.push(i);
        pos.set(ch, arr);
    }
    for (const [ch, arr] of pos) {
        for (let i = 1; i < arr.length; i++) {
            if (arr[i]! !== arr[i - 1]! + 1) {
                throw new Error(
                    `Non-contiguous chain block detected for chain="${ch}". ` +
                    `Chain entries must be adjacent in transfers[] to be safe with TB linked semantics.`
                );
            }
        }
    }
}

// Safe: TB linked flag means “linked to NEXT transfer in batch”
function computeLinkedFlags(transfers: TransferPlanLine[]): boolean[] {
    const linked = new Array(transfers.length).fill(false);
    for (let i = 0; i < transfers.length - 1; i++) {
        const a = transfers[i]!.chain;
        const b = transfers[i + 1]!.chain;
        if (a && b && a === b) linked[i] = true;
    }
    return linked;
}

function normalizeAndValidateTransfers(input: TransferPlanLine[]): TransferPlanLine[] {
    if (!Array.isArray(input) || input.length === 0) throw new Error("transfers must be a non-empty array");

    const out = input.map((t) => {
        if (!t.planKey || t.planKey.length > 512) throw new Error(`Invalid planKey (missing/too long)`);

        const currency = normalizeCurrency(t.currency);

        if (t.type === PlanType.CREATE) {
            if (!t.debitKey || !t.creditKey) throw new Error("create transfer requires debitKey and creditKey");
            if (t.amount <= 0n) throw new Error("create transfer amount must be > 0");
            if (t.pending && t.pending.timeoutSeconds <= 0) throw new Error("pending timeoutSeconds must be > 0");
            return { ...t, currency };
        }

        if (t.type === PlanType.POST_PENDING) {
            const amount = t.amount ?? 0n;
            if (amount < 0n) throw new Error("post_pending amount must be >= 0");
            if (!t.pendingId || t.pendingId <= 0n) throw new Error("post_pending pendingId must be set");
            return { ...t, currency, amount };
        }

        // void_pending
        if (!t.pendingId || t.pendingId <= 0n) throw new Error("void_pending pendingId must be set");
        return { ...t, currency };
    });

    validateChainBlocks(out);
    return out;
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

export function createLedgerEngine(deps: { db: Database }) {
    const { db } = deps;

    async function createEntryTx(tx: any, input: CreateEntryInput): Promise<string> {
        const transfers = normalizeAndValidateTransfers(input.transfers);
        const planFingerprint = computePlanFingerprint(transfers);
        const linkedFlags = computeLinkedFlags(transfers);

        const inserted = await tx
            .insert(schema.journalEntries)
            .values({
                orgId: input.orgId,
                sourceType: input.source.type,
                sourceId: input.source.id,
                idempotencyKey: input.idempotencyKey,
                planFingerprint,
                postingDate: input.postingDate,
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
                .where(and(eq(schema.journalEntries.orgId, input.orgId), eq(schema.journalEntries.idempotencyKey, input.idempotencyKey)))
                .limit(1);

            if (!existing.length) throw new Error("Idempotency conflict but entry not found");
            entryId = existing[0]!.id;

            if (existing[0]!.planFingerprint !== planFingerprint) {
                throw new IdempotencyConflictError(
                    `Entry already exists with different plan fingerprint for idempotencyKey=${input.idempotencyKey}`
                );
            }
        }

        // journal lines derived from transfers (create only)
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
                orgId: input.orgId,
                entryId,
                lineNo: lineNo++,
                accountKey: t.debitKey,
                side: "debit",
                currency: t.currency,
                amountMinor: t.amount,
                memo: t.memo ?? null
            });
            derived.push({
                orgId: input.orgId,
                entryId,
                lineNo: lineNo++,
                accountKey: t.creditKey,
                side: "credit",
                currency: t.currency,
                amountMinor: t.amount,
                memo: t.memo ?? null
            });
        }
        if (derived.length) {
            await tx.insert(schema.journalLines).values(derived).onConflictDoNothing();
        }

        const planRows = transfers.map((t, i) => {
            const idx = i + 1;
            const tbLedger = tbLedgerForCurrency(t.currency);
            const transferId = tbTransferIdForPlan(input.orgId, entryId, idx, t.planKey);

            if (t.type === PlanType.CREATE) {
                return {
                    orgId: input.orgId,
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
                    orgId: input.orgId,
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
                orgId: input.orgId,
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

        // Outbox marker — makes “journal exists + will be posted” true atomically.
        await tx
            .insert(schema.outbox)
            .values({ orgId: input.orgId, kind: "post_journal", refId: entryId, status: "pending" })
            .onConflictDoNothing();

        return entryId;
    }

    async function createEntry(input: CreateEntryInput): Promise<string> {
        return db.transaction(async (tx: any) => createEntryTx(tx, input));
    }

    return {
        createEntry,
        createEntryTx
    };
}
