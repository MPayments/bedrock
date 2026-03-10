import {
  createAccountingService,
  type AccountingService,
} from "@bedrock/accounting";
import { createCurrenciesService, type CurrenciesService } from "@bedrock/assets";
import { createBalancesService, type BalancesService } from "@bedrock/balances";
import type { Logger } from "@bedrock/common";
import {
  createDocumentRegistry,
  createDocumentsService,
  type DocumentRegistry,
  type DocumentsService,
} from "@bedrock/documents/runtime";
import { createUsersService, type UsersService } from "@bedrock/identity";
import {
  createLedgerEngine,
  createLedgerReadService,
  type LedgerReadService,
} from "@bedrock/ledger";
import type { Database } from "@bedrock/sql/ports";

import {
  createAccountingReportingService,
  type AccountingReportingService,
} from "@multihansa/accounting-reporting";
import {
  createCounterpartiesService,
  type CounterpartiesService,
} from "@multihansa/counterparties";
import { createCustomersService, type CustomersService } from "@multihansa/customers";
import { createFeesService, type FeesService } from "@multihansa/fees";
import { createFxService, type FxService } from "@multihansa/fx";
import { createIfrsDocumentModules } from "@multihansa/ifrs-documents";
import {
  createOrganizationsService,
  type OrganizationsService,
} from "@multihansa/organizations";
import {
  createPaymentIntentDocumentModule,
  createPaymentResolutionDocumentModule,
  createPaymentsService,
  type PaymentsService,
} from "@multihansa/payments";
import {
  createRequisiteProvidersService,
  type RequisiteProvidersService,
} from "@multihansa/requisite-providers";
import {
  createRequisitesService,
  type RequisitesService,
} from "@multihansa/requisites";

import { rawMultihansaAccountingPackDefinition } from "./default-pack";
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
    defaultPackDefinition: rawMultihansaAccountingPackDefinition,
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
