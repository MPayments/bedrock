import type { z } from "zod";

import type { DocumentPostingPlan } from "@bedrock/accounting";
import type {
  Document,
  DocumentApprovalStatus,
  DocumentEvent,
  DocumentLifecycleStatus,
  DocumentLink,
  DocumentOperation,
  DocumentPostingStatus,
  DocumentSnapshot,
  DocumentSubmissionStatus,
} from "@bedrock/documents/schema";
import type { CorrelationContext } from "@bedrock/core/correlation";
import type { Database, Transaction } from "@bedrock/adapter-db-drizzle/db/types";
import type { Logger } from "@bedrock/observability/logger";

import type {
  DocumentsAccountingPort,
  DocumentsIdempotencyPort,
  DocumentsLedgerCommitPort,
  DocumentsLedgerReadPort,
} from "./ports";
import type { DocumentAction } from "./state-machine";

export type {
  Document,
  DocumentApprovalStatus,
  DocumentEvent,
  DocumentLifecycleStatus,
  DocumentLink,
  DocumentOperation,
  DocumentPostingStatus,
  DocumentSnapshot,
  DocumentSubmissionStatus,
};

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
}

export interface DocumentDraftResult {
  occurredAt: Date;
  payload: Record<string, unknown>;
}

export type DocumentRequestContext = CorrelationContext;

export type DocumentTransitionAction =
  | "submit"
  | "approve"
  | "reject"
  | "post"
  | "cancel"
  | "repost";

export interface DocumentTransitionInput {
  action: DocumentTransitionAction;
  docType: string;
  documentId: string;
  actorUserId: string;
  idempotencyKey?: string;
  requestContext?: DocumentRequestContext;
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

export interface DocumentsServiceDeps {
  accounting: DocumentsAccountingPort;
  db: Database;
  idempotency: DocumentsIdempotencyPort;
  ledger: DocumentsLedgerCommitPort;
  ledgerReadService: DocumentsLedgerReadPort;
  policy?: DocumentActionPolicyService;
  registry: DocumentRegistry;
  logger?: Logger;
}

export interface DocumentWithOperationId {
  document: Document;
  postingOperationId: string | null;
  allowedActions: DocumentAction[];
}

export interface DocumentDetails {
  document: Document;
  postingOperationId: string | null;
  allowedActions: DocumentAction[];
  links: DocumentLink[];
  events: DocumentEvent[];
  snapshot: DocumentSnapshot | null;
  parent: Document | null;
  children: Document[];
  dependsOn: Document[];
  compensates: Document[];
  documentOperations: DocumentOperation[];
  ledgerOperations: Awaited<
    ReturnType<DocumentsLedgerReadPort["getOperationDetails"]>
  >[];
  computed?: unknown;
  extra?: unknown;
}
