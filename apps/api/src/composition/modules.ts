import { db } from "@bedrock/db/client";
import {
  createAccountingReportingService,
  type AccountingReportingService,
} from "@bedrock/modules/accounting-reporting";
import { createFeesService, type FeesService } from "@bedrock/modules/fees";
import { createFxService, type FxService } from "@bedrock/modules/fx";
import {
  createPaymentIntentDocumentModule,
  createPaymentResolutionDocumentModule,
  createPaymentsService,
  type PaymentsService,
} from "@bedrock/modules/payments";
import {
  createConnectorsService,
  getMockProviders,
  type ConnectorsService,
} from "@bedrock/platform/connectors";
import {
  createCounterpartiesService,
  type CounterpartiesService,
} from "@bedrock/platform/counterparties";
import {
  createCurrenciesService,
  type CurrenciesService,
} from "@bedrock/platform/currencies";
import {
  createCustomersService,
  type CustomersService,
} from "@bedrock/platform/customers";
import {
  createDocumentRegistry,
  createDocumentsService,
  type DocumentsService,
} from "@bedrock/platform/documents";
import {
  createOperationalAccountsService,
  type OperationalAccountsService,
} from "@bedrock/platform/operational-accounts";
import {
  createOrchestrationService,
  type OrchestrationService,
} from "@bedrock/platform/orchestration";
import {
  createReconciliationService,
  type ReconciliationService,
} from "@bedrock/platform/reconciliation";

import type { ApiPlatformServices } from "./platform";

export interface ApiModuleServices {
  operationalAccountsService: OperationalAccountsService;
  accountingReportingService: AccountingReportingService;
  counterpartiesService: CounterpartiesService;
  customersService: CustomersService;
  currenciesService: CurrenciesService;
  feesService: FeesService;
  fxService: FxService;
  connectorsService: ConnectorsService;
  orchestrationService: OrchestrationService;
  paymentsService: PaymentsService;
  documentsService: DocumentsService;
  reconciliationService: ReconciliationService;
}

export function createModuleServices(
  platform: ApiPlatformServices,
): ApiModuleServices {
  const { accountingService, ledger, ledgerReadService, logger } = platform;

  const operationalAccountsService = createOperationalAccountsService({
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
  const connectorsService = createConnectorsService({
    db,
    logger,
    providers: getMockProviders(),
  });
  const orchestrationService = createOrchestrationService({
    db,
    logger,
  });
  const documentRegistry = createDocumentRegistry([
    createPaymentIntentDocumentModule({
      operationalAccountsService,
    }),
    createPaymentResolutionDocumentModule({
      operationalAccountsService,
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
    db,
    documents: documentsService,
    connectors: connectorsService,
    orchestration: orchestrationService,
    logger,
  });
  const reconciliationService = createReconciliationService({
    db,
    documents: documentsService,
    logger,
  });

  return {
    operationalAccountsService,
    accountingReportingService,
    counterpartiesService,
    customersService,
    currenciesService,
    feesService,
    fxService,
    connectorsService,
    orchestrationService,
    paymentsService,
    documentsService,
    reconciliationService,
  };
}
