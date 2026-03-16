import { Currency } from "lucide-react";

import { getFxQuotes } from "@/features/fx/quotes/lib/queries";
import { getRatePairs, getRateSources } from "@/features/fx/rates/lib/queries";
import { SectionOverviewPage } from "@/features/overview/ui/section-overview-page";

function formatCount(value: number) {
  return value.toLocaleString("ru-RU");
}

export default async function FxOverviewPage() {
  const [pairs, sources, quotes] = await Promise.all([
    getRatePairs(),
    getRateSources(),
    getFxQuotes({ page: 1, perPage: 1 }),
  ]);
  const staleSources = sources.filter((source) => source.isExpired).length;

  return (
    <SectionOverviewPage
      icon={Currency}
      title="FX"
      description="Административный обзор по источникам курсов, валютным парам, котировкам и manual-rate workflow."
      stats={[
        {
          id: "pairs",
          label: "Валютные пары",
          value: formatCount(pairs.length),
          description: "Пары с лучшим курсом и breakdown по источникам.",
          href: "/fx/rates",
        },
        {
          id: "sources",
          label: "Источники",
          value: formatCount(sources.length),
          description:
            staleSources > 0
              ? `Просроченных источников: ${formatCount(staleSources)}`
              : "Все источники актуальны в пределах TTL.",
          href: "/fx/rates",
        },
        {
          id: "quotes",
          label: "Котировки",
          value: formatCount(quotes.total),
          description: "История созданных котировок и их жизненный цикл.",
          href: "/fx/quotes",
        },
      ]}
      links={[
        {
          id: "rates",
          title: "Курсы",
          description: "Открыть основной FX экран с manual rates и source statuses.",
          href: "/fx/rates",
        },
        {
          id: "quotes",
          title: "Котировки",
          description: "Открыть журнал FX-котировок с фильтрами по статусу и модели.",
          href: "/fx/quotes",
        },
      ]}
    />
  );
}
