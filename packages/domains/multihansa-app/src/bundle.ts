import type { Logger } from "@multihansa/common";
import type { Database } from "@multihansa/common/sql/ports";
import {
  createDocumentRegistry,
  createDocumentsService,
  type DocumentRegistry,
  type DocumentsService,
} from "@multihansa/documents/runtime";
import {
  createAccountingService,
  type AccountingService,
} from "@multihansa/accounting";
import { createCurrenciesService, type CurrenciesService } from "@multihansa/assets";
import { createBalancesService, type BalancesService } from "@multihansa/balances";
import {
  createLedgerEngine,
  createLedgerReadService,
  type LedgerReadService,
} from "@multihansa/ledger";
import { createUsersService, type UsersService } from "@multihansa/identity";

import {
  createCounterpartiesService,
  type CounterpartiesService,
} from "@multihansa/parties/counterparties";
import { createCustomersService, type CustomersService } from "@multihansa/parties/customers";
import {
  createOrganizationsService,
  type OrganizationsService,
} from "@multihansa/parties/organizations";
import {
  createRequisiteProvidersService,
  type RequisiteProvidersService,
} from "@multihansa/parties/requisite-providers";
import {
  createRequisitesService,
  type RequisitesService,
} from "@multihansa/parties/requisites";
import {
  createAccountingReportingService,
  type AccountingReportingService,
} from "@multihansa/reporting/accounting-reporting";
import { createIfrsDocumentModules } from "@multihansa/reporting/ifrs-documents";
import { createFeesService, type FeesService } from "@multihansa/treasury/fees";
import { createFxService, type FxService } from "@multihansa/treasury/fx";
import {
  createPaymentIntentDocumentModule,
  createPaymentResolutionDocumentModule,
  createPaymentsService,
  type PaymentsService,
} from "@multihansa/treasury/payments";

import { rawPackDefinition } from "./default-pack";
import { createMultihansaDimensionRegistry } from "./dimensions";

export interface MultihansaDomainServices extends Record<string, unknown> {
  accountingService: AccountingService;
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
  usersService: UsersService;
  ledgerReadService: LedgerReadService;
  balancesService: BalancesService;
  documentsService: DocumentsService;
}

export function createMultihansaDocumentRegistry(input: {
  requisitesService: RequisitesService;
}): DocumentRegistry {
  return createDocumentRegistry([
    ...createIfrsDocumentModules({
      requisitesService: input.requisitesService,
    }),
    createPaymentIntentDocumentModule({
      requisitesService: input.requisitesService,
    }),
    createPaymentResolutionDocumentModule({
      requisitesService: input.requisitesService,
    }),
  ]);
}

export function createMultihansaServices(input: {
  db: Database;
  logger?: Logger;
}): MultihansaDomainServices {
  const { db, logger } = input;

  const accountingService = createAccountingService({
    db,
    logger,
    defaultPackDefinition: rawPackDefinition,
  });
  const ledger = createLedgerEngine({ db });
  const ledgerReadService = createLedgerReadService({ db });
  const balancesService = createBalancesService({ db, logger });
  const usersService = createUsersService({ db, logger });
  const dimensionRegistry = createMultihansaDimensionRegistry();

  const accountingReportingService = createAccountingReportingService({
    db,
    dimensionRegistry,
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
  const organizationsService = createOrganizationsService({ db, logger });
  const requisiteProvidersService = createRequisiteProvidersService({
    db,
    logger,
  });
  const requisitesService = createRequisitesService({ db, logger });
  const documentRegistry = createMultihansaDocumentRegistry({
    requisitesService,
  });
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
    accountingService,
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
    usersService,
    ledgerReadService,
    balancesService,
    documentsService,
  };
}
