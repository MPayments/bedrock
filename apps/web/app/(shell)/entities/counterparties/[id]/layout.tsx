import { notFound } from "next/navigation";

import { CounterpartyEditWorkspaceLayout } from "../components/counterparty-edit-workspace-layout";
import { getCounterpartyById } from "../lib/queries";

export default async function CounterpartyLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const counterparty = await getCounterpartyById(id);

  if (!counterparty) {
    notFound();
  }

  return (
    <CounterpartyEditWorkspaceLayout
      counterpartyId={counterparty.id}
      initialTitle={counterparty.shortName}
    >
      {children}
    </CounterpartyEditWorkspaceLayout>
  );
}
