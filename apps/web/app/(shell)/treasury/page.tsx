import { Vault } from "lucide-react";

import { getOrganizations } from "@/features/entities/organizations/lib/queries";
import { getDocuments } from "@/features/operations/documents/lib/queries";
import { SectionOverviewPage } from "@/features/overview/ui/section-overview-page";
import { getFxQuotes } from "@/features/treasury/quotes/lib/queries";
import { getRateSources } from "@/features/treasury/rates/lib/queries";

const TREASURY_DOC_TYPES = [
  "payment_case",
  "payin_funding",
  "payout_initiate",
  "payout_settle",
  "payout_void",
  "fee_payout_initiate",
  "fee_payout_settle",
  "fee_payout_void",
  "capital_funding",
  "fx_execute",
  "fx_resolution",
];

function formatCount(value: number) {
  return value.toLocaleString("ru-RU");
}

export default async function TreasuryOverviewPage() {
  const [organizations, treasuryDocuments, sources, quotes] = await Promise.all([
    getOrganizations(),
    getDocuments({ page: 1, perPage: 1, docType: TREASURY_DOC_TYPES }),
    getRateSources(),
    getFxQuotes({ page: 1, perPage: 1 }),
  ]);
  const staleSources = sources.filter((source) => source.isExpired).length;

  return (
    <SectionOverviewPage
      icon={Vault}
      title="Казначейство"
      description="Административный обзор казначейских потоков, контрагентов и связанных документов."
      stats={[
        {
          id: "organizations",
          label: "Организации",
          value: formatCount(organizations.total),
          description:
            "Владельцы внутренних книг и казначейских ledgers.",
          href: "/treasury/organizations",
        },
        {
          id: "sources",
          label: "FX-источники",
          value: formatCount(sources.length),
          description:
            staleSources > 0
              ? `Просроченных источников: ${formatCount(staleSources)}`
              : "Все treasury FX-источники актуальны в пределах TTL.",
          href: "/treasury/rates",
        },
        {
          id: "quotes",
          label: "Котировки",
          value: formatCount(quotes.total),
          description: "История treasury FX-котировок и их жизненный цикл.",
          href: "/treasury/quotes",
        },
        {
          id: "documents",
          label: "Treasury-документы",
          value: formatCount(treasuryDocuments.total),
          description: "Документы funding, payout и treasury FX в едином журнале.",
          href: "/documents",
        },
      ]}
      links={[
        {
          id: "organizations",
          title: "Организации",
          description: "Рабочая зона казначейских организаций и их внутренних книг.",
          href: "/treasury/organizations",
        },
        {
          id: "rates",
          title: "Курсы",
          description: "Источники, TTL и manual-rate workflow для treasury FX.",
          href: "/treasury/rates",
        },
        {
          id: "quotes",
          title: "Котировки",
          description: "Журнал treasury FX-котировок со статусом и деталями.",
          href: "/treasury/quotes",
        },
        {
          id: "journal",
          title: "Журнал операций",
          description:
            "Просмотр статусов и деталей казначейских документов в общем потоке.",
          href: "/documents/journal",
        },
      ]}
    />
  );
}
