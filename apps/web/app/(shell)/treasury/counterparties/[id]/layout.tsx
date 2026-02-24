import { notFound } from "next/navigation";

import { CounterpartyEditWorkspaceLayout } from "@/app/(shell)/entities/counterparties/components/counterparty-edit-workspace-layout";
import { getCounterpartyById } from "@/app/(shell)/entities/counterparties/lib/queries";

export default async function TreasuryCounterpartyLayout({
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
