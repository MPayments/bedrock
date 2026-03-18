import * as React from "react";
import Link from "next/link";
import { Plus, Wallet } from "lucide-react";

import { Button } from "@bedrock/sdk-ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@bedrock/sdk-ui/components/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@bedrock/sdk-ui/components/table";

import { getOrganizationRequisitesForOrganization } from "@/features/entities/organization-requisites/lib/queries";
import { formatDate } from "@/lib/format";

interface OrganizationRequisitesPageProps {
  params: Promise<{ id: string }>;
}

export default async function OrganizationRequisitesPage({
  params,
}: OrganizationRequisitesPageProps) {
  const { id } = await params;
  const requisites = await getOrganizationRequisitesForOrganization(id);

  return (
    <Card className="rounded-sm">
      <CardHeader className="border-b">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <Wallet className="size-4" />
              Реквизиты организации
            </CardTitle>
            <CardDescription>
              Собственные реквизиты организации для платежей и документов.
            </CardDescription>
          </div>
          <Button
            nativeButton={false}
            render={
              <Link
                href={{
                  pathname: "/entities/requisites/create",
                  query: { ownerType: "organization", ownerId: id },
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
                Для этой организации пока не создано ни одного реквизита.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button
                nativeButton={false}
                render={
                  <Link
                    href={{
                      pathname: "/entities/requisites/create",
                      query: { ownerType: "organization", ownerId: id },
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
                      href={`/entities/requisites/${requisite.id}`}
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
