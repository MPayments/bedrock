import { Vault } from "lucide-react";

import { getCounterparties } from "@/app/(shell)/entities/counterparties/lib/queries";
import { getDocuments } from "@/app/(shell)/operations/lib/queries";
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
  "external_funding",
  "fx_execute",
];

function formatCount(value: number) {
  return value.toLocaleString("ru-RU");
}

export async function TreasuryOverviewPage() {
  const [counterparties, treasuryDocuments] = await Promise.all([
    getCounterparties({ page: 1, perPage: 1 }),
    getDocuments({ page: 1, perPage: 1, docType: TREASURY_DOC_TYPES }),
  ]);

  return (
    <SectionOverviewPage
      icon={Vault}
      title="Казначейство"
      description="Административный обзор казначейских потоков, контрагентов и платежных документов."
      stats={[
        {
          id: "counterparties",
          label: "Контрагенты",
          value: formatCount(counterparties.total),
          description: "Контрагентская база, используемая в treasury и payments flows.",
          href: "/treasury/counterparties",
        },
        {
          id: "documents",
          label: "Treasury-документы",
          value: formatCount(treasuryDocuments.total),
          description: "Payment case, funding, payout и FX execute документы.",
          href: "/payments",
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
          id: "payments",
          title: "Платежный workspace",
          description: "Канонические order/settlement витрины для treasury workflows.",
          href: "/payments",
        },
      ]}
    />
  );
}
