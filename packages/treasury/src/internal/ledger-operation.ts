import {
  OPERATION_TRANSFER_TYPE,
  type OperationIntent,
  type IntentLine,
} from "@bedrock/ledger";

type Dimensions = Record<string, string>;

interface AccountSide {
  accountNo: string;
  currency: string;
  dimensions: Dimensions;
}

interface TemplateCreateLine {
  type: typeof OPERATION_TRANSFER_TYPE.CREATE;
  planKey: string;
  postingCode: string;
  debit: AccountSide;
  credit: AccountSide;
  amountMinor: bigint;
  code?: number;
  pending?: {
    timeoutSeconds: number;
    ref?: string | null;
  };
  chain?: string | null;
  memo?: string | null;
  context?: Record<string, string> | null;
}

interface TemplatePostPendingLine {
  type: typeof OPERATION_TRANSFER_TYPE.POST_PENDING;
  planKey: string;
  currency: string;
  pendingId: bigint;
  amount?: bigint;
  code?: number;
  chain?: string | null;
  memo?: string | null;
}

interface TemplateVoidPendingLine {
  type: typeof OPERATION_TRANSFER_TYPE.VOID_PENDING;
  planKey: string;
  currency: string;
  pendingId: bigint;
  code?: number;
  chain?: string | null;
  memo?: string | null;
}

export type TemplateLine =
  | TemplateCreateLine
  | TemplatePostPendingLine
  | TemplateVoidPendingLine;

interface BuildTreasuryIntentInput {
  source: OperationIntent["source"];
  operationCode: string;
  operationVersion?: number;
  payload?: unknown;
  idempotencyKey: string;
  postingDate: Date;
  bookOrgId: string;
  lines: TemplateLine[];
}

function toIntentLine(line: TemplateLine): IntentLine {
  if (line.type === OPERATION_TRANSFER_TYPE.CREATE) {
    return {
      type: OPERATION_TRANSFER_TYPE.CREATE,
      planRef: line.planKey,
      postingCode: line.postingCode,
      debit: line.debit,
      credit: line.credit,
      amountMinor: line.amountMinor,
      code: line.code,
      pending: line.pending
        ? {
            timeoutSeconds: line.pending.timeoutSeconds,
            ref: line.pending.ref ?? line.planKey,
          }
        : undefined,
      chain: line.chain,
      memo: line.memo,
      context: line.context,
    };
  }

  if (line.type === OPERATION_TRANSFER_TYPE.POST_PENDING) {
    return {
      type: OPERATION_TRANSFER_TYPE.POST_PENDING,
      planRef: line.planKey,
      currency: line.currency,
      pendingId: line.pendingId,
      amount: line.amount,
      code: line.code,
      chain: line.chain,
      memo: line.memo,
    };
  }

  return {
    type: OPERATION_TRANSFER_TYPE.VOID_PENDING,
    planRef: line.planKey,
    currency: line.currency,
    pendingId: line.pendingId,
    code: line.code,
    chain: line.chain,
    memo: line.memo,
  };
}

export function buildTreasuryIntent(
  input: BuildTreasuryIntentInput,
): OperationIntent {
  return {
    source: input.source,
    operationCode: input.operationCode,
    operationVersion: input.operationVersion ?? 1,
    payload: input.payload,
    idempotencyKey: input.idempotencyKey,
    postingDate: input.postingDate,
    bookOrgId: input.bookOrgId,
    lines: input.lines.map(toIntentLine),
  };
}
