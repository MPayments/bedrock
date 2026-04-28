import {
  minorToAmountString,
  toMinorAmountString,
} from "@bedrock/shared/money";

import type {
  TreasuryOrganizationBalanceRow,
  TreasuryOrganizationBalancesSnapshot,
} from "./server-queries";
import type { TreasuryBalancesEvaluationSummary } from "./evaluation";

const BALANCE_METRICS = [
  {
    key: "ledgerBalance",
    label: "Позиция",
  },
  {
    key: "available",
    label: "Доступно по учёту",
  },
  {
    key: "inventoryAvailable",
    label: "Доступно в инвентаре",
  },
  {
    key: "reserved",
    label: "Учётный резерв",
  },
  {
    key: "inventoryReserved",
    label: "Резерв инвентаря",
  },
  {
    key: "pending",
    label: "В обработке",
  },
] as const;

const DEFAULT_EVALUATION_CURRENCY = "USD";
const CURRENCY_TONE_INDEX: Record<string, number> = {
  AED: 3,
  CNY: 5,
  EUR: 1,
  GBP: 2,
  RUB: 4,
  USD: 0,
};

type BalanceMetricKey = (typeof BALANCE_METRICS)[number]["key"];

type CurrencyTotals = {
  available: string;
  currency: string;
  inventoryAvailable: string;
  inventoryReserved: string;
  ledgerBalance: string;
  pending: string;
  reserved: string;
};

type OrganizationBalanceGroup = {
  currencyTotals: CurrencyTotals[];
  organizationId: string;
  organizationName: string;
  rows: TreasuryOrganizationBalanceRow[];
};

export type TreasuryBalancesOrganizationOption = {
  organizationId: string;
  organizationName: string;
};

export type TreasuryBalancesSelectedOrganizationSummary = {
  asOf: string;
  currencyCount: number;
  currencyMix: {
    currency: string;
    ledgerBalance: string;
    shareLabel: string;
    sharePercent: number;
    toneIndex: number;
  }[];
  evaluationCurrency: string;
  evaluationCurrencyOptions: {
    currency: string;
    toneIndex: number;
  }[];
  organizationId: string;
  organizationName: string;
  requisitesCount: number;
  totalEvaluation: TreasuryBalancesEvaluationSummary;
};

export type TreasuryBalancesSelectedOrganizationMetrics = {
  key: BalanceMetricKey;
  label: string;
  values: {
    amount: string;
    currency: string;
    toneIndex: number;
  }[];
}[];

export type TreasuryBalancesAllAccountsRow = TreasuryOrganizationBalanceRow & {
  anchorId: string;
  isSelectedOrganization: boolean;
  key: string;
  toneIndex: number;
};

export type TreasuryBalancesOrganizationAccountGroup = {
  accountCount: number;
  anchorId: string;
  currencies: string[];
  isSelected: boolean;
  organizationId: string;
  organizationName: string;
  rows: TreasuryBalancesAllAccountsRow[];
};

export type TreasuryBalancesDashboardViewModel = {
  allAccountsRows: TreasuryBalancesAllAccountsRow[];
  allOrganizationAccountGroups: TreasuryBalancesOrganizationAccountGroup[];
  organizationOptions: TreasuryBalancesOrganizationOption[];
  selectedOrganizationMetrics: TreasuryBalancesSelectedOrganizationMetrics;
  selectedOrganizationSummary: TreasuryBalancesSelectedOrganizationSummary;
};

type BuildTreasuryBalancesDashboardViewModelOptions = {
  selectedEvaluationCurrency?: string | null;
  selectedOrganizationId?: string | null;
  totalEvaluation?: TreasuryBalancesEvaluationSummary | null;
};

function absoluteMinor(value: bigint) {
  return value < 0n ? -value : value;
}

function compareNames(left: string, right: string) {
  return left.localeCompare(right, "ru-RU");
}

function createAnchorId(organizationId: string) {
  return `organization-${organizationId}`;
}

function getCurrencyToneIndex(currency: string) {
  const normalizedCurrency = currency.toUpperCase();
  const configuredToneIndex = CURRENCY_TONE_INDEX[normalizedCurrency];

  if (configuredToneIndex !== undefined) {
    return configuredToneIndex;
  }

  return normalizedCurrency
    .split("")
    .reduce((accumulator, symbol) => accumulator + symbol.charCodeAt(0), 0);
}

function toMinor(value: string, currency: string) {
  return BigInt(toMinorAmountString(value, currency));
}

function sumAmountStrings(values: string[], currency: string) {
  const totalMinor = values.reduce(
    (accumulator, value) => accumulator + toMinor(value, currency),
    0n,
  );

  return minorToAmountString(totalMinor, { currency });
}

function groupBalancesByOrganization(
  rows: TreasuryOrganizationBalanceRow[],
): OrganizationBalanceGroup[] {
  const grouped = new Map<string, OrganizationBalanceGroup>();

  for (const row of rows) {
    const existing = grouped.get(row.organizationId);

    if (existing) {
      existing.rows.push(row);
      continue;
    }

    grouped.set(row.organizationId, {
      currencyTotals: [],
      organizationId: row.organizationId,
      organizationName: row.organizationName,
      rows: [row],
    });
  }

  const organizations = Array.from(grouped.values()).sort(
    (
      left: OrganizationBalanceGroup,
      right: OrganizationBalanceGroup,
    ) => compareNames(left.organizationName, right.organizationName),
  );

  for (const group of organizations) {
    const rowsByCurrency = new Map<string, TreasuryOrganizationBalanceRow[]>();

    for (const row of group.rows) {
      const currentRows = rowsByCurrency.get(row.currency);

      if (currentRows) {
        currentRows.push(row);
        continue;
      }

      rowsByCurrency.set(row.currency, [row]);
    }

    group.rows = [...group.rows].sort(
      (
        left: TreasuryOrganizationBalanceRow,
        right: TreasuryOrganizationBalanceRow,
      ) => {
        const byCurrency = compareNames(left.currency, right.currency);
        if (byCurrency !== 0) {
          return byCurrency;
        }

        const leftLedger = toMinor(left.ledgerBalance, left.currency);
        const rightLedger = toMinor(right.ledgerBalance, right.currency);
        if (leftLedger !== rightLedger) {
          return rightLedger > leftLedger ? 1 : -1;
        }

        const byLabel = compareNames(left.requisiteLabel, right.requisiteLabel);
        if (byLabel !== 0) {
          return byLabel;
        }

        return compareNames(left.requisiteIdentity, right.requisiteIdentity);
      },
    );

    group.currencyTotals = Array.from(rowsByCurrency.entries())
      .map(([currency, currencyRows]) => ({
        available: sumAmountStrings(
          currencyRows.map((row) => row.available),
          currency,
        ),
        currency,
        inventoryAvailable: sumAmountStrings(
          currencyRows.map((row) => row.inventoryAvailable),
          currency,
        ),
        inventoryReserved: sumAmountStrings(
          currencyRows.map((row) => row.inventoryReserved),
          currency,
        ),
        ledgerBalance: sumAmountStrings(
          currencyRows.map((row) => row.ledgerBalance),
          currency,
        ),
        pending: sumAmountStrings(
          currencyRows.map((row) => row.pending),
          currency,
        ),
        reserved: sumAmountStrings(
          currencyRows.map((row) => row.reserved),
          currency,
        ),
      }))
      .sort((left: CurrencyTotals, right: CurrencyTotals) => {
        const leftLedger = absoluteMinor(
          toMinor(left.ledgerBalance, left.currency),
        );
        const rightLedger = absoluteMinor(
          toMinor(right.ledgerBalance, right.currency),
        );
        if (leftLedger !== rightLedger) {
          return rightLedger > leftLedger ? 1 : -1;
        }

        return compareNames(left.currency, right.currency);
      });
  }

  return organizations;
}

function formatShareLabel(value: number) {
  return `${value.toFixed(value >= 10 ? 0 : 1)}%`;
}

export function resolveTreasuryBalancesOrganizationId(
  rows: TreasuryOrganizationBalanceRow[],
  requestedOrganizationId?: string | null,
) {
  const organizations = groupBalancesByOrganization(rows);
  if (organizations.length === 0) {
    return null;
  }

  if (
    requestedOrganizationId &&
    organizations.some(
      (organization) =>
        organization.organizationId === requestedOrganizationId,
    )
  ) {
    return requestedOrganizationId;
  }

  return organizations[0]?.organizationId ?? null;
}

export function resolveTreasuryBalancesEvaluationCurrency(
  rows: TreasuryOrganizationBalanceRow[],
  selectedOrganizationId?: string | null,
  requestedEvaluationCurrency?: string | null,
) {
  if (!selectedOrganizationId) {
    return null;
  }

  const selectedOrganization = groupBalancesByOrganization(rows).find(
    (organization) => organization.organizationId === selectedOrganizationId,
  );
  if (!selectedOrganization) {
    return null;
  }

  const availableCurrencies = [
    DEFAULT_EVALUATION_CURRENCY,
    ...selectedOrganization.currencyTotals.map((total) =>
      total.currency.toUpperCase(),
    ),
  ].filter(
    (currency, index, currencies) => currencies.indexOf(currency) === index,
  );
  const normalizedRequestedCurrency = requestedEvaluationCurrency?.toUpperCase();
  if (
    normalizedRequestedCurrency &&
    availableCurrencies.includes(normalizedRequestedCurrency)
  ) {
    return normalizedRequestedCurrency;
  }

  return DEFAULT_EVALUATION_CURRENCY;
}

export function buildTreasuryBalancesDashboardViewModel(
  snapshot: TreasuryOrganizationBalancesSnapshot,
  options: BuildTreasuryBalancesDashboardViewModelOptions = {},
): TreasuryBalancesDashboardViewModel | null {
  const organizations = groupBalancesByOrganization(snapshot.data);
  if (organizations.length === 0) {
    return null;
  }

  const resolvedOrganizationId = resolveTreasuryBalancesOrganizationId(
    snapshot.data,
    options.selectedOrganizationId,
  );
  const selectedOrganization = organizations.find(
    (organization) => organization.organizationId === resolvedOrganizationId,
  );
  if (!selectedOrganization) {
    return null;
  }

  const resolvedEvaluationCurrency = resolveTreasuryBalancesEvaluationCurrency(
    snapshot.data,
    selectedOrganization.organizationId,
    options.selectedEvaluationCurrency,
  );
  if (!resolvedEvaluationCurrency) {
    return null;
  }

  const totalSelectedLedger = selectedOrganization.currencyTotals.reduce(
    (accumulator, total) =>
      accumulator + absoluteMinor(toMinor(total.ledgerBalance, total.currency)),
    0n,
  );
  const hasPositiveShareBasis = totalSelectedLedger > 0n;
  const currencyMix =
    selectedOrganization.currencyTotals.map((total, index, totals) => {
      const ledgerMinor = absoluteMinor(
        toMinor(total.ledgerBalance, total.currency),
      );
      const sharePercent = hasPositiveShareBasis
        ? Number((ledgerMinor * 1000n) / totalSelectedLedger) / 10
        : 100 / totals.length;

      return {
        currency: total.currency,
        ledgerBalance: total.ledgerBalance,
        shareLabel: formatShareLabel(sharePercent),
        sharePercent,
        toneIndex: getCurrencyToneIndex(total.currency),
      };
    });

  const selectedOrganizationMetrics = BALANCE_METRICS.map((metric) => ({
    key: metric.key,
    label: metric.label,
    values: selectedOrganization.currencyTotals.map((total) => ({
      amount: total[metric.key],
      currency: total.currency,
      toneIndex: getCurrencyToneIndex(total.currency),
    })),
  }));
  const totalEvaluation = options.totalEvaluation ?? {
    amount: null,
    currency: resolvedEvaluationCurrency,
    isComplete: true,
    missingCurrencies: [],
  };
  const evaluationCurrencyOptions = [
    DEFAULT_EVALUATION_CURRENCY,
    ...selectedOrganization.currencyTotals.map((total) => total.currency),
  ]
    .filter(
      (currency, index, currencies) => currencies.indexOf(currency) === index,
    )
    .map((currency) => ({
      currency,
      toneIndex: getCurrencyToneIndex(currency),
    }));

  const allOrganizationAccountGroups = organizations.map((organization) => {
    return {
      accountCount: organization.rows.length,
      anchorId: createAnchorId(organization.organizationId),
      currencies: organization.currencyTotals.map((total) => total.currency),
      isSelected: organization.organizationId === selectedOrganization.organizationId,
      organizationId: organization.organizationId,
      organizationName: organization.organizationName,
      rows: organization.rows.map((row) => ({
        ...row,
        anchorId: createAnchorId(organization.organizationId),
        isSelectedOrganization:
          organization.organizationId === selectedOrganization.organizationId,
        key: `${row.requisiteId}:${row.currency}`,
        toneIndex: getCurrencyToneIndex(row.currency),
      })),
    };
  });

  return {
    allAccountsRows: allOrganizationAccountGroups.flatMap(
      (organization) => organization.rows,
    ),
    allOrganizationAccountGroups,
    organizationOptions: organizations.map((organization) => ({
      organizationId: organization.organizationId,
      organizationName: organization.organizationName,
    })),
    selectedOrganizationMetrics,
    selectedOrganizationSummary: {
      asOf: snapshot.asOf,
      currencyCount: selectedOrganization.currencyTotals.length,
      currencyMix,
      evaluationCurrency: resolvedEvaluationCurrency,
      evaluationCurrencyOptions,
      organizationId: selectedOrganization.organizationId,
      organizationName: selectedOrganization.organizationName,
      requisitesCount: selectedOrganization.rows.length,
      totalEvaluation,
    },
  };
}
