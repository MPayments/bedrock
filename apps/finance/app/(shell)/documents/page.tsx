import Link from "next/link";
import { FileText } from "lucide-react";

import { Button } from "@bedrock/sdk-ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";

import { DataTableSkeleton } from "@bedrock/sdk-tables-ui/components/data-table-skeleton";
import { EntityListPageShell } from "@/components/entities/entity-list-page-shell";
import { DocumentsTable } from "@/features/documents/components/documents-table";
import {
  getDocumentTypeLabel,
  getTypeListDocumentOptions,
} from "@/features/documents/lib/doc-types";
import { getDocuments } from "@/features/operations/documents/lib/queries";
import { RecentItemsCard } from "@/features/overview/ui/recent-items-card";
import { SectionOverviewPage } from "@/features/overview/ui/section-overview-page";
import { getServerSessionSnapshot } from "@/lib/auth/session";

function formatCount(value: number) {
  return value.toLocaleString("ru-RU");
}

function groupTitle(family: string): string {
  if (family === "transfers") return "Transfers";
  return "IFRS";
}

export default async function DocumentsPage() {
  const session = await getServerSessionSnapshot();
  const typeListOptions = getTypeListDocumentOptions(session.role);

  const [total, pending, recent] = await Promise.all([
    getDocuments({ page: 1, perPage: 1 }),
    getDocuments({
      page: 1,
      perPage: 1,
      postingStatus: ["unposted", "posting"],
      lifecycleStatus: ["active"],
    }),
    getDocuments({ page: 1, perPage: 5 }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <SectionOverviewPage
        icon={FileText}
        title="Документы"
        description="Выделенный раздел документов: общий журнал, создание и списки по типам."
        stats={[
          {
            id: "total",
            label: "Всего документов",
            value: formatCount(total.total),
            description: "Все типы документов, доступные через /v1/documents.",
            href: "/documents",
          },
          {
            id: "pending",
            label: "Ожидают проведения",
            value: formatCount(pending.total),
            description: "Active-документы в состояниях unposted/posting.",
            href: "/documents",
          },
          {
            id: "types",
            label: "Типов в UI",
            value: String(typeListOptions.length),
            description: "Списки и отдельные формы по IFRS-типам доступны ниже.",
          },
        ]}
        links={[
          {
            id: "create",
            title: "Создать документ",
            description:
              "Открыть раздел выбора typed-формы создания документа.",
            href: "/documents/create",
            cta: "Создать",
          },
          {
            id: "all",
            title: "Общий список",
            description:
              "Перейти к полному списку документов с текущими фильтрами.",
            href: "/documents",
            cta: "Открыть список",
          },
          {
            id: "journal",
            title: "Журнал проводок",
            description:
              "Переход к ledger operations, привязанным к posting lifecycle.",
            href: "/documents/journal",
            cta: "Открыть журнал",
          },
        ]}
        aside={
          <RecentItemsCard
            title="Последние документы"
            description="5 последних документов по всем типам."
            items={recent.data.map((document) => ({
              id: document.id,
              title: document.title,
              subtitle: `${document.docType} · ${document.docNo}`,
              href: `/documents/${document.docType}/${document.id}`,
            }))}
          />
        }
      />

      <DocumentTypeListsCard options={typeListOptions} />

      <EntityListPageShell
        icon={FileText}
        title="Общий список документов"
        description="Единый список с фильтрами и переходом к редактированию/действиям документа."
        actions={
          <Button
            nativeButton={false}
            render={<Link href="/documents/create" />}
          >
            Создать документ
          </Button>
        }
        fallback={
          <DataTableSkeleton columnCount={7} rowCount={10} filterCount={5} />
        }
      >
        <DocumentsTable
          promise={getDocuments({ page: 1, perPage: 20 })}
          routeBasePath="/documents"
        />
      </EntityListPageShell>
    </div>
  );
}

function DocumentTypeListsCard({
  options,
}: {
  options: ReturnType<typeof getTypeListDocumentOptions>;
}) {
  const grouped = new Map<string, typeof options>();

  for (const option of options) {
    const group = grouped.get(option.family) ?? [];
    group.push(option);
    grouped.set(option.family, group);
  }

  return (
    <Card className="rounded-sm">
      <CardHeader className="border-b">
        <CardTitle>Списки по типам</CardTitle>
        <CardDescription>
          Быстрые переходы к отдельным витринам документов по конкретному
          docType.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 py-6">
        {[...grouped.entries()].map(([family, options]) => (
          <div key={family} className="space-y-3">
            <p className="text-sm font-medium">{groupTitle(family)}</p>
            <div className="flex flex-wrap gap-2">
              {options.map((option) => (
                <Button
                  key={option.value}
                  variant="outline"
                  nativeButton={false}
                  render={<Link href={`/documents/${option.value}`} />}
                >
                  {getDocumentTypeLabel(option.value)}
                </Button>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
