import {
  NotFoundError,
  ServiceError,
  ValidationError,
} from "@bedrock/shared/core/errors";

export class FilesError extends ServiceError {}

export class FileAssetNotFoundError extends NotFoundError {
  constructor(id: string) {
    super("File asset", id);
  }
}

export class FileAttachmentDeletionNotAllowedError extends ValidationError {
  constructor(id: string) {
    super(`File asset ${id} is not a deletable uploaded attachment`);
  }
}
