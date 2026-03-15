import { inArray } from "drizzle-orm";

import { createCurrenciesService } from "@bedrock/currencies";
import { createLedgerBookAccountsService, createLedgerBooksService } from "@bedrock/ledger";
import { createOrganizationsService } from "@bedrock/organizations";
import { CounterpartyNotFoundError } from "@bedrock/parties";
import { createPartiesQueries } from "@bedrock/parties/queries";
import type { Queryable } from "@bedrock/platform/persistence";

import type {
  RequisitesCurrenciesPort,
  RequisitesLedgerBindingsPort,
  RequisitesOwnersPort,
} from "../../../application/ports";
import { schema } from "../schema";

export function createDrizzleRequisitesOwnersPort(input: {
  db: Queryable;
}): RequisitesOwnersPort {
  const organizations = createOrganizationsService({
    db: input.db,
    ledgerBooks: createLedgerBooksService(),
  });
  const partiesQueries = createPartiesQueries({ db: input.db });

  return {
    async assertOrganizationExists(id: string) {
      await organizations.findById(id);
    },
    async assertCounterpartyExists(id: string) {
      const names = await partiesQueries.counterparties.listShortNamesById([id]);
      if (!names.has(id)) {
        throw new CounterpartyNotFoundError(id);
      }
    },
  };
}

export function createDrizzleRequisitesCurrenciesPort(input: {
  db: Queryable;
}): RequisitesCurrenciesPort {
  const currencies = createCurrenciesService({ db: input.db });

  return {
    async assertCurrencyExists(id: string) {
      await currencies.findById(id);
    },
    async listCodesById(ids: string[]) {
      const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
      if (uniqueIds.length === 0) {
        return new Map();
      }

      const rows = await input.db
        .select({
          id: schema.currencies.id,
          code: schema.currencies.code,
        })
        .from(schema.currencies)
        .where(inArray(schema.currencies.id, uniqueIds));

      return new Map(rows.map((row) => [row.id, row.code]));
    },
  };
}

export function createLedgerRequisitesBindingsPort(): RequisitesLedgerBindingsPort {
  const ledgerBooks = createLedgerBooksService();

  return {
    async ensureOrganizationPostingTarget(tx, input) {
      const { bookId } = await ledgerBooks.ensureDefaultOrganizationBook(tx, {
        organizationId: input.organizationId,
      });
      const bookAccounts = createLedgerBookAccountsService({ db: tx });
      const bookAccount = await bookAccounts.ensureBookAccountInstance({
        bookId,
        accountNo: input.postingAccountNo,
        currency: input.currencyCode,
        dimensions: {},
      });

      return {
        bookId,
        bookAccountInstanceId: bookAccount.id,
      };
    },
  };
}
