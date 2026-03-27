import { randomUUID } from "node:crypto";

import type { Logger } from "@bedrock/platform/observability/logger";
import {
  bindPersistenceSession,
  createPersistenceContext,
  type Database,
  type PersistenceContext,
  type Transaction,
} from "@bedrock/platform/persistence";
import {
  createTreasuryModule,
  type TreasuryModule,
  type TreasuryModuleDeps,
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
import { createTreasuryPostingWorkflow } from "@bedrock/workflow-treasury-posting";

import { createApiAccountingModule } from "./accounting-module";
import { createApiLedgerModule } from "./ledger-module";

function createBaseTreasuryModule(input: {
  db: Database | Transaction;
  logger: Logger;
  currencies: TreasuryModuleDeps["currencies"];
  now?: TreasuryModuleDeps["now"];
  generateUuid?: TreasuryModuleDeps["generateUuid"];
  persistence?: PersistenceContext;
}): TreasuryModule {
  const persistence =
    input.persistence ?? createPersistenceContext(input.db as Database);

  return createTreasuryModule({
    logger: input.logger,
    now: input.now ?? (() => new Date()),
    generateUuid: input.generateUuid ?? randomUUID,
    currencies: input.currencies,
    coreReads: new DrizzleTreasuryCoreRepository(input.db),
    ratesRepository: new DrizzleTreasuryRatesRepository(input.db),
    quotesRepository: new DrizzleTreasuryQuotesRepository(input.db),
    quoteFinancialLinesRepository:
      new DrizzleTreasuryQuoteFinancialLinesRepository(input.db),
    quoteFeeComponentsRepository:
      new DrizzleTreasuryQuoteFeeComponentsRepository(input.db),
    feeRulesRepository: new DrizzleTreasuryFeeRulesRepository(input.db),
    unitOfWork: new DrizzleTreasuryUnitOfWork({ persistence }),
    rateSourceProviders: createDefaultRateSourceProviders(),
  });
}

export function createApiTreasuryModule(input: {
  db: Database;
  logger: Logger;
  idempotency: Parameters<typeof createApiLedgerModule>[0]["idempotency"];
  currencies: TreasuryModuleDeps["currencies"];
  now?: TreasuryModuleDeps["now"];
  generateUuid?: TreasuryModuleDeps["generateUuid"];
  persistence?: PersistenceContext;
}): TreasuryModule {
  const persistence = input.persistence ?? createPersistenceContext(input.db);
  const createTreasuryModuleForTransaction = (tx: Transaction) =>
    createBaseTreasuryModule({
      db: tx,
      logger: input.logger,
      currencies: input.currencies,
      now: input.now,
      generateUuid: input.generateUuid,
      persistence: bindPersistenceSession(tx),
    });
  const treasuryPostingWorkflow = createTreasuryPostingWorkflow({
    db: input.db,
    currencies: input.currencies,
    createTreasuryModule: createTreasuryModuleForTransaction,
    createTreasuryReads: (tx) => new DrizzleTreasuryCoreRepository(tx),
    createAccountingModule: (tx) =>
      createApiAccountingModule({
        db: tx,
        logger: input.logger,
        persistence: bindPersistenceSession(tx),
      }),
    createLedgerModule: (tx) =>
      createApiLedgerModule({
        db: tx,
        idempotency: input.idempotency,
        logger: input.logger,
        persistence: bindPersistenceSession(tx),
      }),
  });
  const baseModule = createBaseTreasuryModule({
    db: input.db,
    logger: input.logger,
    currencies: input.currencies,
    now: input.now,
    generateUuid: input.generateUuid,
    persistence,
  });

  return {
    ...baseModule,
    obligations: {
      ...baseModule.obligations,
      commands: {
        ...baseModule.obligations.commands,
        openObligation: treasuryPostingWorkflow.openObligation,
      },
    },
    executions: {
      ...baseModule.executions,
      commands: {
        ...baseModule.executions.commands,
        recordExecutionEvent: treasuryPostingWorkflow.recordExecutionEvent,
      },
    },
    positions: {
      ...baseModule.positions,
      commands: {
        ...baseModule.positions.commands,
        settlePosition: treasuryPostingWorkflow.settlePosition,
      },
    },
  };
}
