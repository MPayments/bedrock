import {
  createAccountingService,
  type AccountingService,
} from "@bedrock/accounting";
import { createCurrenciesService, type CurrenciesService } from "@bedrock/assets";
import { createBalancesService, type BalancesService } from "@bedrock/balances";
import {
  createDocumentRegistry,
  createDocumentsService,
  type DocumentsService,
} from "@bedrock/documents/runtime";
import { createUsersService, type UsersService } from "@bedrock/identity";
import type { Logger } from "@bedrock/kernel";
import {
  createLedgerEngine,
  createLedgerReadService,
  type LedgerReadService,
} from "@bedrock/ledger";
import {
  BEDROCK_CORE_MODULE_MANIFESTS,
  DORMANT_MODULE_IDS,
  defineModule,
  type BedrockModuleDefinition,
  type ModuleManifest,
} from "@bedrock/modules";
import type { Database } from "@bedrock/sql/ports";

import {
  createAccountingReportingService,
  type AccountingReportingService,
} from "@multihansa/accounting-reporting";
import {
  createCounterpartiesService,
  type CounterpartiesService,
} from "@multihansa/counterparties";
import { COUNTERPARTIES_MODULE_MANIFESTS } from "@multihansa/counterparties/manifest";
import { createCustomersService, type CustomersService } from "@multihansa/customers";
import { CUSTOMERS_MODULE_MANIFEST } from "@multihansa/customers/manifest";
import { createFeesService, type FeesService } from "@multihansa/fees";
import { FEES_MODULE_MANIFEST } from "@multihansa/fees/manifest";
import { createFxService, type FxService } from "@multihansa/fx";
import { FX_MODULE_MANIFESTS } from "@multihansa/fx/manifest";
import { createIfrsDocumentModules } from "@multihansa/ifrs-documents";
import { IFRS_DOCUMENTS_MODULE_MANIFEST } from "@multihansa/ifrs-documents/manifest";
import {
  createOrganizationsService,
  type OrganizationsService,
} from "@multihansa/organizations";
import { ORGANIZATIONS_MODULE_MANIFEST } from "@multihansa/organizations/manifest";
import {
  createPaymentIntentDocumentModule,
  createPaymentResolutionDocumentModule,
  createPaymentsService,
  type PaymentsService,
} from "@multihansa/payments";
import { PAYMENTS_MODULE_MANIFEST } from "@multihansa/payments/manifest";
import {
  createRequisiteProvidersService,
  type RequisiteProvidersService,
} from "@multihansa/requisite-providers";
import { REQUISITE_PROVIDERS_MODULE_MANIFEST } from "@multihansa/requisite-providers/manifest";
import {
  createRequisitesService,
  type RequisitesService,
} from "@multihansa/requisites";
import { REQUISITES_MODULE_MANIFEST } from "@multihansa/requisites/manifest";


import { rawMultihansaAccountingPackDefinition } from "./default-pack";
import { createMultihansaDimensionRegistry } from "./dimensions";

function manifestToDefinition(manifest: ModuleManifest): BedrockModuleDefinition {
  return defineModule({
    id: manifest.id,
    version: manifest.version,
    kind: manifest.kind === "kernel" ? "framework" : "domain",
    dependsOn: manifest.dependencies.map((dependency) => dependency.moduleId),
    api: manifest.capabilities.api
      ? {
          routePath: manifest.capabilities.api.routePath,
          guarded: manifest.id !== "system-modules",
        }
      : undefined,
    workers: manifest.capabilities.workers?.map((worker) => ({
      id: worker.id,
      envKey: worker.envKey,
      defaultIntervalMs: worker.defaultIntervalMs,
      description: worker.description,
    })),
    manifest,
  });
}

export const MULTIHANSA_FRAMEWORK_MODULES = BEDROCK_CORE_MODULE_MANIFESTS.map(
  manifestToDefinition,
) as readonly BedrockModuleDefinition[];

const DOMAIN_MANIFESTS = [
  ...COUNTERPARTIES_MODULE_MANIFESTS,
  CUSTOMERS_MODULE_MANIFEST,
  FEES_MODULE_MANIFEST,
  ...FX_MODULE_MANIFESTS,
  IFRS_DOCUMENTS_MODULE_MANIFEST,
  ORGANIZATIONS_MODULE_MANIFEST,
  PAYMENTS_MODULE_MANIFEST,
  REQUISITE_PROVIDERS_MODULE_MANIFEST,
  REQUISITES_MODULE_MANIFEST,
] as const satisfies readonly ModuleManifest[];

export const MULTIHANSA_DOMAIN_MODULES = DOMAIN_MANIFESTS.map(
  manifestToDefinition,
) as readonly BedrockModuleDefinition[];

export const MULTIHANSA_MODULES = [
  ...MULTIHANSA_FRAMEWORK_MODULES,
  ...MULTIHANSA_DOMAIN_MODULES,
] as const satisfies readonly BedrockModuleDefinition[];

const dormantModuleIdSet = new Set<string>(DORMANT_MODULE_IDS);

export const MULTIHANSA_ACTIVE_MODULES = MULTIHANSA_MODULES.filter(
  (module) => !dormantModuleIdSet.has(module.id),
) as readonly BedrockModuleDefinition[];

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

export function createMultihansaDomainServices(input: {
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

export function createMultihansaDomainBundle(input: {
  db: Database;
  logger?: Logger;
}) {
  return {
    modules: MULTIHANSA_ACTIVE_MODULES,
    services: createMultihansaDomainServices(input),
  } as const;
}
