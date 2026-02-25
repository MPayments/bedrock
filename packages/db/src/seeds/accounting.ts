import { and, eq, isNull } from "drizzle-orm";

import type { Database } from "../client";
import { schema } from "../schema";

const ACCOUNTS = [
  ["1000", "Активы", "asset", "debit", false, null],
  ["1100", "Денежные средства и эквиваленты", "asset", "debit", false, "1000"],
  ["1200", "Операционные активы", "asset", "debit", false, "1000"],
  ["1300", "Внутригрупповые расчеты", "active_passive", "both", false, "1000"],
  ["2000", "Обязательства", "liability", "credit", false, null],
  ["2100", "Операционные обязательства", "liability", "credit", false, "2000"],
  ["3000", "Капитал", "equity", "credit", false, null],
  ["4000", "Доходы", "revenue", "credit", false, null],
  ["5000", "Расходы", "expense", "debit", false, null],
  ["1110", "Банк", "asset", "debit", true, "1100"],
  ["1210", "Резерв по ордерам", "asset", "debit", true, "1200"],
  ["1220", "Транзит", "asset", "debit", true, "1200"],
  ["1310", "Внутригрупповой неттинг", "active_passive", "both", true, "1300"],
  ["2110", "Кошелек клиента", "liability", "credit", true, "2100"],
  ["2120", "Клиринг комиссий", "liability", "credit", true, "2100"],
  ["2130", "Обязательство по выплате", "liability", "credit", true, "2100"],
  ["4110", "Доход от комиссий", "revenue", "credit", true, "4000"],
  ["4120", "Доход от спреда", "revenue", "credit", true, "4000"],
  ["4130", "Доход от корректировок", "revenue", "credit", true, "4000"],
  ["5110", "Расход по корректировкам", "expense", "debit", true, "5000"],
] as const;

const RULES = [
  ["TR.INTRA.IMMEDIATE", "1110", "1110"],
  ["TR.INTRA.PENDING", "1110", "1110"],
  ["TR.CROSS.SOURCE.IMMEDIATE", "1310", "1110"],
  ["TR.CROSS.DEST.IMMEDIATE", "1110", "1310"],
  ["TR.CROSS.SOURCE.PENDING", "1310", "1110"],
  ["TR.CROSS.DEST.PENDING", "1110", "1310"],
  ["TC.1001", "1110", "2110"],
  ["TC.2001", "2110", "1210"],
  ["TC.2002", "2110", "4110"],
  ["TC.2003", "2110", "4120"],
  ["TC.2006", "2110", "4110"],
  ["TC.2007", "2110", "4110"],
  ["TC.2008", "2110", "4110"],
  ["TC.2009", "1210", "1310"],
  ["TC.2010", "1310", "1210"],
  ["TC.2005", "1210", "2130"],
  ["TC.3001", "2130", "1110"],
  ["TC.3002", "2110", "2120"],
  ["TC.3002", "5110", "2120"],
  ["TC.3003", "2120", "1110"],
  ["TC.3006", "2110", "4130"],
  ["TC.3007", "5110", "2110"],
] as const;

export async function seedAccounting(db: Database) {
  for (const [accountNo, name, kind, normalSide, postingAllowed, parentAccountNo] of ACCOUNTS) {
    await db
      .insert(schema.chartTemplateAccounts)
      .values({
        accountNo,
        name,
        kind,
        normalSide,
        postingAllowed,
        parentAccountNo,
      })
      .onConflictDoUpdate({
        target: schema.chartTemplateAccounts.accountNo,
        set: {
          name,
          kind,
          normalSide,
          postingAllowed,
          parentAccountNo,
        },
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
