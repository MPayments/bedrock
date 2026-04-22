import { randomUUID } from "node:crypto";

import { DrizzleAgreementReads } from "@bedrock/agreements/adapters/drizzle";
import { createCurrenciesService } from "@bedrock/currencies";
import { createCurrenciesQueries } from "@bedrock/currencies/queries";
import { createDealsModule } from "@bedrock/deals";
import {
  DrizzleDealReads,
  DrizzleDealsUnitOfWork,
} from "@bedrock/deals/adapters/drizzle";
import { createDrizzleDocumentsReadModel } from "@bedrock/documents/read-model";
import { createDocumentsWorkerDefinition } from "@bedrock/documents/worker";
import { createFilesModule } from "@bedrock/files";
import {
  DrizzleFileReads,
  DrizzleFilesUnitOfWork,
} from "@bedrock/files/adapters/drizzle";
import {
  createBalancesProjectorWorkerDefinition,
  createLedgerWorkerDefinition,
  type TbClient,
} from "@bedrock/ledger/worker";
import {
  DrizzleCounterpartyReads,
  DrizzleCustomerReads,
} from "@bedrock/parties/adapters/drizzle";
import { createPartiesQueries } from "@bedrock/parties/queries";
import { OpenAIDocumentExtractionAdapter } from "@bedrock/platform/ai";
import { createIdempotencyService } from "@bedrock/platform/idempotency-postgres";
import { S3ObjectStorageAdapter } from "@bedrock/platform/object-storage";
import type { Logger } from "@bedrock/platform/observability/logger";
import { createPersistenceContext } from "@bedrock/platform/persistence";
import type { Database } from "@bedrock/platform/persistence/drizzle";
import {
  type BedrockWorker,
  type WorkerCatalogEntry,
} from "@bedrock/platform/worker-runtime";
import { createReconciliationWorkerDefinition } from "@bedrock/reconciliation/worker";
import { createTreasuryModule } from "@bedrock/treasury";
import {
  DrizzlePaymentRouteTemplatesRepository,
  DrizzleTreasuryFeeRulesRepository,
  DrizzleTreasuryInstructionArtifactsRepository,
  DrizzleTreasuryInstructionsRepository,
  DrizzleTreasuryOperationsRepository,
  DrizzleTreasuryQuoteFeeComponentsRepository,
  DrizzleTreasuryQuoteFinancialLinesRepository,
  DrizzleTreasuryQuotesRepository,
  DrizzleTreasuryRatesRepository,
  DrizzleTreasuryUnitOfWork,
} from "@bedrock/treasury/adapters/drizzle";
import { createDefaultRateSourceProviders } from "@bedrock/treasury/providers";
import { createTreasuryRatesWorkerDefinition } from "@bedrock/treasury/worker";
import { createDealAttachmentIngestionWorkflow } from "@bedrock/workflow-deal-attachment-ingestion";

import { WORKER_CATALOG } from "../catalog";
import type { WorkerEnv } from "../env";
import { createWorkerLedgerModule } from "../ledger-module";
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
  const currenciesQueries = createCurrenciesQueries({ db: deps.db });
  const documentsReadModel = createDrizzleDocumentsReadModel({ db: deps.db });
  const agreementReads = new DrizzleAgreementReads(deps.db, currenciesQueries);
  const counterpartyReads = new DrizzleCounterpartyReads(deps.db);
  const customerReads = new DrizzleCustomerReads(deps.db);
  const objectStorage =
    deps.env.S3_ENDPOINT &&
    deps.env.S3_ACCESS_KEY &&
    deps.env.S3_SECRET_KEY
      ? new S3ObjectStorageAdapter(
          {
            accessKeyId: deps.env.S3_ACCESS_KEY,
            bucket: deps.env.S3_BUCKET,
            endpoint: deps.env.S3_ENDPOINT,
            publicEndpoint: deps.env.S3_PUBLIC_ENDPOINT,
            forcePathStyle: true,
            region: deps.env.S3_REGION,
            secretAccessKey: deps.env.S3_SECRET_KEY,
          },
          deps.logger,
        )
      : undefined;
  const filesModule = createFilesModule({
    commandUow: new DrizzleFilesUnitOfWork({
      persistence: createPersistenceContext(deps.db),
    }),
    generateUuid: randomUUID,
    logger: deps.logger,
    now: () => new Date(),
    objectStorage,
    reads: new DrizzleFileReads(deps.db),
  });
  const partiesQueries = createPartiesQueries({ db: deps.db });
  const dealsModule = createDealsModule({
    commandUow: new DrizzleDealsUnitOfWork({
      bindDocumentsReadModel: (db) => createDrizzleDocumentsReadModel({ db }),
      persistence: createPersistenceContext(deps.db),
    }),
    generateUuid: randomUUID,
    idempotency: {
      withIdempotencyTx: async ({ handler }) => handler(),
    },
    logger: deps.logger,
    now: () => new Date(),
    reads: new DrizzleDealReads(
      deps.db,
      currenciesQueries,
      partiesQueries,
      documentsReadModel,
    ),
    references: {
      async findAgreementById(id: string) {
        const agreement = await agreementReads.findById(id);
        if (!agreement) {
          return null;
        }

        return {
          currentVersionId: agreement.currentVersion.id,
          customerId: agreement.customerId,
          id: agreement.id,
          isActive: agreement.isActive,
          organizationId: agreement.organizationId,
        };
      },
      async findCalculationById() {
        return null;
      },
      async findCounterpartyById(id: string) {
        return counterpartyReads.findById(id);
      },
      async findCurrencyById(id: string) {
        return currenciesService.findById(id);
      },
      async findCustomerById(id: string) {
        return customerReads.findById(id);
      },
      async findQuoteById() {
        return null;
      },
      async listActiveAgreementsByCustomerId(customerId: string) {
        const result = await agreementReads.list({
          customerId,
          isActive: true,
          limit: 10,
          offset: 0,
          sortBy: "createdAt",
          sortOrder: "desc",
        });

        return result.data.map((agreement) => ({
          currentVersionId: agreement.currentVersion.id,
          customerId: agreement.customerId,
          id: agreement.id,
          isActive: agreement.isActive,
          organizationId: agreement.organizationId,
        }));
      },
      validateSupportedCreateType(type) {
        if (
          ![
            "payment",
            "currency_exchange",
            "currency_transit",
            "exporter_settlement",
          ].includes(type)
        ) {
          throw new Error(`Unsupported deal type: ${type}`);
        }
      },
    },
  });
  const documentExtraction = deps.env.OPENAI_API_KEY
    ? new OpenAIDocumentExtractionAdapter({
        apiKey: deps.env.OPENAI_API_KEY,
      })
    : undefined;
  const dealAttachmentIngestionWorkflow = createDealAttachmentIngestionWorkflow({
    currencies: currenciesService,
    deals: dealsModule,
    documentExtraction,
    files: filesModule,
    logger: deps.logger,
  });
  const treasuryModule = createTreasuryModule({
    logger: deps.logger,
    now: () => new Date(),
    generateUuid: randomUUID,
    currencies: currenciesService,
    instructionArtifactsRepository:
      new DrizzleTreasuryInstructionArtifactsRepository(deps.db),
    instructionsRepository: new DrizzleTreasuryInstructionsRepository(deps.db),
    operationsRepository: new DrizzleTreasuryOperationsRepository(deps.db),
    ratesRepository: new DrizzleTreasuryRatesRepository(deps.db),
    quotesRepository: new DrizzleTreasuryQuotesRepository(deps.db),
    quoteFinancialLinesRepository:
      new DrizzleTreasuryQuoteFinancialLinesRepository(deps.db),
    quoteFeeComponentsRepository:
      new DrizzleTreasuryQuoteFeeComponentsRepository(deps.db),
    feeRulesRepository: new DrizzleTreasuryFeeRulesRepository(deps.db),
    paymentRouteTemplatesRepository:
      new DrizzlePaymentRouteTemplatesRepository(deps.db),
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
  const reconciliationIdempotency = createIdempotencyService({
    logger: deps.logger,
  });
  const ledgerModule = createWorkerLedgerModule({
    db: deps.db,
    idempotency: reconciliationIdempotency,
    logger: deps.logger,
    persistence: createPersistenceContext(deps.db),
  });
  const reconciliation = createReconciliationWorkerDefinition({
    ...createWorkerMetadata("reconciliation", deps.env),
    db: deps.db,
    documents: {
      existsById(documentId: string) {
        return documentsReadModel.existsById(documentId);
      },
    },
    idempotency: reconciliationIdempotency,
    ledgerLookup: {
      async operationExists(operationId: string) {
        return (
          (await ledgerModule.operations.queries.getDetails(operationId)) !== null
        );
      },
      async treasuryOperationExists(operationId: string) {
        return (await treasuryModule.operations.queries.findById(operationId)) !== null;
      },
    },
    logger: deps.logger,
  });
  const dealAttachmentIngestion = {
    ...createWorkerMetadata("deal-attachment-ingestion", deps.env),
    async runOnce(ctx) {
      return dealAttachmentIngestionWorkflow.runOnce({ now: ctx.now });
    },
  } satisfies BedrockWorker;

  return {
    [ledger.id]: ledger,
    [documents.id]: documents,
    [documentsPeriodClose.id]: documentsPeriodClose,
    [balances.id]: balances,
    [treasuryRates.id]: treasuryRates,
    [reconciliation.id]: reconciliation,
    [dealAttachmentIngestion.id]: dealAttachmentIngestion,
  };
}
