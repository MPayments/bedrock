import { randomUUID } from "node:crypto";

import { createCurrenciesService } from "@bedrock/currencies";
import { createDocumentsWorkerDefinition } from "@bedrock/documents/worker";
import {
  createBalancesProjectorWorkerDefinition,
  createLedgerWorkerDefinition,
  type TbClient,
} from "@bedrock/ledger/worker";
import type { Logger } from "@bedrock/platform/observability/logger";
import { createPersistenceContext } from "@bedrock/platform/persistence";
import type { Database } from "@bedrock/platform/persistence/drizzle";
import {
  type BedrockWorker,
  type WorkerCatalogEntry,
} from "@bedrock/platform/worker-runtime";
import {
  createTreasuryModule,
} from "@bedrock/treasury";
import {
  DrizzleTreasuryCoreRepository,
  DrizzleTreasuryFeeRulesRepository,
  DrizzleTreasuryQuoteFeeComponentsRepository,
  DrizzleTreasuryQuoteFinancialLinesRepository,
  DrizzleTreasuryQuotesRepository,
  DrizzleTreasuryRatesRepository,
  DrizzleTreasuryUnitOfWork,
} from "@bedrock/treasury/adapters/drizzle";
import { createDefaultRateSourceProviders } from "@bedrock/treasury/providers";
import { createTreasuryRatesWorkerDefinition } from "@bedrock/treasury/worker";

import { WORKER_CATALOG } from "../catalog";
import type { WorkerEnv } from "../env";
import { createPeriodCloseWorkerDefinition } from "./period-close";

interface WorkerModuleDeps {
  db: Database;
  logger: Logger;
  env: WorkerEnv;
  tb: TbClient;
}

const workerCatalogById = new Map<string, WorkerCatalogEntry>(
  WORKER_CATALOG.map((entry) => [entry.id, entry]),
);

function requireWorkerCatalogEntry(workerId: string): WorkerCatalogEntry {
  const entry = workerCatalogById.get(workerId);
  if (!entry) {
    throw new Error(`Missing worker catalog entry for ${workerId}`);
  }
  return entry;
}

function createWorkerMetadata(
  workerId: string,
  env: WorkerEnv,
): Pick<BedrockWorker, "id" | "intervalMs"> {
  const entry = requireWorkerCatalogEntry(workerId);
  const intervalMs = env.WORKER_INTERVALS[workerId] ?? entry.defaultIntervalMs;

  if (!Number.isInteger(intervalMs) || intervalMs <= 0) {
    throw new Error(`Invalid interval for worker ${workerId}: ${intervalMs}`);
  }

  return {
    id: workerId,
    intervalMs,
  };
}

export function createWorkerImplementations(
  deps: WorkerModuleDeps,
): Record<string, BedrockWorker> {
  const ledger = createLedgerWorkerDefinition({
    ...createWorkerMetadata("ledger", deps.env),
    db: deps.db,
    tb: deps.tb,
  });

  const documents = createDocumentsWorkerDefinition({
    ...createWorkerMetadata("documents", deps.env),
    db: deps.db,
  });
  const documentsPeriodClose = createPeriodCloseWorkerDefinition({
    ...createWorkerMetadata("documents-period-close", deps.env),
    db: deps.db,
    logger: deps.logger,
  });

  const balances = createBalancesProjectorWorkerDefinition({
    ...createWorkerMetadata("balances", deps.env),
    db: deps.db,
    logger: deps.logger,
  });

  const currenciesService = createCurrenciesService({
    db: deps.db,
    logger: deps.logger,
  });
  const treasuryModule = createTreasuryModule({
    logger: deps.logger,
    now: () => new Date(),
    generateUuid: randomUUID,
    currencies: currenciesService,
    coreReads: new DrizzleTreasuryCoreRepository(deps.db),
    ratesRepository: new DrizzleTreasuryRatesRepository(deps.db),
    quotesRepository: new DrizzleTreasuryQuotesRepository(deps.db),
    quoteFinancialLinesRepository:
      new DrizzleTreasuryQuoteFinancialLinesRepository(deps.db),
    quoteFeeComponentsRepository:
      new DrizzleTreasuryQuoteFeeComponentsRepository(deps.db),
    feeRulesRepository: new DrizzleTreasuryFeeRulesRepository(deps.db),
    unitOfWork: new DrizzleTreasuryUnitOfWork({
      persistence: createPersistenceContext(deps.db),
    }),
    rateSourceProviders: createDefaultRateSourceProviders(),
  });
  const treasuryRates = createTreasuryRatesWorkerDefinition({
    ...createWorkerMetadata("treasury-rates", deps.env),
    treasuryModule,
    logger: deps.logger,
  });

  return {
    [ledger.id]: ledger,
    [documents.id]: documents,
    [documentsPeriodClose.id]: documentsPeriodClose,
    [balances.id]: balances,
    [treasuryRates.id]: treasuryRates,
  };
}
