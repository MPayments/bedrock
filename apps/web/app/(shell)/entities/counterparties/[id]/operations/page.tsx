import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bedrock/ui/components/card";

import { OperationsJournalTable } from "@/features/operations/journal/components/operations-journal-table";
import { getOperations } from "@/features/operations/journal/lib/queries";
import { searchParamsCache } from "@/features/operations/journal/lib/validations";

interface CounterpartyOperationsPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CounterpartyOperationsPage({
  params,
  searchParams,
}: CounterpartyOperationsPageProps) {
  const { id } = await params;
  const parsedSearch = await searchParamsCache.parse(searchParams);

  const operations = await getOperations({
    ...parsedSearch,
    counterpartyId: id,
  });

  return (
    <div className="flex flex-col gap-4">
      <Card className="rounded-sm">
        <CardHeader className="border-b">
          <CardTitle>Операции контрагента</CardTitle>
          <CardDescription>
            Проводки и операции ledger, где книга принадлежит текущему
            контрагенту.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <p className="text-muted-foreground text-sm">
            Отображаются операции с фильтром <code>counterpartyId={id}</code> по
            аналитике проводок. Для полного журнала откройте{" "}
            <Link href="/operations/journal" className="underline">
              глобальный журнал операций
            </Link>
            .
          </p>
        </CardContent>
      </Card>

      <Card className="rounded-sm">
        <CardContent className="p-0">
          <OperationsJournalTable promise={Promise.resolve(operations)} />
        </CardContent>
      </Card>
    </div>
  );
}
