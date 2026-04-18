import type { AccountingModule } from "@bedrock/accounting";
import {
  createAccountingPeriodDocumentTransitionEffectsService,
  createDocumentsService,
  createRuleBasedDocumentActionPolicyService,
  type DocumentApprovalRule,
  type DocumentsService,
} from "@bedrock/documents";
import { UserNotFoundError } from "@bedrock/iam";
import { bindPersistenceSession } from "@bedrock/platform/persistence";
import {
  createCommercialDocumentModules,
} from "@bedrock/plugin-documents-commercial";
import { createIfrsDocumentModules } from "@bedrock/plugin-documents-ifrs";
import { createDocumentRegistry } from "@bedrock/plugin-documents-sdk";
import { NotFoundError, ValidationError } from "@bedrock/shared/core/errors";

import type { ApiCoreServices } from "./core";
import type { ApplicationModules } from "./modules";
import type { ApplicationTransactions } from "./transactions";
import type { DealQuoteWorkflow } from "./deal-quote-workflow";
import {
  createCommercialDocumentDeps,
  createIfrsDocumentDeps,
} from "./document-plugin-adapters";

const DOCUMENT_QUOTE_REF_PATTERN =
  /^(invoice|fx_execute):([0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[1-8][0-9a-fA-F-]{3}-[89abAB][0-9a-fA-F-]{3}-[0-9a-fA-F-]{12})$/;

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

export interface ApplicationDocuments {
  createDocumentsServiceForTransaction(tx: TransactionLike): DocumentsService;
  documentsService: DocumentsService;
}

type DealQuoteWorkflowPort = Pick<
  DealQuoteWorkflow,
  "expireQuotes" | "markQuoteUsed"
>;

type TransactionLike = Parameters<
  ApplicationTransactions["createAccountingModuleForTransaction"]
>[0];

export type AccountingPeriodsPort = {
  assertOrganizationPeriodsOpen(input: {
    occurredAt: Date;
    organizationIds: string[];
    docType: string;
  }): Promise<void>;
  listClosedOrganizationIdsForPeriod(input: {
    organizationIds: string[];
    occurredAt: Date;
  }): Promise<string[]>;
  closePeriod(input: {
    organizationId: string;
    periodStart: Date;
    periodEnd: Date;
    closedBy: string;
    closeReason?: string | null;
    closeDocumentId: string;
    db?: unknown;
  }): Promise<unknown>;
  isOrganizationPeriodClosed(input: {
    organizationId: string;
    occurredAt: Date;
  }): Promise<boolean>;
  reopenPeriod(input: {
    organizationId: string;
    periodStart: Date;
    reopenedBy: string;
    reopenReason?: string | null;
    reopenDocumentId?: string | null;
    db?: unknown;
  }): Promise<unknown>;
};

export function createAccountingPeriodsPort(input: {
  accountingModule: AccountingModule;
  createAccountingModuleForTransaction: ApplicationTransactions["createAccountingModuleForTransaction"];
}): AccountingPeriodsPort {
  const { accountingModule, createAccountingModuleForTransaction } = input;

  function resolveAccountingModule(db?: unknown) {
    const target = db as TransactionLike | undefined;
    return target
      ? createAccountingModuleForTransaction(target)
      : accountingModule;
  }

  return {
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
      const module = resolveAccountingModule(input.db);

      return module.periods.commands.closePeriod({
        closeDocumentId: input.closeDocumentId,
        closeReason: input.closeReason,
        closedBy: input.closedBy,
        organizationId: input.organizationId,
        periodEnd: input.periodEnd,
        periodStart: input.periodStart,
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
      const module = resolveAccountingModule(input.db);

      return module.periods.commands.reopenPeriod({
        organizationId: input.organizationId,
        periodStart: input.periodStart,
        reopenDocumentId: input.reopenDocumentId,
        reopenReason: input.reopenReason,
        reopenedBy: input.reopenedBy,
      });
    },
  };
}

export function createTreasuryQuotesAdapter(input: {
  documentsReadModel: ApplicationModules["documentsReadModel"];
  getDealQuoteWorkflow: () => DealQuoteWorkflowPort;
  treasuryModule: ApplicationModules["treasuryModule"];
}) {
  const { documentsReadModel, getDealQuoteWorkflow, treasuryModule } = input;

  return {
    createQuote: treasuryModule.quotes.commands.createQuote,
    async expireQuotes(now: Date) {
      return getDealQuoteWorkflow().expireQuotes(now);
    },
    getQuoteDetails: treasuryModule.quotes.queries.getQuoteDetails,
    async markQuoteUsed(
      input: Parameters<typeof treasuryModule.quotes.commands.markQuoteUsed>[0],
    ) {
      let usedDocumentId = input.usedDocumentId ?? null;
      let dealId = input.dealId ?? null;

      if (!usedDocumentId) {
        const matched = input.usedByRef.match(DOCUMENT_QUOTE_REF_PATTERN);
        if (matched) {
          usedDocumentId = matched[2]!;
        }
      }

      if (usedDocumentId) {
        const linkedDocument = await documentsReadModel.findBusinessLinkByDocumentId(
          usedDocumentId,
        );

        if (!linkedDocument) {
          throw new NotFoundError("Document", usedDocumentId);
        }

        if (
          dealId &&
          linkedDocument.dealId &&
          dealId !== linkedDocument.dealId
        ) {
          throw new ValidationError(
            `Quote document ${usedDocumentId} belongs to deal ${linkedDocument.dealId}, not ${dealId}`,
          );
        }

        dealId = dealId ?? linkedDocument.dealId ?? null;
      }

      return getDealQuoteWorkflow().markQuoteUsed({
        ...input,
        dealId,
        usedDocumentId,
      });
    },
  };
}

export function createApplicationDocuments(input: {
  getDealQuoteWorkflow: () => DealQuoteWorkflowPort;
  modules: ApplicationModules;
  platform: Pick<
    ApiCoreServices,
    "accountingModule" | "iamService" | "idempotency" | "logger" | "persistence"
  >;
  transactions: ApplicationTransactions;
}): ApplicationDocuments {
  const { getDealQuoteWorkflow, modules, platform, transactions } = input;

  const documentsAccountingPort = {
    getDefaultCompiledPack:
      platform.accountingModule.packs.queries.getDefaultCompiledPack,
    loadActiveCompiledPackForBook:
      platform.accountingModule.packs.queries.loadActivePackForBook,
    resolvePostingPlan: platform.accountingModule.packs.queries.resolvePostingPlan,
  };
  const accountingPeriodsPort = createAccountingPeriodsPort({
    accountingModule: platform.accountingModule,
    createAccountingModuleForTransaction:
      transactions.createAccountingModuleForTransaction,
  });
  const documentRequisitesService = {
    findById: modules.partiesModule.requisites.queries.findById,
    resolveBindings: modules.partiesModule.requisites.queries.resolveBindings,
  };
  const documentPartiesService = {
    customers: {
      findById: modules.partiesModule.customers.queries.findById,
    },
    counterparties: {
      findById: modules.partiesModule.counterparties.queries.findById,
    },
  };
  const treasuryQuotes = createTreasuryQuotesAdapter({
    documentsReadModel: modules.documentsReadModel,
    getDealQuoteWorkflow,
    treasuryModule: modules.treasuryModule,
  });
  const documentRegistry = createDocumentRegistry([
    ...createCommercialDocumentModules(
      createCommercialDocumentDeps({
        calculationReads: modules.calculationsModule.calculations.queries,
        currenciesService: modules.currenciesService,
        dealReads: modules.dealsModule.deals.queries,
        documentsReadModel: modules.documentsReadModel,
        treasuryQuotes,
        partiesService: documentPartiesService,
        requisitesService: documentRequisitesService,
      }),
    ),
    ...createIfrsDocumentModules(
      createIfrsDocumentDeps({
        currenciesService: modules.currenciesService,
        treasuryQuotes,
        ledgerReadService: {
          getOperationDetails: modules.ledgerReadPort.getOperationDetails,
        },
        requisitesService: documentRequisitesService,
      }),
    ),
  ]);
  const documentsPolicy = createRuleBasedDocumentActionPolicyService({
    rules: DEFAULT_DOCUMENT_APPROVAL_RULES,
    async isActorExemptFromApproval({ actorUserId }) {
      try {
        return (await platform.iamService.queries.findById(actorUserId)).role === "admin";
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

  function createDocumentsServiceForTransaction(tx: TransactionLike) {
    return createDocumentsService({
      persistence: bindPersistenceSession(tx),
      idempotency: platform.idempotency,
      accounting: documentsAccountingPort,
      accountingPeriods: accountingPeriodsPort,
      ledgerReadService: modules.ledgerReadPort,
      policy: documentsPolicy,
      registry: documentRegistry,
      transitionEffects: documentTransitionEffects,
      logger: platform.logger,
    });
  }

  const documentsService = createDocumentsService({
    persistence: platform.persistence,
    idempotency: platform.idempotency,
    accounting: documentsAccountingPort,
    accountingPeriods: accountingPeriodsPort,
    ledgerReadService: modules.ledgerReadPort,
    policy: documentsPolicy,
    registry: documentRegistry,
    transitionEffects: documentTransitionEffects,
    logger: platform.logger,
  });

  return {
    createDocumentsServiceForTransaction,
    documentsService,
  };
}
