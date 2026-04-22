import { Vault } from "lucide-react";

import { getTreasuryExceptionQueue } from "@/features/treasury/queue/lib/queries";
import { TreasuryExceptionQueueTable } from "@/features/treasury/queue/components/queue-table";

interface PageProps {
  searchParams?: Promise<{
    currencyCode?: string;
    dealId?: string;
    internalEntityOrganizationId?: string;
    kind?: string;
  }>;
}

export default async function TreasuryQueuePage({ searchParams }: PageProps) {
  const resolved = (await searchParams) ?? {};
  const rows = await getTreasuryExceptionQueue({
    currencyCode: resolved.currencyCode,
    dealId: resolved.dealId,
    internalEntityOrganizationId: resolved.internalEntityOrganizationId,
    kind: resolved.kind as never,
  });

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Vault className="text-muted-foreground h-6 w-6" />
        <div>
          <h1 className="text-2xl font-semibold">Очередь исключений казначейства</h1>
          <p className="text-muted-foreground text-sm">
            Единая очередь готовых, заблокированных и проблемных операций по
            сделкам.
          </p>
        </div>
      </div>

      <TreasuryExceptionQueueTable rows={rows} />
    </div>
  );
}
