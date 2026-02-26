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
  ["1300", "Clearing", "active_passive", "both", true, true, "1000"],
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
  ["TR.CROSS.SOURCE.IMMEDIATE", "1300", "1110"],
  ["TR.CROSS.DEST.IMMEDIATE", "1110", "1300"],
  ["TR.CROSS.SOURCE.PENDING", "1300", "1110"],
  ["TR.CROSS.DEST.PENDING", "1110", "1300"],
  ["TC.1001", "1110", "2110"],
  ["TC.2001", "2110", "2140"],
  ["TC.2009", "2140", "1300"],
  ["TC.2010", "1300", "2140"],
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

const ACCOUNT_DIMENSION_POLICIES = [
  ["1110", "operationalAccountId", "required"],
  ["1300", "clearingKind", "required"],
  ["1300", "counterpartyId", "optional"],
  ["1300", "orderId", "optional"],
  ["2110", "customerId", "required"],
  ["2120", "feeBucket", "required"],
  ["2120", "orderId", "required"],
  ["2120", "counterpartyId", "optional"],
  ["2130", "orderId", "required"],
  ["2140", "orderId", "required"],
  ["2140", "customerId", "optional"],
  ["5120", "feeBucket", "required"],
  ["5120", "orderId", "required"],
  ["5120", "counterpartyId", "optional"],
] as const;

const POSTING_CODE_DIMENSION_POLICIES = [
  ["TR.INTRA.IMMEDIATE", "operationalAccountId", true],
  ["TR.INTRA.PENDING", "operationalAccountId", true],
  ["TR.CROSS.SOURCE.IMMEDIATE", "counterpartyId", true],
  ["TR.CROSS.SOURCE.IMMEDIATE", "operationalAccountId", true],
  ["TR.CROSS.DEST.IMMEDIATE", "counterpartyId", true],
  ["TR.CROSS.DEST.IMMEDIATE", "operationalAccountId", true],
  ["TR.CROSS.SOURCE.PENDING", "counterpartyId", true],
  ["TR.CROSS.SOURCE.PENDING", "operationalAccountId", true],
  ["TR.CROSS.DEST.PENDING", "counterpartyId", true],
  ["TR.CROSS.DEST.PENDING", "operationalAccountId", true],
  ["TC.1001", "customerId", true],
  ["TC.1001", "operationalAccountId", true],
  ["TC.2001", "orderId", true],
  ["TC.2001", "customerId", true],
  ["TC.2009", "orderId", true],
  ["TC.2009", "counterpartyId", true],
  ["TC.2009", "clearingKind", true],
  ["TC.2010", "orderId", true],
  ["TC.2010", "counterpartyId", true],
  ["TC.2010", "clearingKind", true],
  ["TC.2005", "orderId", true],
  ["TC.3001", "orderId", true],
  ["TC.3001", "customerId", true],
  ["TC.3001", "feeBucket", true],
  ["TC.3002", "orderId", true],
  ["TC.3002", "customerId", true],
  ["TC.3002", "feeBucket", true],
  ["TC.3003", "orderId", true],
  ["TC.3003", "customerId", true],
  ["TC.3003", "feeBucket", true],
  ["TC.3008", "orderId", true],
  ["TC.3008", "feeBucket", true],
  ["TC.3008", "counterpartyId", true],
  ["TC.3011", "orderId", true],
  ["TC.3011", "feeBucket", true],
  ["TC.3011", "counterpartyId", true],
  ["TC.3011", "operationalAccountId", true],
  ["TC.3101", "orderId", true],
  ["TC.3101", "counterpartyId", true],
  ["TC.3101", "operationalAccountId", true],
  ["TC.3006", "orderId", true],
  ["TC.3006", "customerId", true],
  ["TC.3006", "feeBucket", true],
  ["TC.3007", "orderId", true],
  ["TC.3007", "customerId", true],
  ["TC.3007", "feeBucket", true],
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

  for (const [accountNo, dimensionKey, mode] of ACCOUNT_DIMENSION_POLICIES) {
    await db
      .insert(schema.chartAccountDimensionPolicy)
      .values({
        accountNo,
        dimensionKey,
        mode,
      })
      .onConflictDoUpdate({
        target: [
          schema.chartAccountDimensionPolicy.accountNo,
          schema.chartAccountDimensionPolicy.dimensionKey,
        ],
        set: { mode },
      });
  }

  for (const [
    postingCode,
    dimensionKey,
    required,
  ] of POSTING_CODE_DIMENSION_POLICIES) {
    await db
      .insert(schema.postingCodeDimensionPolicy)
      .values({
        postingCode,
        dimensionKey,
        required,
      })
      .onConflictDoUpdate({
        target: [
          schema.postingCodeDimensionPolicy.postingCode,
          schema.postingCodeDimensionPolicy.dimensionKey,
        ],
        set: { required },
      });
  }
}
