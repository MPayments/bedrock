import {
  createAccountingReportingService,
  type AccountingReportingService,
} from "@bedrock/application/accounting-reporting";
import { createFeesService, type FeesService } from "@bedrock/application/fees";
import { createFxService, type FxService } from "@bedrock/application/fx";
import {
  createPaymentIntentDocumentModule,
  createPaymentResolutionDocumentModule,
  createPaymentsService,
  type PaymentsService,
} from "@bedrock/application/payments";
import {
  createConnectorsService,
  getMockProviders,
  type ConnectorsService,
} from "@bedrock/core/connectors";
import {
  createCounterpartiesService,
  type CounterpartiesService,
} from "@bedrock/core/counterparties";
import {
  createCounterpartyAccountsService,
  type CounterpartyAccountsService,
} from "@bedrock/core/counterparty-accounts";
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
  createOrchestrationService,
  type OrchestrationService,
} from "@bedrock/core/orchestration";
import {
  createReconciliationService,
  type ReconciliationService,
} from "@bedrock/core/reconciliation";
import { db } from "@bedrock/db/client";

import type { ApiCoreServices } from "./core";

export interface ApiApplicationServices {
  counterpartyAccountsService: CounterpartyAccountsService;
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

export function createApplicationServices(
  platform: ApiCoreServices,
): ApiApplicationServices {
  const { accountingService, ledger, ledgerReadService, logger } = platform;

  const counterpartyAccountsService = createCounterpartyAccountsService({
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
      counterpartyAccountsService,
    }),
    createPaymentResolutionDocumentModule({
      counterpartyAccountsService,
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
    counterpartyAccountsService,
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
