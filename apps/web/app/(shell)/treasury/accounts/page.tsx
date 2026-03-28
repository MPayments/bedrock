import * as React from "react";
import { Wallet } from "lucide-react";

import { DataTableSkeleton } from "@/components/data-table/skeleton";
import { EntityListPageShell } from "@/components/entities/entity-list-page-shell";
import { TreasuryAccountsOverview } from "@/features/treasury/workbench/components/accounts-overview";
import { getTreasuryReferenceData } from "@/features/treasury/workbench/lib/reference-data";
import {
  getTreasuryAccountBalances,
  listTreasuryAccounts,
} from "@/features/treasury/workbench/lib/queries";

export default async function AccountsPage() {
  const [accounts, balances, references] = await Promise.all([
    listTreasuryAccounts(),
    getTreasuryAccountBalances(),
    getTreasuryReferenceData(),
  ]);

  return (
    <EntityListPageShell
      icon={Wallet}
      title="Счета казначейства"
      description="Исполняемые казначейские счета"
      fallback={
        <DataTableSkeleton columnCount={6} rowCount={8} filterCount={2} />
      }
    >
      <TreasuryAccountsOverview
        accounts={accounts}
        balances={balances}
        assetLabels={references.assetLabels}
        organizationLabels={references.organizationLabels}
        providerLabels={references.providerLabels}
      />
    </EntityListPageShell>
  );
}
