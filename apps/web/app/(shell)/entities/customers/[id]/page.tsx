import { notFound } from "next/navigation";

import { EditCustomerFormClient } from "../components/edit-customer-form-client";
import { getCustomerById } from "../lib/queries";

interface CustomerPageProps {
  params: Promise<{ id: string }>;
}

export default async function CustomerPage({ params }: CustomerPageProps) {
  const { id } = await params;
  const customer = await getCustomerById(id);

  if (!customer) {
    notFound();
  }

  return <EditCustomerFormClient customer={customer} />;
}
