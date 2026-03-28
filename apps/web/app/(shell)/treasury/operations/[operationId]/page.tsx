import { notFound } from "next/navigation";
import { Landmark } from "lucide-react";

import { EntityListPageShell } from "@/components/entities/entity-list-page-shell";
import { SectionPlaceholderPage } from "@/components/section-placeholder-page";
import { TreasuryOperationDetail } from "@/features/treasury/workbench/components/operation-detail";
import { presentTreasuryOperationDetail } from "@/features/treasury/workbench/lib/presentation";
import { getTreasuryReferenceData } from "@/features/treasury/workbench/lib/reference-data";
import {
  getTreasuryOperationTimeline,
  listCounterpartyEndpoints,
  listTreasuryAccounts,
  listTreasuryEndpoints,
} from "@/features/treasury/workbench/lib/queries";

type PageProps = {
  params: Promise<{ operationId: string }>;
};

export default async function TreasuryOperationDetailsPage({
  params,
}: PageProps) {
  const { operationId } = await params;
  const [accounts, operationTimeline, references, treasuryEndpoints, counterpartyEndpoints] = await Promise.all([
    listTreasuryAccounts(),
    getTreasuryOperationTimeline(operationId),
    getTreasuryReferenceData(),
    listTreasuryEndpoints(),
    listCounterpartyEndpoints(),
  ]);

  if (!operationTimeline) {
    notFound();
  }

  const detail = presentTreasuryOperationDetail({
    accounts,
    counterpartyEndpoints,
    labels: {
      assetLabels: references.assetLabels,
      counterpartyLabels: references.counterpartyLabels,
      customerLabels: references.customerLabels,
      organizationLabels: references.organizationLabels,
    },
    operationTimeline,
    treasuryEndpoints,
  });

  return (
    <EntityListPageShell
      icon={Landmark}
      title={detail.header.title}
      description={detail.header.summary}
      fallback={<SectionPlaceholderPage title="Загрузка операции" />}
    >
      <TreasuryOperationDetail
        accounts={accounts}
        assetLabels={references.assetLabels}
        counterpartyEndpoints={counterpartyEndpoints}
        counterpartyLabels={references.counterpartyLabels}
        customerLabels={references.customerLabels}
        operationTimeline={operationTimeline}
        organizationLabels={references.organizationLabels}
        showHeaderCopy={false}
        treasuryEndpoints={treasuryEndpoints}
      />
    </EntityListPageShell>
  );
}
