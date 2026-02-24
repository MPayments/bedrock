import { and, eq, inArray, sql } from "drizzle-orm";

import { type CurrenciesService } from "@bedrock/currencies";
import { type Database } from "@bedrock/db";
import { schema, TransferStatus } from "@bedrock/db/schema";
import { makePlanKey } from "@bedrock/kernel";
import { TransferCodes } from "@bedrock/kernel/constants";
import { PermissionError, NotFoundError } from "@bedrock/kernel/errors";
import { PlanType, type createLedgerEngine } from "@bedrock/ledger";

import { InvalidStateError } from "./errors";
import { transfersKeyspace } from "./keyspace";
import {
    validateCreateDraftInput,
    validateApproveInput,
    validateRejectInput,
    validateMarkFailedInput,
    type CreateDraftInput,
    type ApproveInput,
    type RejectInput,
    type MarkFailedInput,
} from "./validation";

type LedgerEngine = ReturnType<typeof createLedgerEngine>;

export interface Logger {
    info: (message: string, context?: Record<string, any>) => void;
    error: (message: string, context?: Record<string, any>) => void;
    debug: (message: string, context?: Record<string, any>) => void;
}

type TransactionClient = Parameters<Parameters<Database["transaction"]>[0]>[0];

/**
 * transfers = maker/checker слой над ledger.
 * Логику ролей/permission передаём через callbacks (RBAC будет в отдельном пакете).
 */
export function createTransfersService(deps: {
    db: Database;
    ledger: LedgerEngine;
    currenciesService: CurrenciesService;
    canApprove?: (actorUserId: string, transferCounterpartyId: string) => Promise<boolean> | boolean;
    logger?: Logger;
}) {
    const { db, ledger, currenciesService, logger } = deps;
    const { keys } = transfersKeyspace;

    async function createDraft(input: CreateDraftInput) {
        const validated = validateCreateDraftInput(input);

        const { id: currencyId } = await currenciesService.findByCode(validated.currency);

        logger?.debug("Creating draft transfer", {
            counterpartyId: validated.counterpartyId,
            idempotencyKey: validated.idempotencyKey,
            currency: validated.currency,
            amountMinor: validated.amountMinor.toString(),
        });

        const inserted = await db
            .insert(schema.internalTransfers)
            .values({
                counterpartyId: validated.counterpartyId,
                status: TransferStatus.DRAFT,
                fromAccountKey: validated.fromAccountKey,
                toAccountKey: validated.toAccountKey,
                currencyId,
                amountMinor: validated.amountMinor,
                memo: validated.memo ?? null,
                makerUserId: validated.makerUserId,
                idempotencyKey: validated.idempotencyKey
            })
            .onConflictDoNothing()
            .returning({ id: schema.internalTransfers.id });

        if (inserted.length) {
            logger?.info("Draft transfer created", {
                transferId: inserted[0]!.id,
                counterpartyId: validated.counterpartyId,
                currency: validated.currency,
                amountMinor: validated.amountMinor.toString(),
            });
            return inserted[0]!.id;
        }

        // Idempotent retry - fetch existing
        const existing = await db
            .select({ id: schema.internalTransfers.id })
            .from(schema.internalTransfers)
            .where(and(
                eq(schema.internalTransfers.counterpartyId, validated.counterpartyId),
                eq(schema.internalTransfers.idempotencyKey, validated.idempotencyKey)
            ))
            .limit(1);

        if (!existing.length) {
            throw new InvalidStateError("Draft upsert failed unexpectedly - conflict detected but record not found");
        }

        logger?.debug("Draft transfer already exists (idempotent)", {
            transferId: existing[0]!.id,
            idempotencyKey: validated.idempotencyKey,
        });

        return existing[0]!.id;
    }

    async function approve(input: ApproveInput) {
        const validated = validateApproveInput(input);

        const allowed = await deps.canApprove?.(validated.checkerUserId, validated.counterpartyId);
        if (allowed === false) {
            throw new PermissionError("Not allowed to approve transfers");
        }

        return db.transaction(async (tx: TransactionClient) => {
            const [transfer] = await tx
                .select()
                .from(schema.internalTransfers)
                .where(and(
                    eq(schema.internalTransfers.id, validated.transferId),
                    eq(schema.internalTransfers.counterpartyId, validated.counterpartyId)
                ))
                .limit(1);

            if (!transfer) {
                throw new NotFoundError("Transfer", validated.transferId);
            }

            if (transfer.status !== TransferStatus.DRAFT) {
                throw new InvalidStateError(
                    `approve allowed only from draft, got ${transfer.status}`,
                    transfer.status,
                    [TransferStatus.DRAFT]
                );
            }

            logger?.debug("Approving transfer", {
                transferId: transfer.id,
                counterpartyId: transfer.counterpartyId,
                checkerUserId: validated.checkerUserId,
            });
            const { code: currencyCode } = await currenciesService.findById(transfer.currencyId);

            // ledger entry (atomic with state transition)
            const planKey = makePlanKey("internal_transfer", {
                transferId: transfer.id,
                from: transfer.fromAccountKey,
                to: transfer.toAccountKey,
                currency: currencyCode,
                amount: transfer.amountMinor.toString()
            });

            const result = await ledger.createEntryTx(tx, {
                orgId: transfer.counterpartyId,
                source: { type: "internal_transfer", id: transfer.id },
                idempotencyKey: `transfer:${transfer.counterpartyId}:${transfer.id}`,
                postingDate: validated.occurredAt,
                transfers: [
                    {
                        type: PlanType.CREATE,
                        planKey,
                        debitKey: transfer.fromAccountKey,
                        creditKey: transfer.toAccountKey,
                        currency: currencyCode,
                        amount: transfer.amountMinor,
                        code: TransferCodes.INTERNAL_TRANSFER,
                        memo: transfer.memo ?? undefined
                    }
                ]
            });

            const entryId = result.entryId;

            // CAS update with status check
            const moved = await tx
                .update(schema.internalTransfers)
                .set({
                    status: TransferStatus.APPROVED_PENDING_POSTING,
                    checkerUserId: validated.checkerUserId,
                    approvedAt: validated.occurredAt,
                    ledgerEntryId: entryId,
                    updatedAt: sql`now()`
                })
                .where(and(
                    eq(schema.internalTransfers.id, transfer.id),
                    eq(schema.internalTransfers.status, TransferStatus.DRAFT)
                ))
                .returning({ id: schema.internalTransfers.id });

            if (!moved.length) {
                // Check for idempotent retry
                const [current] = await tx
                    .select({
                        status: schema.internalTransfers.status,
                        ledgerEntryId: schema.internalTransfers.ledgerEntryId,
                    })
                    .from(schema.internalTransfers)
                    .where(eq(schema.internalTransfers.id, transfer.id))
                    .limit(1);

                if (current && current.ledgerEntryId === entryId) {
                    const advancedStatuses = [
                        TransferStatus.APPROVED_PENDING_POSTING,
                        TransferStatus.POSTED,
                    ];
                    if (advancedStatuses.includes(current.status as TransferStatus)) {
                        logger?.debug("Transfer already approved (idempotent)", {
                            transferId: transfer.id,
                            status: current.status,
                            ledgerEntryId: entryId,
                        });
                        return { transferId: transfer.id, ledgerEntryId: entryId };
                    }
                }

                throw new InvalidStateError("Approve race: transfer state changed during transaction");
            }

            logger?.info("Transfer approved", {
                transferId: transfer.id,
                counterpartyId: transfer.counterpartyId,
                ledgerEntryId: entryId,
                checkerUserId: validated.checkerUserId,
            });

            return { transferId: transfer.id, ledgerEntryId: entryId };
        });
    }

    async function reject(input: RejectInput) {
        const validated = validateRejectInput(input);

        const allowed = await deps.canApprove?.(validated.checkerUserId, validated.counterpartyId);
        if (allowed === false) {
            throw new PermissionError("Not allowed to reject transfers");
        }

        logger?.debug("Rejecting transfer", {
            transferId: validated.transferId,
            counterpartyId: validated.counterpartyId,
            checkerUserId: validated.checkerUserId,
        });

        // CAS update with status check
        const updated = await db
            .update(schema.internalTransfers)
            .set({
                status: TransferStatus.REJECTED,
                checkerUserId: validated.checkerUserId,
                rejectedAt: validated.occurredAt,
                rejectReason: validated.reason,
                updatedAt: sql`now()`
            })
            .where(and(
                eq(schema.internalTransfers.id, validated.transferId),
                eq(schema.internalTransfers.counterpartyId, validated.counterpartyId),
                eq(schema.internalTransfers.status, TransferStatus.DRAFT)
            ))
            .returning({ id: schema.internalTransfers.id });

        if (!updated.length) {
            // Check if transfer exists and what state it's in
            const [current] = await db
                .select({ status: schema.internalTransfers.status })
                .from(schema.internalTransfers)
                .where(and(
                    eq(schema.internalTransfers.id, validated.transferId),
                    eq(schema.internalTransfers.counterpartyId, validated.counterpartyId)
                ))
                .limit(1);

            if (!current) {
                throw new NotFoundError("Transfer", validated.transferId);
            }

            if (current.status === TransferStatus.REJECTED) {
                // Idempotent retry
                logger?.debug("Transfer already rejected (idempotent)", {
                    transferId: validated.transferId,
                });
                return validated.transferId;
            }

            throw new InvalidStateError(
                `Reject allowed only from draft, got ${current.status}`,
                current.status,
                [TransferStatus.DRAFT]
            );
        }

        logger?.info("Transfer rejected", {
            transferId: validated.transferId,
            counterpartyId: validated.counterpartyId,
            checkerUserId: validated.checkerUserId,
            reason: validated.reason,
        });

        return updated[0]!.id;
    }

    async function markFailed(input: MarkFailedInput) {
        const validated = validateMarkFailedInput(input);

        logger?.debug("Marking transfer as failed", {
            transferId: validated.transferId,
            counterpartyId: validated.counterpartyId,
            reason: validated.reason,
        });

        // Only allow marking as failed from approved_pending_posting
        const updated = await db
            .update(schema.internalTransfers)
            .set({
                status: TransferStatus.FAILED,
                rejectReason: validated.reason,
                updatedAt: sql`now()`
            })
            .where(and(
                eq(schema.internalTransfers.id, validated.transferId),
                eq(schema.internalTransfers.counterpartyId, validated.counterpartyId),
                inArray(schema.internalTransfers.status, [
                    TransferStatus.APPROVED_PENDING_POSTING,
                    TransferStatus.FAILED, // Allow idempotent retries
                ])
            ))
            .returning({ id: schema.internalTransfers.id });

        if (!updated.length) {
            // Check if transfer exists
            const [current] = await db
                .select({ status: schema.internalTransfers.status })
                .from(schema.internalTransfers)
                .where(and(
                    eq(schema.internalTransfers.id, validated.transferId),
                    eq(schema.internalTransfers.counterpartyId, validated.counterpartyId)
                ))
                .limit(1);

            if (!current) {
                throw new NotFoundError("Transfer", validated.transferId);
            }

            throw new InvalidStateError(
                `markFailed allowed only from approved_pending_posting, got ${current.status}`,
                current.status,
                [TransferStatus.APPROVED_PENDING_POSTING]
            );
        }

        logger?.info("Transfer marked as failed", {
            transferId: validated.transferId,
            counterpartyId: validated.counterpartyId,
            reason: validated.reason,
        });
    }

    return {
        keys,
        createDraft,
        approve,
        reject,
        markFailed
    };
}
