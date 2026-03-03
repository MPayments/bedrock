import { Vault } from "lucide-react";

import { getCounterparties } from "@/features/entities/counterparties/lib/queries";
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
];

function formatCount(value: number) {
  return value.toLocaleString("ru-RU");
}

export default async function TreasuryOverviewPage() {
  const [counterparties, treasuryDocuments] = await Promise.all([
    getCounterparties({ page: 1, perPage: 1 }),
    getDocuments({ page: 1, perPage: 1, docType: TREASURY_DOC_TYPES }),
  ]);

  return (
    <SectionOverviewPage
      icon={Vault}
      title="Казначейство"
      description="Административный обзор казначейских потоков, контрагентов и связанных документов."
      stats={[
        {
          id: "counterparties",
          label: "Контрагенты",
          value: formatCount(counterparties.total),
          description: "Контрагентская база, используемая в treasury workflows.",
          href: "/treasury/counterparties",
        },
        {
          id: "documents",
          label: "Treasury-документы",
          value: formatCount(treasuryDocuments.total),
          description: "Документы funding, payout и FX execute в едином журнале.",
          href: "/operations",
        },
      ]}
      links={[
        {
          id: "counterparties",
          title: "Контрагенты",
          description: "Рабочая зона казначейских контрагентов и их счетов.",
          href: "/treasury/counterparties",
        },
        {
          id: "operations",
          title: "Журнал операций",
          description: "Просмотр статусов и деталей казначейских документов в общем потоке.",
          href: "/operations",
        },
      ]}
    />
  );
}
