"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChartLine, ChevronDown, ChevronUp } from "lucide-react";

import { Button } from "@multihansa/ui/components/button";
import { Badge } from "@multihansa/ui/components/badge";
import {
  Card,
  CardContent,
} from "@multihansa/ui/components/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@multihansa/ui/components/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@multihansa/ui/components/table";

import { formatDate } from "@/lib/format";

import {
  formatChange,
  formatChangePercent,
  formatRate,
  sourceLabel,
} from "../lib/format";
import type {
  CurrencyOption,
  SerializedRatePair,
  SerializedSourceRate,
} from "../lib/queries";
import {
  CurrencyFacetedFilter,
  type CurrencyFacetOption,
} from "./currency-faceted-filter";
import { FxSourceAvatar } from "./fx-source-avatar";

type RatePairsListProps = {
  currencies: CurrencyOption[];
  initialPairs: SerializedRatePair[];
};

export function RatePairsList({
  currencies,
  initialPairs,
}: RatePairsListProps) {
  const [selectedBaseCurrencyCode, setSelectedBaseCurrencyCode] = useState<
    string | undefined
  >();
  const [selectedQuoteCurrencyCode, setSelectedQuoteCurrencyCode] = useState<
    string | undefined
  >();

  const currencyNameByCode = useMemo(
    () =>
      new Map(
        currencies.map((currency) => [currency.code.toUpperCase(), currency.name]),
      ),
    [currencies],
  );
  const baseOptions = useMemo(
    () =>
      buildCurrencyFacetOptions(
        selectedQuoteCurrencyCode
          ? initialPairs.filter(
              (pair) => pair.quoteCurrencyCode === selectedQuoteCurrencyCode,
            )
          : initialPairs,
        (pair) => pair.baseCurrencyCode,
        currencyNameByCode,
      ),
    [currencyNameByCode, initialPairs, selectedQuoteCurrencyCode],
  );
  const quoteOptions = useMemo(
    () =>
      buildCurrencyFacetOptions(
        selectedBaseCurrencyCode
          ? initialPairs.filter(
              (pair) => pair.baseCurrencyCode === selectedBaseCurrencyCode,
            )
          : initialPairs,
        (pair) => pair.quoteCurrencyCode,
        currencyNameByCode,
      ),
    [currencyNameByCode, initialPairs, selectedBaseCurrencyCode],
  );
  const filteredPairs = useMemo(
    () =>
      initialPairs.filter((pair) => {
        if (
          selectedBaseCurrencyCode &&
          pair.baseCurrencyCode !== selectedBaseCurrencyCode
        ) {
          return false;
        }

        if (
          selectedQuoteCurrencyCode &&
          pair.quoteCurrencyCode !== selectedQuoteCurrencyCode
        ) {
          return false;
        }

        return true;
      }),
    [initialPairs, selectedBaseCurrencyCode, selectedQuoteCurrencyCode],
  );
  const hasActiveFilters =
    selectedBaseCurrencyCode !== undefined ||
    selectedQuoteCurrencyCode !== undefined;

  function handleResetFilters() {
    setSelectedBaseCurrencyCode(undefined);
    setSelectedQuoteCurrencyCode(undefined);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h4 className="text-lg font-semibold">Пары валют</h4>

          {initialPairs.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <CurrencyFacetedFilter
                title="Базовая валюта"
                placeholder="Поиск базовой валюты..."
                options={baseOptions}
                value={selectedBaseCurrencyCode}
                onChange={setSelectedBaseCurrencyCode}
              />
              <CurrencyFacetedFilter
                title="Валюта котировки"
                placeholder="Поиск валюты котировки..."
                options={quoteOptions}
                value={selectedQuoteCurrencyCode}
                onChange={setSelectedQuoteCurrencyCode}
              />
              {hasActiveFilters ? (
                <Button variant="ghost" size="sm" onClick={handleResetFilters}>
                  Сбросить
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>

        {initialPairs.length > 0 ? (
          <p className="text-muted-foreground text-sm">
            Показано {filteredPairs.length} из {initialPairs.length}
          </p>
        ) : null}
      </div>

      {initialPairs.length === 0 ? (
        <p className="text-muted-foreground text-sm py-8 text-center">
          Нет данных о курсах. Синхронизируйте источники.
        </p>
      ) : filteredPairs.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="text-muted-foreground text-sm">
            По выбранным валютам пары не найдены.
          </p>
          <Button variant="outline" size="sm" onClick={handleResetFilters}>
            Сбросить фильтры
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredPairs.map((pair) => (
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

function buildCurrencyFacetOptions(
  pairs: SerializedRatePair[],
  selectCurrencyCode: (pair: SerializedRatePair) => string,
  currencyNameByCode: Map<string, string>,
): CurrencyFacetOption[] {
  const countsByCode = new Map<string, number>();

  for (const pair of pairs) {
    const currencyCode = selectCurrencyCode(pair);
    countsByCode.set(currencyCode, (countsByCode.get(currencyCode) ?? 0) + 1);
  }

  return Array.from(countsByCode.entries())
    .map(([value, count]) => ({
      count,
      name: currencyNameByCode.get(value) ?? value,
      value,
    }))
    .sort((left, right) => left.value.localeCompare(right.value));
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
          <span className="font-mono text-xl font-bold tabular-nums">
            {rate}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-muted-foreground text-xs">Изменение</span>
          <span className={`font-mono tabular-nums  text-xl  ${change.className}`}>
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
