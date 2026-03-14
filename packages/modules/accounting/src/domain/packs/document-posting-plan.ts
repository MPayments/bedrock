import type { CompiledPack, CompiledPostingTemplate } from "./compiled-pack";
import type { OperationIntent } from "./operation-intent";
import type { PostingTemplateKey } from "../../posting-contracts";

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
