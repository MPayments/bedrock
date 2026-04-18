import { createAccountingModuleFromDrizzle } from "@bedrock/accounting/adapters/drizzle";
import { createDealsModuleFromDrizzle } from "@bedrock/deals/adapters/drizzle";
import { createDrizzleDocumentsReadModel } from "@bedrock/documents/read-model";
import { createLedgerModuleFromDrizzle } from "@bedrock/ledger/adapters/drizzle";
import { createPartiesQueries } from "@bedrock/parties/queries";
import {
  bindPersistenceSession,
  type Transaction,
} from "@bedrock/platform/persistence";
import { createReconciliationService, type ReconciliationService } from "@bedrock/reconciliation";
import { createTreasuryModuleFromDrizzle } from "@bedrock/treasury/adapters/drizzle";

import type { ApiCoreServices } from "./core";
import type { ApplicationModules } from "./modules";

export interface ApplicationTransactions {
  createAccountingModuleForTransaction(tx: Transaction): ApiCoreServices["accountingModule"];
  createDealsModuleForTransaction(tx: Transaction): ApplicationModules["dealsModule"];
  createLedgerModuleForTransaction(tx: Transaction): ApiCoreServices["ledgerModule"];
  createReconciliationServiceForTransaction(tx: Transaction): ReconciliationService;
  createTreasuryModuleForTransaction(tx: Transaction): ApplicationModules["treasuryModule"];
}

export function createApplicationTransactions(input: {
  modules: ApplicationModules;
  platform: ApiCoreServices;
}): ApplicationTransactions {
  const { modules, platform } = input;
  const { idempotency, logger } = platform;

  const createLedgerModuleForTransaction: ApplicationTransactions["createLedgerModuleForTransaction"] =
    (tx) =>
      createLedgerModuleFromDrizzle({
        assertInternalLedgerBooks:
          ({ bookIds }) =>
            createPartiesQueries({ db: tx }).organizations
              .assertBooksBelongToInternalLedgerOrganizations(bookIds),
        db: tx,
        idempotency,
        logger,
        persistence: bindPersistenceSession(tx),
      });

  const createTreasuryModuleForTransaction: ApplicationTransactions["createTreasuryModuleForTransaction"] =
    (tx) =>
      createTreasuryModuleFromDrizzle({
        db: tx,
        currencies: modules.treasuryCurrenciesPort,
        logger,
        persistence: bindPersistenceSession(tx),
      });

  const createDealsModuleForTransaction: ApplicationTransactions["createDealsModuleForTransaction"] =
    (tx) =>
      createDealsModuleFromDrizzle({
        bindDocumentsReadModel: (queryable) =>
          createDrizzleDocumentsReadModel({ db: queryable }),
        currencies: modules.currenciesService,
        db: tx,
        documentsReadModel: createDrizzleDocumentsReadModel({ db: tx }),
        ledgerBalances: createLedgerModuleForTransaction(tx).balances.queries,
        idempotency,
        logger,
        persistence: bindPersistenceSession(tx),
        quoteReads: createTreasuryModuleForTransaction(tx).quotes.queries,
      });

  const createAccountingModuleForTransaction: ApplicationTransactions["createAccountingModuleForTransaction"] =
    (tx) =>
      createAccountingModuleFromDrizzle({
        db: tx,
        documentsReadModel: createDrizzleDocumentsReadModel({ db: tx }),
        logger,
        persistence: bindPersistenceSession(tx),
      });

  const createReconciliationServiceForTransaction: ApplicationTransactions["createReconciliationServiceForTransaction"] =
    (tx) =>
      createReconciliationService({
        persistence: bindPersistenceSession(tx),
        idempotency,
        documents: {
          async existsById(documentId: string) {
            return createDrizzleDocumentsReadModel({ db: tx }).existsById(
              documentId,
            );
          },
        },
        ledgerLookup: {
          async operationExists(operationId: string) {
            return (
              (await createLedgerModuleForTransaction(tx).operations.queries.getDetails(
                operationId,
              )) !== null
            );
          },
          async treasuryOperationExists(operationId: string) {
            return (
              (await createTreasuryModuleForTransaction(tx).operations.queries.findById(
                operationId,
              )) !== null
            );
          },
        },
        logger,
      });

  return {
    createAccountingModuleForTransaction,
    createDealsModuleForTransaction,
    createLedgerModuleForTransaction,
    createReconciliationServiceForTransaction,
    createTreasuryModuleForTransaction,
  };
}
