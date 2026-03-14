import { Vault } from "lucide-react";

import { getOrganizations } from "@/features/entities/organizations/lib/queries";
import { getDocuments } from "@/features/operations/documents/lib/queries";
import { SectionOverviewPage } from "@/features/overview/ui/section-overview-page";

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
  const [organizations, treasuryDocuments] = await Promise.all([
    getOrganizations(),
    getDocuments({ page: 1, perPage: 1, docType: TREASURY_DOC_TYPES }),
  ]);

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
          id: "documents",
          label: "Treasury-документы",
          value: formatCount(treasuryDocuments.total),
          description:
            "Документы funding, payout и treasury FX в едином журнале.",
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
