import Link from "next/link";
import { Plus, Wallet } from "lucide-react";

import { Button } from "@multihansa/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@multihansa/ui/components/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@multihansa/ui/components/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@multihansa/ui/components/table";

import { getCounterpartyRequisitesForCounterparty } from "@/features/entities/counterparty-requisites/lib/queries";
import { formatDate } from "@/lib/format";

interface CounterpartyRequisitesPageProps {
  params: Promise<{ id: string }>;
}

export default async function CounterpartyRequisitesPage({
  params,
}: CounterpartyRequisitesPageProps) {
  const { id } = await params;
  const requisites = await getCounterpartyRequisitesForCounterparty(id);

  return (
    <Card className="rounded-sm">
      <CardHeader className="border-b">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <Wallet className="size-4" />
              Реквизиты контрагента
            </CardTitle>
            <CardDescription>
              Пользовательские реквизиты для платежей и документов.
            </CardDescription>
          </div>
          <Button
            nativeButton={false}
            render={
              <Link
                href={{
                  pathname: "/entities/parties/requisites/create",
                  query: { ownerType: "counterparty", ownerId: id },
                }}
              />
            }
          >
            <Plus size={16} />
            Добавить реквизит
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        {requisites.length === 0 ? (
          <Empty className="border-dashed">
            <EmptyHeader>
              <EmptyTitle>Реквизиты не найдены</EmptyTitle>
              <EmptyDescription>
                Для этого контрагента пока не создано ни одного реквизита.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button
                nativeButton={false}
                render={
                  <Link
                    href={{
                      pathname: "/entities/parties/requisites/create",
                      query: { ownerType: "counterparty", ownerId: id },
                    }}
                  />
                }
              >
                <Plus className="size-4" />
                Создать первый реквизит
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Название</TableHead>
                <TableHead>Вид</TableHead>
                <TableHead>Валюта</TableHead>
                <TableHead>Идентификатор</TableHead>
                <TableHead className="text-right">Обновлено</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requisites.map((requisite) => (
                <TableRow key={requisite.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/entities/parties/requisites/${requisite.id}`}
                      className="hover:underline"
                    >
                      {requisite.label}
                    </Link>
                  </TableCell>
                  <TableCell>{requisite.kindDisplay}</TableCell>
                  <TableCell>{requisite.currencyDisplay}</TableCell>
                  <TableCell>{requisite.identity || "—"}</TableCell>
                  <TableCell className="text-right">
                    {formatDate(requisite.updatedAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
