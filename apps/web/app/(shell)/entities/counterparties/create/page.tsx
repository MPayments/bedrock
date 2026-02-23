import { CreateCounterpartyFormClient } from "./create-counterparty-form-client";
import { getCounterpartyGroups } from "../lib/queries";

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
