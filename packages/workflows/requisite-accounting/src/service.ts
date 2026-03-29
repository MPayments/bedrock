import { randomUUID } from "node:crypto";

import { ACCOUNT_NO } from "@bedrock/accounting/constants";
import type { LedgerModule } from "@bedrock/ledger";
import {
  createPartiesModule,
  RequisiteAccountingBindingOwnerTypeError,
  RequisiteNotFoundError,
  type PartiesModuleDeps,
} from "@bedrock/parties";
import {
  DrizzleCustomerMembershipReads,
  DrizzleCounterpartyGroupReads,
  DrizzleCounterpartyReads,
  DrizzleCustomerReads,
  DrizzleOrganizationReads,
  DrizzlePartyRegistryUnitOfWork,
  DrizzleRequisiteBindingReads,
  DrizzleRequisiteProviderReads,
  DrizzleRequisiteReads,
} from "@bedrock/parties/adapters/drizzle";
import type {
  CreateRequisiteInput,
  Requisite,
  RequisiteAccountingBinding,
  UpdateRequisiteInput,
} from "@bedrock/parties/contracts";
import { noopLogger, type Logger } from "@bedrock/platform/observability/logger";
import {
  bindPersistenceSession,
  type Database,
  type Transaction,
} from "@bedrock/platform/persistence";
import { InvalidStateError } from "@bedrock/shared/core/errors";

export interface RequisiteAccountingWorkflowDeps {
  db: Database;
  createLedgerModule(
    tx: Transaction,
  ): Pick<LedgerModule, "bookAccounts" | "books">;
  currencies: PartiesModuleDeps["currencies"];
  logger?: Logger;
  now?: PartiesModuleDeps["now"];
}

export interface RequisiteAccountingWorkflow {
  create(input: CreateRequisiteInput): Promise<Requisite>;
  update(id: string, input: UpdateRequisiteInput): Promise<Requisite>;
  upsertBinding(
    requisiteId: string,
    input: { postingAccountNo?: string },
  ): Promise<RequisiteAccountingBinding>;
}

function createWorkflowPartiesModule(input: {
  tx: Transaction;
  currencies: PartiesModuleDeps["currencies"];
  logger?: Logger;
  now?: PartiesModuleDeps["now"];
}) {
  return createPartiesModule({
    logger: input.logger ?? noopLogger,
    now: input.now ?? (() => new Date()),
    generateUuid: randomUUID,
    documents: {
      hasDocumentsForCustomer: async () => false,
    },
    currencies: input.currencies,
    customerMembershipReads: new DrizzleCustomerMembershipReads(input.tx),
    customerReads: new DrizzleCustomerReads(input.tx),
    counterpartyReads: new DrizzleCounterpartyReads(input.tx),
    counterpartyGroupReads: new DrizzleCounterpartyGroupReads(input.tx),
    organizationReads: new DrizzleOrganizationReads(input.tx),
    requisiteReads: new DrizzleRequisiteReads(input.tx),
    requisiteProviderReads: new DrizzleRequisiteProviderReads(input.tx),
    requisiteBindingReads: new DrizzleRequisiteBindingReads(input.tx),
    unitOfWork: new DrizzlePartyRegistryUnitOfWork({
      persistence: bindPersistenceSession(input.tx),
    }),
  });
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
    const ledgerModule = deps.createLedgerModule(input.tx);
    const postingAccountNo = input.postingAccountNo ?? ACCOUNT_NO.BANK;
    const { bookId } =
      await ledgerModule.books.commands.ensureDefaultOrganizationBook({
        organizationId: input.organizationId,
      });
    const bookAccount =
      await ledgerModule.bookAccounts.commands.ensureBookAccountInstance({
        bookId,
        accountNo: postingAccountNo,
        currency: input.currencyCode,
        dimensions: {},
      });

    const partiesModule = createWorkflowPartiesModule({
      tx: input.tx,
      currencies: deps.currencies,
      logger: deps.logger,
      now: deps.now,
    });

    return partiesModule.requisites.commands.upsertBinding({
      requisiteId: input.requisiteId,
      bookId,
      bookAccountInstanceId: bookAccount.id,
      postingAccountNo,
    });
  }

  async function syncOrganizationBindingForRequisiteTx(input: {
    tx: Transaction;
    requisite: Requisite;
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
        const partiesModule = createWorkflowPartiesModule({
          tx,
          currencies: deps.currencies,
          logger: deps.logger,
          now: deps.now,
        });
        const requisite = await partiesModule.requisites.commands.create(input);

        await syncOrganizationBindingForRequisiteTx({
          tx,
          requisite,
        });

        return requisite;
      });
    },
    async update(id, input) {
      return deps.db.transaction(async (tx) => {
        const partiesModule = createWorkflowPartiesModule({
          tx,
          currencies: deps.currencies,
          logger: deps.logger,
          now: deps.now,
        });
        const requisite = await partiesModule.requisites.commands.update(
          id,
          input,
        );

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
        const partiesModule = createWorkflowPartiesModule({
          tx,
          currencies: deps.currencies,
          logger: deps.logger,
          now: deps.now,
        });
        const requisite =
          await partiesModule.requisites.queries.findById(requisiteId);

        if (!requisite) {
          throw new RequisiteNotFoundError(requisiteId);
        }

        if (requisite.ownerType !== "organization") {
          throw new RequisiteAccountingBindingOwnerTypeError(requisiteId);
        }

        const currencyCode = await resolveCurrencyCode(
          { currencies: deps.currencies },
          requisite.currencyId,
        );

        return upsertOrganizationBindingTx({
          tx,
          requisiteId,
          organizationId: requisite.ownerId,
          currencyCode,
          postingAccountNo: input.postingAccountNo,
        });
      });
    },
  };
}
