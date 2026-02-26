"use client";

import { Plus } from "lucide-react";

import { Badge } from "@bedrock/ui/components/badge";
import { Button } from "@bedrock/ui/components/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@bedrock/ui/components/accordion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@bedrock/ui/components/table";

import { formatDate } from "@/lib/format";

import { SOURCE_LABELS } from "../lib/constants";
import type { CurrencyOption, SerializedRatePair, SerializedSourceRate } from "../lib/queries";
import { SetManualRateDialog } from "./set-manual-rate-dialog";

function sourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? source;
}

function computeDecimalRate(rateNum: string, rateDen: string): number {
  return Number(rateNum) / Number(rateDen);
}

function formatRate(rateNum: string, rateDen: string): string {
  return computeDecimalRate(rateNum, rateDen).toFixed(6);
}

function formatChange(value: number | null): { text: string; className: string } {
  if (value === null) {
    return { text: "—", className: "text-muted-foreground" };
  }
  if (value > 0) {
    return { text: `+${value.toFixed(4)}`, className: "text-green-600" };
  }
  if (value < 0) {
    return { text: value.toFixed(4), className: "text-red-600" };
  }
  return { text: "0.0000", className: "text-muted-foreground" };
}

function formatChangePercent(value: number | null): { text: string; className: string } {
  if (value === null) {
    return { text: "—", className: "text-muted-foreground" };
  }
  if (value > 0) {
    return { text: `+${value.toFixed(2)}%`, className: "text-green-600" };
  }
  if (value < 0) {
    return { text: `${value.toFixed(2)}%`, className: "text-red-600" };
  }
  return { text: "0.00%", className: "text-muted-foreground" };
}

type RatePairsListProps = {
  initialPairs: SerializedRatePair[];
  currencies: CurrencyOption[];
};

export function RatePairsList({ initialPairs, currencies }: RatePairsListProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h4 className="text-lg font-semibold">Пары валют</h4>
        <SetManualRateDialog currencies={currencies}>
          <Button size="sm" variant="outline">
            <Plus className="h-4 w-4" />
            Добавить курс
          </Button>
        </SetManualRateDialog>
      </div>

      {initialPairs.length === 0 ? (
        <p className="text-muted-foreground text-sm py-8 text-center">
          Нет данных о курсах. Синхронизируйте источники.
        </p>
      ) : (
        <Accordion>
          {initialPairs.map((pair) => (
            <AccordionItem
              key={`${pair.baseCurrencyCode}-${pair.quoteCurrencyCode}`}
              value={`${pair.baseCurrencyCode}-${pair.quoteCurrencyCode}`}
            >
              <AccordionTrigger>
                <PairSummary pair={pair} />
              </AccordionTrigger>
              <AccordionContent>
                <PairRatesTable rates={pair.rates} />
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
}

function PairSummary({ pair }: { pair: SerializedRatePair }) {
  const rate = formatRate(pair.bestRate.rateNum, pair.bestRate.rateDen);
  const change = formatChange(pair.bestRate.change);

  return (
    <div className="flex flex-1 items-center gap-4 pr-2">
      <span className="font-semibold min-w-[100px]">
        {pair.baseCurrencyCode} / {pair.quoteCurrencyCode}
      </span>
      <span className="font-mono tabular-nums">{rate}</span>
      <span className={`font-mono tabular-nums text-xs ${change.className}`}>
        {change.text}
      </span>
      <Badge variant="secondary" className="text-xs">
        {sourceLabel(pair.bestRate.source)}
      </Badge>
      <span className="text-muted-foreground text-xs ml-auto hidden sm:block">
        {formatDate(pair.bestRate.asOf)}
      </span>
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
                  {sourceLabel(rate.source)}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {formatRate(rate.rateNum, rate.rateDen)}
                </TableCell>
                <TableCell className={`text-right font-mono tabular-nums ${change.className}`}>
                  {change.text}
                </TableCell>
                <TableCell className={`text-right font-mono tabular-nums ${changePercent.className}`}>
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
