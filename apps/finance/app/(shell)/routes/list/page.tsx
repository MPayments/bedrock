import Link from "next/link";
import { GitBranch } from "lucide-react";

import { Button } from "@bedrock/sdk-ui/components/button";
import { DataTableSkeleton } from "@bedrock/sdk-tables-ui/components/data-table-skeleton";
import { EntityListPageShell } from "@/components/entities/entity-list-page-shell";
import { PaymentRoutesTable } from "@/features/payment-routes/components/list-table";
import {
  getPaymentRouteConstructorOptions,
  getPaymentRoutesList,
} from "@/features/payment-routes/lib/queries";
import { searchParamsCache } from "@/features/payment-routes/lib/validations";

interface PaymentRoutesListPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PaymentRoutesListPage({
  searchParams,
}: PaymentRoutesListPageProps) {
  const parsedSearch = await searchParamsCache.parse(searchParams);
  const options = await getPaymentRouteConstructorOptions();
  const promise = getPaymentRoutesList(parsedSearch);

  return (
    <EntityListPageShell
      icon={GitBranch}
      title="Список маршрутов"
      description="Каталог route templates для treasury-операций, обменов, intercompany и payout-сценариев."
      actions={
        <Button nativeButton={false} render={<Link href="/routes/constructor" />}>
          Конструктор маршрута
        </Button>
      }
      fallback={<DataTableSkeleton columnCount={8} rowCount={10} filterCount={2} />}
    >
      <PaymentRoutesTable currencies={options.currencies} promise={promise} />
    </EntityListPageShell>
  );
}
