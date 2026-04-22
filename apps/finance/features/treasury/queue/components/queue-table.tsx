import Link from "next/link";

import type { TreasuryExceptionQueueRow } from "@bedrock/deals/contracts";
import { Badge } from "@bedrock/sdk-ui/components/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@bedrock/sdk-ui/components/table";

import { formatMinorAmountWithCurrency } from "@/lib/format";

const KIND_LABELS: Record<TreasuryExceptionQueueRow["kind"], string> = {
  blocked_leg: "Заблокированный шаг",
  failed_instruction: "Неудачная инструкция",
  intercompany_imbalance: "Внутрикомпанейский дисбаланс",
  pre_funded_awaiting_collection: "Пре-фондирование",
  ready_leg: "Готовая к подготовке",
  reconciliation_mismatch: "Нестыковка сверки",
};

const KIND_VARIANTS: Record<
  TreasuryExceptionQueueRow["kind"],
  "default" | "secondary" | "destructive" | "outline"
> = {
  blocked_leg: "destructive",
  failed_instruction: "destructive",
  intercompany_imbalance: "secondary",
  pre_funded_awaiting_collection: "outline",
  ready_leg: "default",
  reconciliation_mismatch: "destructive",
};

function formatAge(ageSeconds: number): string {
  if (ageSeconds < 60) return `${ageSeconds}с`;
  const minutes = Math.floor(ageSeconds / 60);
  if (minutes < 60) return `${minutes}м`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}ч`;
  const days = Math.floor(hours / 24);
  return `${days}д`;
}

function formatAmount(row: TreasuryExceptionQueueRow): string {
  if (!row.amountMinor) return "—";
  if (!row.currencyCode) return row.amountMinor;
  return formatMinorAmountWithCurrency(row.amountMinor, row.currencyCode);
}

export interface TreasuryExceptionQueueTableProps {
  rows: TreasuryExceptionQueueRow[];
}

export function TreasuryExceptionQueueTable({
  rows,
}: TreasuryExceptionQueueTableProps) {
  if (rows.length === 0) {
    return (
      <div className="text-muted-foreground text-sm">
        Очередь пуста — нет исключений, требующих внимания.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Тип</TableHead>
          <TableHead>Сделка</TableHead>
          <TableHead>Нога</TableHead>
          <TableHead>Сумма</TableHead>
          <TableHead>Возраст</TableHead>
          <TableHead className="sr-only">Действия</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const key = [
            row.kind,
            row.dealId ?? "",
            row.instructionId ?? "",
            row.legIdx ?? "",
          ].join(":");
          return (
            <TableRow key={key}>
              <TableCell>
                <Badge variant={KIND_VARIANTS[row.kind]}>
                  {KIND_LABELS[row.kind]}
                </Badge>
              </TableCell>
              <TableCell>
                {row.dealId ? (
                  <Link
                    className="text-primary hover:underline"
                    href={`/treasury/deals/${row.dealId}`}
                  >
                    {row.dealRef ?? row.dealId.slice(0, 8)}
                  </Link>
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell>{row.legIdx ?? "—"}</TableCell>
              <TableCell>{formatAmount(row)}</TableCell>
              <TableCell>{formatAge(row.ageSeconds)}</TableCell>
              <TableCell>
                {row.dealId ? (
                  <Link
                    className="text-primary text-xs hover:underline"
                    href={`/treasury/deals/${row.dealId}`}
                  >
                    Открыть →
                  </Link>
                ) : null}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
