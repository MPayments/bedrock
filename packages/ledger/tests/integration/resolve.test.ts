import { describe, it, expect } from "vitest";

import { resolveTbAccountId } from "../../src/resolve";
import { tbAccountIdFor, tbLedgerForCurrency } from "../../src/ids";
import {
  db,
  tb,
  randomOrgId,
  getBookAccount,
  getTbAccount,
} from "./helpers";

describe("Resolve Integration Tests", () => {
  it("creates legacy account mapping in DB and TigerBeetle", async () => {
    const orgId = randomOrgId();
    const key = "customer:alice";
    const currency = "USD";
    const tbLedger = tbLedgerForCurrency(currency);

    const accountId = await resolveTbAccountId({
      db,
      tb,
      orgId,
      key,
      currency,
      tbLedger,
    });

    expect(accountId).toBe(tbAccountIdFor(orgId, key, tbLedger));

    const dbAccount = await getBookAccount(orgId, key, tbLedger);
    expect(dbAccount).toBeDefined();
    expect(dbAccount!.tbAccountId).toBe(accountId);

    const tbAccount = await getTbAccount(accountId);
    expect(tbAccount).toBeDefined();
    expect(tbAccount!.ledger).toBe(tbLedger);
  });

  it("returns same account id on repeated resolve", async () => {
    const orgId = randomOrgId();
    const key = "customer:bob";
    const currency = "USD";
    const tbLedger = tbLedgerForCurrency(currency);

    const id1 = await resolveTbAccountId({
      db,
      tb,
      orgId,
      key,
      currency,
      tbLedger,
    });
    const id2 = await resolveTbAccountId({
      db,
      tb,
      orgId,
      key,
      currency,
      tbLedger,
    });

    expect(id1).toBe(id2);
  });

  it("sets credit-normal flags for customer wallet-style keys", async () => {
    const orgId = randomOrgId();
    const key = "treasury:CustomerWallet:customer-1:USD";
    const tbLedger = tbLedgerForCurrency("USD");

    const accountId = await resolveTbAccountId({
      db,
      tb,
      orgId,
      key,
      currency: "USD",
      tbLedger,
    });

    const account = await getTbAccount(accountId);
    const { AccountFlags } = await import("tigerbeetle-node");
    expect(account!.flags).toBe(AccountFlags.debits_must_not_exceed_credits);
  });
});
