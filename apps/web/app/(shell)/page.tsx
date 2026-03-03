import { FileText } from "lucide-react";

import { requirePageAudience } from "@/lib/auth/session";
import { getDocuments } from "@/features/operations/documents/lib/queries";
import { getRateSources } from "@/features/fx/rates/lib/queries";

import { SectionOverviewPage } from "@/features/overview/ui/section-overview-page";
import { RecentItemsCard } from "@/features/overview/ui/recent-items-card";

const TRANSFER_DOC_TYPES = [
  "transfer_intra",
  "transfer_intercompany",
  "transfer_resolution",
];

function formatCount(value: number) {
  return value.toLocaleString("ru-RU");
}

export default async function DashboardPage() {
  const session = await requirePageAudience("user");
  const [recentDocuments, transferDocuments, sourceStatuses] = await Promise.all([
    getDocuments({ page: 1, perPage: 5 }),
    getDocuments({ page: 1, perPage: 1, docType: TRANSFER_DOC_TYPES }),
    session.role === "admin" ? getRateSources() : Promise.resolve([]),
  ]);

  const staleSources = sourceStatuses.filter((source) => source.isExpired).length;

  return (
    <SectionOverviewPage
      icon={FileText}
      title="Рабочий стол"
      description="Быстрый доступ к ключевым потокам платформы, последним документам и текущей картине по роли."
      stats={[
        {
          id: "recent-documents",
          label: "Документы в работе",
          value: formatCount(recentDocuments.total),
          description: "Общий объем документов в едином списке.",
          href: "/documents",
        },
        {
          id: "transfers",
          label: "Переводы",
          value: formatCount(transferDocuments.total),
          description:
            "Внутренние/межкомпанейские переводы и документы transfer_resolution.",
          href: "/transfers",
        },
        {
          id: "fx",
          label: session.role === "admin" ? "FX-источники" : "Роль",
          value:
            session.role === "admin"
              ? formatCount(sourceStatuses.length)
              : "User",
          description:
            session.role === "admin"
              ? staleSources > 0
                ? `Просроченных источников: ${formatCount(staleSources)}`
                : "Все источники FX актуальны в пределах TTL."
              : "Административные разделы доступны по роли.",
          href: session.role === "admin" ? "/fx" : undefined,
        },
      ]}
      links={
        session.role === "admin"
          ? [
              {
                id: "entities",
                title: "Справочники",
                description: "Клиенты, контрагенты, провайдеры, счета и валюты.",
                href: "/entities",
                cta: "Открыть справочники",
              },
              {
                id: "accounting",
                title: "Бухгалтерия",
                description: "План счетов, корреспонденция и финансовый результат.",
                href: "/accounting",
                cta: "Открыть бухгалтерию",
              },
            ]
          : [
              {
                id: "transfers",
                title: "Переводы",
                description: "Открыть transfer workflow и связанные документы.",
                href: "/transfers",
                cta: "Открыть переводы",
              },
              {
                id: "documents",
                title: "Документы",
                description: "Проверить статусы документов и связанные ссылки.",
                href: "/documents",
                cta: "Открыть документы",
              },
            ]
      }
      aside={
        <RecentItemsCard
          title="Последние документы"
          description="Срез последних операций без дополнительной фильтрации."
          items={recentDocuments.data.slice(0, 5).map((document) => ({
            id: document.id,
            title: document.title,
            subtitle: `${document.docType} · ${document.docNo}`,
            href: `/documents/${document.docType}/${document.id}`,
          }))}
        />
      }
    />
  );
}
