import { ServiceError } from "@bedrock/shared/core/errors";

export class RequisiteError extends ServiceError {}

export class RequisiteNotFoundError extends RequisiteError {
  name = "RequisiteNotFoundError";

  constructor(id: string) {
    super(`Requisite not found: ${id}`);
  }
}

export class RequisiteProviderError extends RequisiteError {}

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

export class RequisiteAccountingBindingNotFoundError extends RequisiteError {
  name = "RequisiteAccountingBindingNotFoundError";

  constructor(id: string) {
    super(`Requisite accounting binding not found: ${id}`);
  }
}

export class RequisiteAccountingBindingOwnerTypeError extends RequisiteError {
  name = "RequisiteAccountingBindingOwnerTypeError";

  constructor(id: string) {
    super(`Only organization requisites can have accounting binding: ${id}`);
  }
}
