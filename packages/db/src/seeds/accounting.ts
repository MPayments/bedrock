import type { Database, Transaction } from "../client";
import { schema } from "../schema";

const ACCOUNTS = [
  ["1000", "Активы", "asset", "debit", false, true, null],
  [
    "1100",
    "Денежные средства и эквиваленты",
    "asset",
    "debit",
    false,
    true,
    "1000",
  ],
  ["1200", "Операционные активы", "asset", "debit", false, true, "1000"],
  [
    "1300",
    "Внутригрупповые расчеты",
    "active_passive",
    "both",
    false,
    true,
    "1000",
  ],
  ["2000", "Обязательства", "liability", "credit", false, true, null],
  [
    "2100",
    "Операционные обязательства",
    "liability",
    "credit",
    false,
    true,
    "2000",
  ],
  ["3000", "Капитал", "equity", "credit", false, true, null],
  ["4000", "Доходы", "revenue", "credit", false, true, null],
  ["5000", "Расходы", "expense", "debit", false, true, null],
  ["1110", "Банк", "asset", "debit", true, true, "1100"],
  ["1220", "Транзит", "asset", "debit", true, true, "1200"],
  ["1310", "INTERCOMPANY_NET", "active_passive", "both", true, true, "1300"],
  ["1320", "TREASURY_CLEARING", "active_passive", "both", true, true, "1300"],
  ["2110", "Кошелек клиента", "liability", "credit", true, true, "2100"],
  ["2120", "Клиринг комиссий", "liability", "credit", true, true, "2100"],
  [
    "2130",
    "Обязательство по выплате",
    "liability",
    "credit",
    true,
    true,
    "2100",
  ],
  ["2140", "ORDER_RESERVE", "liability", "credit", true, true, "2100"],
  ["4110", "Доход от комиссий", "revenue", "credit", true, true, "4000"],
  ["4120", "Доход от спреда", "revenue", "credit", true, true, "4000"],
  ["4130", "Доход от корректировок", "revenue", "credit", true, true, "4000"],
  ["5110", "Расход по корректировкам", "expense", "debit", true, true, "5000"],
  ["5120", "PROVIDER_FEE_EXPENSE", "expense", "debit", true, true, "5000"],
] as const;

const RULES = [
  ["TR.INTRA.IMMEDIATE", "1110", "1110"],
  ["TR.INTRA.PENDING", "1110", "1110"],
  ["TR.CROSS.SOURCE.IMMEDIATE", "1310", "1110"],
  ["TR.CROSS.DEST.IMMEDIATE", "1110", "1310"],
  ["TR.CROSS.SOURCE.PENDING", "1310", "1110"],
  ["TR.CROSS.DEST.PENDING", "1110", "1310"],
  ["TC.1001", "1110", "2110"],
  ["TC.2001", "2110", "2140"],
  ["TC.2009", "2140", "1320"],
  ["TC.2010", "1320", "2140"],
  ["TC.2005", "2140", "2130"],
  ["TC.3001", "2110", "4110"],
  ["TC.3002", "2110", "4120"],
  ["TC.3003", "2110", "2120"],
  ["TC.3008", "5120", "2120"],
  ["TC.3101", "2130", "1110"],
  ["TC.3011", "2120", "1110"],
  ["TC.3006", "2110", "4130"],
  ["TC.3007", "5110", "2110"],
] as const;

const ANALYTICS = [
  ["1110", "operational_account_id", true],
  ["1310", "counterparty_id", true],
  ["1320", "order_id", true],
  ["1320", "counterparty_id", true],
  ["1320", "quote_id", false],
  ["2120", "fee_bucket", true],
  ["2120", "order_id", true],
  ["2120", "counterparty_id", false],
  ["2120", "quote_id", false],
  ["2130", "order_id", true],
  ["2140", "order_id", true],
  ["2140", "customer_id", false],
  ["2140", "quote_id", false],
  ["5120", "fee_bucket", true],
  ["5120", "order_id", true],
  ["5120", "counterparty_id", false],
  ["5120", "quote_id", false],
] as const;

export async function seedAccounting(db: Database | Transaction) {
  for (const [
    accountNo,
    name,
    kind,
    normalSide,
    postingAllowed,
    enabled,
    parentAccountNo,
  ] of ACCOUNTS) {
    await db
      .insert(schema.chartTemplateAccounts)
      .values({
        accountNo,
        name,
        kind,
        normalSide,
        postingAllowed,
        enabled,
        parentAccountNo,
      })
      .onConflictDoUpdate({
        target: schema.chartTemplateAccounts.accountNo,
        set: {
          name,
          kind,
          normalSide,
          postingAllowed,
          enabled,
          parentAccountNo,
        },
      });
  }

  for (const [postingCode, debitAccountNo, creditAccountNo] of RULES) {
    await db
      .insert(schema.correspondenceRules)
      .values({
        postingCode,
        debitAccountNo,
        creditAccountNo,
        enabled: true,
      })
      .onConflictDoUpdate({
        target: [
          schema.correspondenceRules.postingCode,
          schema.correspondenceRules.debitAccountNo,
          schema.correspondenceRules.creditAccountNo,
        ],
        set: { enabled: true },
      });
  }

  for (const [accountNo, analyticType, required] of ANALYTICS) {
    await db
      .insert(schema.chartTemplateAccountAnalytics)
      .values({
        accountNo,
        analyticType,
        required,
      })
      .onConflictDoUpdate({
        target: [
          schema.chartTemplateAccountAnalytics.accountNo,
          schema.chartTemplateAccountAnalytics.analyticType,
        ],
        set: { required },
      });
  }
}
