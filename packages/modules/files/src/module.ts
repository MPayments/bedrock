import type { Logger } from "@bedrock/platform/observability/logger";
import {
  createModuleRuntime,
  type Clock,
  type UuidGenerator,
} from "@bedrock/shared/core";

import {
  createFilesService,
  type FilesService,
} from "./application";
import type { FileReads } from "./application/ports/file.reads";
import type { FilesCommandUnitOfWork } from "./application/ports/files.uow";
import type { ObjectStoragePort } from "./application/ports/object-storage.port";

export interface FilesModuleDeps {
  commandUow: FilesCommandUnitOfWork;
  generateUuid: UuidGenerator;
  logger: Logger;
  now: Clock;
  objectStorage?: ObjectStoragePort;
  reads: FileReads;
}

export interface FilesModule {
  files: FilesService;
}

export function createFilesModule(deps: FilesModuleDeps): FilesModule {
  return {
    files: createFilesService({
      commandUow: deps.commandUow,
      objectStorage: deps.objectStorage,
      reads: deps.reads,
      runtime: createModuleRuntime({
        logger: deps.logger,
        now: deps.now,
        generateUuid: deps.generateUuid,
        service: "files",
      }),
    }),
  };
}
