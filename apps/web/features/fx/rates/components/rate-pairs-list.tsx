"use client";

import { useState } from "react";
import Link from "next/link";
import { ChartLine, ChevronDown, ChevronUp } from "lucide-react";

import { Button } from "@bedrock/ui/components/button";
import { Badge } from "@bedrock/ui/components/badge";
import {
  Card,
  CardContent,
} from "@bedrock/ui/components/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@bedrock/ui/components/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@bedrock/ui/components/table";

import { formatDate } from "@/lib/format";

import {
  formatChange,
  formatChangePercent,
  formatRate,
  sourceLabel,
} from "../lib/format";
import type {
  SerializedRatePair,
  SerializedSourceRate,
} from "../lib/queries";
import { FxSourceAvatar } from "./fx-source-avatar";
type RatePairsListProps = {
  initialPairs: SerializedRatePair[];
};

export function RatePairsList({ initialPairs }: RatePairsListProps) {
  return (
    <div className="flex flex-col gap-4">
      <h4 className="text-lg font-semibold">Пары валют</h4>

      {initialPairs.length === 0 ? (
        <p className="text-muted-foreground text-sm py-8 text-center">
          Нет данных о курсах. Синхронизируйте источники.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {initialPairs.map((pair) => (
            <RatePairItem
              key={`${pair.baseCurrencyCode}-${pair.quoteCurrencyCode}`}
              pair={pair}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RatePairItem({ pair }: { pair: SerializedRatePair }) {
  const [open, setOpen] = useState(false);
  const pairHref = `/fx/rates/${pair.baseCurrencyCode}-${pair.quoteCurrencyCode}`;

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="group/collapsible"
    >
      <Card className="rounded-sm">
        <CardContent className="flex flex-col gap-4 pt-0">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <PairSummary pair={pair} />

            <div className="flex flex-col gap-2 sm:min-w-[200px] sm:items-end">
              <Button
                variant="secondary"
                size="sm"
                className="w-full sm:w-auto"
                nativeButton={false}
                render={<Link href={pairHref} />}
              >
                <ChartLine className="h-4 w-4" />
                История курсов
              </Button>

              <CollapsibleTrigger
                render={
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-auto"
                  />
                }
              >
                {open ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
                {open ? "Скрыть источники" : "Показать источники"}
              </CollapsibleTrigger>
            </div>
          </div>

          <CollapsibleContent>
            <div className="border-t pt-4">
              <PairRatesTable rates={pair.rates} />
            </div>
          </CollapsibleContent>
        </CardContent>
      </Card>
    </Collapsible>
  );
}

function PairSummary({ pair }: { pair: SerializedRatePair }) {
  const rate = formatRate(pair.bestRate.rateNum, pair.bestRate.rateDen);
  const change = formatChange(pair.bestRate.change);

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-md bg-muted px-2.5 py-1 font-semibold">
          {pair.baseCurrencyCode} / {pair.quoteCurrencyCode}
        </span>
        <Badge variant="secondary" className="gap-1.5 text-xs">
          <FxSourceAvatar
            source={pair.bestRate.source}
            className="size-4 after:hidden"
          />
          {sourceLabel(pair.bestRate.source)}
        </Badge>
        <span className="text-muted-foreground text-xs">
          Обновлено {formatDate(pair.bestRate.asOf)}
        </span>
      </div>

      <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
        <div className="flex flex-col">
          <span className="text-muted-foreground text-xs">Лучший курс</span>
          <span className="font-mono text-2xl font-bold tabular-nums">
            {rate}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-muted-foreground text-xs">Изменение</span>
          <span className={`font-mono tabular-nums text-sm ${change.className}`}>
            {change.text}
          </span>
        </div>
      </div>
    </div>
  );
}

function PairRatesTable({ rates }: { rates: SerializedSourceRate[] }) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Источник</TableHead>
            <TableHead className="text-right">Курс</TableHead>
            <TableHead className="text-right">Изменение</TableHead>
            <TableHead className="text-right">Изменение %</TableHead>
            <TableHead className="text-right">Дата</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rates.map((rate) => {
            const change = formatChange(rate.change);
            const changePercent = formatChangePercent(rate.changePercent);

            return (
              <TableRow key={rate.source}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <FxSourceAvatar source={rate.source} size="sm" />
                    <span>{sourceLabel(rate.source)}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {formatRate(rate.rateNum, rate.rateDen)}
                </TableCell>
                <TableCell
                  className={`text-right font-mono tabular-nums ${change.className}`}
                >
                  {change.text}
                </TableCell>
                <TableCell
                  className={`text-right font-mono tabular-nums ${changePercent.className}`}
                >
                  {changePercent.text}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {formatDate(rate.asOf)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
