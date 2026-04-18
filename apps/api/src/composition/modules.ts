import type { AgreementsModule } from "@bedrock/agreements";
import { createAgreementsModuleFromDrizzle } from "@bedrock/agreements/adapters/drizzle";
import type { CalculationsModule } from "@bedrock/calculations";
import { createCalculationsModuleFromDrizzle } from "@bedrock/calculations/adapters/drizzle";
import {
  createCurrenciesService,
  type CurrenciesService,
} from "@bedrock/currencies";
import type { DealsModule } from "@bedrock/deals";
import { createDealsModuleFromDrizzle } from "@bedrock/deals/adapters/drizzle";
import {
  createDrizzleDocumentsReadModel,
  type DocumentsReadModel,
} from "@bedrock/documents/read-model";
import type { FilesModule } from "@bedrock/files";
import { createFilesModuleFromDrizzle } from "@bedrock/files/adapters/drizzle";
import type { PartiesModule } from "@bedrock/parties";
import { createPartiesModuleFromDrizzle } from "@bedrock/parties/adapters/drizzle";
import {
  createPartiesQueries,
  type PartiesQueries,
} from "@bedrock/parties/queries";
import type { S3ObjectStorageAdapter } from "@bedrock/platform/object-storage";
import { createReconciliationService, type ReconciliationService } from "@bedrock/reconciliation";
import type { TreasuryModule } from "@bedrock/treasury";
import { createTreasuryModuleFromDrizzle } from "@bedrock/treasury/adapters/drizzle";

import type { Env } from "../context";
import { db } from "../db/client";
import type { ApiCoreServices } from "./core";
import { createObjectStorageAdapter } from "./workflows";

export type ApplicationPartiesReadRuntime = {
  counterpartiesQueries: PartiesQueries["counterparties"];
  customersQueries: PartiesQueries["customers"];
  organizationsQueries: PartiesQueries["organizations"];
  requisitesQueries: PartiesQueries["requisites"];
};

export type ApplicationCurrenciesPort = {
  assertCurrencyExists(id: string): Promise<void>;
  listCodesById(ids: string[]): Promise<Map<string, string>>;
};

export type ApplicationTreasuryCurrenciesPort = Pick<
  CurrenciesService,
  "findByCode" | "findById"
>;

export type ApplicationLedgerReadPort = {
  getOperationDetails: ApiCoreServices["ledgerModule"]["operations"]["queries"]["getDetails"];
  listOperationDetails: ApiCoreServices["ledgerModule"]["operations"]["queries"]["listDetails"];
};

export interface ApplicationModules {
  agreementsModule: AgreementsModule;
  calculationsModule: CalculationsModule;
  currenciesPort: ApplicationCurrenciesPort;
  currenciesService: CurrenciesService;
  dealsModule: DealsModule;
  documentsReadModel: DocumentsReadModel;
  filesModule: FilesModule;
  ledgerReadPort: ApplicationLedgerReadPort;
  objectStorage?: S3ObjectStorageAdapter;
  partiesModule: PartiesModule;
  partiesReadRuntime: ApplicationPartiesReadRuntime;
  reconciliationService: ReconciliationService;
  treasuryCurrenciesPort: ApplicationTreasuryCurrenciesPort;
  treasuryModule: TreasuryModule;
}

export function createApplicationModules(input: {
  env?: Env;
  platform: ApiCoreServices;
}): ApplicationModules {
  const { env, platform } = input;
  const { idempotency, ledgerModule, logger, persistence } = platform;

  const objectStorage = createObjectStorageAdapter(env, logger);
  const documentsReadModel = createDrizzleDocumentsReadModel({ db });
  const currenciesService = createCurrenciesService({ db, logger });
  const partiesQueries = createPartiesQueries({ db });
  const partiesReadRuntime: ApplicationPartiesReadRuntime = {
    counterpartiesQueries: partiesQueries.counterparties,
    customersQueries: partiesQueries.customers,
    organizationsQueries: partiesQueries.organizations,
    requisitesQueries: partiesQueries.requisites,
  };
  const currenciesPort: ApplicationCurrenciesPort = {
    async assertCurrencyExists(id: string) {
      await currenciesService.findById(id);
    },
    async listCodesById(ids: string[]) {
      const rows = await Promise.all(
        ids.map(
          async (id) =>
            [id, (await currenciesService.findById(id)).code] as const,
        ),
      );

      return new Map(rows);
    },
  };
  const treasuryCurrenciesPort: ApplicationTreasuryCurrenciesPort = {
    findByCode: currenciesService.findByCode,
    findById: currenciesService.findById,
  };
  const ledgerReadPort: ApplicationLedgerReadPort = {
    getOperationDetails: ledgerModule.operations.queries.getDetails,
    listOperationDetails: ledgerModule.operations.queries.listDetails,
  };

  const treasuryModule = createTreasuryModuleFromDrizzle({
    db,
    currencies: treasuryCurrenciesPort,
    logger,
    persistence,
  });
  const partiesModule = createPartiesModuleFromDrizzle({
    currencies: currenciesPort,
    db,
    documents: {
      hasDocumentsForCustomer(customerId) {
        return documentsReadModel.hasDocumentsForCustomer(customerId);
      },
    },
    logger,
    persistence,
  });
  const agreementsModule = createAgreementsModuleFromDrizzle({
    currencies: currenciesService,
    db,
    idempotency,
    logger,
    persistence,
  });
  const calculationsModule = createCalculationsModuleFromDrizzle({
    currencies: currenciesService,
    db,
    idempotency,
    logger,
    persistence,
    treasuryRates: treasuryModule.rates.queries,
    treasuryQuotes: treasuryModule.quotes.queries,
  });
  const dealsModule = createDealsModuleFromDrizzle({
    bindDocumentsReadModel: (queryable) =>
      createDrizzleDocumentsReadModel({ db: queryable }),
    currencies: currenciesService,
    db,
    documentsReadModel,
    ledgerBalances: ledgerModule.balances.queries,
    idempotency,
    logger,
    persistence,
    quoteReads: treasuryModule.quotes.queries,
  });
  const filesModule = createFilesModuleFromDrizzle({
    db,
    logger,
    objectStorage,
    persistence,
  });
  const reconciliationService = createReconciliationService({
    persistence,
    idempotency,
    documents: {
      existsById(documentId: string) {
        return documentsReadModel.existsById(documentId);
      },
    },
    ledgerLookup: {
      async operationExists(operationId: string) {
        return (await ledgerModule.operations.queries.getDetails(operationId)) !== null;
      },
      async treasuryOperationExists(operationId: string) {
        return (await treasuryModule.operations.queries.findById(operationId)) !== null;
      },
    },
    logger,
  });

  return {
    agreementsModule,
    calculationsModule,
    currenciesPort,
    currenciesService,
    dealsModule,
    documentsReadModel,
    filesModule,
    ledgerReadPort,
    objectStorage,
    partiesModule,
    partiesReadRuntime,
    reconciliationService,
    treasuryCurrenciesPort,
    treasuryModule,
  };
}
