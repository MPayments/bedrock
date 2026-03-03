import Link from "next/link";
import { Plus, Wallet } from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@bedrock/ui/components/accordion";
import { Badge } from "@bedrock/ui/components/badge";
import { Button } from "@bedrock/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bedrock/ui/components/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@bedrock/ui/components/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@bedrock/ui/components/table";

import {
  getCounterpartyAccounts,
  getAccountBalances,
  type CounterpartyAccount,
  type AccountBalance,
} from "@/features/entities/counterparties/lib/queries";
import { formatAmount, formatDate } from "@/lib/format";

interface CounterpartyAccountsPageProps {
  params: Promise<{ id: string }>;
}

function getAccountsWord(value: number): string {
  const mod100 = value % 100;
  if (mod100 >= 11 && mod100 <= 14) {
    return "счетов";
  }

  const mod10 = value % 10;
  if (mod10 === 1) {
    return "счет";
  }
  if (mod10 >= 2 && mod10 <= 4) {
    return "счета";
  }

  return "счетов";
}

function resolveRequisites(account: CounterpartyAccount): string {
  const parts = [
    account.accountNo ? `№ ${account.accountNo}` : null,
    account.corrAccount ? `корр. ${account.corrAccount}` : null,
    account.iban ? `IBAN ${account.iban}` : null,
    account.address,
  ].filter((part): part is string => Boolean(part));

  if (parts.length === 0) {
    return "—";
  }

  return parts.join(" · ");
}

export default async function CounterpartyAccountsPage({
  params,
}: CounterpartyAccountsPageProps) {
  const { id } = await params;
  const accounts = await getCounterpartyAccounts(id);

  const balances = await getAccountBalances(accounts.map((a) => a.id));
  const balanceMap = new Map<string, AccountBalance[]>();
  for (const b of balances) {
    const list = balanceMap.get(b.counterpartyAccountId) ?? [];
    list.push(b);
    balanceMap.set(b.counterpartyAccountId, list);
  }

  const groupedAccounts = accounts.reduce<
    Record<string, CounterpartyAccount[]>
  >((acc, account) => {
    if (!acc[account.providerName]) {
      acc[account.providerName] = [];
    }

    acc[account.providerName]!.push(account);
    return acc;
  }, {});

  const providerRows = Object.entries(groupedAccounts).sort(
    ([providerA], [providerB]) => providerA.localeCompare(providerB),
  );
  const defaultOpenProviders = providerRows.map(([provider]) => provider);

  return (
    <div className="flex flex-col gap-4">
      <Card className="rounded-sm">
        <CardHeader className="border-b">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <Wallet className="size-4" />
                Счета контрагента
              </CardTitle>
              <CardDescription>
                Реальные счета, привязанные к текущему контрагенту.
              </CardDescription>
            </div>
            <Button
              nativeButton={false}
              render={
                <Link
                  href={{
                    pathname: "/entities/counterparty-accounts/create",
                    query: { counterpartyId: id },
                  }}
                />
              }
            >
              <Plus size={16} />
              Добавить счет
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {providerRows.length === 0 ? (
            <Empty className="border-dashed">
              <EmptyHeader>
                <EmptyTitle>Счета не найдены</EmptyTitle>
                <EmptyDescription>
                  Для этого контрагента пока нет счетов.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button
                  nativeButton={false}
                  render={
                    <Link
                      href={{
                        pathname: "/entities/counterparty-accounts/create",
                        query: { counterpartyId: id },
                      }}
                    />
                  }
                >
                  <Plus className="size-4" />
                  Создать первый счет
                </Button>
              </EmptyContent>
            </Empty>
          ) : (
            <Accordion multiple defaultValue={defaultOpenProviders}>
              {providerRows.map(([provider, providerAccounts]) => {
                const totalByCurrency = providerAccounts.reduce<
                  Record<string, { balanceMinor: bigint; precision: number }>
                >((acc, account) => {
                  const accountBalances = balanceMap.get(account.id) ?? [];
                  for (const b of accountBalances) {
                    const cur = b.currency;
                    const existing = acc[cur];
                    acc[cur] = {
                      balanceMinor:
                        (existing?.balanceMinor ?? 0n) + BigInt(b.balanceMinor),
                      precision: b.precision,
                    };
                  }
                  return acc;
                }, {});

                return (
                  <AccordionItem key={provider} value={provider}>
                    <AccordionTrigger className="px-4 hover:no-underline">
                      <div className="flex flex-wrap items-center gap-2">
                        {provider}
                        <span className="text-muted-foreground text-sm">
                          {providerAccounts.length}{" "}
                          {getAccountsWord(providerAccounts.length)}
                        </span>
                        {Object.entries(totalByCurrency)
                          .sort(([a], [b]) => a.localeCompare(b))
                          .map(([currency, { balanceMinor, precision }]) => (
                            <Badge
                              key={currency}
                              variant="secondary"
                              className="h-5 px-2 font-mono"
                            >
                              {currency}{" "}
                              {formatAmount(balanceMinor.toString(), precision)}
                            </Badge>
                          ))}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="py-0 px-2">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Счет</TableHead>
                            <TableHead>Валюта</TableHead>
                            <TableHead className="text-right">Баланс</TableHead>
                            <TableHead>Реквизиты</TableHead>
                            <TableHead>Стабильный ключ</TableHead>
                            <TableHead className="text-right">
                              Дата создания
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {providerAccounts.map((account) => {
                            const accountBalances =
                              balanceMap.get(account.id) ?? [];
                            return (
                              <TableRow key={account.id}>
                                <TableCell className="font-medium">
                                  <div className="flex flex-col">
                                    <Link
                                      href={`/entities/counterparty-accounts/${account.id}`}
                                      className="hover:underline"
                                    >
                                      {account.label}
                                    </Link>
                                    <span className="text-muted-foreground text-xs">
                                      {account.id}
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell>{account.currencyCode}</TableCell>
                                <TableCell className="text-right">
                                  {accountBalances.length === 0 ? (
                                    <span className="text-muted-foreground text-xs">
                                      —
                                    </span>
                                  ) : (
                                    <div className="flex flex-col items-end gap-0.5">
                                      {accountBalances
                                        .sort((a, b) =>
                                          a.currency.localeCompare(b.currency),
                                        )
                                        .map((b) => (
                                          <span
                                            key={b.currency}
                                            className="font-mono text-sm"
                                          >
                                            {formatAmount(
                                              b.balanceMinor,
                                              b.precision,
                                            )}{" "}
                                            <span className="text-muted-foreground">
                                              {b.currency}
                                            </span>
                                          </span>
                                        ))}
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell className="text-xs">
                                  {resolveRequisites(account)}
                                </TableCell>
                                <TableCell>{account.stableKey}</TableCell>
                                <TableCell className="text-right text-xs">
                                  {formatDate(account.createdAt)}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
