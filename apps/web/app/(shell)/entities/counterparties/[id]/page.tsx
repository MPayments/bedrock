import { CounterpartyEditForm } from "../components/organization-edit-form";
import { getCounterpartyById, getCounterpartyGroups } from "../lib/queries";
import { loadResourceByIdParamOrNotFound } from "@/lib/resources/routes";

interface CounterpartyPageProps {
  params: Promise<{ id: string }>;
}

export default async function CounterpartyPage({
  params,
}: CounterpartyPageProps) {
  const [{ entity: counterparty }, groupOptions] = await Promise.all([
    loadResourceByIdParamOrNotFound({
      params,
      getById: getCounterpartyById,
    }),
    getCounterpartyGroups().catch(() => null),
  ]);

  return (
    <CounterpartyEditForm
      counterparty={counterparty}
      initialGroupOptions={groupOptions ?? []}
      initialLoadError={groupOptions ? null : "Не удалось загрузить группы"}
    />
  );
}
