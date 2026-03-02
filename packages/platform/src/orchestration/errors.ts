import { NotFoundError, ServiceError } from "@bedrock/foundation/kernel/errors";

export class RoutingRuleNotFoundError extends NotFoundError {
  constructor(id: string) {
    super("Routing rule", id);
  }
}

export class ProviderCorridorNotFoundError extends NotFoundError {
  constructor(id: string) {
    super("Provider corridor", id);
  }
}

export class ProviderFeeScheduleNotFoundError extends NotFoundError {
  constructor(id: string) {
    super("Provider fee schedule", id);
  }
}

export class ProviderLimitNotFoundError extends NotFoundError {
  constructor(id: string) {
    super("Provider limit", id);
  }
}

export class ScopeOverrideNotFoundError extends NotFoundError {
  constructor(id: string) {
    super("Scope override", id);
  }
}

export class RouteCandidateNotFoundError extends ServiceError {
  constructor(input: {
    corridor: string;
    currency: string;
    direction: string;
  }) {
    super(
      `No orchestration candidates for ${input.direction}:${input.corridor}:${input.currency}`,
    );
  }
}
