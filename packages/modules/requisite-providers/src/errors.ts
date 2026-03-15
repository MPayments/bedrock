import { ServiceError } from "@bedrock/shared/core/errors";

export class RequisiteProviderError extends ServiceError {}

export class RequisiteProviderNotFoundError extends RequisiteProviderError {
  name = "RequisiteProviderNotFoundError";

  constructor(id: string) {
    super(`Requisite provider not found: ${id}`);
  }
}

export class RequisiteProviderNotActiveError extends RequisiteProviderError {
  name = "RequisiteProviderNotActiveError";

  constructor(id: string) {
    super(`Requisite provider is not active: ${id}`);
  }
}
