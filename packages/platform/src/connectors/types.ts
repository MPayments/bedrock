import type { Database } from "@bedrock/foundation/db/types";
import type { CorrelationContext, Logger } from "@bedrock/foundation/kernel";
import type { PaymentAttemptStatus } from "@bedrock/platform/connectors/schema";

export interface ConnectorProviderSubmission {
  status:
    | "submitted"
    | "pending"
    | "succeeded"
    | "failed_retryable"
    | "failed_terminal";
  externalAttemptRef?: string | null;
  responsePayload?: Record<string, unknown> | null;
  error?: string | null;
  nextRetryAt?: Date | null;
  references?: {
    kind: string;
    value: string;
    meta?: Record<string, unknown> | null;
  }[];
}

export interface ConnectorProviderStatusResult {
  status:
    | "submitted"
    | "pending"
    | "succeeded"
    | "failed_retryable"
    | "failed_terminal"
    | "cancelled";
  responsePayload?: Record<string, unknown> | null;
  error?: string | null;
  nextRetryAt?: Date | null;
}

export interface ConnectorWebhookMutation {
  providerCode: string;
  eventType: string;
  webhookIdempotencyKey: string;
  signatureValid: boolean;
  rawPayload: Record<string, unknown>;
  parsedPayload?: Record<string, unknown> | null;
  intentId?: string;
  attemptId?: string;
  status?: PaymentAttemptStatus;
  externalAttemptRef?: string | null;
  error?: string | null;
  actorUserId?: string;
  requestContext?: CorrelationContext;
}

export interface ConnectorStatementRecord {
  recordId: string;
  occurredAt: Date;
  payload: Record<string, unknown>;
}

export interface ConnectorFetchStatementsResult {
  records: ConnectorStatementRecord[];
  nextCursor?: string | null;
}

export interface ConnectorAdapter {
  initiate(input: {
    intent: {
      id: string;
      documentId: string;
      docType: string;
      direction: "payin" | "payout";
      amountMinor: bigint;
      currency: string;
      corridor: string | null;
      metadata: Record<string, unknown> | null;
    };
    attempt: {
      id: string;
      attemptNo: number;
      providerCode: string;
      idempotencyKey: string;
      requestPayload: Record<string, unknown> | null;
    };
  }): Promise<ConnectorProviderSubmission>;
  getStatus(input: {
    attemptId: string;
    externalAttemptRef: string;
  }): Promise<ConnectorProviderStatusResult>;
  verifyAndParseWebhook(input: {
    rawPayload: Record<string, unknown>;
    headers?: Record<string, string | undefined>;
  }): Promise<{
    signatureValid: boolean;
    eventType: string;
    webhookIdempotencyKey: string;
    parsedPayload?: Record<string, unknown> | null;
    attemptId?: string;
    intentId?: string;
    status?: PaymentAttemptStatus;
    externalAttemptRef?: string | null;
    error?: string | null;
  }>;
  fetchStatements(input: {
    range: { from: Date; to: Date };
    cursor?: string | null;
  }): Promise<ConnectorFetchStatementsResult>;
}

export interface ConnectorsServiceDeps {
  db: Database;
  logger?: Logger;
  providers?: Record<string, ConnectorAdapter>;
}
