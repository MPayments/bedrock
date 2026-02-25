import { and, eq, isNull } from "drizzle-orm";

import { CorrespondenceRuleNotFoundError } from "@bedrock/accounting";
import { type Transaction, type Database } from "@bedrock/db";
import { schema } from "@bedrock/db/schema";
import { sha256Hex, stableStringify } from "@bedrock/kernel";


import { IdempotencyConflictError } from "./errors";
import {
  tbBookAccountIdFor,
  tbLedgerForCurrency,
  tbTransferIdForOperation,
} from "./ids";
import {
  PlanType,
  type CreateOperationInput,
  type CreateOperationResult,
  type TransferPlanLine,
} from "./types";
import { validateCreateOperationInput, validateChainBlocks } from "./validation";

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
        planRef: t.planRef,
        chain: t.chain ?? null,
        bookOrgId: t.bookOrgId,
        debitAccountNo: t.debitAccountNo,
        creditAccountNo: t.creditAccountNo,
        postingCode: t.postingCode,
        currency: t.currency,
        amount: t.amount.toString(),
        code: t.code ?? 1,
        pendingTimeoutSeconds: t.pending?.timeoutSeconds ?? 0,
      };
    case PlanType.POST_PENDING:
      return {
        type: t.type,
        planRef: t.planRef,
        chain: t.chain ?? null,
        currency: t.currency,
        pendingId: t.pendingId.toString(),
        amount: (t.amount ?? 0n).toString(),
        code: t.code ?? 0,
      };
    case PlanType.VOID_PENDING:
      return {
        type: t.type,
        planRef: t.planRef,
        chain: t.chain ?? null,
        currency: t.currency,
        pendingId: t.pendingId.toString(),
        amount: "0",
        code: t.code ?? 0,
      };
  }
}

function computePayloadHash(input: {
  operationCode: string;
  operationVersion: number;
  payload: unknown;
  transfers: TransferPlanLine[];
}): string {
  return sha256Hex(
    stableStringify({
      operationCode: input.operationCode,
      operationVersion: input.operationVersion,
      payload: input.payload ?? null,
      transfers: input.transfers.map(normalizeForFingerprint),
    }),
  );
}

async function ensureCorrespondenceRule(
  tx: Transaction,
  plan: Extract<TransferPlanLine, { type: PlanType.CREATE }>,
) {
  const [orgRule] = await tx
    .select({ id: schema.correspondenceRules.id })
    .from(schema.correspondenceRules)
    .where(
      and(
        eq(schema.correspondenceRules.scope, "org"),
        eq(schema.correspondenceRules.orgId, plan.bookOrgId),
        eq(schema.correspondenceRules.postingCode, plan.postingCode),
        eq(schema.correspondenceRules.debitAccountNo, plan.debitAccountNo),
        eq(schema.correspondenceRules.creditAccountNo, plan.creditAccountNo),
        eq(schema.correspondenceRules.enabled, true),
      ),
    )
    .limit(1);

  if (orgRule) return;

  const [globalRule] = await tx
    .select({ id: schema.correspondenceRules.id })
    .from(schema.correspondenceRules)
    .where(
      and(
        eq(schema.correspondenceRules.scope, "global"),
        isNull(schema.correspondenceRules.orgId),
        eq(schema.correspondenceRules.postingCode, plan.postingCode),
        eq(schema.correspondenceRules.debitAccountNo, plan.debitAccountNo),
        eq(schema.correspondenceRules.creditAccountNo, plan.creditAccountNo),
        eq(schema.correspondenceRules.enabled, true),
      ),
    )
    .limit(1);

  if (!globalRule) {
    throw new CorrespondenceRuleNotFoundError(
      plan.postingCode,
      plan.debitAccountNo,
      plan.creditAccountNo,
      plan.bookOrgId,
    );
  }
}

async function ensureBookAccount(
  tx: Transaction,
  input: { orgId: string; accountNo: string; currency: string },
) {
  const tbLedger = tbLedgerForCurrency(input.currency);
  const expectedTbAccountId = tbBookAccountIdFor(
    input.orgId,
    input.accountNo,
    input.currency,
    tbLedger,
  );

  const inserted = await tx
    .insert(schema.bookAccounts)
    .values({
      orgId: input.orgId,
      accountNo: input.accountNo,
      currency: input.currency,
      tbLedger,
      tbAccountId: expectedTbAccountId,
    })
    .onConflictDoNothing()
    .returning({
      id: schema.bookAccounts.id,
      tbLedger: schema.bookAccounts.tbLedger,
      tbAccountId: schema.bookAccounts.tbAccountId,
    });

  if (inserted.length > 0) {
    return inserted[0]!;
  }

  const [existing] = await tx
    .select({
      id: schema.bookAccounts.id,
      tbLedger: schema.bookAccounts.tbLedger,
      tbAccountId: schema.bookAccounts.tbAccountId,
    })
    .from(schema.bookAccounts)
    .where(
      and(
        eq(schema.bookAccounts.orgId, input.orgId),
        eq(schema.bookAccounts.accountNo, input.accountNo),
        eq(schema.bookAccounts.currency, input.currency),
      ),
    )
    .limit(1);

  if (!existing) {
    throw new Error(
      `book account upsert failed for org=${input.orgId}, accountNo=${input.accountNo}, currency=${input.currency}`,
    );
  }

  if (
    existing.tbLedger !== tbLedger ||
    existing.tbAccountId !== expectedTbAccountId
  ) {
    throw new Error(
      `book account mapping mismatch for org=${input.orgId}, accountNo=${input.accountNo}, currency=${input.currency}`,
    );
  }

  return existing;
}

export interface LedgerEngine {
  createOperation: (input: CreateOperationInput) => Promise<CreateOperationResult>;
  createOperationTx: (
    tx: Transaction,
    input: CreateOperationInput,
  ) => Promise<CreateOperationResult>;
}

export function createLedgerEngine(deps: { db: Database }): LedgerEngine {
  const { db } = deps;

  async function createOperationTx(
    tx: Transaction,
    input: CreateOperationInput,
  ): Promise<CreateOperationResult> {
    const validated = validateCreateOperationInput(input);

    validateChainBlocks(validated.transfers);

    const transfers = validated.transfers;
    const payloadHash = computePayloadHash({
      operationCode: validated.operationCode,
      operationVersion: validated.operationVersion,
      payload: validated.payload,
      transfers,
    });

    const linkedFlags = computeLinkedFlags(transfers);

    const inserted = await tx
      .insert(schema.ledgerOperations)
      .values({
        sourceType: validated.source.type,
        sourceId: validated.source.id,
        operationCode: validated.operationCode,
        operationVersion: validated.operationVersion,
        idempotencyKey: validated.idempotencyKey,
        payloadHash,
        postingDate: validated.postingDate,
        status: "pending",
      })
      .onConflictDoNothing()
      .returning({ id: schema.ledgerOperations.id });

    let operationId: string;
    let isIdempotentReplay = false;

    if (inserted.length) {
      operationId = inserted[0]!.id;
    } else {
      const [existing] = await tx
        .select({
          id: schema.ledgerOperations.id,
          payloadHash: schema.ledgerOperations.payloadHash,
        })
        .from(schema.ledgerOperations)
        .where(eq(schema.ledgerOperations.idempotencyKey, validated.idempotencyKey))
        .limit(1);

      if (!existing) {
        throw new Error("Idempotency conflict but operation not found");
      }

      operationId = existing.id;
      if (existing.payloadHash !== payloadHash) {
        throw new IdempotencyConflictError(
          `Operation already exists with different payload hash for idempotencyKey=${validated.idempotencyKey}`,
        );
      }
      isIdempotentReplay = true;
    }

    if (isIdempotentReplay) {
      return {
        operationId,
        pendingTransferIdsByRef: new Map<string, bigint>(),
        transferIds: new Map<number, bigint>(),
      };
    }

    const pendingTransferIdsByRef = new Map<string, bigint>();
    const transferIds = new Map<number, bigint>();
    const postingRows: Array<typeof schema.ledgerPostings.$inferInsert> = [];
    const tbPlanRows: Array<typeof schema.tbTransferPlans.$inferInsert> = [];

    for (let i = 0; i < transfers.length; i++) {
      const lineNo = i + 1;
      const line = transfers[i]!;

      const transferId = tbTransferIdForOperation(operationId, lineNo, line.planRef);
      transferIds.set(lineNo, transferId);

      if (line.type === PlanType.CREATE) {
        await ensureCorrespondenceRule(tx, line);

        const [debitBookAccount, creditBookAccount] = await Promise.all([
          ensureBookAccount(tx, {
            orgId: line.bookOrgId,
            accountNo: line.debitAccountNo,
            currency: line.currency,
          }),
          ensureBookAccount(tx, {
            orgId: line.bookOrgId,
            accountNo: line.creditAccountNo,
            currency: line.currency,
          }),
        ]);

        postingRows.push({
          operationId,
          lineNo,
          bookOrgId: line.bookOrgId,
          debitBookAccountId: debitBookAccount.id,
          creditBookAccountId: creditBookAccount.id,
          postingCode: line.postingCode,
          currency: line.currency,
          amountMinor: line.amount,
          memo: line.memo ?? null,
          analyticCounterpartyId: line.analytics?.counterpartyId ?? null,
          analyticCustomerId: line.analytics?.customerId ?? null,
          analyticOrderId: line.analytics?.orderId ?? null,
          analyticOperationalAccountId: line.analytics?.operationalAccountId ?? null,
          analyticTransferId: line.analytics?.transferId ?? null,
          analyticQuoteId: line.analytics?.quoteId ?? null,
          analyticFeeBucket: line.analytics?.feeBucket ?? null,
        });

        if (line.pending) {
          pendingTransferIdsByRef.set(line.pending.ref ?? line.planRef, transferId);
        }

        tbPlanRows.push({
          operationId,
          lineNo,
          type: PlanType.CREATE,
          transferId,
          debitTbAccountId: debitBookAccount.tbAccountId,
          creditTbAccountId: creditBookAccount.tbAccountId,
          tbLedger: debitBookAccount.tbLedger,
          amount: line.amount,
          code: line.code ?? 1,
          pendingRef: line.pending?.ref ?? null,
          pendingId: null,
          isLinked: linkedFlags[i]!,
          isPending: !!line.pending,
          timeoutSeconds: line.pending?.timeoutSeconds ?? 0,
          status: "pending",
        });

        continue;
      }

      if (line.type === PlanType.POST_PENDING) {
        tbPlanRows.push({
          operationId,
          lineNo,
          type: PlanType.POST_PENDING,
          transferId,
          debitTbAccountId: null,
          creditTbAccountId: null,
          tbLedger: 0,
          amount: line.amount ?? 0n,
          code: line.code ?? 0,
          pendingRef: null,
          pendingId: line.pendingId,
          isLinked: linkedFlags[i]!,
          isPending: false,
          timeoutSeconds: 0,
          status: "pending",
        });
        continue;
      }

      tbPlanRows.push({
        operationId,
        lineNo,
        type: PlanType.VOID_PENDING,
        transferId,
        debitTbAccountId: null,
        creditTbAccountId: null,
        tbLedger: 0,
        amount: 0n,
        code: line.code ?? 0,
        pendingRef: null,
        pendingId: line.pendingId,
        isLinked: linkedFlags[i]!,
        isPending: false,
        timeoutSeconds: 0,
        status: "pending",
      });
    }

    if (postingRows.length > 0) {
      await tx.insert(schema.ledgerPostings).values(postingRows).onConflictDoNothing();
    }

    await tx.insert(schema.tbTransferPlans).values(tbPlanRows).onConflictDoNothing();

    await tx
      .insert(schema.outbox)
      .values({ kind: "post_operation", refId: operationId, status: "pending" })
      .onConflictDoNothing();

    return {
      operationId,
      pendingTransferIdsByRef,
      transferIds,
    };
  }

  async function createOperation(
    input: CreateOperationInput,
  ): Promise<CreateOperationResult> {
    return db.transaction(async (tx: Transaction) => createOperationTx(tx, input));
  }

  return {
    createOperation,
    createOperationTx,
  };
}
