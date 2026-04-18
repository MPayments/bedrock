import { randomUUID } from "node:crypto";

import type { Logger } from "@bedrock/platform/observability/logger";
import {
  createPersistenceContext,
  type Database,
  type PersistenceContext,
  type Transaction,
} from "@bedrock/platform/persistence";

import { DrizzleFileReads } from "./file.reads";
import { DrizzleFilesUnitOfWork } from "./files.uow";
import {
  createFilesModule,
  type FilesModule,
  type FilesModuleDeps,
} from "../../module";

export interface CreateFilesModuleFromDrizzleInput {
  db: Database | Transaction;
  generateUuid?: FilesModuleDeps["generateUuid"];
  logger: Logger;
  now?: FilesModuleDeps["now"];
  objectStorage?: FilesModuleDeps["objectStorage"];
  persistence?: PersistenceContext;
}

export function createFilesModuleFromDrizzle(
  input: CreateFilesModuleFromDrizzleInput,
): FilesModule {
  const persistence =
    input.persistence ?? createPersistenceContext(input.db as Database);

  return createFilesModule({
    commandUow: new DrizzleFilesUnitOfWork({ persistence }),
    generateUuid: input.generateUuid ?? randomUUID,
    logger: input.logger,
    now: input.now ?? (() => new Date()),
    objectStorage: input.objectStorage,
    reads: new DrizzleFileReads(input.db),
  });
}
