import { and, eq } from "drizzle-orm";

import {
  CorrespondenceRuleNotFoundError,
  DEFAULT_CHART_TEMPLATE_ACCOUNTS,
  DEFAULT_CHART_TEMPLATE_ACCOUNT_ANALYTICS,
  DEFAULT_GLOBAL_CORRESPONDENCE_RULES,
  POSTING_CODE_REQUIRED_ANALYTICS,
} from "@bedrock/accounting";
import { type Transaction, type Database } from "@bedrock/db";
import { schema } from "@bedrock/db/schema";
import { sha256Hex, stableStringify } from "@bedrock/kernel";

import {
  AccountPostingValidationError,
  IdempotencyConflictError,
  MissingRequiredAnalyticsError,
} from "./errors";
import {
  tbBookAccountIdFor,
  tbLedgerForCurrency,
  tbTransferIdForOperation,
} from "./ids";
import {
  OPERATION_TRANSFER_TYPE,
  type CreateOperationInput,
  type CreateOperationResult,
  type TransferPlanLine,
} from "./types";
import {
  validateCreateOperationInput,
  validateChainBlocks,
} from "./validation";

const ANALYTIC_FIELD_BY_TYPE = {
  counterparty_id: "counterpartyId",
  customer_id: "customerId",
  order_id: "orderId",
  operational_account_id: "operationalAccountId",
  transfer_id: "transferId",
  quote_id: "quoteId",
  fee_bucket: "feeBucket",
} as const;

type PostingAnalyticType = keyof typeof ANALYTIC_FIELD_BY_TYPE;
type CreateTransferLine = Extract<
  TransferPlanLine,
  { type: typeof OPERATION_TRANSFER_TYPE.CREATE }
>;

interface PostingAccountPolicy {
  postingAllowed: boolean;
  enabled: boolean;
  requiredAnalytics: PostingAnalyticType[];
}

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
    case OPERATION_TRANSFER_TYPE.CREATE:
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
    case OPERATION_TRANSFER_TYPE.POST_PENDING:
      return {
        type: t.type,
        planRef: t.planRef,
        chain: t.chain ?? null,
        currency: t.currency,
        pendingId: t.pendingId.toString(),
        amount: (t.amount ?? 0n).toString(),
        code: t.code ?? 0,
      };
    case OPERATION_TRANSFER_TYPE.VOID_PENDING:
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

function buildReplayTransferMaps(
  operationId: string,
  transfers: TransferPlanLine[],
) {
  const pendingTransferIdsByRef = new Map<string, bigint>();

  for (let i = 0; i < transfers.length; i++) {
    const lineNo = i + 1;
    const line = transfers[i]!;
    const transferId = tbTransferIdForOperation(
      operationId,
      lineNo,
      line.planRef,
    );

    if (line.type === OPERATION_TRANSFER_TYPE.CREATE && line.pending) {
      pendingTransferIdsByRef.set(line.pending.ref ?? line.planRef, transferId);
    }
  }

  return {
    pendingTransferIdsByRef,
  };
}

async function ensureCorrespondenceRule(
  tx: Transaction,
  plan: CreateTransferLine,
) {
  const [rule] = await tx
    .select({ id: schema.correspondenceRules.id })
    .from(schema.correspondenceRules)
    .where(
      and(
        eq(schema.correspondenceRules.postingCode, plan.postingCode),
        eq(schema.correspondenceRules.debitAccountNo, plan.debitAccountNo),
        eq(schema.correspondenceRules.creditAccountNo, plan.creditAccountNo),
        eq(schema.correspondenceRules.enabled, true),
      ),
    )
    .limit(1);

  if (!rule) {
    throw new CorrespondenceRuleNotFoundError(
      plan.postingCode,
      plan.debitAccountNo,
      plan.creditAccountNo,
    );
  }
}

async function loadPostingAccountPolicy(
  tx: Transaction,
  accountNo: string,
): Promise<PostingAccountPolicy> {
  const [templateAccount, requiredAnalytics] = await Promise.all([
    tx
      .select({
        postingAllowed: schema.chartTemplateAccounts.postingAllowed,
        enabled: schema.chartTemplateAccounts.enabled,
      })
      .from(schema.chartTemplateAccounts)
      .where(eq(schema.chartTemplateAccounts.accountNo, accountNo))
      .limit(1),
    tx
      .select({
        analyticType: schema.chartTemplateAccountAnalytics.analyticType,
      })
      .from(schema.chartTemplateAccountAnalytics)
      .where(
        and(
          eq(schema.chartTemplateAccountAnalytics.accountNo, accountNo),
          eq(schema.chartTemplateAccountAnalytics.required, true),
        ),
      ),
  ]);

  const template = templateAccount[0];
  if (!template) {
    throw new AccountPostingValidationError(
      `Unknown chart account ${accountNo}`,
    );
  }

  return {
    postingAllowed: template.postingAllowed,
    enabled: template.enabled,
    requiredAnalytics: requiredAnalytics.map(
      (item) => item.analyticType as PostingAnalyticType,
    ),
  };
}

async function ensurePostingAccountAllowed(
  tx: Transaction,
  cache: Map<string, PostingAccountPolicy>,
  input: {
    accountNo: string;
    postingCode: string;
    analytics?: CreateTransferLine["analytics"];
  },
) {
  const cacheKey = input.accountNo;
  let policy = cache.get(cacheKey);
  if (!policy) {
    policy = await loadPostingAccountPolicy(tx, input.accountNo);
    cache.set(cacheKey, policy);
  }

  if (!policy.postingAllowed) {
    throw new AccountPostingValidationError(
      `Account ${input.accountNo} is not postable`,
    );
  }

  if (!policy.enabled) {
    throw new AccountPostingValidationError(
      `Account ${input.accountNo} is disabled`,
    );
  }

  for (const analyticType of policy.requiredAnalytics) {
    const field = ANALYTIC_FIELD_BY_TYPE[analyticType];
    const value = input.analytics?.[field];
    if (value === undefined || value === null || value === "") {
      throw new MissingRequiredAnalyticsError(
        input.accountNo,
        analyticType,
        input.postingCode,
      );
    }
  }

  const postingRequired =
    POSTING_CODE_REQUIRED_ANALYTICS[
      input.postingCode as keyof typeof POSTING_CODE_REQUIRED_ANALYTICS
    ] ?? [];

  for (const analyticType of postingRequired) {
    const field =
      ANALYTIC_FIELD_BY_TYPE[
        analyticType as keyof typeof ANALYTIC_FIELD_BY_TYPE
      ];
    const value = input.analytics?.[field];
    if (value === undefined || value === null || value === "") {
      throw new AccountPostingValidationError(
        `Posting code ${input.postingCode} requires analytic ${analyticType}`,
      );
    }
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

async function ensureAccountingDefaultsSeeded(tx: Transaction) {
  for (const account of DEFAULT_CHART_TEMPLATE_ACCOUNTS) {
    await tx
      .insert(schema.chartTemplateAccounts)
      .values({
        accountNo: account.accountNo,
        name: account.name,
        kind: account.kind,
        normalSide: account.normalSide,
        postingAllowed: account.postingAllowed,
        enabled: account.enabled,
        parentAccountNo: account.parentAccountNo ?? null,
      })
      .onConflictDoUpdate({
        target: schema.chartTemplateAccounts.accountNo,
        set: {
          name: account.name,
          kind: account.kind,
          normalSide: account.normalSide,
          postingAllowed: account.postingAllowed,
          enabled: account.enabled,
          parentAccountNo: account.parentAccountNo ?? null,
        },
      });
  }

  for (const analytic of DEFAULT_CHART_TEMPLATE_ACCOUNT_ANALYTICS) {
    await tx
      .insert(schema.chartTemplateAccountAnalytics)
      .values({
        accountNo: analytic.accountNo,
        analyticType: analytic.analyticType,
        required: analytic.required,
      })
      .onConflictDoUpdate({
        target: [
          schema.chartTemplateAccountAnalytics.accountNo,
          schema.chartTemplateAccountAnalytics.analyticType,
        ],
        set: {
          required: analytic.required,
        },
      });
  }

  for (const rule of DEFAULT_GLOBAL_CORRESPONDENCE_RULES) {
    await tx
      .insert(schema.correspondenceRules)
      .values({
        postingCode: rule.postingCode,
        debitAccountNo: rule.debitAccountNo,
        creditAccountNo: rule.creditAccountNo,
        enabled: true,
      })
      .onConflictDoUpdate({
        target: [
          schema.correspondenceRules.postingCode,
          schema.correspondenceRules.debitAccountNo,
          schema.correspondenceRules.creditAccountNo,
        ],
        set: {
          enabled: true,
        },
      });
  }
}

export interface LedgerEngine {
  createOperation: (
    input: CreateOperationInput,
  ) => Promise<CreateOperationResult>;
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
    await ensureAccountingDefaultsSeeded(tx);

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
        .where(
          eq(schema.ledgerOperations.idempotencyKey, validated.idempotencyKey),
        )
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
      const replayTransferMaps = buildReplayTransferMaps(
        operationId,
        transfers,
      );
      return {
        operationId,
        pendingTransferIdsByRef: replayTransferMaps.pendingTransferIdsByRef,
      };
    }

    const pendingTransferIdsByRef = new Map<string, bigint>();
    const postingRows: (typeof schema.ledgerPostings.$inferInsert)[] = [];
    const tbPlanRows: (typeof schema.tbTransferPlans.$inferInsert)[] = [];
    const postingPolicyCache = new Map<string, PostingAccountPolicy>();

    for (let i = 0; i < transfers.length; i++) {
      const lineNo = i + 1;
      const line = transfers[i]!;

      const transferId = tbTransferIdForOperation(
        operationId,
        lineNo,
        line.planRef,
      );

      if (line.type === OPERATION_TRANSFER_TYPE.CREATE) {
        await ensureCorrespondenceRule(tx, line);
        await ensurePostingAccountAllowed(tx, postingPolicyCache, {
          accountNo: line.debitAccountNo,
          postingCode: line.postingCode,
          analytics: line.analytics,
        });
        await ensurePostingAccountAllowed(tx, postingPolicyCache, {
          accountNo: line.creditAccountNo,
          postingCode: line.postingCode,
          analytics: line.analytics,
        });

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
          analyticOperationalAccountId:
            line.analytics?.operationalAccountId ?? null,
          analyticTransferId: line.analytics?.transferId ?? null,
          analyticQuoteId: line.analytics?.quoteId ?? null,
          analyticFeeBucket: line.analytics?.feeBucket ?? null,
        });

        if (line.pending) {
          pendingTransferIdsByRef.set(
            line.pending.ref ?? line.planRef,
            transferId,
          );
        }

        tbPlanRows.push({
          operationId,
          lineNo,
          type: OPERATION_TRANSFER_TYPE.CREATE,
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

      if (line.type === OPERATION_TRANSFER_TYPE.POST_PENDING) {
        tbPlanRows.push({
          operationId,
          lineNo,
          type: OPERATION_TRANSFER_TYPE.POST_PENDING,
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
        type: OPERATION_TRANSFER_TYPE.VOID_PENDING,
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
      await tx
        .insert(schema.ledgerPostings)
        .values(postingRows)
        .onConflictDoNothing();
    }

    await tx
      .insert(schema.tbTransferPlans)
      .values(tbPlanRows)
      .onConflictDoNothing();

    await tx
      .insert(schema.outbox)
      .values({ kind: "post_operation", refId: operationId, status: "pending" })
      .onConflictDoNothing();

    return {
      operationId,
      pendingTransferIdsByRef,
    };
  }

  async function createOperation(
    input: CreateOperationInput,
  ): Promise<CreateOperationResult> {
    return db.transaction(async (tx: Transaction) =>
      createOperationTx(tx, input),
    );
  }

  return {
    createOperation,
    createOperationTx,
  };
}
