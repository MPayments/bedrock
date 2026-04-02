import { Wallet } from "lucide-react";

import { EntityListPageShell } from "@/components/entities/entity-list-page-shell";
import { TreasuryOrganizationBalancesView } from "@/features/treasury/balances/components/view";
import { getTreasuryOrganizationBalances } from "@/features/treasury/balances/lib/queries";

export default async function TreasuryBalancesPage() {
  const snapshot = await getTreasuryOrganizationBalances();

  return (
    <EntityListPageShell
      icon={Wallet}
      title="Балансы"
      description="Текущий срез позиций по treasury-реквизитам внутренних организаций."
      fallback={null}
    >
      <TreasuryOrganizationBalancesView snapshot={snapshot} />
    </EntityListPageShell>
  );
}
