import { Currency } from "lucide-react";

import { getRatePairs, getRateSources } from "@/app/(shell)/fx/rates/lib/queries";
import { SectionOverviewPage } from "@/features/overview/ui/section-overview-page";

function formatCount(value: number) {
  return value.toLocaleString("ru-RU");
}

export async function FxOverviewPage() {
  const [pairs, sources] = await Promise.all([getRatePairs(), getRateSources()]);
  const staleSources = sources.filter((source) => source.isExpired).length;

  return (
    <SectionOverviewPage
      icon={Currency}
      title="FX"
      description="Административный обзор по источникам курсов, валютным парам и manual-rate workflow."
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
      ]}
      links={[
        {
          id: "rates",
          title: "Курсы",
          description: "Открыть основной FX экран с manual rates и source statuses.",
          href: "/fx/rates",
        },
      ]}
    />
  );
}
