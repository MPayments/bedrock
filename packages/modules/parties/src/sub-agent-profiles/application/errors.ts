import { ServiceError } from "@bedrock/shared/core/errors";

export class SubAgentProfileError extends ServiceError {}

export class SubAgentProfileNotFoundError extends SubAgentProfileError {
  constructor(counterpartyId: string) {
    super(`Sub-agent profile not found: ${counterpartyId}`);
  }
}
