import {
  createAccountingPeriodsService,
  type AccountingPeriodsService,
} from "@bedrock/accounting/periods";
import {
  createAccountingReportsService,
  type AccountingReportsService,
} from "@bedrock/accounting/reports";
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
  createDocumentsService,
  type DocumentsService,
} from "@bedrock/documents";
import { createDocumentsQueries } from "@bedrock/documents/queries";
import { createFeesService, type FeesService } from "@bedrock/fees";
import { createFxService, type FxService } from "@bedrock/fx";
import { createDefaultFxRateSourceProviders } from "@bedrock/fx/infra/providers";
import {
  createOrganizationsService,
  type OrganizationsService,
} from "@bedrock/organizations";
import { createCommercialDocumentModules } from "@bedrock/plugin-documents-commercial";
import { createIfrsDocumentModules } from "@bedrock/plugin-documents-ifrs";
import { createDocumentRegistry } from "@bedrock/plugin-documents-sdk";
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
import { db } from "../db/client";

export interface ApiApplicationServices {
  accountingReportsService: AccountingReportsService;
  accountingPeriodsService: AccountingPeriodsService;
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

  const accountingReportsService = createAccountingReportsService({
    db,
    documentsQueries: createDocumentsQueries({ db }),
    ledgerReadService,
    logger,
  });
  const accountingPeriodsService = createAccountingPeriodsService({
    db,
    documentsQueriesFactory: ({ db: queryable }) =>
      createDocumentsQueries({ db: queryable }),
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
        currenciesService,
        fxService,
        requisitesService,
      }),
    ),
  ]);
  const documentsService = createDocumentsService({
    accounting: accountingService,
    accountingPeriods: accountingPeriodsService,
    db,
    idempotency,
    ledger,
    ledgerReadService,
    registry: documentRegistry,
    logger,
  });

  return {
    accountingReportsService,
    accountingPeriodsService,
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
