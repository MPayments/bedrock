import { ServiceError, ValidationError } from "@bedrock/shared/core/errors";

export class RequisiteError extends ServiceError {}

export class RequisiteNotFoundError extends RequisiteError {
  constructor(id: string) {
    super(`Requisite not found: ${id}`);
  }
}

export class RequisiteProviderError extends RequisiteError {}

export class RequisiteProviderNotFoundError extends RequisiteProviderError {
  constructor(id: string) {
    super(`Requisite provider not found: ${id}`);
  }
}

export class RequisiteProviderNotActiveError extends RequisiteProviderError {
  constructor(id: string) {
    super(`Requisite provider is not active: ${id}`);
  }
}

export class RequisiteProviderBranchMismatchError extends ValidationError {
  constructor(providerId: string, branchId: string) {
    super(
      `Requisite provider branch ${branchId} does not belong to provider ${providerId}`,
    );
  }
}

export class RequisiteAccountingBindingNotFoundError extends RequisiteError {
  constructor(id: string) {
    super(`Requisite accounting binding not found: ${id}`);
  }
}

export class RequisiteAccountingBindingOwnerTypeError extends RequisiteError {
  constructor(id: string) {
    super(`Only organization requisites can have accounting binding: ${id}`);
  }
}
