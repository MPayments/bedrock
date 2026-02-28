import { ArrowRightLeft } from "lucide-react";

import { DataTableSkeleton } from "@/components/data-table/skeleton";
import { EntityListPageShell } from "@/components/entities/entity-list-page-shell";

import { CreateTransferDialog } from "./components/create-transfer-dialog";
import { TransfersPageClient } from "./components/transfers-page-client";
import { getTransferFormOptions, getTransfers } from "./lib/queries";
import { searchParamsCache } from "./lib/validations";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function OperationsTransfersPage({
  searchParams,
}: PageProps) {
  const parsedSearch = await searchParamsCache.parse(searchParams);

  const transfersPromise = getTransfers(parsedSearch);
  const formOptions = await getTransferFormOptions();

  return (
    <EntityListPageShell
      icon={ArrowRightLeft}
      title="Операции переводов"
      description="Черновики, approve/reject, pending settle/void и связь с ledger operation."
      actions={<CreateTransferDialog formOptions={formOptions} />}
      fallback={<DataTableSkeleton columnCount={10} rowCount={10} filterCount={4} />}
    >
      <TransfersPageClient
        promise={transfersPromise}
        currencies={formOptions.currencies}
      />
    </EntityListPageShell>
  );
}
