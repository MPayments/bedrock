import { CreditCard } from "lucide-react";

import { getDocuments } from "@/app/(shell)/operations/lib/queries";
import { RecentItemsCard } from "@/features/overview/ui/recent-items-card";
import { SectionOverviewPage } from "@/features/overview/ui/section-overview-page";

const ORDER_DOC_TYPES = [
  "payment_case",
  "payin_funding",
  "payout_initiate",
  "fee_payout_initiate",
  "external_funding",
  "fx_execute",
];

const SETTLEMENT_DOC_TYPES = [
  "payout_settle",
  "payout_void",
  "fee_payout_settle",
  "fee_payout_void",
];

function formatCount(value: number) {
  return value.toLocaleString("ru-RU");
}

export async function PaymentsOverviewPage() {
  const [orders, settlements, pendingApprovals, recent] = await Promise.all([
    getDocuments({ page: 1, perPage: 1, docType: ORDER_DOC_TYPES }),
    getDocuments({ page: 1, perPage: 1, docType: SETTLEMENT_DOC_TYPES }),
    getDocuments({
      page: 1,
      perPage: 1,
      docType: [...ORDER_DOC_TYPES, ...SETTLEMENT_DOC_TYPES],
      approvalStatus: ["pending"],
    }),
    getDocuments({
      page: 1,
      perPage: 5,
      docType: [...ORDER_DOC_TYPES, ...SETTLEMENT_DOC_TYPES],
    }),
  ]);

  return (
    <SectionOverviewPage
      icon={CreditCard}
      title="Платежи"
      description="Канонический workspace платежных ордеров и расчетов без промежуточных redirect-страниц."
      stats={[
        {
          id: "orders",
          label: "Ордера",
          value: formatCount(orders.total),
          description: "Инициированные платежные документы и funding workflow.",
          href: "/payments/orders",
        },
        {
          id: "settlements",
          label: "Расчеты",
          value: formatCount(settlements.total),
          description: "Settlement и void документы по платежным потокам.",
          href: "/payments/settlements",
        },
        {
          id: "pending",
          label: "Ждут согласования",
          value: formatCount(pendingApprovals.total),
          description: "Платежные документы в approval pending.",
          href: "/operations",
        },
      ]}
      links={[
        {
          id: "orders",
          title: "Платежные ордера",
          description: "Рабочий список документов инициирования и funding событий.",
          href: "/payments/orders",
          cta: "Открыть ордера",
        },
        {
          id: "settlements",
          title: "Расчеты",
          description: "Канонический список settlement/void событий по платежам.",
          href: "/payments/settlements",
          cta: "Открыть расчеты",
        },
        {
          id: "operations",
          title: "Общий журнал",
          description: "Переход в единый operations center для cross-check.",
          href: "/operations",
          cta: "Открыть журнал",
        },
      ]}
      aside={
        <RecentItemsCard
          title="Последние платежные документы"
          description="Быстрый доступ к активным кейсам и расчетам."
          items={recent.data.map((document) => ({
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
