import type { Logger } from "@bedrock/platform/observability/logger";
import { noopLogger } from "@bedrock/platform/observability/logger";
import type { Database } from "@bedrock/platform/persistence";

import type {
  FeesCurrenciesPort,
  FeesQuoteSnapshotsRepositoryPort,
  FeesRulesRepositoryPort,
} from "../ports";

export interface FeesServiceDeps {
  db: Database;
  logger?: Logger;
  currenciesService: FeesCurrenciesPort;
}

export interface FeesServiceContext {
  currenciesService: FeesCurrenciesPort;
  rulesRepository: FeesRulesRepositoryPort;
  quoteSnapshotsRepository: FeesQuoteSnapshotsRepositoryPort;
  log: Logger;
}

export function createFeesServiceContext(input: {
  logger?: Logger;
  currenciesService: FeesCurrenciesPort;
  rulesRepository: FeesRulesRepositoryPort;
  quoteSnapshotsRepository: FeesQuoteSnapshotsRepositoryPort;
}): FeesServiceContext {
  return {
    currenciesService: input.currenciesService,
    rulesRepository: input.rulesRepository,
    quoteSnapshotsRepository: input.quoteSnapshotsRepository,
    log: input.logger?.child({ service: "fees" }) ?? noopLogger,
  };
}
