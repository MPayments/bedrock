import { notFound } from "next/navigation";

import { EditCurrencyFormClient } from "../components/edit-currency-form-client";
import { getCurrencyById } from "../lib/queries";

interface CurrencyPageProps {
  params: Promise<{ id: string }>;
}

export default async function CurrencyPage({ params }: CurrencyPageProps) {
  const { id } = await params;
  const currency = await getCurrencyById(id);

  if (!currency) {
    notFound();
  }

  return <EditCurrencyFormClient currency={currency} />;
}
