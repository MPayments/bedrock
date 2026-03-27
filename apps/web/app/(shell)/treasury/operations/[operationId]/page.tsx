import { notFound } from "next/navigation";
import { Landmark } from "lucide-react";

import { EntityListPageShell } from "@/components/entities/entity-list-page-shell";
import { SectionPlaceholderPage } from "@/components/section-placeholder-page";
import { TreasuryOperationDetail } from "@/features/treasury/workbench/components/operation-detail";
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

  return (
    <EntityListPageShell
      icon={Landmark}
      title="Операция казначейства"
      description="Один экран для ответа на четыре вопроса: что это за сценарий, где идут деньги, на каком он этапе и что оператору делать дальше."
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
        treasuryEndpoints={treasuryEndpoints}
      />
    </EntityListPageShell>
  );
}
