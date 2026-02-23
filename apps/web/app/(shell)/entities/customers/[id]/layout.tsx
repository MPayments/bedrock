import { notFound } from "next/navigation";

import { CustomerEditWorkspaceLayout } from "../components/customer-edit-workspace-layout";
import { getCustomerById } from "../lib/queries";

export default async function CustomerLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const customer = await getCustomerById(id);

  if (!customer) {
    notFound();
  }

  return (
    <CustomerEditWorkspaceLayout
      customerId={customer.id}
      initialTitle={customer.displayName}
    >
      {children}
    </CustomerEditWorkspaceLayout>
  );
}
