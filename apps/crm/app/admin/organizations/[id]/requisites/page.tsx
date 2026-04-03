"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ChevronLeft,
  Plus,
  Wallet,
} from "lucide-react";

import { Badge } from "@bedrock/sdk-ui/components/badge";
import { Button } from "@bedrock/sdk-ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
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

import { API_BASE_URL } from "@/lib/constants";

interface Organization {
  id: string;
  shortName: string;
  fullName: string;
}

interface RequisiteRow {
  id: string;
  label: string;
  institutionName: string | null;
  accountNo: string | null;
  bic: string | null;
  swift: string | null;
  isDefault: boolean;
  updatedAt: string;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("ru-RU");
}

export default function OrganizationRequisitesPage() {
  const params = useParams();
  const router = useRouter();
  const organizationId = params?.id as string;

  const [organization, setOrganization] = useState<Organization | null>(null);
  const [requisites, setRequisites] = useState<RequisiteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!organizationId) return;

    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        const [organizationRes, requisitesRes] = await Promise.all([
          fetch(`${API_BASE_URL}/organizations/${organizationId}`, {
            credentials: "include",
          }),
          fetch(
            `${API_BASE_URL}/requisites?ownerType=organization&ownerId=${organizationId}&kind=bank&limit=100&offset=0`,
            {
              credentials: "include",
            },
          ),
        ]);

        if (!organizationRes.ok) {
          throw new Error("Не удалось загрузить организацию");
        }

        if (!requisitesRes.ok) {
          throw new Error("Не удалось загрузить реквизиты");
        }

        const organizationPayload = await organizationRes.json();
        const requisitesPayload = await requisitesRes.json();
        const rows = Array.isArray(requisitesPayload)
          ? requisitesPayload
          : requisitesPayload.data ?? [];

        setOrganization(organizationPayload);
        setRequisites(rows);
      } catch (err) {
        console.error("Organization requisites fetch error:", err);
        setError(
          err instanceof Error ? err.message : "Не удалось загрузить реквизиты",
        );
      } finally {
        setLoading(false);
      }
    }

    void fetchData();
  }, [organizationId]);

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center text-muted-foreground">
        Загрузка...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ChevronLeft className="mr-2 h-4 w-4" />
            Назад
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Реквизиты организации</h1>
            <p className="text-sm text-muted-foreground">
              {organization?.shortName ?? "Организация"}
            </p>
          </div>
        </div>

        <Button
          onClick={() =>
            router.push(`/admin/organizations/${organizationId}/requisites/new`)
          }
        >
          <Plus className="mr-2 h-4 w-4" />
          Добавить реквизит
        </Button>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            Банковские реквизиты
          </CardTitle>
          <CardDescription>
            Канонические реквизиты организации используются в договорах,
            сделках и генерации документов.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {requisites.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              У организации пока нет банковских реквизитов.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Название</TableHead>
                  <TableHead>Банк</TableHead>
                  <TableHead>Счёт</TableHead>
                  <TableHead>BIC / SWIFT</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead className="text-right">Обновлено</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requisites.map((requisite) => (
                  <TableRow
                    key={requisite.id}
                    className="cursor-pointer"
                    onClick={() =>
                      router.push(
                        `/admin/organizations/${organizationId}/requisites/${requisite.id}`,
                      )
                    }
                  >
                    <TableCell className="font-medium">
                      {requisite.label}
                    </TableCell>
                    <TableCell>{requisite.institutionName || "—"}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {requisite.accountNo || "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {requisite.bic || requisite.swift || "—"}
                    </TableCell>
                    <TableCell>
                      {requisite.isDefault ? (
                        <Badge>По умолчанию</Badge>
                      ) : (
                        <Badge variant="secondary">Активный</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {formatDate(requisite.updatedAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
