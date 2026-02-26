import { and, eq } from "drizzle-orm";

import {
  ACCOUNT_NO,
  KNOWN_DIMENSION_KEYS,
  CLEARING_KIND_DIMENSION_RULES,
  DIM,
} from "@bedrock/accounting";
import { type Transaction, type Database } from "@bedrock/db";
import { schema } from "@bedrock/db/schema";
import { seedAccounting } from "@bedrock/db/seeds";
import { sha256Hex, stableStringify } from "@bedrock/kernel";

import {
  AccountPostingValidationError,
  DimensionPolicyViolationError,
  IdempotencyConflictError,
} from "./errors";
import {
  tbBookAccountInstanceIdFor,
  tbLedgerForCurrency,
  tbTransferIdForOperation,
} from "./ids";
import {
  OPERATION_TRANSFER_TYPE,
  type OperationIntent,
  type CommitResult,
  type IntentLine,
  type Dimensions,
} from "./types";
import { validateOperationIntent, validateChainBlocks } from "./validation";

type DimensionMode = "required" | "optional" | "forbidden";
type DimensionPolicyScope = "line" | "debit" | "credit";
type CreateIntentLine = Extract<
  IntentLine,
  { type: typeof OPERATION_TRANSFER_TYPE.CREATE }
>;

interface AccountPolicy {
  postingAllowed: boolean;
  enabled: boolean;
  dimensionPolicies: Map<string, DimensionMode>;
}

interface PostingCodePolicyEntry {
  dimensionKey: string;
  scope: DimensionPolicyScope;
}

interface PostingCodePolicy {
  entries: PostingCodePolicyEntry[];
}

let accountingDefaultsKnownPresent = false;

function computeDimensionsHash(dimensions: Dimensions): string {
  const sorted = Object.keys(dimensions)
    .sort()
    .reduce<Record<string, string>>((acc, key) => {
      acc[key] = dimensions[key]!;
      return acc;
    }, {});
  return sha256Hex(stableStringify(sorted));
}

function computeLinkedFlags(lines: IntentLine[]): boolean[] {
  const linked = new Array(lines.length).fill(false);
  for (let i = 0; i < lines.length - 1; i++) {
    const a = lines[i]!.chain;
    const b = lines[i + 1]!.chain;
    if (a && b && a === b) linked[i] = true;
  }
  return linked;
}

function normalizeForFingerprint(line: IntentLine) {
  switch (line.type) {
    case OPERATION_TRANSFER_TYPE.CREATE:
      return {
        type: line.type,
        planRef: line.planRef,
        chain: line.chain ?? null,
        postingCode: line.postingCode,
        debit: {
          accountNo: line.debit.accountNo,
          currency: line.debit.currency,
          dimensionsHash: computeDimensionsHash(line.debit.dimensions),
        },
        credit: {
          accountNo: line.credit.accountNo,
          currency: line.credit.currency,
          dimensionsHash: computeDimensionsHash(line.credit.dimensions),
        },
        amount: line.amountMinor.toString(),
        code: line.code ?? 1,
        pendingTimeoutSeconds: line.pending?.timeoutSeconds ?? 0,
      };
    case OPERATION_TRANSFER_TYPE.POST_PENDING:
      return {
        type: line.type,
        planRef: line.planRef,
        chain: line.chain ?? null,
        currency: line.currency,
        pendingId: line.pendingId.toString(),
        amount: (line.amount ?? 0n).toString(),
        code: line.code ?? 0,
      };
    case OPERATION_TRANSFER_TYPE.VOID_PENDING:
      return {
        type: line.type,
        planRef: line.planRef,
        chain: line.chain ?? null,
        currency: line.currency,
        pendingId: line.pendingId.toString(),
        amount: "0",
        code: line.code ?? 0,
      };
  }
}

function computePayloadHash(input: {
  operationCode: string;
  operationVersion: number;
  payload: unknown;
  bookOrgId: string;
  lines: IntentLine[];
}): string {
  return sha256Hex(
    stableStringify({
      operationCode: input.operationCode,
      operationVersion: input.operationVersion,
      payload: input.payload ?? null,
      bookOrgId: input.bookOrgId,
      lines: input.lines.map(normalizeForFingerprint),
    }),
  );
}

function buildReplayTransferMaps(operationId: string, lines: IntentLine[]) {
  const pendingTransferIdsByRef = new Map<string, bigint>();

  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    const line = lines[i]!;
    const transferId = tbTransferIdForOperation(
      operationId,
      lineNo,
      line.planRef,
    );

    if (line.type === OPERATION_TRANSFER_TYPE.CREATE && line.pending) {
      pendingTransferIdsByRef.set(line.pending.ref ?? line.planRef, transferId);
    }
  }

  return { pendingTransferIdsByRef };
}

async function ensureCorrespondenceRule(
  tx: Transaction,
  line: CreateIntentLine,
) {
  const [rule] = await tx
    .select({ id: schema.correspondenceRules.id })
    .from(schema.correspondenceRules)
    .where(
      and(
        eq(schema.correspondenceRules.postingCode, line.postingCode),
        eq(schema.correspondenceRules.debitAccountNo, line.debit.accountNo),
        eq(schema.correspondenceRules.creditAccountNo, line.credit.accountNo),
        eq(schema.correspondenceRules.enabled, true),
      ),
    )
    .limit(1);

  if (!rule) {
    const { CorrespondenceRuleNotFoundError } =
      await import("@bedrock/accounting");
    throw new CorrespondenceRuleNotFoundError(
      line.postingCode,
      line.debit.accountNo,
      line.credit.accountNo,
    );
  }
}

async function loadAccountPolicy(
  tx: Transaction,
  accountNo: string,
): Promise<AccountPolicy> {
  const [templateAccount, dimensionRows] = await Promise.all([
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
        dimensionKey: schema.chartAccountDimensionPolicy.dimensionKey,
        mode: schema.chartAccountDimensionPolicy.mode,
      })
      .from(schema.chartAccountDimensionPolicy)
      .where(eq(schema.chartAccountDimensionPolicy.accountNo, accountNo)),
  ]);

  const template = templateAccount[0];
  if (!template) {
    throw new AccountPostingValidationError(
      `Unknown chart account ${accountNo}`,
    );
  }

  const dimensionPolicies = new Map<string, DimensionMode>();
  for (const row of dimensionRows) {
    dimensionPolicies.set(row.dimensionKey, row.mode as DimensionMode);
  }

  return {
    postingAllowed: template.postingAllowed,
    enabled: template.enabled,
    dimensionPolicies,
  };
}

async function loadPostingCodePolicy(
  tx: Transaction,
  postingCode: string,
): Promise<PostingCodePolicy> {
  const rows = await tx
    .select({
      dimensionKey: schema.postingCodeDimensionPolicy.dimensionKey,
      required: schema.postingCodeDimensionPolicy.required,
      scope: schema.postingCodeDimensionPolicy.scope,
    })
    .from(schema.postingCodeDimensionPolicy)
    .where(
      and(
        eq(schema.postingCodeDimensionPolicy.postingCode, postingCode),
        eq(schema.postingCodeDimensionPolicy.required, true),
      ),
    );

  return {
    entries: rows.map((r) => ({
      dimensionKey: r.dimensionKey,
      scope: (r.scope ?? "line") as DimensionPolicyScope,
    })),
  };
}

function validateDimensionKeys(dimensions: Dimensions, label: string) {
  for (const key of Object.keys(dimensions)) {
    if (!KNOWN_DIMENSION_KEYS.has(key)) {
      throw new DimensionPolicyViolationError(
        label,
        key,
        `unknown dimension key (not in canonical DIM registry)`,
      );
    }
  }
}

function validateDimensions(
  accountPolicy: AccountPolicy,
  dimensions: Dimensions,
  accountNo: string,
) {
  if (!accountPolicy.postingAllowed) {
    throw new AccountPostingValidationError(
      `Account ${accountNo} is not postable`,
    );
  }
  if (!accountPolicy.enabled) {
    throw new AccountPostingValidationError(`Account ${accountNo} is disabled`);
  }

  validateDimensionKeys(dimensions, accountNo);

  for (const key of Object.keys(dimensions)) {
    const mode = accountPolicy.dimensionPolicies.get(key);
    if (!mode) {
      throw new DimensionPolicyViolationError(
        accountNo,
        key,
        `dimension not allowed for this account`,
      );
    }
    if (mode === "forbidden") {
      throw new DimensionPolicyViolationError(
        accountNo,
        key,
        `forbidden dimension present`,
      );
    }
  }

  for (const [key, mode] of accountPolicy.dimensionPolicies) {
    if (mode !== "required") continue;
    if (!(key in dimensions)) {
      throw new DimensionPolicyViolationError(
        accountNo,
        key,
        `required dimension missing`,
      );
    }
  }

  if (accountNo === ACCOUNT_NO.CLEARING && DIM.clearingKind in dimensions) {
    validateClearingKindDimensions(dimensions);
  }
}

function validateClearingKindDimensions(dimensions: Dimensions) {
  const kind = dimensions[DIM.clearingKind];
  if (!kind) return;

  const rules = CLEARING_KIND_DIMENSION_RULES[kind];
  if (!rules) {
    throw new DimensionPolicyViolationError(
      ACCOUNT_NO.CLEARING,
      DIM.clearingKind,
      `unknown clearingKind value: ${kind}`,
    );
  }

  for (const rule of rules) {
    if (rule.mode === "required" && !(rule.dimensionKey in dimensions)) {
      throw new DimensionPolicyViolationError(
        `CLEARING[${kind}]`,
        rule.dimensionKey,
        `required for clearingKind=${kind}`,
      );
    }
    if (rule.mode === "forbidden" && rule.dimensionKey in dimensions) {
      throw new DimensionPolicyViolationError(
        `CLEARING[${kind}]`,
        rule.dimensionKey,
        `forbidden for clearingKind=${kind}`,
      );
    }
  }
}

function validatePostingCodeDimensions(
  postingCodePolicy: PostingCodePolicy,
  debitDimensions: Dimensions,
  creditDimensions: Dimensions,
  postingCode: string,
) {
  for (const entry of postingCodePolicy.entries) {
    const { dimensionKey, scope } = entry;

    switch (scope) {
      case "debit":
        if (!(dimensionKey in debitDimensions)) {
          throw new DimensionPolicyViolationError(
            postingCode,
            dimensionKey,
            `required on debit side by posting code`,
          );
        }
        break;
      case "credit":
        if (!(dimensionKey in creditDimensions)) {
          throw new DimensionPolicyViolationError(
            postingCode,
            dimensionKey,
            `required on credit side by posting code`,
          );
        }
        break;
      case "line":
      default:
        if (
          !(dimensionKey in debitDimensions) &&
          !(dimensionKey in creditDimensions)
        ) {
          throw new DimensionPolicyViolationError(
            postingCode,
            dimensionKey,
            `required by posting code but not present in either debit or credit dimensions`,
          );
        }
        break;
    }
  }
}

async function ensureBookAccountInstance(
  tx: Transaction,
  input: {
    bookOrgId: string;
    accountNo: string;
    currency: string;
    dimensions: Dimensions;
  },
) {
  const dimensionsHash = computeDimensionsHash(input.dimensions);
  const tbLedger = tbLedgerForCurrency(input.currency);
  const expectedTbAccountId = tbBookAccountInstanceIdFor(
    input.bookOrgId,
    input.accountNo,
    input.currency,
    dimensionsHash,
    tbLedger,
  );

  const inserted = await tx
    .insert(schema.bookAccountInstances)
    .values({
      bookOrgId: input.bookOrgId,
      accountNo: input.accountNo,
      currency: input.currency,
      dimensions: input.dimensions,
      dimensionsHash,
      tbLedger,
      tbAccountId: expectedTbAccountId,
    })
    .onConflictDoUpdate({
      target: [
        schema.bookAccountInstances.bookOrgId,
        schema.bookAccountInstances.accountNo,
        schema.bookAccountInstances.currency,
        schema.bookAccountInstances.dimensionsHash,
      ],
      set: {
        tbLedger,
        tbAccountId: expectedTbAccountId,
        dimensions: input.dimensions,
      },
    })
    .returning({
      id: schema.bookAccountInstances.id,
      tbLedger: schema.bookAccountInstances.tbLedger,
      tbAccountId: schema.bookAccountInstances.tbAccountId,
    });

  const existing = inserted[0];
  if (!existing) {
    throw new Error(
      `book account instance upsert failed unexpectedly for org=${input.bookOrgId}, accountNo=${input.accountNo}, currency=${input.currency}, hash=${dimensionsHash}`,
    );
  }

  if (
    existing.tbLedger !== tbLedger ||
    existing.tbAccountId !== expectedTbAccountId
  ) {
    throw new Error(
      `book_account_instance invariant mismatch for org=${input.bookOrgId}, accountNo=${input.accountNo}, currency=${input.currency}, hash=${dimensionsHash}`,
    );
  }

  return existing;
}

async function ensureAccountingDefaultsSeeded(tx: Transaction) {
  if (accountingDefaultsKnownPresent) {
    return;
  }

  const [existing] = await tx
    .select({ accountNo: schema.chartTemplateAccounts.accountNo })
    .from(schema.chartTemplateAccounts)
    .where(eq(schema.chartTemplateAccounts.accountNo, ACCOUNT_NO.ASSETS))
    .limit(1);

  if (existing) {
    accountingDefaultsKnownPresent = true;
    return;
  }

  await seedAccounting(tx);
}

export interface LedgerEngine {
  commit: (tx: Transaction, intent: OperationIntent) => Promise<CommitResult>;
  commitStandalone: (intent: OperationIntent) => Promise<CommitResult>;
}

export function createLedgerEngine(deps: { db: Database }): LedgerEngine {
  const { db } = deps;

  async function commit(
    tx: Transaction,
    intent: OperationIntent,
  ): Promise<CommitResult> {
    const validated = validateOperationIntent(intent);
    await ensureAccountingDefaultsSeeded(tx);

    validateChainBlocks(validated.lines);

    const lines = validated.lines;
    const payloadHash = computePayloadHash({
      operationCode: validated.operationCode,
      operationVersion: validated.operationVersion,
      payload: validated.payload,
      bookOrgId: validated.bookOrgId,
      lines,
    });

    const linkedFlags = computeLinkedFlags(lines);

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
      const [hasAnyPlan] = await tx
        .select({ id: schema.tbTransferPlans.id })
        .from(schema.tbTransferPlans)
        .where(eq(schema.tbTransferPlans.operationId, operationId))
        .limit(1);
      const [hasAnyPosting] = await tx
        .select({ id: schema.postings.id })
        .from(schema.postings)
        .where(eq(schema.postings.operationId, operationId))
        .limit(1);

      const shouldHavePostings = lines.some(
        (line) => line.type === OPERATION_TRANSFER_TYPE.CREATE,
      );
      const incomplete =
        !hasAnyPlan || (shouldHavePostings && !hasAnyPosting);

      if (!incomplete) {
        const replayTransferMaps = buildReplayTransferMaps(operationId, lines);
        return {
          operationId,
          pendingTransferIdsByRef: replayTransferMaps.pendingTransferIdsByRef,
        };
      }
    }

    const pendingTransferIdsByRef = new Map<string, bigint>();
    const postingRows: (typeof schema.postings.$inferInsert)[] = [];
    const tbPlanRows: (typeof schema.tbTransferPlans.$inferInsert)[] = [];
    const accountPolicyCache = new Map<string, AccountPolicy>();
    const postingCodePolicyCache = new Map<string, PostingCodePolicy>();

    async function getAccountPolicy(accountNo: string): Promise<AccountPolicy> {
      let policy = accountPolicyCache.get(accountNo);
      if (!policy) {
        policy = await loadAccountPolicy(tx, accountNo);
        accountPolicyCache.set(accountNo, policy);
      }
      return policy;
    }

    async function getPostingCodePolicy(
      postingCode: string,
    ): Promise<PostingCodePolicy> {
      let policy = postingCodePolicyCache.get(postingCode);
      if (!policy) {
        policy = await loadPostingCodePolicy(tx, postingCode);
        postingCodePolicyCache.set(postingCode, policy);
      }
      return policy;
    }

    for (let i = 0; i < lines.length; i++) {
      const lineNo = i + 1;
      const line = lines[i]!;

      const transferId = tbTransferIdForOperation(
        operationId,
        lineNo,
        line.planRef,
      );

      if (line.type === OPERATION_TRANSFER_TYPE.CREATE) {
        await ensureCorrespondenceRule(tx, line);
        if (line.debit.currency !== line.credit.currency) {
          throw new AccountPostingValidationError(
            `Currency mismatch for postingCode=${line.postingCode}: debit=${line.debit.currency}, credit=${line.credit.currency}`,
          );
        }

        const [debitPolicy, creditPolicy, postingCodePolicy] =
          await Promise.all([
            getAccountPolicy(line.debit.accountNo),
            getAccountPolicy(line.credit.accountNo),
            getPostingCodePolicy(line.postingCode),
          ]);

        validateDimensions(
          debitPolicy,
          line.debit.dimensions,
          line.debit.accountNo,
        );
        validateDimensions(
          creditPolicy,
          line.credit.dimensions,
          line.credit.accountNo,
        );
        validatePostingCodeDimensions(
          postingCodePolicy,
          line.debit.dimensions,
          line.credit.dimensions,
          line.postingCode,
        );

        const [debitInstance, creditInstance] = await Promise.all([
          ensureBookAccountInstance(tx, {
            bookOrgId: validated.bookOrgId,
            accountNo: line.debit.accountNo,
            currency: line.debit.currency,
            dimensions: line.debit.dimensions,
          }),
          ensureBookAccountInstance(tx, {
            bookOrgId: validated.bookOrgId,
            accountNo: line.credit.accountNo,
            currency: line.credit.currency,
            dimensions: line.credit.dimensions,
          }),
        ]);

        postingRows.push({
          operationId,
          lineNo,
          bookOrgId: validated.bookOrgId,
          debitInstanceId: debitInstance.id,
          creditInstanceId: creditInstance.id,
          postingCode: line.postingCode,
          currency: line.debit.currency,
          amountMinor: line.amountMinor,
          memo: line.memo ?? null,
          context: line.context ?? null,
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
          debitTbAccountId: debitInstance.tbAccountId,
          creditTbAccountId: creditInstance.tbAccountId,
          tbLedger: debitInstance.tbLedger,
          amount: line.amountMinor,
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
          tbLedger: tbLedgerForCurrency(line.currency),
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
        tbLedger: tbLedgerForCurrency(line.currency),
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
        .insert(schema.postings)
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

  async function commitStandalone(
    intent: OperationIntent,
  ): Promise<CommitResult> {
    return db.transaction(async (tx: Transaction) => commit(tx, intent));
  }

  return {
    commit,
    commitStandalone,
  };
}
