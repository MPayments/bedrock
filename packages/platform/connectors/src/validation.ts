import { z } from "zod";

const amountMinorSchema = z
  .union([z.bigint(), z.string().regex(/^-?\d+$/), z.number().int()])
  .transform((value) => BigInt(value));

const directionSchema = z.enum(["payin", "payout"]);
const attemptStatusSchema = z.enum([
  "queued",
  "dispatching",
  "submitted",
  "pending",
  "succeeded",
  "failed_retryable",
  "failed_terminal",
  "cancelled",
]);
const terminalIntentStatusSchema = z.enum(["succeeded", "failed", "cancelled"]);

export const CreateIntentFromDocumentInputSchema = z.object({
  documentId: z.uuid(),
  docType: z.string().trim().min(1),
  direction: directionSchema,
  amountMinor: amountMinorSchema,
  currency: z
    .string()
    .trim()
    .min(2)
    .max(16)
    .transform((value) => value.toUpperCase()),
  corridor: z.string().trim().min(1).max(128).optional(),
  providerConstraint: z.string().trim().min(1).max(128).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  idempotencyKey: z.string().trim().min(1).max(255),
  actorUserId: z.string().trim().min(1).optional(),
});

export const EnqueueAttemptInputSchema = z.object({
  intentId: z.uuid(),
  providerCode: z.string().trim().min(1).max(128),
  providerRoute: z.string().trim().min(1).max(128).optional(),
  requestPayload: z.record(z.string(), z.unknown()).optional(),
  nextRetryAt: z.date().optional(),
  idempotencyKey: z.string().trim().min(1).max(255),
  actorUserId: z.string().trim().min(1).optional(),
});

export const RecordAttemptStatusInputSchema = z.object({
  attemptId: z.uuid(),
  status: attemptStatusSchema,
  externalAttemptRef: z.string().trim().min(1).max(255).optional(),
  responsePayload: z.record(z.string(), z.unknown()).optional(),
  error: z.string().trim().min(1).optional(),
  nextRetryAt: z.date().optional(),
  idempotencyKey: z.string().trim().min(1).max(255),
  actorUserId: z.string().trim().min(1).optional(),
});

export const HandleWebhookEventInputSchema = z.object({
  providerCode: z.string().trim().min(1).max(128),
  eventType: z.string().trim().min(1).max(128),
  webhookIdempotencyKey: z.string().trim().min(1).max(255),
  signatureValid: z.boolean(),
  rawPayload: z.record(z.string(), z.unknown()),
  parsedPayload: z.record(z.string(), z.unknown()).optional(),
  intentId: z.uuid().optional(),
  attemptId: z.uuid().optional(),
  status: attemptStatusSchema.optional(),
  externalAttemptRef: z.string().trim().min(1).max(255).optional(),
  error: z.string().trim().min(1).optional(),
  actorUserId: z.string().trim().min(1).optional(),
  idempotencyKey: z.string().trim().min(1).max(255),
});

export const IngestStatementBatchInputSchema = z.object({
  providerCode: z.string().trim().min(1).max(128),
  cursorKey: z.string().trim().min(1).max(128),
  cursorValue: z.string().trim().min(1).max(2000).optional(),
  records: z.array(
    z.object({
      recordId: z.string().trim().min(1).max(255),
      occurredAt: z.date(),
      payload: z.record(z.string(), z.unknown()),
    }),
  ),
  idempotencyKey: z.string().trim().min(1).max(255),
  actorUserId: z.string().trim().min(1).optional(),
});

export const MarkIntentTerminalInputSchema = z.object({
  intentId: z.uuid(),
  status: terminalIntentStatusSchema,
  error: z.string().trim().min(1).optional(),
  idempotencyKey: z.string().trim().min(1).max(255),
  actorUserId: z.string().trim().min(1).optional(),
});

export const ClaimDispatchBatchInputSchema = z.object({
  batchSize: z.number().int().positive().max(500).default(50),
  now: z.date().optional(),
});

export const ClaimPollBatchInputSchema = z.object({
  batchSize: z.number().int().positive().max(500).default(50),
  workerId: z.string().trim().min(1).max(128).default("status-poller"),
  leaseSec: z.number().int().min(5).max(300).default(60),
  now: z.date().optional(),
});

export const ClaimStatementBatchInputSchema = z.object({
  batchSize: z.number().int().positive().max(500).default(20),
  workerId: z.string().trim().min(1).max(128).default("statement-ingest"),
  leaseSec: z.number().int().min(5).max(300).default(120),
  now: z.date().optional(),
});

export type CreateIntentFromDocumentInput = z.infer<
  typeof CreateIntentFromDocumentInputSchema
>;
export type EnqueueAttemptInput = z.infer<typeof EnqueueAttemptInputSchema>;
export type RecordAttemptStatusInput = z.infer<
  typeof RecordAttemptStatusInputSchema
>;
export type HandleWebhookEventInput = z.infer<
  typeof HandleWebhookEventInputSchema
>;
export type IngestStatementBatchInput = z.infer<
  typeof IngestStatementBatchInputSchema
>;
export type MarkIntentTerminalInput = z.infer<
  typeof MarkIntentTerminalInputSchema
>;
