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
  createCounterpartyRequisitesService,
  type CounterpartyRequisitesService,
} from "@bedrock/core/counterparty-requisites";
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
  createOrganizationRequisitesService,
  type OrganizationRequisitesService,
} from "@bedrock/core/organization-requisites";
import { db } from "@bedrock/db/client";

import type { ApiCoreServices } from "./core";

export interface ApiApplicationServices {
  counterpartyRequisitesService: CounterpartyRequisitesService;
  accountingReportingService: AccountingReportingService;
  counterpartiesService: CounterpartiesService;
  customersService: CustomersService;
  currenciesService: CurrenciesService;
  feesService: FeesService;
  fxService: FxService;
  organizationRequisitesService: OrganizationRequisitesService;
  paymentsService: PaymentsService;
  documentsService: DocumentsService;
}

export function createApplicationServices(
  platform: ApiCoreServices,
): ApiApplicationServices {
  const { accountingService, ledger, ledgerReadService, logger } = platform;

  const counterpartyRequisitesService = createCounterpartyRequisitesService({
    db,
    logger,
  });
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
  const organizationRequisitesService = createOrganizationRequisitesService({
    db,
    logger,
  });
  const documentRegistry = createDocumentRegistry([
    ...createIfrsDocumentModules({
      organizationRequisitesService,
    }),
    createPaymentIntentDocumentModule({
      organizationRequisitesService,
    }),
    createPaymentResolutionDocumentModule({
      organizationRequisitesService,
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
    counterpartyRequisitesService,
    accountingReportingService,
    counterpartiesService,
    customersService,
    currenciesService,
    feesService,
    fxService,
    organizationRequisitesService,
    paymentsService,
    documentsService,
  };
}
