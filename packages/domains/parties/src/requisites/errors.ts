import { ServiceError } from "@multihansa/common/errors";

export class RequisiteError extends ServiceError {}

export class RequisiteNotFoundError extends RequisiteError {
  name = "RequisiteNotFoundError";

  constructor(id: string) {
    super(`Requisite not found: ${id}`);
  }
}

export class RequisiteProviderNotActiveError extends RequisiteError {
  name = "RequisiteProviderNotActiveError";

  constructor(id: string) {
    super(`Requisite provider is not active: ${id}`);
  }
}

export class RequisiteBindingNotFoundError extends RequisiteError {
  name = "RequisiteBindingNotFoundError";

  constructor(requisiteId: string) {
    super(`Requisite accounting binding not found: ${requisiteId}`);
  }
}

export class RequisiteBindingOwnerTypeError extends RequisiteError {
  name = "RequisiteBindingOwnerTypeError";

  constructor(requisiteId: string) {
    super(`Only organization requisites can have accounting binding: ${requisiteId}`);
  }
}
