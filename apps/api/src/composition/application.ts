import {
  createAccountingReportingService,
  type AccountingReportingService,
} from "@bedrock/application/accounting-reporting";
import { createFeesService, type FeesService } from "@bedrock/application/fees";
import { createFxService, type FxService } from "@bedrock/application/fx";
import { createIfrsDocumentModules } from "@bedrock/application/ifrs-documents";
import {
  createPaymentIntentDocumentModule,
  createPaymentResolutionDocumentModule,
  createPaymentsService,
  type PaymentsService,
} from "@bedrock/application/payments";
import {
  createCounterpartiesService,
  type CounterpartiesService,
} from "@bedrock/core/counterparties";
import {
  createCurrenciesService,
  type CurrenciesService,
} from "@bedrock/core/currencies";
import {
  createCustomersService,
  type CustomersService,
} from "@bedrock/core/customers";
import {
  createDocumentRegistry,
  createDocumentsService,
  type DocumentsService,
} from "@bedrock/core/documents";
import {
  createOrganizationsService,
  type OrganizationsService,
} from "@bedrock/core/organizations";
import {
  createRequisiteProvidersService,
  type RequisiteProvidersService,
} from "@bedrock/core/requisite-providers";
import {
  createRequisitesService,
  type RequisitesService,
} from "@bedrock/core/requisites";
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
  paymentsService: PaymentsService;
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
    ...createIfrsDocumentModules({
      requisitesService,
    }),
    createPaymentIntentDocumentModule({
      requisitesService,
    }),
    createPaymentResolutionDocumentModule({
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
  const paymentsService = createPaymentsService({
    documents: documentsService,
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
    paymentsService,
    requisiteProvidersService,
    requisitesService,
    documentsService,
  };
}
