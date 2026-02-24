"use client";

import { Plus, Wallet } from "lucide-react";
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
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@bedrock/ui/components/accordion";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@bedrock/ui/components/dialog";
import { Input } from "@bedrock/ui/components/input";
import { Label } from "@bedrock/ui/components/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@bedrock/ui/components/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@bedrock/ui/components/table";

import { formatDate } from "@/lib/format";

type OrganizationAccount = {
  id: string;
  name: string;
  provider: "TigerBeetle" | "BankingCore" | "StableProvider";
  kind: string;
  currency: "USD" | "EUR" | "RUB" | "USDT";
  available: number;
  reserved: number;
  status: "active" | "frozen";
  createdAt: string;
};

const ACCOUNTS: OrganizationAccount[] = [
  {
    id: "acct-usd-main",
    name: "Основной расчетный",
    provider: "TigerBeetle",
    kind: "Операционный",
    currency: "USD",
    available: 254390.32,
    reserved: 13000.0,
    status: "active",
    createdAt: "2026-02-21T10:44:00Z",
  },
  {
    id: "acct-usd-payout",
    name: "Выплаты клиентам",
    provider: "TigerBeetle",
    kind: "Платежный",
    currency: "USD",
    available: 78910.0,
    reserved: 5420.75,
    status: "active",
    createdAt: "2026-02-20T16:11:00Z",
  },
  {
    id: "acct-eur-settlement",
    name: "Settlement EUR",
    provider: "BankingCore",
    kind: "Settlement",
    currency: "EUR",
    available: 64110.45,
    reserved: 2499.5,
    status: "active",
    createdAt: "2026-02-21T08:03:00Z",
  },
  {
    id: "acct-rub-local",
    name: "Локальный RUB",
    provider: "BankingCore",
    kind: "Операционный",
    currency: "RUB",
    available: 8_930_100.0,
    reserved: 112_340.55,
    status: "active",
    createdAt: "2026-02-19T12:00:00Z",
  },
  {
    id: "acct-usdt-otc",
    name: "OTC ликвидность",
    provider: "StableProvider",
    kind: "Крипто",
    currency: "USDT",
    available: 48120.25,
    reserved: 0,
    status: "frozen",
    createdAt: "2026-02-14T09:22:00Z",
  },
];

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    const value = new Intl.NumberFormat("ru-RU", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);

    return `${value} ${currency}`;
  }
}

export default function OrganizationAccountsPage() {
  const groupedAccounts = ACCOUNTS.reduce<
    Record<string, OrganizationAccount[]>
  >((acc, account) => {
    if (!acc[account.provider]) {
      acc[account.provider] = [];
    }

    acc[account.provider]!.push(account);
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
                Балансы сгруппированы по провайдерам. Подытоги считаются по
                валютам без конвертации.
              </CardDescription>
            </div>
            <Dialog>
              <DialogTrigger render={<Button />}>
                <Plus size={16} />
                Добавить счет
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Новый счет</DialogTitle>
                  <DialogDescription>
                    Создайте дополнительный счет для этого контрагента.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor="new-account-name">Название счета</Label>
                    <Input
                      id="new-account-name"
                      placeholder="Например: Резервный USD"
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="new-account-currency">Валюта</Label>
                    <Select defaultValue="USD">
                      <SelectTrigger
                        id="new-account-currency"
                        className="w-full"
                      >
                        <SelectValue placeholder="Выберите валюту" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="USD">USD</SelectItem>
                          <SelectItem value="EUR">EUR</SelectItem>
                          <SelectItem value="RUB">RUB</SelectItem>
                          <SelectItem value="USDT">USDT</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <DialogClose render={<Button variant="outline" />}>
                    Отмена
                  </DialogClose>
                  <Button disabled>Создать</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Accordion multiple defaultValue={defaultOpenProviders}>
            {providerRows.map(([provider, accounts]) => {
              const totalsByProviderCurrency = accounts.reduce<Record<string, number>>(
                (acc, account) => {
                  acc[account.currency] =
                    (acc[account.currency] ?? 0) +
                    account.available +
                    account.reserved;
                  return acc;
                },
                {},
              );

              return (
                <AccordionItem key={provider} value={provider}>
                  <AccordionTrigger className="px-4 hover:no-underline">
                    <div className="flex flex-wrap items-center gap-2">
                      {provider}
                      <span className="text-muted-foreground text-sm">
                        {accounts.length}{" "}
                        {accounts.length === 1 ? "счет" : "счета"}
                      </span>
                      {Object.entries(totalsByProviderCurrency)
                        .sort(([currencyA], [currencyB]) =>
                          currencyA.localeCompare(currencyB),
                        )
                        .map(([currency, total]) => (
                          <Badge
                            key={currency}
                            variant="secondary"
                            className="h-5 px-2"
                          >
                            {currency}: {formatMoney(total, currency)}
                          </Badge>
                        ))}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="py-0 px-2">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Счет</TableHead>
                          <TableHead>Тип</TableHead>
                          <TableHead>Валюта</TableHead>
                          <TableHead className="text-right">Доступно</TableHead>
                          <TableHead className="text-right">Резерв</TableHead>
                          <TableHead className="text-right">Баланс</TableHead>
                          <TableHead>Статус</TableHead>
                          <TableHead className="text-right">Дата создания</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {accounts.map((account) => {
                          const total = account.available + account.reserved;

                          return (
                            <TableRow key={account.id}>
                              <TableCell className="font-medium">
                                <div className="flex flex-col">
                                  <span>{account.name}</span>
                                  <span className="text-muted-foreground text-xs">
                                    {account.id}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell>{account.kind}</TableCell>
                              <TableCell>{account.currency}</TableCell>
                              <TableCell className="text-right">
                                {formatMoney(
                                  account.available,
                                  account.currency,
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                {formatMoney(
                                  account.reserved,
                                  account.currency,
                                )}
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {formatMoney(total, account.currency)}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={
                                    account.status === "active"
                                      ? "default"
                                      : "secondary"
                                  }
                                  className="h-5"
                                >
                                  {account.status === "active"
                                    ? "Активен"
                                    : "Заморожен"}
                                </Badge>
                              </TableCell>
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
        </CardContent>
      </Card>
    </div>
  );
}
