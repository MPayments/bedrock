import type { z } from "zod";

import type { DocumentPostingPlan } from "@bedrock/accounting/contracts";
import type { Logger } from "@bedrock/platform/observability/logger";

import type { Document, DocumentInitialLink } from "./domain/document";
import type { DocumentSummaryFields } from "./domain/document-summary";
import type { DocumentAction } from "./domain/document-workflow";
import type { DocumentsReadModel } from "./read-model";

export interface DocumentModuleRuntime {
  documents: Pick<
    DocumentsReadModel,
    "findIncomingLinkedDocument" | "getDocumentByType" | "getDocumentOperationId"
  >;
  withQueryable: <TResult>(
    run: (queryable: unknown) => Promise<TResult>,
  ) => Promise<TResult>;
}

export interface DocumentModuleContext {
  runtime: DocumentModuleRuntime;
  actorUserId: string;
  now: Date;
  log: Logger;
  operationIdempotencyKey: string | null;
}

export interface DocumentDraftResult {
  occurredAt: Date;
  payload: Record<string, unknown>;
}

export interface DocumentUpdateDraftResult {
  occurredAt?: Date;
  payload: Record<string, unknown>;
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
  approvalRequired(doc: Document): boolean;
  createDraft(
    context: DocumentModuleContext,
    input: TCreateInput,
  ): Promise<DocumentDraftResult>;
  updateDraft(
    context: DocumentModuleContext,
    document: Document,
    input: TUpdateInput,
  ): Promise<DocumentUpdateDraftResult>;
  deriveSummary(document: Document): DocumentSummaryFields;
  canCreate(context: DocumentModuleContext, input: TCreateInput): Promise<void>;
  canEdit(context: DocumentModuleContext, document: Document): Promise<void>;
  canSubmit(context: DocumentModuleContext, document: Document): Promise<void>;
  canApprove(context: DocumentModuleContext, document: Document): Promise<void>;
  canReject(context: DocumentModuleContext, document: Document): Promise<void>;
  canPost(context: DocumentModuleContext, document: Document): Promise<void>;
  canCancel(context: DocumentModuleContext, document: Document): Promise<void>;
  buildPostingPlan?(
    context: DocumentModuleContext,
    document: Document,
  ): Promise<DocumentPostingPlan>;
  resolveAccountingSourceId?(
    context: DocumentModuleContext,
    document: Document,
    postingPlan: DocumentPostingPlan,
  ): Promise<string> | string;
  buildPostIdempotencyKey(document: Document): string;
  buildInitialLinks?(
    context: DocumentModuleContext,
    document: Document,
  ): Promise<DocumentInitialLink[]>;
  buildDetails?(
    context: DocumentModuleContext,
    document: Document,
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
    document: Document;
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
    document: Document;
    actorUserId: string;
    moduleContext: DocumentModuleContext;
  }): Promise<DocumentPolicyDecision>;
  canSubmit(input: {
    module: DocumentModule;
    document: Document;
    actorUserId: string;
    moduleContext: DocumentModuleContext;
  }): Promise<DocumentPolicyDecision>;
  canApprove(input: {
    module: DocumentModule;
    document: Document;
    actorUserId: string;
    moduleContext: DocumentModuleContext;
  }): Promise<DocumentPolicyDecision>;
  canReject(input: {
    module: DocumentModule;
    document: Document;
    actorUserId: string;
    moduleContext: DocumentModuleContext;
  }): Promise<DocumentPolicyDecision>;
  canPost(input: {
    module: DocumentModule;
    document: Document;
    actorUserId: string;
    moduleContext: DocumentModuleContext;
  }): Promise<DocumentPolicyDecision>;
  canCancel(input: {
    module: DocumentModule;
    document: Document;
    actorUserId: string;
    moduleContext: DocumentModuleContext;
  }): Promise<DocumentPolicyDecision>;
}

export interface DocumentRegistry {
  getDocumentModules(): DocumentModule[];
  getDocumentModule(docType: string): DocumentModule;
}

export type { Document, DocumentAction, DocumentInitialLink, DocumentSummaryFields };
