import type { z } from "zod";

import type { DocumentPostingPlan } from "@bedrock/accounting/contracts";
import type { Logger } from "@bedrock/platform/observability/logger";

import type {
  DocumentSnapshot,
  DocumentDraftMetadata,
  DocumentInitialLink,
} from "./documents/domain/document";
import type { DocumentSummaryFields } from "./documents/domain/document-summary";
import type { DocumentAction } from "./lifecycle/domain/document-workflow";
import type { DocumentsReadModel } from "./read-model";

export interface DocumentModuleRuntime {
  documents: Pick<
    DocumentsReadModel,
    "findIncomingLinkedDocument" | "getDocumentByType" | "getDocumentOperationId"
  >;
}

export interface DocumentModuleContext {
  runtime: DocumentModuleRuntime;
  actorUserId: string;
  now: Date;
  log: Logger;
  draft: DocumentDraftMetadata | null;
  operationIdempotencyKey: string | null;
}

export interface DocumentDraftResult {
  occurredAt: Date;
  payload: Record<string, unknown>;
  summary: DocumentSummaryFields;
}

export interface DocumentUpdateDraftResult {
  occurredAt?: Date;
  payload: Record<string, unknown>;
  summary: DocumentSummaryFields;
}

export interface DocumentModule<
  TCreateInput = unknown,
  TUpdateInput = unknown,
> {
  docType: string;
  docNoPrefix: string;
  moduleId?: string;
  moduleVersion?: number;
  accountingSourceId?: string;
  accountingSourceIds?: string[];
  payloadVersion: number;
  createSchema: z.ZodType<TCreateInput>;
  updateSchema: z.ZodType<TUpdateInput>;
  payloadSchema: z.ZodType<Record<string, unknown>>;
  postingRequired: boolean;
  allowDirectPostFromDraft?: boolean;
  approvalRequired(doc: DocumentSnapshot): boolean;
  createDraft(
    context: DocumentModuleContext,
    input: TCreateInput,
  ): Promise<DocumentDraftResult>;
  updateDraft(
    context: DocumentModuleContext,
    document: DocumentSnapshot,
    input: TUpdateInput,
  ): Promise<DocumentUpdateDraftResult>;
  canCreate(context: DocumentModuleContext, input: TCreateInput): Promise<void>;
  canEdit(context: DocumentModuleContext, document: DocumentSnapshot): Promise<void>;
  canSubmit(context: DocumentModuleContext, document: DocumentSnapshot): Promise<void>;
  canApprove(context: DocumentModuleContext, document: DocumentSnapshot): Promise<void>;
  canReject(context: DocumentModuleContext, document: DocumentSnapshot): Promise<void>;
  canPost(context: DocumentModuleContext, document: DocumentSnapshot): Promise<void>;
  canCancel(context: DocumentModuleContext, document: DocumentSnapshot): Promise<void>;
  buildPostingPlan?(
    context: DocumentModuleContext,
    document: DocumentSnapshot,
  ): Promise<DocumentPostingPlan>;
  resolveAccountingSourceId?(
    context: DocumentModuleContext,
    document: DocumentSnapshot,
    postingPlan: DocumentPostingPlan,
  ): Promise<string> | string;
  buildPostIdempotencyKey(document: DocumentSnapshot): string;
  buildInitialLinks?(
    context: DocumentModuleContext,
    document: DocumentSnapshot,
  ): Promise<DocumentInitialLink[]>;
  buildDetails?(
    context: DocumentModuleContext,
    document: DocumentSnapshot,
  ): Promise<{ computed?: unknown; extra?: unknown }>;
}

export interface DocumentPolicyDecision {
  allow: boolean;
  reasonCode: string;
  reasonMeta?: Record<string, unknown> | null;
}

export type DocumentApprovalMode = "not_required" | "maker_checker";

export interface DocumentActionPolicyService {
  approvalMode(input: {
    module: DocumentModule;
    document: DocumentSnapshot;
    actorUserId: string;
    moduleContext: DocumentModuleContext;
  }): Promise<DocumentApprovalMode>;
  canCreate(input: {
    module: DocumentModule;
    actorUserId: string;
    payload: unknown;
    moduleContext: DocumentModuleContext;
  }): Promise<DocumentPolicyDecision>;
  canEdit(input: {
    module: DocumentModule;
    document: DocumentSnapshot;
    actorUserId: string;
    moduleContext: DocumentModuleContext;
  }): Promise<DocumentPolicyDecision>;
  canSubmit(input: {
    module: DocumentModule;
    document: DocumentSnapshot;
    actorUserId: string;
    moduleContext: DocumentModuleContext;
  }): Promise<DocumentPolicyDecision>;
  canApprove(input: {
    module: DocumentModule;
    document: DocumentSnapshot;
    actorUserId: string;
    moduleContext: DocumentModuleContext;
  }): Promise<DocumentPolicyDecision>;
  canReject(input: {
    module: DocumentModule;
    document: DocumentSnapshot;
    actorUserId: string;
    moduleContext: DocumentModuleContext;
  }): Promise<DocumentPolicyDecision>;
  canPost(input: {
    module: DocumentModule;
    document: DocumentSnapshot;
    actorUserId: string;
    moduleContext: DocumentModuleContext;
  }): Promise<DocumentPolicyDecision>;
  canCancel(input: {
    module: DocumentModule;
    document: DocumentSnapshot;
    actorUserId: string;
    moduleContext: DocumentModuleContext;
  }): Promise<DocumentPolicyDecision>;
}

export interface DocumentRegistry {
  getDocumentModules(): DocumentModule[];
  getDocumentModule(docType: string): DocumentModule;
}

export type {
  DocumentSnapshot,
  DocumentAction,
  DocumentDraftMetadata,
  DocumentInitialLink,
  DocumentSummaryFields,
};
