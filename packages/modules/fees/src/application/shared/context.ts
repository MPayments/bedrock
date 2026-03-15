import type { Logger } from "@bedrock/platform/observability/logger";
import { noopLogger } from "@bedrock/platform/observability/logger";
import type { Database } from "@bedrock/platform/persistence";

import type {
  FeesQuoteSnapshotsCommandRepository,
  FeesQuoteSnapshotsQueryRepository,
} from "../quotes/ports";
import type { FeesRulesRepository } from "../rules/ports";
import type { FeesCurrenciesPort } from "./external-ports";

export interface FeesServiceDeps {
  db: Database;
  logger?: Logger;
  currenciesService: FeesCurrenciesPort;
}

export interface FeesServiceContext {
  currenciesService: FeesCurrenciesPort;
  rulesRepository: FeesRulesRepository;
  quoteSnapshotsQueryRepository: FeesQuoteSnapshotsQueryRepository;
  quoteSnapshotsCommandRepository: FeesQuoteSnapshotsCommandRepository;
  log: Logger;
}

export function createFeesServiceContext(input: {
  logger?: Logger;
  currenciesService: FeesCurrenciesPort;
  rulesRepository: FeesRulesRepository;
  quoteSnapshotsQueryRepository: FeesQuoteSnapshotsQueryRepository;
  quoteSnapshotsCommandRepository: FeesQuoteSnapshotsCommandRepository;
}): FeesServiceContext {
  return {
    currenciesService: input.currenciesService,
    rulesRepository: input.rulesRepository,
    quoteSnapshotsQueryRepository: input.quoteSnapshotsQueryRepository,
    quoteSnapshotsCommandRepository: input.quoteSnapshotsCommandRepository,
    log: input.logger?.child({ service: "fees" }) ?? noopLogger,
  };
}
