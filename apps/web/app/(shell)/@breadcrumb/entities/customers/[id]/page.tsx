import { notFound } from "next/navigation";

import { getCustomerById } from "@/app/(shell)/entities/customers/lib/queries";

import { EditCustomerBreadcrumb } from "./edit-customer-breadcrumb";

interface EditCustomerBreadcrumbPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditCustomerBreadcrumbPage({
  params,
}: EditCustomerBreadcrumbPageProps) {
  const { id } = await params;
  const customer = await getCustomerById(id);

  if (!customer) {
    notFound();
  }

  return (
    <EditCustomerBreadcrumb
      customerId={customer.id}
      initialLabel={customer.displayName}
    />
  );
}
