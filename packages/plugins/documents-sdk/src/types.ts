import type { z } from "zod";

import type { DocumentPostingPlan } from "@bedrock/accounting/packs";
import type { Document } from "@bedrock/documents/contracts";
import type { Database, Transaction } from "@bedrock/platform/persistence";
import type { Logger } from "@bedrock/platform/observability/logger";

export interface DocumentSummaryFields {
  title: string;
  amountMinor?: bigint | null;
  currency?: string | null;
  memo?: string | null;
  counterpartyId?: string | null;
  customerId?: string | null;
  organizationRequisiteId?: string | null;
  searchText: string;
}

export interface DocumentModuleContext {
  db: Database | Transaction;
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

export interface DocumentInitialLink {
  toDocumentId: string;
  linkType: "parent" | "depends_on" | "compensates" | "related";
  role?: string;
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

export interface DocumentRegistry {
  getDocumentModules(): DocumentModule[];
  getDocumentModule(docType: string): DocumentModule;
}
