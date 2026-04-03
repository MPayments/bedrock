import { randomUUID } from "node:crypto";

import {
  createFilesModule,
  type FilesModule,
  type FilesModuleDeps,
} from "@bedrock/files";
import {
  DrizzleFileReads,
  DrizzleFilesUnitOfWork,
} from "@bedrock/files/adapters/drizzle";
import type { Logger } from "@bedrock/platform/observability/logger";
import {
  createPersistenceContext,
  type Database,
  type PersistenceContext,
} from "@bedrock/platform/persistence";

export function createApiFilesModule(input: {
  db: Database;
  generateUuid?: FilesModuleDeps["generateUuid"];
  logger: Logger;
  now?: FilesModuleDeps["now"];
  objectStorage?: FilesModuleDeps["objectStorage"];
  persistence?: PersistenceContext;
}): FilesModule {
  const persistence = input.persistence ?? createPersistenceContext(input.db);

  return createFilesModule({
    logger: input.logger,
    now: input.now ?? (() => new Date()),
    generateUuid: input.generateUuid ?? randomUUID,
    objectStorage: input.objectStorage,
    reads: new DrizzleFileReads(input.db),
    commandUow: new DrizzleFilesUnitOfWork({ persistence }),
  });
}
