import { CreateCounterpartyFormClient } from "@/app/(shell)/entities/counterparties/create/create-counterparty-form-client";
import {
  filterGroupsByRootCode,
  findSystemRootGroupByCode,
} from "@/app/(shell)/entities/counterparties/lib/group-scope";
import { getCounterpartyGroups } from "@/app/(shell)/entities/counterparties/lib/queries";

export default async function TreasuryCreateCounterpartyPage() {
  try {
    const groupOptions = await getCounterpartyGroups();
    const treasuryGroupOptions = filterGroupsByRootCode(groupOptions, "treasury");
    const treasuryRootGroup = findSystemRootGroupByCode(
      treasuryGroupOptions,
      "treasury",
    );

    return (
      <CreateCounterpartyFormClient
        initialGroupOptions={treasuryGroupOptions}
        initialGroupIds={treasuryRootGroup ? [treasuryRootGroup.id] : []}
        allowedRootCode="treasury"
        lockedGroupIds={treasuryRootGroup ? [treasuryRootGroup.id] : []}
        detailsBasePath="/treasury/counterparties"
        disableSubmit={!treasuryRootGroup}
        initialLoadError={
          treasuryRootGroup
            ? null
            : "Системная группа Казначейство не найдена"
        }
      />
    );
  } catch {
    return (
      <CreateCounterpartyFormClient
        initialGroupOptions={[]}
        allowedRootCode="treasury"
        detailsBasePath="/treasury/counterparties"
        disableSubmit
        initialLoadError="Не удалось загрузить группы"
      />
    );
  }
}
