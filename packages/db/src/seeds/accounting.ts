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
  [
    "2210",
    "Займ от учредителя/инвестора",
    "liability",
    "credit",
    true,
    true,
    "2000",
  ],
  ["3000", "Капитал", "equity", "credit", false, true, null],
  ["3110", "Вклад учредителя", "equity", "credit", true, true, "3000"],
  ["3120", "Инвестиции в капитал", "equity", "credit", true, true, "3000"],
  ["3200", "Балансирующий капитал", "equity", "credit", true, true, "3000"],
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
  ["TR.CROSS.SOURCE.IMMEDIATE", "1310", "1110"],
  ["TR.CROSS.DEST.IMMEDIATE", "1110", "1310"],
  ["TR.CROSS.SOURCE.PENDING", "1310", "1110"],
  ["TR.CROSS.DEST.PENDING", "1110", "1310"],
  ["TC.1001", "1110", "2110"],
  ["TC.9001", "1110", "3110"],
  ["TC.9002", "1110", "3120"],
  ["TC.9003", "1110", "2210"],
  ["TC.9004", "1110", "2110"],
  ["TC.9005", "1110", "3200"],
  ["TC.2001", "2110", "2140"],
  ["TC.2009", "2140", "1310"],
  ["TC.2010", "1310", "2140"],
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

// [accountNo, dimensionKey, mode]
const ACCOUNT_DIMENSION_POLICIES = [
  // BANK
  ["1110", "operationalAccountId", "required"],
  ["1110", "orderId", "forbidden"],
  ["1110", "customerId", "forbidden"],
  ["1110", "feeBucket", "forbidden"],
  ["1110", "clearingKind", "forbidden"],
  ["1110", "counterpartyId", "forbidden"],
  // CUSTOMER_WALLET
  ["2110", "customerId", "required"],
  ["2110", "operationalAccountId", "forbidden"],
  ["2110", "feeBucket", "forbidden"],
  ["2110", "clearingKind", "forbidden"],
  // CLEARING (1310)
  ["1310", "clearingKind", "required"],
  ["1310", "counterpartyId", "optional"],
  ["1310", "orderId", "optional"],
  ["1310", "operationalAccountId", "forbidden"],
  ["1310", "feeBucket", "forbidden"],
  ["1310", "customerId", "forbidden"],
  // ORDER_RESERVE
  ["2140", "orderId", "required"],
  ["2140", "customerId", "optional"],
  ["2140", "operationalAccountId", "forbidden"],
  ["2140", "feeBucket", "forbidden"],
  ["2140", "clearingKind", "forbidden"],
  // FEE_CLEARING
  ["2120", "feeBucket", "required"],
  ["2120", "orderId", "required"],
  ["2120", "counterpartyId", "optional"],
  ["2120", "operationalAccountId", "forbidden"],
  ["2120", "clearingKind", "forbidden"],
  ["2120", "customerId", "forbidden"],
  // PAYOUT_OBLIGATION
  ["2130", "orderId", "required"],
  ["2130", "counterpartyId", "optional"],
  ["2130", "operationalAccountId", "forbidden"],
  ["2130", "feeBucket", "forbidden"],
  ["2130", "clearingKind", "forbidden"],
  ["2130", "customerId", "forbidden"],
  // SHAREHOLDER_LOAN (2210)
  ["2210", "counterpartyId", "required"],
  ["2210", "operationalAccountId", "forbidden"],
  ["2210", "orderId", "forbidden"],
  ["2210", "customerId", "forbidden"],
  ["2210", "feeBucket", "forbidden"],
  ["2210", "clearingKind", "forbidden"],
  // FOUNDER_EQUITY (3110)
  ["3110", "counterpartyId", "required"],
  ["3110", "operationalAccountId", "forbidden"],
  ["3110", "orderId", "forbidden"],
  ["3110", "customerId", "forbidden"],
  ["3110", "feeBucket", "forbidden"],
  ["3110", "clearingKind", "forbidden"],
  // INVESTOR_EQUITY (3120)
  ["3120", "counterpartyId", "required"],
  ["3120", "operationalAccountId", "forbidden"],
  ["3120", "orderId", "forbidden"],
  ["3120", "customerId", "forbidden"],
  ["3120", "feeBucket", "forbidden"],
  ["3120", "clearingKind", "forbidden"],
  // PROVIDER_FEE_EXPENSE
  ["5120", "feeBucket", "required"],
  ["5120", "orderId", "required"],
  ["5120", "counterpartyId", "optional"],
] as const;

// [postingCode, dimensionKey, required, scope]
const POSTING_CODE_DIMENSION_POLICIES = [
  ["TR.INTRA.IMMEDIATE", "operationalAccountId", true, "line"],
  ["TR.INTRA.PENDING", "operationalAccountId", true, "line"],
  ["TR.CROSS.SOURCE.IMMEDIATE", "counterpartyId", true, "debit"],
  ["TR.CROSS.SOURCE.IMMEDIATE", "operationalAccountId", true, "credit"],
  ["TR.CROSS.DEST.IMMEDIATE", "counterpartyId", true, "credit"],
  ["TR.CROSS.DEST.IMMEDIATE", "operationalAccountId", true, "debit"],
  ["TR.CROSS.SOURCE.PENDING", "counterpartyId", true, "debit"],
  ["TR.CROSS.SOURCE.PENDING", "operationalAccountId", true, "credit"],
  ["TR.CROSS.DEST.PENDING", "counterpartyId", true, "credit"],
  ["TR.CROSS.DEST.PENDING", "operationalAccountId", true, "debit"],
  ["TC.1001", "customerId", true, "credit"],
  ["TC.1001", "operationalAccountId", true, "debit"],
  ["TC.9001", "operationalAccountId", true, "debit"],
  ["TC.9001", "counterpartyId", true, "credit"],
  ["TC.9002", "operationalAccountId", true, "debit"],
  ["TC.9002", "counterpartyId", true, "credit"],
  ["TC.9003", "operationalAccountId", true, "debit"],
  ["TC.9003", "counterpartyId", true, "credit"],
  ["TC.9004", "operationalAccountId", true, "debit"],
  ["TC.9004", "customerId", true, "credit"],
  ["TC.9005", "operationalAccountId", true, "debit"],
  ["TC.2001", "orderId", true, "credit"],
  ["TC.2001", "customerId", true, "debit"],
  ["TC.2009", "orderId", true, "line"],
  ["TC.2009", "counterpartyId", true, "credit"],
  ["TC.2009", "clearingKind", true, "credit"],
  ["TC.2010", "orderId", true, "line"],
  ["TC.2010", "counterpartyId", true, "debit"],
  ["TC.2010", "clearingKind", true, "debit"],
  ["TC.2005", "orderId", true, "line"],
  ["TC.3001", "orderId", true, "line"],
  ["TC.3001", "customerId", true, "debit"],
  ["TC.3001", "feeBucket", true, "line"],
  ["TC.3002", "orderId", true, "line"],
  ["TC.3002", "customerId", true, "debit"],
  ["TC.3002", "feeBucket", true, "line"],
  ["TC.3003", "orderId", true, "line"],
  ["TC.3003", "feeBucket", true, "line"],
  ["TC.3008", "orderId", true, "line"],
  ["TC.3008", "feeBucket", true, "line"],
  ["TC.3008", "counterpartyId", true, "line"],
  ["TC.3011", "orderId", true, "debit"],
  ["TC.3011", "feeBucket", true, "debit"],
  ["TC.3011", "counterpartyId", true, "debit"],
  ["TC.3011", "operationalAccountId", true, "credit"],
  ["TC.3101", "orderId", true, "debit"],
  ["TC.3101", "operationalAccountId", true, "credit"],
  ["TC.3006", "orderId", true, "line"],
  ["TC.3006", "customerId", true, "debit"],
  ["TC.3006", "feeBucket", true, "line"],
  ["TC.3007", "orderId", true, "line"],
  ["TC.3007", "customerId", true, "credit"],
  ["TC.3007", "feeBucket", true, "line"],
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
    scope,
  ] of POSTING_CODE_DIMENSION_POLICIES) {
    await db
      .insert(schema.postingCodeDimensionPolicy)
      .values({
        postingCode,
        dimensionKey,
        required,
        scope,
      })
      .onConflictDoUpdate({
        target: [
          schema.postingCodeDimensionPolicy.postingCode,
          schema.postingCodeDimensionPolicy.dimensionKey,
        ],
        set: { required, scope },
      });
  }
}
