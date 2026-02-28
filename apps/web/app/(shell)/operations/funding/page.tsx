import { Landmark } from "lucide-react";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bedrock/ui/components/card";

import { DataTableSkeleton } from "@/components/data-table/skeleton";
import { EntityListPageShell } from "@/components/entities/entity-list-page-shell";
import { OperationsJournalTable } from "@/app/(shell)/operations/journal/components/operations-journal-table";
import { getOperations } from "@/app/(shell)/operations/journal/lib/queries";
import { searchParamsCache } from "@/app/(shell)/operations/journal/lib/validations";

import { CreateFundingDialog } from "./components/create-funding-dialog";
import { getExternalFundingFormOptions } from "./lib/queries";

interface OperationsFundingPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function OperationsFundingPage({
  searchParams,
}: OperationsFundingPageProps) {
  const parsedSearch = await searchParamsCache.parse(searchParams);

  const formOptionsPromise = getExternalFundingFormOptions();
  const fundingOperationsPromise = getOperations({
    ...parsedSearch,
    sourceType: ["treasury/external_funding"],
  });
  const formOptions = await formOptionsPromise;

  return (
    <EntityListPageShell
      icon={Landmark}
      title="Внешнее пополнение"
      description="Ввод средств извне, депозитов клиентов и начальных остатков."
      actions={<CreateFundingDialog formOptions={formOptions} />}
      fallback={
        <DataTableSkeleton columnCount={8} rowCount={10} filterCount={4} />
      }
    >
      <Card className="rounded-sm">
        <CardHeader className="border-b">
          <CardTitle>Журнал пополнений</CardTitle>
          <CardDescription>
            Отображаются операции, созданные сценарием внешнего пополнения и
            ввода начального остатка.
          </CardDescription>
        </CardHeader>
      </Card>
      <OperationsJournalTable promise={fundingOperationsPromise} />
    </EntityListPageShell>
  );
}
