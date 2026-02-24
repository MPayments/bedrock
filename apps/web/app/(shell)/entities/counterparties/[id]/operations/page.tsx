"use client";

import { useMemo, useState } from "react";
import { ArrowRightLeft, Plus } from "lucide-react";
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

import { formatDate, formatMoney } from "@/lib/format";

type TransactionStatus = "posted" | "processing" | "failed";
type TransactionType = "create" | "post_pending" | "void_pending";
type TransactionDirection = "debit" | "credit";

type OperationTransaction = {
  id: string;
  reference: string;
  provider: "TigerBeetle" | "BankingCore" | "StableProvider";
  type: TransactionType;
  direction: TransactionDirection;
  status: TransactionStatus;
  currency: "USD" | "EUR" | "RUB" | "USDT";
  amount: number;
  fee: number;
  createdAt: string;
};

const TRANSACTIONS: OperationTransaction[] = [
  {
    id: "tx_10041",
    reference: "pay-551902",
    provider: "TigerBeetle",
    type: "create",
    direction: "debit",
    status: "posted",
    currency: "USD",
    amount: 2100,
    fee: 10.5,
    createdAt: "2026-02-21T10:44:00Z",
  },
  {
    id: "tx_10042",
    reference: "pay-551903",
    provider: "TigerBeetle",
    type: "post_pending",
    direction: "credit",
    status: "processing",
    currency: "USD",
    amount: 1800,
    fee: 9,
    createdAt: "2026-02-21T10:18:00Z",
  },
  {
    id: "tx_10043",
    reference: "fxq-7891",
    provider: "BankingCore",
    type: "create",
    direction: "debit",
    status: "posted",
    currency: "EUR",
    amount: 950,
    fee: 3.2,
    createdAt: "2026-02-21T09:55:00Z",
  },
  {
    id: "tx_10044",
    reference: "settle-903",
    provider: "BankingCore",
    type: "void_pending",
    direction: "credit",
    status: "failed",
    currency: "RUB",
    amount: 123450,
    fee: 0,
    createdAt: "2026-02-21T09:21:00Z",
  },
  {
    id: "tx_10045",
    reference: "otc-2415",
    provider: "StableProvider",
    type: "create",
    direction: "debit",
    status: "posted",
    currency: "USDT",
    amount: 560.25,
    fee: 0.75,
    createdAt: "2026-02-20T18:42:00Z",
  },
  {
    id: "tx_10046",
    reference: "pay-551904",
    provider: "TigerBeetle",
    type: "create",
    direction: "credit",
    status: "processing",
    currency: "USD",
    amount: 420,
    fee: 2.1,
    createdAt: "2026-02-20T17:11:00Z",
  },
];

function statusMeta(status: TransactionStatus): {
  label: string;
  variant: "default" | "secondary" | "destructive";
} {
  if (status === "posted") return { label: "Проведена", variant: "default" };
  if (status === "processing") return { label: "В обработке", variant: "secondary" };
  return { label: "Ошибка", variant: "destructive" };
}

function typeLabel(type: TransactionType) {
  if (type === "create") return "Create";
  if (type === "post_pending") return "Post Pending";
  return "Void Pending";
}

export default function OrganizationOperationsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | TransactionStatus>("all");

  const filtered = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return TRANSACTIONS.filter((tx) => {
      const matchesStatus = status === "all" || tx.status === status;
      const matchesSearch =
        normalizedSearch.length === 0 ||
        tx.id.toLowerCase().includes(normalizedSearch) ||
        tx.reference.toLowerCase().includes(normalizedSearch);

      return matchesStatus && matchesSearch;
    });
  }, [search, status]);

  const totalsByCurrency = useMemo(
    () =>
      filtered.reduce<Record<string, number>>((acc, tx) => {
        acc[tx.currency] = (acc[tx.currency] ?? 0) + tx.amount;
        return acc;
      }, {}),
    [filtered],
  );

  const processingCount = filtered.filter((tx) => tx.status === "processing").length;
  const failedCount = filtered.filter((tx) => tx.status === "failed").length;

  return (
    <div className="flex flex-col gap-4">
      <Card className="rounded-sm">
        <CardHeader className="border-b">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <ArrowRightLeft className="size-4" />
                Операции и транзакции
              </CardTitle>
              <CardDescription>
                История проводок и технических транзакций организации.
              </CardDescription>
            </div>
            <Dialog>
              <DialogTrigger render={<Button />}>
                <Plus size={16} />
                Создать транзакцию
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Новая транзакция</DialogTitle>
                  <DialogDescription>
                    Создайте операцию для выбранного провайдера и валюты.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-3">
                  <Input placeholder="Reference (например: pay-552100)" />
                  <div className="grid gap-1.5">
                    <Select defaultValue="TigerBeetle">
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Провайдер" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="TigerBeetle">TigerBeetle</SelectItem>
                          <SelectItem value="BankingCore">BankingCore</SelectItem>
                          <SelectItem value="StableProvider">StableProvider</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Select defaultValue="create">
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Тип" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="create">Create</SelectItem>
                          <SelectItem value="post_pending">Post Pending</SelectItem>
                          <SelectItem value="void_pending">Void Pending</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    <Select defaultValue="debit">
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Сторона" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="debit">Debit</SelectItem>
                          <SelectItem value="credit">Credit</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <Select defaultValue="USD">
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Валюта" />
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
                    <Input type="number" placeholder="Сумма" />
                    <Input type="number" placeholder="Комиссия" />
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
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="bg-muted/30 rounded-lg border p-3">
              <div className="text-muted-foreground text-xs">Транзакций</div>
              <div className="mt-1 text-lg font-semibold">{filtered.length}</div>
            </div>
            <div className="bg-muted/30 rounded-lg border p-3">
              <div className="text-muted-foreground text-xs">В обработке</div>
              <div className="mt-1 text-lg font-semibold">{processingCount}</div>
            </div>
            <div className="bg-muted/30 rounded-lg border p-3">
              <div className="text-muted-foreground text-xs">С ошибкой</div>
              <div className="mt-1 text-lg font-semibold">{failedCount}</div>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Оборот по валютам</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(totalsByCurrency)
                .sort(([currencyA], [currencyB]) => currencyA.localeCompare(currencyB))
                .map(([currency, total]) => (
                  <Badge key={currency} variant="secondary" className="h-6 px-2.5">
                    {currency}: {formatMoney(total, currency)}
                  </Badge>
                ))}
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Поиск по tx id или reference"
              className="sm:col-span-2"
            />
            <Select
              value={status}
              onValueChange={(value) => setStatus(value as "all" | TransactionStatus)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Статус" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="all">Все статусы</SelectItem>
                  <SelectItem value="posted">Проведена</SelectItem>
                  <SelectItem value="processing">В обработке</SelectItem>
                  <SelectItem value="failed">Ошибка</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Провайдер</TableHead>
                <TableHead>Тип</TableHead>
                <TableHead>Сторона</TableHead>
                <TableHead className="text-right">Сумма</TableHead>
                <TableHead className="text-right">Комиссия</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead className="text-right">Создана</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-muted-foreground py-8 text-center">
                    Транзакции не найдены
                  </TableCell>
                </TableRow>
              )}

              {filtered.map((tx) => {
                const statusInfo = statusMeta(tx.status);

                return (
                  <TableRow key={tx.id}>
                    <TableCell className="font-medium">{tx.id}</TableCell>
                    <TableCell>{tx.reference}</TableCell>
                    <TableCell>{tx.provider}</TableCell>
                    <TableCell>{typeLabel(tx.type)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {tx.direction === "debit" ? "Debit" : "Credit"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatMoney(tx.amount, tx.currency)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatMoney(tx.fee, tx.currency)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                    </TableCell>
                    <TableCell className="text-right text-xs">
                      {formatDate(tx.createdAt)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
