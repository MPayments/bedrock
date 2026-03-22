import type { AccountingModule } from "@bedrock/accounting";
import { createBalancesQueries } from "@bedrock/balances/queries";
import {
  createCurrenciesService,
  type CurrenciesService,
} from "@bedrock/currencies";
import { createCurrenciesQueries } from "@bedrock/currencies/queries";
import {
  createAccountingPeriodDocumentTransitionEffectsService,
  createDocumentsService,
  createRuleBasedDocumentActionPolicyService,
  type DocumentsService,
  type DocumentApprovalRule,
} from "@bedrock/documents";
import { createDrizzleDocumentsReadModel } from "@bedrock/documents/read-model";
import { createFeesService, type FeesService } from "@bedrock/fees";
import { createFxService, type FxService } from "@bedrock/fx";
import { createDefaultFxRateSourceProviders } from "@bedrock/fx/providers";
import type { PartiesModule } from "@bedrock/parties";
import {
  bindPersistenceSession,
  createPersistenceContext,
  type Transaction,
} from "@bedrock/platform/persistence";
import { createCommercialDocumentModules } from "@bedrock/plugin-documents-commercial";
import { createIfrsDocumentModules } from "@bedrock/plugin-documents-ifrs";
import { createDocumentRegistry } from "@bedrock/plugin-documents-sdk";
import { UserNotFoundError } from "@bedrock/users";
import {
  createDocumentDraftWorkflow,
  type DocumentDraftWorkflow,
} from "@bedrock/workflow-document-drafts";
import {
  createDocumentPostingWorkflow,
  type DocumentPostingWorkflow,
} from "@bedrock/workflow-document-posting";
import {
  createIntegrationEventHandler,
  type IntegrationEventHandler,
} from "@bedrock/workflow-integration-mpayments";
import {
  createOrganizationBootstrapWorkflow,
  type OrganizationBootstrapWorkflow,
} from "@bedrock/workflow-organization-bootstrap";
import {
  createRequisiteAccountingWorkflow,
  type RequisiteAccountingWorkflow,
} from "@bedrock/workflow-requisite-accounting";

import { createApiAccountingModule } from "./accounting-module";
import type { ApiCoreServices } from "./core";
import {
  createCommercialDocumentDeps,
  createIfrsDocumentDeps,
} from "./document-plugin-adapters";
import {
  createApiPartiesModule,
  createApiPartiesReadRuntime,
} from "./parties-module";
import { db } from "../db/client";

export interface ApiApplicationServices {
  partiesModule: PartiesModule;
  currenciesService: CurrenciesService;
  feesService: FeesService;
  fxService: FxService;
  organizationBootstrapWorkflow: OrganizationBootstrapWorkflow;
  requisiteAccountingWorkflow: RequisiteAccountingWorkflow;
  documentsService: DocumentsService;
  documentDraftWorkflow: DocumentDraftWorkflow;
  documentPostingWorkflow: DocumentPostingWorkflow;
  integrationEventHandler: IntegrationEventHandler;
}

const DEFAULT_DOCUMENT_APPROVAL_RULES: DocumentApprovalRule[] = [
  {
    docTypes: ["period_close", "period_reopen"],
    approvalMode: "maker_checker",
  },
  {
    docTypes: [
      "invoice",
      "exchange",
      "transfer_intra",
      "transfer_intercompany",
      "transfer_resolution",
      "fx_execute",
      "fx_resolution",
      "capital_funding",
    ],
    approvalMode: "maker_checker",
  },
];

export function createApplicationServices(
  platform: ApiCoreServices,
): ApiApplicationServices {
  const {
    accountingModule,
    idempotency,
    ledger,
    ledgerReadService,
    logger,
    usersService,
  } =
    platform;

  const documentsReadModel = createDrizzleDocumentsReadModel({ db });
  const currenciesService = createCurrenciesService({ db, logger });
  const currenciesPort = {
    async assertCurrencyExists(id: string) {
      await currenciesService.findById(id);
    },
    async listCodesById(ids: string[]) {
      const rows = await Promise.all(
        ids.map(
          async (id) =>
            [id, (await currenciesService.findById(id)).code] as const,
        ),
      );
      return new Map(rows);
    },
  };
  const feesService = createFeesService({ db, logger, currenciesService });
  const fxService = createFxService({
    persistence: createPersistenceContext(db),
    logger,
    feesService,
    currenciesService,
    rateSourceProviders: createDefaultFxRateSourceProviders(),
  });
  const partiesModule = createApiPartiesModule({
    db,
    persistence: createPersistenceContext(db),
    documents: {
      hasDocumentsForCustomer(customerId) {
        return createDrizzleDocumentsReadModel({ db }).hasDocumentsForCustomer(
          customerId,
        );
      },
    },
    currencies: currenciesPort,
    logger,
  });
  const organizationBootstrapWorkflow = createOrganizationBootstrapWorkflow({
    db,
    ledgerBooks: ledger.books,
    logger,
  });
  const requisiteAccountingWorkflow = createRequisiteAccountingWorkflow({
    db,
    ledgerBooks: ledger.books,
    ledgerBookAccounts: ledger.bookAccounts,
    currencies: currenciesPort,
    logger,
  });
  const documentsAccountingPort = {
    getDefaultCompiledPack:
      accountingModule.packs.queries.getDefaultCompiledPack,
    loadActiveCompiledPackForBook:
      accountingModule.packs.queries.loadActivePackForBook,
    resolvePostingPlan: accountingModule.packs.queries.resolvePostingPlan,
  };
  const accountingPeriodsPort = {
    async assertOrganizationPeriodsOpen(input: {
      occurredAt: Date;
      organizationIds: string[];
      docType: string;
    }) {
      return accountingModule.periods.commands.assertOrganizationPeriodsOpen(input);
    },
    async listClosedOrganizationIdsForPeriod(input: {
      organizationIds: string[];
      occurredAt: Date;
    }) {
      return accountingModule.periods.queries.listClosedOrganizationIdsForPeriod(
        input,
      );
    },
    async closePeriod(input: {
      organizationId: string;
      periodStart: Date;
      periodEnd: Date;
      closedBy: string;
      closeReason?: string | null;
      closeDocumentId: string;
      db?: unknown;
    }) {
      const target = input.db as Transaction | undefined;
      const module: AccountingModule = target
        ? createApiAccountingModule({
            db: target,
            persistence: bindPersistenceSession(target),
            logger,
            ledgerReadPort: ledgerReadService,
          })
        : accountingModule;

      return module.periods.commands.closePeriod({
        organizationId: input.organizationId,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        closedBy: input.closedBy,
        closeReason: input.closeReason,
        closeDocumentId: input.closeDocumentId,
      });
    },
    async isOrganizationPeriodClosed(input: {
      organizationId: string;
      occurredAt: Date;
    }) {
      return accountingModule.periods.queries.isOrganizationPeriodClosed(input);
    },
    async reopenPeriod(input: {
      organizationId: string;
      periodStart: Date;
      reopenedBy: string;
      reopenReason?: string | null;
      reopenDocumentId?: string | null;
      db?: unknown;
    }) {
      const target = input.db as Transaction | undefined;
      const module: AccountingModule = target
        ? createApiAccountingModule({
            db: target,
            persistence: bindPersistenceSession(target),
            logger,
            ledgerReadPort: ledgerReadService,
          })
        : accountingModule;

      return module.periods.commands.reopenPeriod({
        organizationId: input.organizationId,
        periodStart: input.periodStart,
        reopenedBy: input.reopenedBy,
        reopenReason: input.reopenReason,
        reopenDocumentId: input.reopenDocumentId,
      });
    },
  };
  const documentRequisitesService = {
    findById: partiesModule.requisites.queries.findById,
    resolveBindings: partiesModule.requisites.queries.resolveBindings,
  };
  const documentPartiesService = {
    customers: {
      findById: partiesModule.customers.queries.findById,
    },
    counterparties: {
      findById: partiesModule.counterparties.queries.findById,
    },
  };
  const documentRegistry = createDocumentRegistry([
    ...createCommercialDocumentModules(
      createCommercialDocumentDeps({
        currenciesService,
        fxQuotes: fxService.quotes,
        partiesService: documentPartiesService,
        requisitesService: documentRequisitesService,
      }),
    ),
    ...createIfrsDocumentModules(
      createIfrsDocumentDeps({
        currenciesService,
        fxQuotes: fxService.quotes,
        ledgerReadService,
        requisitesService: documentRequisitesService,
      }),
    ),
  ]);
  const documentsPolicy = createRuleBasedDocumentActionPolicyService({
    rules: DEFAULT_DOCUMENT_APPROVAL_RULES,
    async isActorExemptFromApproval({ actorUserId }) {
      try {
        return (await usersService.findById(actorUserId)).role === "admin";
      } catch (error) {
        if (error instanceof UserNotFoundError) {
          return false;
        }

        throw error;
      }
    },
  });
  const documentTransitionEffects =
    createAccountingPeriodDocumentTransitionEffectsService();
  const documentsCoreService = createDocumentsService({
    persistence: createPersistenceContext(db),
    idempotency,
    accounting: documentsAccountingPort,
    accountingPeriods: accountingPeriodsPort,
    ledgerReadService,
    policy: documentsPolicy,
    registry: documentRegistry,
    transitionEffects: documentTransitionEffects,
    logger,
  });

  function createDocumentsServiceForTransaction(tx: Transaction) {
    return createDocumentsService({
      persistence: bindPersistenceSession(tx),
      idempotency,
      accounting: documentsAccountingPort,
      accountingPeriods: accountingPeriodsPort,
      ledgerReadService,
      policy: documentsPolicy,
      registry: documentRegistry,
      transitionEffects: documentTransitionEffects,
      logger,
    });
  }
  const documentsService = documentsCoreService;
  const documentDraftWorkflow = createDocumentDraftWorkflow({
    db,
    createDocumentsService: createDocumentsServiceForTransaction,
  });
  const documentPostingWorkflow = createDocumentPostingWorkflow({
    db,
    idempotency,
    ledgerCommit: ledger.commit,
    createDocumentsService: createDocumentsServiceForTransaction,
  });

  const integrationEventHandler = createIntegrationEventHandler({
    createCustomer: partiesModule.customers.commands.create,
    listCustomers: partiesModule.customers.queries.list,
    createCounterparty: partiesModule.counterparties.commands.create,
    listCounterparties: partiesModule.counterparties.queries.list,
    createRequisite: partiesModule.requisites.commands.create,
    listProviders: partiesModule.requisites.queries.listProviders,
    createProvider: partiesModule.requisites.commands.createProvider,
    findCurrencyByCode: currenciesService.findByCode,
    logger,
  });

  return {
    partiesModule,
    currenciesService,
    feesService,
    fxService,
    organizationBootstrapWorkflow,
    requisiteAccountingWorkflow,
    documentsService,
    documentDraftWorkflow,
    documentPostingWorkflow,
    integrationEventHandler,
  };
}
