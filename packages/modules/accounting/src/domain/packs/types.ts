import type {
  AccountingPackDefinition,
  CreatePostingTemplateDefinition,
  PendingPostingTemplateDefinition,
} from "../../packs/schema";
import type { PostingTemplateKey } from "../../posting-contracts";

export interface CreateIntentLine {
  type: "create";
  planRef: string;
  bookId: string;
  postingCode: string;
  debit: {
    accountNo: string;
    currency: string;
    dimensions: Record<string, string>;
  };
  credit: {
    accountNo: string;
    currency: string;
    dimensions: Record<string, string>;
  };
  amountMinor: bigint;
  code?: number;
  pending?: {
    timeoutSeconds: number;
    ref?: string | null;
  };
  chain?: string | null;
  memo?: string | null;
}

export interface PostPendingIntentLine {
  type: "post_pending";
  planRef: string;
  currency: string;
  pendingId: bigint;
  amount?: bigint;
  code?: number;
  chain?: string | null;
  memo?: string | null;
}

export interface VoidPendingIntentLine {
  type: "void_pending";
  planRef: string;
  currency: string;
  pendingId: bigint;
  code?: number;
  chain?: string | null;
  memo?: string | null;
}

export type IntentLine =
  | CreateIntentLine
  | PostPendingIntentLine
  | VoidPendingIntentLine;

export interface OperationIntent {
  source: {
    type: string;
    id: string;
  };
  operationCode: string;
  operationVersion?: number;
  payload?: unknown;
  idempotencyKey: string;
  postingDate: Date;
  lines: IntentLine[];
}

export type CompiledPostingTemplate =
  | (Omit<CreatePostingTemplateDefinition, "requiredRefs" | "pendingMode"> & {
      requiredRefs: string[];
      pendingMode: "allowed" | "required" | "forbidden";
    })
  | (Omit<PendingPostingTemplateDefinition, "requiredRefs"> & {
      requiredRefs: string[];
    });

export interface CompiledPack {
  packKey: string;
  version: number;
  templates: CompiledPostingTemplate[];
  checksum: string;
  templateLookup: Map<string, CompiledPostingTemplate>;
}

export interface PackValidationResult {
  ok: boolean;
  errors: string[];
}

export interface DocumentPostingPlanRequest {
  templateKey: PostingTemplateKey;
  effectiveAt: Date;
  currency: string;
  amountMinor: bigint;
  bookRefs: Record<string, string>;
  dimensions: Record<string, string>;
  refs?: Record<string, string> | null;
  pending?: {
    ref?: string | null;
    pendingId?: bigint;
    timeoutSeconds?: number;
    amountMinor?: bigint;
  } | null;
  memo?: string | null;
}

export interface DocumentPostingPlan {
  operationCode: string;
  operationVersion?: number;
  payload: Record<string, unknown>;
  requests: DocumentPostingPlanRequest[];
}

export interface ResolvedPostingTemplate {
  requestIndex: number;
  templateKey: string;
  lineType: CompiledPostingTemplate["lineType"];
  postingCode: string | null;
}

export interface ResolvePostingPlanResult {
  intent: OperationIntent;
  packChecksum: string;
  postingPlanChecksum: string;
  journalIntentChecksum: string;
  appliedTemplates: ResolvedPostingTemplate[];
}

export interface ResolvePostingPlanInput {
  accountingSourceId: string;
  source: OperationIntent["source"];
  idempotencyKey: string;
  postingDate: Date;
  at?: Date;
  bookIdContext?: string;
  plan: DocumentPostingPlan;
  pack?: CompiledPack;
}

export interface StoredCompiledPack {
  checksum: string;
  compiledJson: Record<string, unknown>;
}

export type DefaultPackDefinition = AccountingPackDefinition;
