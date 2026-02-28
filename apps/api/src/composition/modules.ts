import {
  createAccountingReportingService,
  type AccountingReportingService,
} from "@bedrock/accounting-reporting";
import {
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
import { db } from "@bedrock/db/client";
import {
  createDocumentRegistry,
  createDocumentsService,
  type DocumentsService,
} from "@bedrock/documents";
import { createFeesService, type FeesService } from "@bedrock/fees";
import { createFxService, type FxService } from "@bedrock/fx";
import {
  createOperationalAccountsService,
  type OperationalAccountsService,
} from "@bedrock/operational-accounts";
import {
  createReconciliationService,
  type ReconciliationService,
} from "@bedrock/reconciliation";
import {
  createTransferDocumentModule,
  createTransferSettleDocumentModule,
  createTransferVoidDocumentModule,
} from "@bedrock/transfers";
import {
  createExternalFundingDocumentModule,
  createFeePayoutInitiateDocumentModule,
  createFeePayoutSettleDocumentModule,
  createFeePayoutVoidDocumentModule,
  createFxExecuteDocumentModule,
  createPaymentCaseDocumentModule,
  createPayinFundingDocumentModule,
  createPayoutInitiateDocumentModule,
  createPayoutSettleDocumentModule,
  createPayoutVoidDocumentModule,
} from "@bedrock/treasury";

import type { ApiPlatformServices } from "./platform";

export interface ApiModuleServices {
  operationalAccountsService: OperationalAccountsService;
  accountingReportingService: AccountingReportingService;
  counterpartiesService: CounterpartiesService;
  customersService: CustomersService;
  currenciesService: CurrenciesService;
  feesService: FeesService;
  fxService: FxService;
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
  const documentRegistry = createDocumentRegistry([
    createPaymentCaseDocumentModule(),
    createPayinFundingDocumentModule({
      currenciesService,
    }),
    createFxExecuteDocumentModule({
      currenciesService,
      feesService,
    }),
    createPayoutInitiateDocumentModule({
      currenciesService,
    }),
    createPayoutSettleDocumentModule(),
    createPayoutVoidDocumentModule(),
    createFeePayoutInitiateDocumentModule({
      currenciesService,
      feesService,
    }),
    createFeePayoutSettleDocumentModule(),
    createFeePayoutVoidDocumentModule(),
    createExternalFundingDocumentModule({
      currenciesService,
    }),
    createTransferDocumentModule({
      operationalAccountsService,
    }),
    createTransferSettleDocumentModule({
      operationalAccountsService,
    }),
    createTransferVoidDocumentModule({
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
    documentsService,
    reconciliationService,
  };
}
