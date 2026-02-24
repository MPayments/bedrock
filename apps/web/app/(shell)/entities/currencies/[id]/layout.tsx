import { notFound } from "next/navigation";

import { CurrencyEditWorkspaceLayout } from "../components/currency-edit-workspace-layout";
import { getCurrencyById } from "../lib/queries";

export default async function CurrencyLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const currency = await getCurrencyById(id);

  if (!currency) {
    notFound();
  }

  return (
    <CurrencyEditWorkspaceLayout
      currencyId={currency.id}
      initialTitle={currency.name}
    >
      {children}
    </CurrencyEditWorkspaceLayout>
  );
}
