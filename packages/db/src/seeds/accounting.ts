import { and, eq, isNull } from "drizzle-orm";

import type { Database } from "../client";
import { schema } from "../schema";

const ACCOUNTS = [
  ["51.01", "Bank", "asset", "debit"],
  ["57.01", "Order Inventory", "asset", "debit"],
  ["57.02", "Transit", "asset", "debit"],
  ["62.01", "Customer Wallet", "liability", "credit"],
  ["76.10", "Fee Clearing", "liability", "credit"],
  ["76.20", "Payout Obligation", "liability", "credit"],
  ["79.01", "Intercompany Net", "active_passive", "both"],
  ["90.01", "Fee Revenue", "revenue", "credit"],
  ["90.02", "Spread Revenue", "revenue", "credit"],
  ["91.01", "Adjustment Revenue", "revenue", "credit"],
  ["91.02", "Adjustment Expense", "expense", "debit"],
] as const;

const RULES = [
  ["TR.INTRA.IMMEDIATE", "51.01", "51.01"],
  ["TR.INTRA.PENDING", "51.01", "51.01"],
  ["TR.CROSS.SOURCE.IMMEDIATE", "79.01", "51.01"],
  ["TR.CROSS.DEST.IMMEDIATE", "51.01", "79.01"],
  ["TR.CROSS.SOURCE.PENDING", "79.01", "51.01"],
  ["TR.CROSS.DEST.PENDING", "51.01", "79.01"],
  ["TC.1001", "51.01", "62.01"],
  ["TC.2001", "62.01", "57.01"],
  ["TC.2002", "62.01", "90.01"],
  ["TC.2003", "62.01", "90.02"],
  ["TC.2006", "62.01", "90.01"],
  ["TC.2007", "62.01", "90.01"],
  ["TC.2008", "62.01", "90.01"],
  ["TC.2009", "57.01", "79.01"],
  ["TC.2010", "79.01", "57.01"],
  ["TC.2005", "57.01", "76.20"],
  ["TC.3001", "76.20", "51.01"],
  ["TC.3002", "62.01", "76.10"],
  ["TC.3002", "91.02", "76.10"],
  ["TC.3003", "76.10", "51.01"],
  ["TC.3006", "62.01", "91.01"],
  ["TC.3007", "91.02", "62.01"],
] as const;

export async function seedAccounting(db: Database) {
  for (const [accountNo, name, kind, normalSide] of ACCOUNTS) {
    await db
      .insert(schema.chartTemplateAccounts)
      .values({
        accountNo,
        name,
        kind,
        normalSide,
        postingAllowed: true,
      })
      .onConflictDoUpdate({
        target: schema.chartTemplateAccounts.accountNo,
        set: { name, kind, normalSide, postingAllowed: true },
      });
  }

  for (const [postingCode, debitAccountNo, creditAccountNo] of RULES) {
    await db
      .insert(schema.correspondenceRules)
      .values({
        scope: "global",
        orgId: null,
        postingCode,
        debitAccountNo,
        creditAccountNo,
        enabled: true,
      })
      .onConflictDoUpdate({
        target: [
          schema.correspondenceRules.scope,
          schema.correspondenceRules.orgId,
          schema.correspondenceRules.postingCode,
          schema.correspondenceRules.debitAccountNo,
          schema.correspondenceRules.creditAccountNo,
        ],
        set: { enabled: true },
      });
  }
}

export async function seedAccountingForOrg(db: Database, orgId: string) {
  await seedAccounting(db);

  const templateAccounts = await db
    .select({ accountNo: schema.chartTemplateAccounts.accountNo })
    .from(schema.chartTemplateAccounts);

  if (templateAccounts.length > 0) {
    await db
      .insert(schema.chartOrgOverrides)
      .values(
        templateAccounts.map((a) => ({
          orgId,
          accountNo: a.accountNo,
          enabled: true,
          nameOverride: null,
        })),
      )
      .onConflictDoNothing();
  }

  const globalRules = await db
    .select({
      postingCode: schema.correspondenceRules.postingCode,
      debitAccountNo: schema.correspondenceRules.debitAccountNo,
      creditAccountNo: schema.correspondenceRules.creditAccountNo,
    })
    .from(schema.correspondenceRules)
    .where(
      and(
        eq(schema.correspondenceRules.scope, "global"),
        isNull(schema.correspondenceRules.orgId),
      ),
    );

  if (globalRules.length > 0) {
    await db
      .insert(schema.correspondenceRules)
      .values(
        globalRules.map((r) => ({
          scope: "org" as const,
          orgId,
          postingCode: r.postingCode,
          debitAccountNo: r.debitAccountNo,
          creditAccountNo: r.creditAccountNo,
          enabled: true,
        })),
      )
      .onConflictDoUpdate({
        target: [
          schema.correspondenceRules.scope,
          schema.correspondenceRules.orgId,
          schema.correspondenceRules.postingCode,
          schema.correspondenceRules.debitAccountNo,
          schema.correspondenceRules.creditAccountNo,
        ],
        set: { enabled: true },
      });
  }
}
