import type { ConnectorAdapter } from "./types";

/**
 * Mock webhook-based PSP adapter for development and testing.
 * DO NOT use in production -- gate behind NODE_ENV check.
 */
export const mockWebhookAdapter: ConnectorAdapter = {
  async initiate(input) {
    return {
      status: "submitted",
      externalAttemptRef: `wh:${input.attempt.id}`,
      responsePayload: { accepted: true },
    };
  },
  async getStatus() {
    return {
      status: "pending",
      responsePayload: { pending: true },
    };
  },
  async verifyAndParseWebhook(input) {
    return {
      signatureValid: true,
      eventType: "provider_event",
      webhookIdempotencyKey: String(
        input.rawPayload.eventId ?? input.rawPayload.id ?? "unknown",
      ),
      parsedPayload: input.rawPayload,
      attemptId:
        typeof input.rawPayload.attemptId === "string"
          ? input.rawPayload.attemptId
          : undefined,
      status:
        input.rawPayload.status === "succeeded"
          ? "succeeded"
          : input.rawPayload.status === "failed_terminal"
            ? "failed_terminal"
            : input.rawPayload.status === "failed_retryable"
              ? "failed_retryable"
              : "pending",
    };
  },
  async fetchStatements() {
    return {
      records: [],
      nextCursor: null,
    };
  },
};

/**
 * Mock polling-based PSP adapter for development and testing.
 * DO NOT use in production -- gate behind NODE_ENV check.
 */
export const mockPollingAdapter: ConnectorAdapter = {
  async initiate(input) {
    return {
      status: "pending",
      externalAttemptRef: `poll:${input.attempt.id}`,
      responsePayload: { accepted: true },
    };
  },
  async getStatus(input) {
    return {
      status: input.externalAttemptRef.includes("fail")
        ? "failed_retryable"
        : "succeeded",
      responsePayload: { externalAttemptRef: input.externalAttemptRef },
    };
  },
  async verifyAndParseWebhook(input) {
    return {
      signatureValid: false,
      eventType: "unsupported",
      webhookIdempotencyKey: String(
        input.rawPayload.eventId ?? input.rawPayload.id ?? "unknown",
      ),
      parsedPayload: input.rawPayload,
    };
  },
  async fetchStatements() {
    return {
      records: [],
      nextCursor: null,
    };
  },
};

/**
 * Returns mock connector adapters for development/testing.
 * Throws in production to prevent accidental use.
 */
export function getMockProviders(): Record<string, ConnectorAdapter> {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Mock connector adapters cannot be used in production. " +
        "Configure real provider adapters instead.",
    );
  }
  return {
    mock_webhook: mockWebhookAdapter,
    mock_polling: mockPollingAdapter,
  };
}
