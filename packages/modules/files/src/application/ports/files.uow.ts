import type { UnitOfWork } from "@bedrock/shared/core/unit-of-work";

import type { FileReads } from "./file.reads";
import type { FileStore } from "./file.store";

export interface FilesCommandTx {
  fileReads: FileReads;
  fileStore: FileStore;
}

export type FilesCommandUnitOfWork = UnitOfWork<FilesCommandTx>;
