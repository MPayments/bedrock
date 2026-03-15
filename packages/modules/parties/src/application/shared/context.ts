import type { Logger } from "@bedrock/platform/observability/logger";
import { noopLogger } from "@bedrock/platform/observability/logger";
import type { Database } from "@bedrock/platform/persistence";

import type {
  PartiesDocumentsReadPort,
  PartiesRepository,
} from "../ports";

export interface PartiesServiceDeps {
  db: Database;
  logger?: Logger;
  documents: PartiesDocumentsReadPort;
}

export interface PartiesServiceContext {
  db: Database;
  log: Logger;
  documents: PartiesDocumentsReadPort;
  parties: PartiesRepository;
}

export function createPartiesServiceContext(input: {
  db: Database;
  logger?: Logger;
  documents: PartiesDocumentsReadPort;
  parties: PartiesRepository;
}): PartiesServiceContext {
  return {
    db: input.db,
    log: input.logger?.child({ service: "parties" }) ?? noopLogger,
    documents: input.documents,
    parties: input.parties,
  };
}
