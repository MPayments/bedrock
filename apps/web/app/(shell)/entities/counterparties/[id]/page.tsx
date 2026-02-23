import { notFound } from "next/navigation";

import { CounterpartyEditForm } from "../components/organization-edit-form";
import { getCounterpartyById, getCounterpartyGroups } from "../lib/queries";

interface CounterpartyPageProps {
  params: Promise<{ id: string }>;
}

export default async function CounterpartyPage({
  params,
}: CounterpartyPageProps) {
  const { id } = await params;
  const [counterparty, groupOptions] = await Promise.all([
    getCounterpartyById(id),
    getCounterpartyGroups().catch(() => null),
  ]);

  if (!counterparty) {
    notFound();
  }

  return (
    <CounterpartyEditForm
      counterparty={counterparty}
      initialGroupOptions={groupOptions ?? []}
      initialLoadError={groupOptions ? null : "Не удалось загрузить группы"}
    />
  );
}
