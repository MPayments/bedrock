import { describe, expect, it } from "vitest";

import {
  computeDimensionsHash,
  tbBookAccountInstanceIdFor,
  tbLedgerForCurrency,
} from "@bedrock/kernel";

import { getBookAccount, getTbAccount, randomOrgId, tb, db } from "./helpers";
import { resolveTbBookAccountInstanceId } from "../../src/resolve";

describe("Resolve Integration Tests", () => {
  it("creates book account mapping in DB and TigerBeetle", async () => {
    const orgId = randomOrgId();
    const accountNo = "1000";
    const currency = "USD";
    const tbLedger = tbLedgerForCurrency(currency);

    const accountId = await resolveTbBookAccountInstanceId({
      db,
      tb,
      bookId: orgId,
      accountNo,
      currency,
      dimensions: {},
    });
    const dimensionsHash = computeDimensionsHash({});

    expect(accountId).toBe(
      tbBookAccountInstanceIdFor(
        orgId,
        accountNo,
        currency,
        dimensionsHash,
        tbLedger,
      ),
    );

    const dbAccount = await getBookAccount(orgId, accountNo, tbLedger);
    expect(dbAccount).toBeDefined();
    expect(dbAccount!.tbAccountId).toBe(accountId);

    const tbAccount = await getTbAccount(accountId);
    expect(tbAccount).toBeDefined();
    expect(tbAccount!.ledger).toBe(tbLedger);
  });

  it("returns same account id on repeated resolve", async () => {
    const orgId = randomOrgId();
    const accountNo = "2110";
    const currency = "USD";

    const id1 = await resolveTbBookAccountInstanceId({
      db,
      tb,
      bookId: orgId,
      accountNo,
      currency,
      dimensions: {},
    });
    const id2 = await resolveTbBookAccountInstanceId({
      db,
      tb,
      bookId: orgId,
      accountNo,
      currency,
      dimensions: {},
    });

    expect(id1).toBe(id2);
  });

  it("creates TB account with no extra flags", async () => {
    const orgId = randomOrgId();
    const accountNo = "1000";
    const currency = "USD";

    const accountId = await resolveTbBookAccountInstanceId({
      db,
      tb,
      bookId: orgId,
      accountNo,
      currency,
      dimensions: {},
    });

    const account = await getTbAccount(accountId);
    expect(account).toBeDefined();
    expect(account!.flags).toBe(0);
  });
});
