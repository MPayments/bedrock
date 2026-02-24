import { notFound } from "next/navigation";

import { getCurrencyById } from "@/app/(shell)/entities/currencies/lib/queries";

import { EditCurrencyBreadcrumb } from "./edit-currency-breadcrumb";

interface EditCurrencyBreadcrumbPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditCurrencyBreadcrumbPage({
  params,
}: EditCurrencyBreadcrumbPageProps) {
  const { id } = await params;
  const currency = await getCurrencyById(id);

  if (!currency) {
    notFound();
  }

  return (
    <EditCurrencyBreadcrumb
      currencyId={currency.id}
      initialLabel={currency.name}
    />
  );
}
