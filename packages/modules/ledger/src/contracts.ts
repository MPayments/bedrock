import { z } from "zod";

import type { PaginatedList } from "@bedrock/shared/core/pagination";

import {
  OPERATION_TRANSFER_TYPE,
  type CommitResult,
  type CreateIntentLine,
  type IntentLine,
  type OperationIntent,
  type OperationTransferType,
  type PostPendingIntentLine,
  type VoidPendingIntentLine,
} from "./operations/domain/operation-intent";
import type { Dimensions } from "./shared/domain/dimensions";

export * from "./balances/contracts";

export const LedgerOperationStatusSchema = z.enum(["pending", "posted", "failed"]);
export const SortableLedgerOperationColumnSchema = z.enum([
  "createdAt",
  "postingDate",
  "postedAt",
]);
export const DimensionsSchema = z.record(
  z.string().min(1),
  z.string().min(1),
);

const uuidSchema = z.uuid({ version: "v4" });
const nonEmptyStringSchema = z.string().trim().min(1);
const nonEmptyStringArraySchema = z.array(nonEmptyStringSchema).min(1);
const idempotencyKeySchema = z.string().min(1).max(255);
const sourceTypeSchema = z.string().min(1).max(100);
const sourceIdSchema = z.string().min(1).max(255);
const memoSchema = z.string().max(1000).nullable().exactOptional();
const currencySchema = z
  .string()
  .transform((value) => value.trim().toUpperCase())
  .refine((value) => /^[A-Z0-9_]{2,16}$/.test(value), {
    message:
      "Currency must be 2-16 uppercase alphanumeric characters or underscores",
  });
const planRefSchema = z.string().min(1).max(512);
const accountNoSchema = z
  .string()
  .trim()
  .min(1, "accountNo must be a non-empty string")
  .max(128, "accountNo must be at most 128 characters");
const positiveAmountSchema = z.bigint().positive();
const nonNegativeAmountSchema = z.bigint().min(0n);
const positiveTimeoutSchema = z.number().int().positive();
const transferCodeSchema = z.number().int().min(0).exactOptional();
const chainIdSchema = z.string().min(1).nullable().exactOptional();
const contextSchema = z
  .record(z.string().min(1), z.string())
  .nullable()
  .exactOptional();
const accountSideSchema = z.object({
  accountNo: accountNoSchema,
  currency: currencySchema,
  dimensions: DimensionsSchema,
});
const pendingConfigSchema = z
  .object({
    timeoutSeconds: positiveTimeoutSchema,
    ref: z.string().min(1).max(255).nullable().exactOptional(),
  })
  .exactOptional();
const baseIntentLineSchema = z.object({
  planRef: planRefSchema,
  code: transferCodeSchema,
  chain: chainIdSchema,
  memo: memoSchema,
});

const createIntentLineSchema = baseIntentLineSchema.extend({
  type: z.literal(OPERATION_TRANSFER_TYPE.CREATE),
  bookId: uuidSchema,
  postingCode: z.string().min(1).max(128),
  debit: accountSideSchema,
  credit: accountSideSchema,
  amountMinor: positiveAmountSchema,
  pending: pendingConfigSchema,
  context: contextSchema,
});

const postPendingIntentLineSchema = baseIntentLineSchema.extend({
  type: z.literal(OPERATION_TRANSFER_TYPE.POST_PENDING),
  currency: currencySchema,
  pendingId: z.bigint().positive(),
  amount: nonNegativeAmountSchema.exactOptional(),
});

const voidPendingIntentLineSchema = baseIntentLineSchema.extend({
  type: z.literal(OPERATION_TRANSFER_TYPE.VOID_PENDING),
  currency: currencySchema,
  pendingId: z.bigint().positive(),
});

export const IntentLineSchema = z.discriminatedUnion("type", [
  createIntentLineSchema,
  postPendingIntentLineSchema,
  voidPendingIntentLineSchema,
]);

export const OperationIntentSchema = z
  .object({
    source: z.object({
      type: sourceTypeSchema,
      id: sourceIdSchema,
    }),
    operationCode: z.string().min(1).max(128),
    operationVersion: z.number().int().positive().exactOptional(),
    payload: z.unknown().exactOptional(),
    idempotencyKey: idempotencyKeySchema,
    postingDate: z.date(),
    lines: z.array(IntentLineSchema).min(1, "lines must be a non-empty array"),
  })
  .transform(({ operationVersion, ...intent }) => ({
    ...intent,
    operationVersion: operationVersion ?? 1,
  }));

export const ListLedgerOperationsInputSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  sortBy: SortableLedgerOperationColumnSchema.default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  query: nonEmptyStringSchema.exactOptional(),
  status: z.array(LedgerOperationStatusSchema).min(1).exactOptional(),
  operationCode: nonEmptyStringArraySchema.exactOptional(),
  sourceType: nonEmptyStringArraySchema.exactOptional(),
  sourceId: nonEmptyStringSchema.exactOptional(),
  bookId: nonEmptyStringSchema.exactOptional(),
  dimensionFilters: z
    .record(nonEmptyStringSchema, nonEmptyStringArraySchema)
    .exactOptional(),
});

export type OperationIntentInput = z.input<typeof OperationIntentSchema>;
export type ValidatedOperationIntent = z.output<typeof OperationIntentSchema>;
export type ListLedgerOperationsInput = z.input<
  typeof ListLedgerOperationsInputSchema
>;
export type ResolvedListLedgerOperationsInput = z.output<
  typeof ListLedgerOperationsInputSchema
>;

export type LedgerOperationStatus = "pending" | "posted" | "failed";
export type TbPlanStatus = "pending" | "posted" | "failed";
export type TbPlanType = "create" | "post_pending" | "void_pending";

export interface LedgerOperationListRow {
  id: string;
  sourceType: string;
  sourceId: string;
  operationCode: string;
  operationVersion: number;
  postingDate: Date;
  status: LedgerOperationStatus;
  error: string | null;
  postedAt: Date | null;
  outboxAttempts: number;
  lastOutboxErrorAt: Date | null;
  createdAt: Date;
  postingCount: number;
  bookIds: string[];
  currencies: string[];
}

export interface LedgerOperationPostingRow {
  id: string;
  lineNo: number;
  bookId: string;
  bookName: string | null;
  debitInstanceId: string;
  debitAccountNo: string | null;
  debitDimensions: Dimensions | null;
  creditInstanceId: string;
  creditAccountNo: string | null;
  creditDimensions: Dimensions | null;
  postingCode: string;
  currency: string;
  amountMinor: bigint;
  memo: string | null;
  context: Record<string, string> | null;
  createdAt: Date;
}

export interface LedgerOperationTbPlanRow {
  id: string;
  lineNo: number;
  type: TbPlanType;
  transferId: bigint;
  debitTbAccountId: bigint | null;
  creditTbAccountId: bigint | null;
  tbLedger: number;
  amount: bigint;
  code: number;
  pendingRef: string | null;
  pendingId: bigint | null;
  isLinked: boolean;
  isPending: boolean;
  timeoutSeconds: number;
  status: TbPlanStatus;
  error: string | null;
  createdAt: Date;
}

export interface LedgerOperationDetails {
  operation: LedgerOperationListRow;
  postings: LedgerOperationPostingRow[];
  tbPlans: LedgerOperationTbPlanRow[];
}

export type LedgerOperationList = PaginatedList<LedgerOperationListRow>;

export interface LedgerBookRow {
  id: string;
  name: string | null;
  ownerId: string | null;
}

export interface AccountingScopedPostingRow {
  operationId: string;
  sourceType: string;
  sourceId: string;
  lineNo: number;
  postingDate: Date;
  status: LedgerOperationStatus;
  bookId: string;
  bookLabel: string | null;
  bookCounterpartyId: string | null;
  currency: string;
  amountMinor: string;
  postingCode: string;
  debitAccountNo: string;
  creditAccountNo: string;
  analyticCounterpartyId: string | null;
}

export interface ListScopedPostingRowsInput {
  statuses: ("pending" | "posted" | "failed")[];
  from?: Date;
  to?: Date;
  asOf?: Date;
  currency?: string;
  resolvedBookIds: string[];
  resolvedCounterpartyIds: string[];
  scopeType: "all" | "counterparty" | "group" | "book";
  attributionMode: "analytic_counterparty" | "book_org";
  includeUnattributed: boolean;
  internalLedgerOrganizationIds: string[];
}

export { OPERATION_TRANSFER_TYPE };
export type {
  CommitResult,
  CreateIntentLine,
  Dimensions,
  IntentLine,
  OperationIntent,
  OperationTransferType,
  PostPendingIntentLine,
  VoidPendingIntentLine,
};
