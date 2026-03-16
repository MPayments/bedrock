import { CreateCounterpartyFormClient } from "@/features/entities/counterparties/components/create-counterparty-form-client";
import { getCounterpartyGroups } from "@/features/entities/counterparties/lib/queries";

export default async function CreateCounterpartyPage() {
  try {
    const groupOptions = await getCounterpartyGroups();
    return <CreateCounterpartyFormClient initialGroupOptions={groupOptions} />;
  } catch {
    return (
      <CreateCounterpartyFormClient
        initialGroupOptions={[]}
        initialLoadError="Не удалось загрузить группы"
      />
    );
  }
}
