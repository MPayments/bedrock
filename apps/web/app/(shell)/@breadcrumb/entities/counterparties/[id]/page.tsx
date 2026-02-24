import { getCounterpartyById } from "@/app/(shell)/entities/counterparties/lib/queries";
import { loadResourceByIdParamOrNotFound } from "@/lib/resources/routes";

import { EditCounterpartyBreadcrumb } from "./edit-counterparty-breadcrumb";

interface EditCounterpartyBreadcrumbPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditCounterpartyBreadcrumbPage({
  params,
}: EditCounterpartyBreadcrumbPageProps) {
  const { entity: counterparty } = await loadResourceByIdParamOrNotFound({
    params,
    getById: getCounterpartyById,
  });

  return (
    <EditCounterpartyBreadcrumb
      counterpartyId={counterparty.id}
      initialLabel={counterparty.shortName}
    />
  );
}
