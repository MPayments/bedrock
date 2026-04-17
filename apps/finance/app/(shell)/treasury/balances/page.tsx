import { Wallet } from "lucide-react";

import { EntityListPageShell } from "@/components/entities/entity-list-page-shell";
import { TreasuryBalancesOrganizationSwitcher } from "@/features/treasury/balances/components/organization-switcher";
import { TreasuryOrganizationBalancesView } from "@/features/treasury/balances/components/view";
import {
  buildTreasuryBalancesDashboardViewModel,
  resolveTreasuryBalancesEvaluationCurrency,
  resolveTreasuryBalancesOrganizationId,
} from "@/features/treasury/balances/lib/presenter";
import {
  getTreasuryBalancesEvaluationTotal,
  getTreasuryOrganizationBalances,
} from "@/features/treasury/balances/lib/queries";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getFirstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function TreasuryBalancesPage({
  searchParams = Promise.resolve({}),
}: PageProps) {
  const snapshot = await getTreasuryOrganizationBalances();
  const params = await searchParams;
  const selectedOrganizationId = resolveTreasuryBalancesOrganizationId(
    snapshot.data,
    getFirstParam(params.organizationId),
  );
  const selectedEvaluationCurrency = resolveTreasuryBalancesEvaluationCurrency(
    snapshot.data,
    selectedOrganizationId,
    getFirstParam(params.evaluationCurrency),
  );
  const initialViewModel = buildTreasuryBalancesDashboardViewModel(snapshot, {
    selectedEvaluationCurrency,
    selectedOrganizationId,
  });
  const ledgerBalanceMetric = initialViewModel?.selectedOrganizationMetrics.find(
    (metric) => metric.key === "ledgerBalance",
  );
  const totalEvaluation =
    selectedEvaluationCurrency && ledgerBalanceMetric
      ? await getTreasuryBalancesEvaluationTotal({
          asOf: snapshot.asOf,
          currencyAmounts: ledgerBalanceMetric.values.map((value) => ({
            amount: value.amount,
            currency: value.currency,
          })),
          evaluationCurrency: selectedEvaluationCurrency,
        })
      : null;
  const viewModel = buildTreasuryBalancesDashboardViewModel(snapshot, {
    selectedEvaluationCurrency,
    selectedOrganizationId,
    totalEvaluation,
  });

  return (
    <EntityListPageShell
      actions={
        viewModel ? (
          <TreasuryBalancesOrganizationSwitcher
            options={viewModel.organizationOptions}
            value={viewModel.selectedOrganizationSummary.organizationId}
          />
        ) : null
      }
      icon={Wallet}
      title="Балансы внутренних организаций"
      description="Полный список счетов по всем организациям на одной странице."
      fallback={null}
    >
      <TreasuryOrganizationBalancesView
        asOf={snapshot.asOf}
        viewModel={viewModel}
      />
    </EntityListPageShell>
  );
}
