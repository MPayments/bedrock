import {
  createDocumentGenerationService,
  createEasyTemplateXAdapter,
  createLibreOfficeConvertAdapter,
  type DocumentGenerationService,
} from "@bedrock/documents/generation";
import { createDealQuoteService, type DealQuoteService } from "@bedrock/use-case-deal-quote";
import {
  createOrganizationBootstrapService,
  type OrganizationBootstrapService,
} from "@bedrock/use-case-organization-bootstrap";
import { createPortalService, type PortalService } from "@bedrock/use-case-portal";
import {
  createRequisiteAccountingService,
  type RequisiteAccountingService,
} from "@bedrock/use-case-requisite-accounting";

import type { ApiCoreServices } from "./core";
import type { ApplicationModules } from "./modules";
import type { ApplicationTransactions } from "./transactions";
import { db } from "../db/client";

export interface ApplicationOwnedServices {
  dealQuoteService: DealQuoteService;
  documentGenerationService: DocumentGenerationService;
  organizationBootstrapService: OrganizationBootstrapService;
  portalService: PortalService;
  requisiteAccountingService: RequisiteAccountingService;
}

export function createApplicationOwnedServices(input: {
  modules: ApplicationModules;
  platform: ApiCoreServices;
  transactions: ApplicationTransactions;
}): ApplicationOwnedServices {
  const { modules, platform, transactions } = input;
  const { logger } = platform;

  const dealQuoteService = createDealQuoteService({
    calculations: modules.calculationsModule,
    currencies: modules.currenciesService,
    deals: modules.dealsModule,
    treasury: modules.treasuryModule,
  });
  const organizationBootstrapService =
    createOrganizationBootstrapService({
      db,
      createLedgerModule: transactions.createLedgerModuleForTransaction,
      logger,
    });
  const requisiteAccountingService =
    createRequisiteAccountingService({
      currencies: modules.currenciesPort,
      db,
      createLedgerModule: transactions.createLedgerModuleForTransaction,
      logger,
    });
  const portalService = createPortalService({
    calculations: modules.calculationsModule,
    currencies: modules.currenciesService,
    deals: modules.dealsModule,
    iam: {
      customerMemberships: platform.customerMembershipsService,
      portalAccessGrants: platform.portalAccessGrantsService,
      users: platform.iamService,
    },
    logger,
    parties: {
      counterparties: modules.partiesModule.counterparties,
      customers: modules.partiesModule.customers,
      requisites: modules.partiesModule.requisites,
    },
  });

  const templatesDir = new URL(
    "../../../../packages/modules/documents/templates",
    import.meta.url,
  ).pathname;
  const templateAdapter = createEasyTemplateXAdapter({
    templatesDir,
    logger,
  });
  const documentGenerationService = createDocumentGenerationService({
    agreements: modules.agreementsModule,
    currencies: modules.currenciesService,
    logger,
    objectStorage: modules.objectStorage,
    parties: modules.partiesModule,
    pdfConverter: createLibreOfficeConvertAdapter(),
    templateManager: templateAdapter,
    templateRenderer: templateAdapter,
  });

  return {
    dealQuoteService,
    documentGenerationService,
    organizationBootstrapService,
    portalService,
    requisiteAccountingService,
  };
}
