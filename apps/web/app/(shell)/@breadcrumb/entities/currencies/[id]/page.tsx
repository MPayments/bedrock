import { getCurrencyById } from "@/features/entities/currencies/lib/queries";
import { loadResourceByIdParamOrNotFound } from "@/lib/resources/routes";

import { EditCurrencyBreadcrumb } from "./edit-currency-breadcrumb";

interface EditCurrencyBreadcrumbPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditCurrencyBreadcrumbPage({
  params,
}: EditCurrencyBreadcrumbPageProps) {
  const { entity: currency } = await loadResourceByIdParamOrNotFound({
    params,
    getById: getCurrencyById,
  });

  return (
    <EditCurrencyBreadcrumb
      currencyId={currency.id}
      initialLabel={currency.name}
    />
  );
}
