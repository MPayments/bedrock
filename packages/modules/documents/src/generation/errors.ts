import { NotFoundError, ValidationError } from "@bedrock/shared/core/errors";

export class CustomerContractNotFoundError extends NotFoundError {
  constructor() {
    super("Contract", "active");
    this.message = "Contract not found";
  }
}

export class CustomerContractOrganizationNotFoundError extends NotFoundError {
  constructor() {
    super("Organization", "contract");
    this.message = "Organization not found";
  }
}

export class OrganizationFilesNotConfiguredError extends ValidationError {
  constructor() {
    super("Organization signature and seal are not configured");
  }
}

export class OrganizationFileMissingInStorageError extends ValidationError {
  constructor() {
    super("Organization signature or seal file is missing in object storage");
  }
}
