import { db } from "@bedrock/adapter-db-drizzle/client";
import {
  createCustomerLifecycleSyncPort,
  createCounterpartiesService,
  type CounterpartiesService,
} from "@bedrock/counterparties";
import {
  createCurrenciesService,
  type CurrenciesService,
} from "@bedrock/currencies";
import {
  createCustomersService,
  type CustomersService,
} from "@bedrock/customers";
import {
  createDocumentRegistry,
  createDocumentsService,
  type DocumentsService,
} from "@bedrock/documents";
import { createCommercialDocumentModules } from "@bedrock/extension-documents-commercial";
import { createIfrsDocumentModules } from "@bedrock/extension-documents-ifrs";
import { createFeesService, type FeesService } from "@bedrock/fees";
import { createFxService, type FxService } from "@bedrock/fx";
import { createDefaultFxRateSourceProviders } from "@bedrock/integration-fx-providers";
import {
  createOrganizationsService,
  type OrganizationsService,
} from "@bedrock/organizations";
import {
  createAccountingReportingService,
  type AccountingReportingService,
} from "@bedrock/query-accounting-reporting";
import {
  createRequisitesService,
  type RequisitesService,
} from "@bedrock/requisites";
import {
  createRequisiteProvidersService,
  type RequisiteProvidersService,
} from "@bedrock/requisites/providers";

import type { ApiCoreServices } from "./core";
import {
  createCommercialDocumentDeps,
  createIfrsDocumentDeps,
} from "./document-plugin-adapters";

export interface ApiApplicationServices {
  accountingReportingService: AccountingReportingService;
  counterpartiesService: CounterpartiesService;
  customersService: CustomersService;
  currenciesService: CurrenciesService;
  feesService: FeesService;
  fxService: FxService;
  organizationsService: OrganizationsService;
  requisiteProvidersService: RequisiteProvidersService;
  requisitesService: RequisitesService;
  documentsService: DocumentsService;
}

export function createApplicationServices(
  platform: ApiCoreServices,
): ApiApplicationServices {
  const { accountingService, idempotency, ledger, ledgerReadService, logger } =
    platform;

  const accountingReportingService = createAccountingReportingService({
    db,
    ledgerReadService,
    logger,
  });
  const counterpartiesService = createCounterpartiesService({ db, logger });
  const customersService = createCustomersService({
    db,
    customerLifecycleSyncPort: createCustomerLifecycleSyncPort(),
    logger,
  });
  const currenciesService = createCurrenciesService({ db, logger });
  const feesService = createFeesService({ db, logger, currenciesService });
  const fxService = createFxService({
    db,
    logger,
    feesService,
    currenciesService,
    rateSourceProviders: createDefaultFxRateSourceProviders(),
  });
  const organizationsService = createOrganizationsService({
    db,
    logger,
  });
  const requisiteProvidersService = createRequisiteProvidersService({
    db,
    logger,
  });
  const requisitesService = createRequisitesService({
    db,
    logger,
  });
  const documentRegistry = createDocumentRegistry([
    ...createCommercialDocumentModules(
      createCommercialDocumentDeps({
        currenciesService,
        requisitesService,
      }),
    ),
    ...createIfrsDocumentModules(
      createIfrsDocumentDeps({
        requisitesService,
      }),
    ),
  ]);
  const documentsService = createDocumentsService({
    accounting: accountingService,
    db,
    idempotency,
    ledger,
    ledgerReadService,
    registry: documentRegistry,
    logger,
  });

  return {
    accountingReportingService,
    counterpartiesService,
    customersService,
    currenciesService,
    feesService,
    fxService,
    organizationsService,
    requisiteProvidersService,
    requisitesService,
    documentsService,
  };
}
