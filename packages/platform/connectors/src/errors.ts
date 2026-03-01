import { NotFoundError, ServiceError } from "@bedrock/kernel/errors";

export class ConnectorIntentNotFoundError extends NotFoundError {
  constructor(id: string) {
    super("Connector intent", id);
  }
}

export class PaymentAttemptNotFoundError extends NotFoundError {
  constructor(id: string) {
    super("Payment attempt", id);
  }
}

export class ConnectorProviderNotConfiguredError extends ServiceError {
  constructor(providerCode: string) {
    super(`Connector provider not configured: ${providerCode}`);
  }
}

export class ConnectorIntentTerminalError extends ServiceError {
  constructor(intentId: string, status: string) {
    super(`Connector intent is terminal: ${intentId} (${status})`);
  }
}

export class ConnectorMaxAttemptsExceededError extends ServiceError {
  constructor(intentId: string, attemptNo: number, maxAttempts: number) {
    super(
      `Max attempts exceeded for intent ${intentId}: ${attemptNo} >= ${maxAttempts}`,
    );
  }
}
