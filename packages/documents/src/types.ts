import type {
  Document,
  DocumentApprovalStatus,
  DocumentLifecycleStatus,
  DocumentLink,
  DocumentOperation,
  DocumentPostingStatus,
  DocumentSubmissionStatus,
} from "@bedrock/db/schema";
import type { Database, Transaction } from "@bedrock/db";
import type { Logger } from "@bedrock/kernel";
import type {
  IntentLine,
  LedgerEngine,
  LedgerReadService,
} from "@bedrock/ledger";
import type { z } from "zod";

export type {
  Document,
  DocumentApprovalStatus,
  DocumentLifecycleStatus,
  DocumentLink,
  DocumentOperation,
  DocumentPostingStatus,
  DocumentSubmissionStatus,
};

export interface DocumentSummaryFields {
  title: string;
  amountMinor?: bigint | null;
  currency?: string | null;
  memo?: string | null;
  counterpartyId?: string | null;
  customerId?: string | null;
  operationalAccountId?: string | null;
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

export interface DocumentUpdateDraftResult {
  occurredAt?: Date;
  payload: Record<string, unknown>;
}

export interface DocumentModuleIntent {
  operationCode: string;
  operationVersion?: number;
  bookOrgId: string;
  payload: Record<string, unknown>;
  lines: IntentLine[];
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
  payloadVersion: number;
  createSchema: z.ZodType<TCreateInput>;
  updateSchema: z.ZodType<TUpdateInput>;
  payloadSchema: z.ZodType<Record<string, unknown>>;
  postingRequired: boolean;
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
  buildIntent?(
    context: DocumentModuleContext,
    document: Document,
  ): Promise<DocumentModuleIntent>;
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

export interface DocumentsServiceDeps {
  db: Database;
  ledger: LedgerEngine;
  ledgerReadService: LedgerReadService;
  registry: DocumentRegistry;
  logger?: Logger;
}

export interface DocumentWithOperationId {
  document: Document;
  postingOperationId: string | null;
}

export interface DocumentDetails {
  document: Document;
  postingOperationId: string | null;
  links: DocumentLink[];
  parent: Document | null;
  children: Document[];
  dependsOn: Document[];
  compensates: Document[];
  documentOperations: DocumentOperation[];
  ledgerOperations: Awaited<ReturnType<LedgerReadService["getOperationDetails"]>>[];
  computed?: unknown;
  extra?: unknown;
}
