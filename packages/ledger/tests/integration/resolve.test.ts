import { describe, expect, it } from "vitest";

import {
  db,
  tb,
  randomOrgId,
  getBookAccount,
  getTbAccount,
} from "./helpers";
import {
  tbBookAccountIdFor,
  tbLedgerForCurrency,
} from "../../src/ids";
import { resolveTbBookAccountId } from "../../src/resolve";

describe("Resolve Integration Tests", () => {
  it("creates book account mapping in DB and TigerBeetle", async () => {
    const orgId = randomOrgId();
    const accountNo = "1000";
    const currency = "USD";
    const tbLedger = tbLedgerForCurrency(currency);

    const accountId = await resolveTbBookAccountId({
      db,
      tb,
      orgId,
      accountNo,
      currency,
    });

    expect(accountId).toBe(
      tbBookAccountIdFor(orgId, accountNo, currency, tbLedger),
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

    const id1 = await resolveTbBookAccountId({
      db,
      tb,
      orgId,
      accountNo,
      currency,
    });
    const id2 = await resolveTbBookAccountId({
      db,
      tb,
      orgId,
      accountNo,
      currency,
    });

    expect(id1).toBe(id2);
  });

  it("creates TB account with no extra flags", async () => {
    const orgId = randomOrgId();
    const accountNo = "1000";
    const currency = "USD";

    const accountId = await resolveTbBookAccountId({
      db,
      tb,
      orgId,
      accountNo,
      currency,
    });

    const account = await getTbAccount(accountId);
    expect(account).toBeDefined();
    expect(account!.flags).toBe(0);
  });
});
