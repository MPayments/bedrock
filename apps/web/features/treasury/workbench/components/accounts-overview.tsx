import { Badge } from "@bedrock/sdk-ui/components/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";

import { getAccountsBalanceGlossary, presentTreasuryAccounts } from "../lib/presentation";
import type {
  TreasuryAccountBalanceListItem,
  TreasuryAccountListItem,
} from "../lib/queries";

function SummaryValue({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="space-y-1">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}

export function TreasuryAccountsOverview({
  accounts,
  balances,
  assetLabels,
  organizationLabels,
  providerLabels,
}: {
  accounts: TreasuryAccountListItem[];
  balances: TreasuryAccountBalanceListItem[];
  assetLabels: Record<string, string>;
  organizationLabels: Record<string, string>;
  providerLabels: Record<string, string>;
}) {
  const glossaryItems = getAccountsBalanceGlossary();
  const items = presentTreasuryAccounts({
    accounts,
    balances,
    labels: {
      assetLabels,
      organizationLabels,
      providerLabels,
    },
  });

  return (
    <div className="space-y-4">
      <Card className="rounded-sm">
        <CardHeader className="border-b">
          <CardTitle>Как читать остатки</CardTitle>
          <CardDescription>
            В карточках ниже сначала показан человеческий идентификатор счета, а
            затем — роль счета, провайдер и четыре bucket&apos;а остатка.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 pt-4 md:grid-cols-2 xl:grid-cols-4">
          {glossaryItems.map((item) => (
            <div key={item.label} className="rounded-xl border px-4 py-3">
              <div className="text-sm font-medium">{item.label}</div>
              <div className="text-muted-foreground mt-1 text-sm leading-6">
                {item.description}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {items.map((account) => (
          <Card key={account.id} className="rounded-sm">
            <CardHeader className="border-b">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle className="text-lg">{account.title}</CardTitle>
                  <CardDescription>{account.subtitle}</CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{account.kindLabel}</Badge>
                  {account.flags.map((flag) => (
                    <Badge key={flag} variant="secondary">
                      {flag}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="grid gap-4 md:grid-cols-2">
                <SummaryValue label="Владелец" value={account.ownerLabel} />
                <SummaryValue label="Оператор" value={account.operatorLabel} />
                <SummaryValue label="Провайдер" value={account.providerLabel} />
                <SummaryValue label="Рельс / сеть" value={account.railLabel} />
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {account.balances.map((balance) => (
                  <SummaryValue
                    key={`${account.id}-${balance.label}`}
                    label={balance.label}
                    value={balance.value}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
