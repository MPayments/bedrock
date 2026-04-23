import { Vault } from "lucide-react";

import type {
  TreasuryExceptionQueueRow,
  TreasuryExceptionQueueRowKind,
} from "@bedrock/deals/contracts";

import { getTreasuryExceptionQueue } from "@/features/treasury/queue/lib/queries";
import { TreasuryQueueFilterBar } from "@/features/treasury/queue/components/queue-filter-bar";
import { TreasuryExceptionQueueGrouped } from "@/features/treasury/queue/components/queue-grouped-table";
import { TreasuryExceptionQueueTable } from "@/features/treasury/queue/components/queue-table";

interface PageProps {
  searchParams?: Promise<{
    currencyCode?: string;
    dealId?: string;
    internalEntityOrganizationId?: string;
    kind?: string;
    view?: string;
  }>;
}

const QUEUE_ROW_KINDS: ReadonlySet<TreasuryExceptionQueueRowKind> = new Set([
  "blocked_leg",
  "failed_instruction",
  "intercompany_imbalance",
  "pre_funded_awaiting_collection",
  "ready_leg",
  "reconciliation_mismatch",
]);

function parseKind(value?: string): TreasuryExceptionQueueRowKind | undefined {
  if (!value) return undefined;
  return QUEUE_ROW_KINDS.has(value as TreasuryExceptionQueueRowKind)
    ? (value as TreasuryExceptionQueueRowKind)
    : undefined;
}

function parseView(value?: string): "flat" | "grouped" {
  return value === "grouped" ? "grouped" : "flat";
}

export default async function TreasuryQueuePage({ searchParams }: PageProps) {
  const resolved = (await searchParams) ?? {};
  const kind = parseKind(resolved.kind);
  const view = parseView(resolved.view);
  const rows: TreasuryExceptionQueueRow[] = await getTreasuryExceptionQueue({
    currencyCode: resolved.currencyCode,
    dealId: resolved.dealId,
    internalEntityOrganizationId: resolved.internalEntityOrganizationId,
    kind,
  });

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Vault className="text-muted-foreground h-6 w-6" />
        <div>
          <h1 className="text-2xl font-semibold">
            Очередь исключений казначейства
          </h1>
          <p className="text-muted-foreground text-sm">
            Единая очередь готовых, заблокированных и проблемных операций по
            сделкам.
          </p>
        </div>
      </div>

      <TreasuryQueueFilterBar rows={rows} view={view} />

      {view === "grouped" ? (
        <TreasuryExceptionQueueGrouped rows={rows} />
      ) : (
        <TreasuryExceptionQueueTable rows={rows} />
      )}
    </div>
  );
}
