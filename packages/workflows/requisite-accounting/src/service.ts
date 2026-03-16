import { ACCOUNT_NO } from "@bedrock/accounting/constants";
import type {
  LedgerBookAccountsService,
  LedgerBooksService,
} from "@bedrock/ledger";
import type { Logger } from "@bedrock/platform/observability/logger";
import type { Database, Transaction } from "@bedrock/platform/persistence";
import {
  createRequisitesServiceFromTransaction,
  RequisiteAccountingBindingOwnerTypeError,
  RequisiteNotFoundError,
  type RequisitesServiceDeps,
} from "@bedrock/requisites";
import { createRequisitesQueries } from "@bedrock/requisites/queries";
import { InvalidStateError } from "@bedrock/shared/core/errors";

export interface RequisiteAccountingWorkflowDeps {
  db: Database;
  ledgerBooks: Pick<LedgerBooksService, "ensureDefaultOrganizationBook">;
  ledgerBookAccounts: Pick<
    LedgerBookAccountsService,
    "ensureBookAccountInstance"
  >;
  currencies: RequisitesServiceDeps["currencies"];
  owners: RequisitesServiceDeps["owners"];
  logger?: Logger;
  now?: RequisitesServiceDeps["now"];
}

async function resolveCurrencyCode(
  deps: Pick<RequisiteAccountingWorkflowDeps, "currencies">,
  currencyId: string,
) {
  const codes = await deps.currencies.listCodesById([currencyId]);
  const currencyCode = codes.get(currencyId);

  if (!currencyCode) {
    throw new InvalidStateError(`Missing currency code for ${currencyId}`);
  }

  return currencyCode;
}

export function createRequisiteAccountingWorkflow(
  deps: RequisiteAccountingWorkflowDeps,
) {
  async function upsertOrganizationBindingTx(input: {
    tx: Transaction;
    requisiteId: string;
    organizationId: string;
    currencyCode: string;
    postingAccountNo?: string;
  }) {
    const postingAccountNo = input.postingAccountNo ?? ACCOUNT_NO.BANK;
    const { bookId } = await deps.ledgerBooks.ensureDefaultOrganizationBook(
      input.tx,
      {
        organizationId: input.organizationId,
      },
    );
    const bookAccount = await deps.ledgerBookAccounts.ensureBookAccountInstance(
      input.tx,
      {
        bookId,
        accountNo: postingAccountNo,
        currency: input.currencyCode,
        dimensions: {},
      },
    );

    const requisites = createRequisitesServiceFromTransaction({
      tx: input.tx,
      logger: deps.logger,
      now: deps.now,
      currencies: deps.currencies,
      owners: deps.owners,
    });

    await requisites.bindings.upsert({
      requisiteId: input.requisiteId,
      bookId,
      bookAccountInstanceId: bookAccount.id,
      postingAccountNo,
    });

    return requisites.bindings.get(input.requisiteId);
  }

  async function syncOrganizationBindingForRequisiteTx(input: {
    tx: Transaction;
    requisite: Awaited<
      ReturnType<
        ReturnType<typeof createRequisitesServiceFromTransaction>["findById"]
      >
    >;
    postingAccountNo?: string;
  }) {
    if (input.requisite.ownerType !== "organization") {
      return null;
    }

    const currencyCode = await resolveCurrencyCode(
      { currencies: deps.currencies },
      input.requisite.currencyId,
    );

    return upsertOrganizationBindingTx({
      tx: input.tx,
      requisiteId: input.requisite.id,
      organizationId: input.requisite.ownerId,
      currencyCode,
      postingAccountNo: input.postingAccountNo,
    });
  }

  return {
    async create(
      input: Parameters<
        ReturnType<typeof createRequisitesServiceFromTransaction>["create"]
      >[0],
    ) {
      return deps.db.transaction(async (tx) => {
        const requisites = createRequisitesServiceFromTransaction({
          tx,
          logger: deps.logger,
          now: deps.now,
          currencies: deps.currencies,
          owners: deps.owners,
        });
        const requisite = await requisites.create(input);

        await syncOrganizationBindingForRequisiteTx({
          tx,
          requisite,
        });

        return requisite;
      });
    },
    async update(
      id: string,
      input: Parameters<
        ReturnType<typeof createRequisitesServiceFromTransaction>["update"]
      >[1],
    ) {
      return deps.db.transaction(async (tx) => {
        const requisites = createRequisitesServiceFromTransaction({
          tx,
          logger: deps.logger,
          now: deps.now,
          currencies: deps.currencies,
          owners: deps.owners,
        });
        const requisite = await requisites.update(id, input);

        await syncOrganizationBindingForRequisiteTx({
          tx,
          requisite,
        });

        return requisite;
      });
    },
    async upsertBinding(
      requisiteId: string,
      input: { postingAccountNo?: string },
    ) {
      return deps.db.transaction(async (tx) => {
        const subject = await createRequisitesQueries({
          db: tx,
        }).findSubjectById(requisiteId);

        if (!subject) {
          throw new RequisiteNotFoundError(requisiteId);
        }

        if (subject.ownerType !== "organization" || !subject.organizationId) {
          throw new RequisiteAccountingBindingOwnerTypeError(requisiteId);
        }

        return upsertOrganizationBindingTx({
          tx,
          requisiteId,
          organizationId: subject.organizationId,
          currencyCode: subject.currencyCode,
          postingAccountNo: input.postingAccountNo,
        });
      });
    },
  };
}

export type RequisiteAccountingWorkflow = ReturnType<
  typeof createRequisiteAccountingWorkflow
>;
