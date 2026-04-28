"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Archive } from "lucide-react";

import { Button } from "@bedrock/sdk-ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@bedrock/sdk-ui/components/table";
import { formatCompactId } from "@bedrock/shared/core/uuid";
import {
  formatFractionDecimal,
  minorToAmountString,
} from "@bedrock/shared/money";

import { EntityWorkspaceLayout } from "@/components/entities/workspace-layout";
import { formatDate } from "@/lib/format";
import { listCurrencyOptions } from "@/features/treasury/steps/lib/currency-options";
import { resolvePartyDisplayName } from "@/features/treasury/steps/lib/party-options";

import type { TreasuryInventoryPositionDetails } from "../lib/queries";

type TreasuryInventoryDetailsViewProps = {
  position: TreasuryInventoryPositionDetails;
};

const INVENTORY_STATE_LABELS: Record<
  TreasuryInventoryPositionDetails["state"],
  string
> = {
  cancelled: "Отменена",
  exhausted: "Исчерпана",
  open: "Доступна",
};

const ALLOCATION_STATE_LABELS: Record<
  TreasuryInventoryPositionDetails["allocations"][number]["state"],
  string
> = {
  consumed: "Использована",
  released: "Освобождена",
  reserved: "Зарезервирована",
};

export function TreasuryInventoryDetailsView({
  position,
}: TreasuryInventoryDetailsViewProps) {
  const codes = useCurrencyCodes();
  const [ownerLabel, setOwnerLabel] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    resolvePartyDisplayName(position.ownerPartyId).then((label) => {
      if (!cancelled) setOwnerLabel(label);
    });
    return () => {
      cancelled = true;
    };
  }, [position.ownerPartyId]);

  const acquiredCurrency = codes.get(position.currencyId);
  const costCurrency = codes.get(position.costCurrencyId);
  const impliedRate = formatFractionDecimal(
    position.costAmountMinor,
    position.acquiredAmountMinor,
    {
      scale: 8,
      trimTrailingZeros: true,
    },
  );

  return (
    <EntityWorkspaceLayout
      icon={Archive}
      title={`Позиция #${formatCompactId(position.id)}`}
      subtitle={`Инвентарь казначейства · ${INVENTORY_STATE_LABELS[position.state]}`}
      headerControls={
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<Link href={`/treasury/operations/orders/${position.sourceOrderId}`} />}
        >
          Ордер #{formatCompactId(position.sourceOrderId)}
        </Button>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(360px,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Сводка позиции</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <InfoLine
              label="Приобретено"
              value={formatAmount(
                position.acquiredAmountMinor,
                acquiredCurrency,
              )}
            />
            <InfoLine
              label="Доступно"
              value={formatAmount(
                position.availableAmountMinor,
                acquiredCurrency,
              )}
            />
            <InfoLine
              label="Себестоимость"
              value={formatAmount(position.costAmountMinor, costCurrency)}
            />
            <InfoLine
              label="Курс себестоимости"
              value={
                acquiredCurrency && costCurrency
                  ? `1 ${acquiredCurrency} = ${impliedRate} ${costCurrency}`
                  : impliedRate
              }
            />
            <InfoLine
              label="Владелец"
              value={ownerLabel ?? `#${formatCompactId(position.ownerPartyId)}`}
            />
            <InfoLine label="Статус" value={INVENTORY_STATE_LABELS[position.state]} />
            <InfoLine label="Создана" value={formatDate(position.createdAt)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Аллокации</CardTitle>
          </CardHeader>
          <CardContent>
            {position.allocations.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Сделка</TableHead>
                    <TableHead className="text-right">Сумма</TableHead>
                    <TableHead className="text-right">Cost basis</TableHead>
                    <TableHead>Статус</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {position.allocations.map((allocation) => (
                    <TableRow key={allocation.id}>
                      <TableCell>
                        <Link
                          href={`/treasury/deals/${allocation.dealId}`}
                          className="underline-offset-2 hover:underline"
                        >
                          #{formatCompactId(allocation.dealId)}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatAmount(allocation.amountMinor, acquiredCurrency)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatAmount(allocation.costAmountMinor, costCurrency)}
                      </TableCell>
                      <TableCell>
                        {ALLOCATION_STATE_LABELS[allocation.state]}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-muted-foreground text-sm">
                Эта позиция ещё не зарезервирована под сделки.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </EntityWorkspaceLayout>
  );
}

function useCurrencyCodes() {
  const [codes, setCodes] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    let cancelled = false;
    listCurrencyOptions().then((options) => {
      if (!cancelled) {
        setCodes(new Map(options.map((option) => [option.id, option.code])));
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return codes;
}

function formatAmount(amountMinor: string, currency: string | undefined) {
  if (!currency) return amountMinor;
  return `${minorToAmountString(amountMinor, { currency })} ${currency}`;
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
