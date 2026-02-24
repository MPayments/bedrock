import { notFound } from "next/navigation";

import { getCounterpartyById } from "@/app/(shell)/entities/counterparties/lib/queries";

import { EditCounterpartyBreadcrumb } from "./edit-counterparty-breadcrumb";

interface EditCounterpartyBreadcrumbPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditCounterpartyBreadcrumbPage({
  params,
}: EditCounterpartyBreadcrumbPageProps) {
  const { id } = await params;
  const counterparty = await getCounterpartyById(id);

  if (!counterparty) {
    notFound();
  }

  return (
    <EditCounterpartyBreadcrumb
      counterpartyId={counterparty.id}
      initialLabel={counterparty.shortName}
    />
  );
}
