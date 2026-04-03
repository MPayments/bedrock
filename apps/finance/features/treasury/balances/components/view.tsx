import {
  minorToAmountString,
  toMinorAmountString,
} from "@bedrock/shared/money";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";

import { formatDate } from "@/lib/format";

import type {
  TreasuryOrganizationBalanceRow,
  TreasuryOrganizationBalancesSnapshot,
} from "../lib/queries";

type CurrencyTotals = {
  available: string;
  currency: string;
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

const BALANCE_METRICS = [
  {
    key: "ledgerBalance",
    label: "Позиция",
  },
  {
    key: "available",
    label: "Доступно",
  },
  {
    key: "reserved",
    label: "Резерв",
  },
  {
    key: "pending",
    label: "В обработке",
  },
] as const;

function sumAmountStrings(values: string[], currency: string) {
  const totalMinor = values.reduce(
    (accumulator, value) =>
      accumulator + BigInt(toMinorAmountString(value, currency)),
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
      organizationId: row.organizationId,
      organizationName: row.organizationName,
      rows: [row],
      currencyTotals: [],
    });
  }

  for (const group of grouped.values()) {
    const rowsByCurrency = new Map<string, TreasuryOrganizationBalanceRow[]>();

    for (const row of group.rows) {
      const currentRows = rowsByCurrency.get(row.currency);
      if (currentRows) {
        currentRows.push(row);
        continue;
      }

      rowsByCurrency.set(row.currency, [row]);
    }

    group.currencyTotals = Array.from(rowsByCurrency.entries()).map(
      ([currency, currencyRows]) => ({
        currency,
        ledgerBalance: sumAmountStrings(
          currencyRows.map((row) => row.ledgerBalance),
          currency,
        ),
        available: sumAmountStrings(
          currencyRows.map((row) => row.available),
          currency,
        ),
        reserved: sumAmountStrings(
          currencyRows.map((row) => row.reserved),
          currency,
        ),
        pending: sumAmountStrings(
          currencyRows.map((row) => row.pending),
          currency,
        ),
      }),
    );
  }

  return Array.from(grouped.values());
}

export function TreasuryOrganizationBalancesView({
  snapshot,
}: {
  snapshot: TreasuryOrganizationBalancesSnapshot;
}) {
  const organizations = groupBalancesByOrganization(snapshot.data);

  if (organizations.length === 0) {
    return (
      <Card className="rounded-sm">
        <CardHeader className="border-b">
          <CardTitle>Балансы отсутствуют</CardTitle>
          <CardDescription>
            Срез на {formatDate(snapshot.asOf)}.
          </CardDescription>
        </CardHeader>
        <CardContent className="py-8 text-sm text-muted-foreground">
          Позиции treasury-организаций пока отсутствуют.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {organizations.map((organization) => (
        <Card key={organization.organizationId} className="rounded-sm">
          <CardHeader className="border-b">
            <CardTitle>{organization.organizationName}</CardTitle>
            <CardDescription>
              {organization.rows.length} позиций по реквизитам.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {organization.currencyTotals.map((total) => (
                <div
                  key={total.currency}
                  className="rounded-lg border bg-muted/30 px-4 py-3"
                >
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    {total.currency} · Итого
                  </div>
                  <div className="mt-3 space-y-2 text-sm">
                    {BALANCE_METRICS.map((metric) => (
                      <div
                        key={metric.key}
                        className="flex items-center justify-between gap-3"
                      >
                        <span className="text-muted-foreground">
                          {metric.label}
                        </span>
                        <span className="font-medium">
                          {total[metric.key]} {total.currency}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {organization.rows.map((row) => (
                <div
                  key={`${row.requisiteId}:${row.currency}`}
                  className="rounded-xl border bg-background/80 px-4 py-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="font-medium">{row.requisiteLabel}</div>
                      <div className="text-xs text-muted-foreground">
                        {row.requisiteIdentity}
                      </div>
                    </div>
                    <div className="rounded-full bg-muted px-2 py-1 text-xs font-medium">
                      {row.currency}
                    </div>
                  </div>

                  <div className="mt-4 space-y-2 text-sm">
                    {BALANCE_METRICS.map((metric) => (
                      <div
                        key={metric.key}
                        className="flex items-center justify-between gap-3"
                      >
                        <span className="text-muted-foreground">
                          {metric.label}
                        </span>
                        <span className="font-medium">
                          {row[metric.key]} {row.currency}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
