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
  type CounterpartyAccount,
} from "@/app/(shell)/entities/counterparties/lib/queries";
import { formatDate } from "@/lib/format";

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
                    pathname: "/entities/accounts/create",
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
                        pathname: "/entities/accounts/create",
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
                const countByCurrency = providerAccounts.reduce<
                  Record<string, number>
                >((acc, account) => {
                  acc[account.currencyCode] =
                    (acc[account.currencyCode] ?? 0) + 1;
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
                        {Object.entries(countByCurrency)
                          .sort(([currencyA], [currencyB]) =>
                            currencyA.localeCompare(currencyB),
                          )
                          .map(([currency, count]) => (
                            <Badge
                              key={currency}
                              variant="secondary"
                              className="h-5 px-2"
                            >
                              {currency}: {count}
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
                            <TableHead>Реквизиты</TableHead>
                            <TableHead>Стабильный ключ</TableHead>
                            <TableHead className="text-right">
                              Дата создания
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {providerAccounts.map((account) => (
                            <TableRow key={account.id}>
                              <TableCell className="font-medium">
                                <div className="flex flex-col">
                                  <Link
                                    href={`/entities/accounts/${account.id}`}
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
                              <TableCell className="text-xs">
                                {resolveRequisites(account)}
                              </TableCell>
                              <TableCell>{account.stableKey}</TableCell>
                              <TableCell className="text-right text-xs">
                                {formatDate(account.createdAt)}
                              </TableCell>
                            </TableRow>
                          ))}
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
