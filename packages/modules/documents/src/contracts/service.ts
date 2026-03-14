import type { LedgerOperationDetails } from "@bedrock/ledger/contracts";
import type { CorrelationContext } from "@bedrock/shared/core/correlation";

import type { DocumentAction } from "../domain/state-machine";
import type {
  Document,
  DocumentEvent,
  DocumentLink,
  DocumentOperation,
  DocumentSnapshot,
} from "../domain/types";

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
  ledgerOperations: (LedgerOperationDetails | null)[];
  computed?: unknown;
  extra?: unknown;
}
