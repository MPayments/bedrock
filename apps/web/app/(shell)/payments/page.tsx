import { CreditCard } from "lucide-react";

import { RecentItemsCard } from "@/features/overview/ui/recent-items-card";
import { SectionOverviewPage } from "@/features/overview/ui/section-overview-page";
import { listPayments } from "@/features/payments/lib/api";

function formatCount(value: number) {
  return value.toLocaleString("ru-RU");
}

export default async function PaymentsOverviewPage() {
  const [orders, settlements, recent] = await Promise.all([
    listPayments({ kind: "intent", limit: 1, offset: 0 }),
    listPayments({ kind: "resolution", limit: 1, offset: 0 }),
    listPayments({ kind: "all", limit: 5, offset: 0 }),
  ]);

  return (
    <SectionOverviewPage
      icon={CreditCard}
      title="Платежи"
      description="Канонический workspace платежных ордеров и расчетов без промежуточных redirect-страниц."
      stats={[
        {
          id: "orders",
          label: "Интенты",
          value: formatCount(orders.total),
          description: "Инициированные платежи (`payment_intent`).",
          href: "/treasury/payments/orders",
        },
        {
          id: "settlements",
          label: "Резолюшены",
          value: formatCount(settlements.total),
          description: "Системные результаты (`payment_resolution`).",
          href: "/treasury/payments/settlements",
        },
        {
          id: "pending",
          label: "Последние",
          value: formatCount(recent.data.length),
          description: "Количество записей в оперативном срезе.",
          href: "/treasury/payments/orders",
        },
      ]}
      links={[
        {
          id: "orders",
          title: "Платежные интенты",
          description: "Список бизнес-интентов и их текущих статусов.",
          href: "/treasury/payments/orders",
          cta: "Открыть интенты",
        },
        {
          id: "settlements",
          title: "Резолюшены",
          description: "Список финальных исходов по платежам.",
          href: "/treasury/payments/settlements",
          cta: "Открыть резолюшены",
        },
        {
          id: "timeline",
          title: "Таймлайн",
          description: "История попыток и событий доступна в карточке интента.",
          href: "/treasury/payments/orders",
          cta: "Открыть список",
        },
      ]}
      aside={
        <RecentItemsCard
          title="Последние платежные документы"
          description="Быстрый доступ к интентам и резолюшенам."
          items={recent.data.map((document) => ({
            id: document.id,
            title: document.title,
            subtitle: `${document.docType} · ${document.docNo}`,
            href:
              document.docType === "payment_intent"
                ? `/treasury/payments/orders/${document.id}`
                : "/treasury/payments/settlements",
          }))}
        />
      }
    />
  );
}
