import { FileText } from "lucide-react";

import { getServerSessionSnapshot } from "@/lib/auth/session";
import { getDocuments } from "@/app/(shell)/operations/lib/queries";
import { getRateSources } from "@/app/(shell)/fx/rates/lib/queries";

import { SectionOverviewPage } from "@/features/overview/ui/section-overview-page";
import { RecentItemsCard } from "@/features/overview/ui/recent-items-card";

const PAYMENT_DOC_TYPES = [
  "payment_case",
  "payin_funding",
  "payout_initiate",
  "payout_settle",
  "payout_void",
  "fee_payout_initiate",
  "fee_payout_settle",
  "fee_payout_void",
  "external_funding",
  "fx_execute",
];

const TRANSFER_DOC_TYPES = ["transfer", "transfer_settle", "transfer_void"];

function formatCount(value: number) {
  return value.toLocaleString("ru-RU");
}

export async function DashboardPage() {
  const session = await getServerSessionSnapshot();
  const [recentDocuments, paymentDocuments, transferDocuments, sourceStatuses] =
    await Promise.all([
      getDocuments({ page: 1, perPage: 5 }),
      getDocuments({ page: 1, perPage: 1, docType: PAYMENT_DOC_TYPES }),
      getDocuments({ page: 1, perPage: 1, docType: TRANSFER_DOC_TYPES }),
      session.role === "admin" ? getRateSources() : Promise.resolve([]),
    ]);

  const staleSources = sourceStatuses.filter((source) => source.isExpired).length;

  return (
    <SectionOverviewPage
      icon={FileText}
      title="Рабочий стол"
      description="Быстрый доступ к ключевым потокам платформы, последним документам и текущей operational картине по роли."
      stats={[
        {
          id: "recent-documents",
          label: "Документы в работе",
          value: formatCount(recentDocuments.total),
          description: "Общий объем документов в едином журнале операций.",
          href: "/operations",
        },
        {
          id: "payments",
          label: "Платежные документы",
          value: formatCount(paymentDocuments.total),
          description: "Платежи и treasury документы на всех стадиях обработки.",
          href: "/payments",
        },
        {
          id: "transfers",
          label: "Переводы",
          value: formatCount(transferDocuments.total),
          description: "Переводы, сеттлы и void-события transfer workflow.",
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
                id: "payments",
                title: "Платежный workspace",
                description: "Order и settlement витрины без перехода через alias-страницы.",
                href: "/payments",
                cta: "Открыть платежи",
              },
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
                id: "payments",
                title: "Платежи",
                description: "Открыть платежные ордера и расчеты.",
                href: "/payments",
                cta: "Открыть платежи",
              },
              {
                id: "transfers",
                title: "Переводы",
                description: "Открыть transfer workflow и связанные документы.",
                href: "/transfers",
                cta: "Открыть переводы",
              },
              {
                id: "operations",
                title: "Операции",
                description: "Проверить статусы документов и ledger links.",
                href: "/operations",
                cta: "Открыть журнал",
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
            href: `/operations/${document.docType}/${document.id}`,
          }))}
        />
      }
    />
  );
}
