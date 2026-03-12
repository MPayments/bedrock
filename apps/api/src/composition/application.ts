import {
  createAccountingReportingService,
  type AccountingReportingService,
} from "@bedrock/application/accounting-reporting";
import {
  createCounterpartiesService,
  type CounterpartiesService,
} from "@bedrock/application/counterparties";
import {
  createCurrenciesService,
  type CurrenciesService,
} from "@bedrock/application/currencies";
import {
  createCustomersService,
  type CustomersService,
} from "@bedrock/application/customers";
import {
  createDocumentRegistry,
  createDocumentsService,
  type DocumentsService,
} from "@bedrock/application/documents";
import { createFeesService, type FeesService } from "@bedrock/application/fees";
import { createFxService, type FxService } from "@bedrock/application/fx";
import { createCommercialDocumentModules } from "@bedrock/application/commercial-documents";
import { createIfrsDocumentModules } from "@bedrock/application/ifrs-documents";
import {
  createOrganizationsService,
  type OrganizationsService,
} from "@bedrock/application/organizations";
import {
  createRequisiteProvidersService,
  type RequisiteProvidersService,
} from "@bedrock/application/requisite-providers";
import {
  createRequisitesService,
  type RequisitesService,
} from "@bedrock/application/requisites";
import { db } from "@bedrock/db/client";

import type { ApiCoreServices } from "./core";

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
  const { accountingService, ledger, ledgerReadService, logger } = platform;

  const accountingReportingService = createAccountingReportingService({
    db,
    ledgerReadService,
    logger,
  });
  const counterpartiesService = createCounterpartiesService({ db, logger });
  const customersService = createCustomersService({ db, logger });
  const currenciesService = createCurrenciesService({ db, logger });
  const feesService = createFeesService({ db, logger, currenciesService });
  const fxService = createFxService({
    db,
    logger,
    feesService,
    currenciesService,
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
    ...createCommercialDocumentModules({
      currenciesService,
      requisitesService,
    }),
    ...createIfrsDocumentModules({
      requisitesService,
    }),
  ]);
  const documentsService = createDocumentsService({
    accounting: accountingService,
    db,
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
