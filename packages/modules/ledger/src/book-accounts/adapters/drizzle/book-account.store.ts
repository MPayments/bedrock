import { and, eq } from "drizzle-orm";

import type { Queryable } from "@bedrock/platform/persistence";

import { schema } from "../../../schema";
import {
  tbBookAccountInstanceIdFor,
  tbLedgerForCurrency,
} from "../../../shared/adapters/tigerbeetle/identity-policy";
import type { LedgerBookAccountStore } from "../../application/ports/book-account.store";
import {
  computeBookAccountIdentity,
  type BookAccountInstanceRef,
  type BookAccountIdentityInput,
} from "../../domain/book-account-identity";

export class DrizzleBookAccountStore implements LedgerBookAccountStore {
  constructor(private readonly db: Queryable) {}

  async ensureBookAccountInstance(
    input: BookAccountIdentityInput,
  ): Promise<BookAccountInstanceRef> {
    const dimensionsHash = computeBookAccountIdentity(input).dimensionsHash;
    const settlementLedger = tbLedgerForCurrency(input.currency);
    const settlementAccountId = tbBookAccountInstanceIdFor({
      bookId: input.bookId,
      accountNo: input.accountNo,
      currency: input.currency,
      dimensions: input.dimensions,
    });

    const inserted = await this.db
      .insert(schema.bookAccountInstances)
      .values({
        bookId: input.bookId,
        accountNo: input.accountNo,
        currency: input.currency,
        dimensions: input.dimensions,
        dimensionsHash,
        tbLedger: settlementLedger,
        tbAccountId: settlementAccountId,
      })
      .onConflictDoNothing()
      .returning({
        id: schema.bookAccountInstances.id,
        settlementLedger: schema.bookAccountInstances.tbLedger,
        settlementAccountId: schema.bookAccountInstances.tbAccountId,
      });

    if (inserted[0]) {
      return {
        id: inserted[0].id,
        dimensionsHash,
        settlementLedger,
        settlementAccountId,
      };
    }

    const [existing] = await this.db
      .select({
        id: schema.bookAccountInstances.id,
        settlementLedger: schema.bookAccountInstances.tbLedger,
        settlementAccountId: schema.bookAccountInstances.tbAccountId,
      })
      .from(schema.bookAccountInstances)
      .where(
        and(
          eq(schema.bookAccountInstances.bookId, input.bookId),
          eq(schema.bookAccountInstances.accountNo, input.accountNo),
          eq(schema.bookAccountInstances.currency, input.currency),
          eq(schema.bookAccountInstances.dimensionsHash, dimensionsHash),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new Error(
        `book account instance insert/select failed unexpectedly for book=${input.bookId}, accountNo=${input.accountNo}, currency=${input.currency}`,
      );
    }

    if (
      existing.settlementLedger !== settlementLedger ||
      existing.settlementAccountId !== settlementAccountId
    ) {
      throw new Error(
        `book_account_instance invariant mismatch for book=${input.bookId}, accountNo=${input.accountNo}, currency=${input.currency}, hash=${dimensionsHash}`,
      );
    }

    return {
      id: existing.id,
      dimensionsHash,
      settlementLedger,
      settlementAccountId,
    };
  }
}
