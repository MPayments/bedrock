import { notFound } from "next/navigation";

import { CounterpartyEditForm } from "@/features/entities/counterparties/components/organization-edit-form";
import {
  filterGroupsByRootCode,
  findSystemRootGroupByCode,
  getRootCodeByGroupId,
} from "@/features/entities/counterparties/lib/group-scope";
import {
  getCounterpartyById,
  getCounterpartyGroups,
} from "@/features/entities/counterparties/lib/queries";

interface CounterpartyPageProps {
  params: Promise<{ id: string }>;
}

export default async function TreasuryCounterpartyPage({
  params,
}: CounterpartyPageProps) {
  const { id } = await params;
  const counterparty = await getCounterpartyById(id);

  if (!counterparty) {
    notFound();
  }

  const groupOptions = await getCounterpartyGroups().catch(() => null);

  if (groupOptions) {
    const rootCodeByGroupId = getRootCodeByGroupId(groupOptions);
    const hasTreasuryMembership = counterparty.groupIds.some(
      (groupId) => rootCodeByGroupId.get(groupId) === "treasury",
    );

    if (!hasTreasuryMembership) {
      notFound();
    }

    const treasuryGroupOptions = filterGroupsByRootCode(groupOptions, "treasury");
    const treasuryRootGroup = findSystemRootGroupByCode(
      treasuryGroupOptions,
      "treasury",
    );

    return (
      <CounterpartyEditForm
        counterparty={counterparty}
        initialGroupOptions={treasuryGroupOptions}
        initialLoadError={
          treasuryRootGroup
            ? null
            : "Системная группа Казначейство не найдена"
        }
        allowedRootCode="treasury"
        lockedGroupIds={treasuryRootGroup ? [treasuryRootGroup.id] : []}
        listPath="/treasury/counterparties"
        disableSubmit={!treasuryRootGroup}
      />
    );
  }

  return (
    <CounterpartyEditForm
      counterparty={counterparty}
      initialGroupOptions={[]}
      initialLoadError="Не удалось загрузить группы"
      allowedRootCode="treasury"
      listPath="/treasury/counterparties"
      disableSubmit
    />
  );
}
