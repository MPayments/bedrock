import { ACCOUNT_NO } from "@bedrock/accounting/constants";
import type {
  LedgerBookAccountsService,
  LedgerBooksService,
} from "@bedrock/ledger";
import type { Logger } from "@bedrock/platform/observability/logger";
import {
  bindPersistenceSession,
  type Database,
  type Transaction,
} from "@bedrock/platform/persistence";
import {
  createRequisitesService,
  RequisiteAccountingBindingOwnerTypeError,
  RequisiteNotFoundError,
  type RequisitesServiceDeps,
} from "@bedrock/requisites";
import type {
  CreateRequisiteInput,
  Requisite,
  RequisiteAccountingBinding,
  UpdateRequisiteInput,
} from "@bedrock/requisites/contracts";
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

export interface RequisiteAccountingWorkflow {
  create(input: CreateRequisiteInput): Promise<Requisite>;
  update(id: string, input: UpdateRequisiteInput): Promise<Requisite>;
  upsertBinding(
    requisiteId: string,
    input: { postingAccountNo?: string },
  ): Promise<RequisiteAccountingBinding>;
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
): RequisiteAccountingWorkflow {
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

    const requisites = createRequisitesService({
      persistence: bindPersistenceSession(input.tx),
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
        ReturnType<typeof createRequisitesService>["findById"]
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
    async create(input) {
      return deps.db.transaction(async (tx) => {
        const requisites = createRequisitesService({
          persistence: bindPersistenceSession(tx),
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
    async update(id, input) {
      return deps.db.transaction(async (tx) => {
        const requisites = createRequisitesService({
          persistence: bindPersistenceSession(tx),
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
