import { EditCurrencyFormClient } from "../components/edit-currency-form-client";
import { getCurrencyById } from "../lib/queries";
import { loadResourceByIdParamOrNotFound } from "@/lib/resources/routes";

interface CurrencyPageProps {
  params: Promise<{ id: string }>;
}

export default async function CurrencyPage({ params }: CurrencyPageProps) {
  const { entity: currency } = await loadResourceByIdParamOrNotFound({
    params,
    getById: getCurrencyById,
  });

  return <EditCurrencyFormClient currency={currency} />;
}
