import { redirect } from "next/navigation";

interface CounterpartyAccountsPageProps {
  params: Promise<{ id: string }>;
}

export default async function CounterpartyAccountsPage({
  params,
}: CounterpartyAccountsPageProps) {
  const { id } = await params;
  redirect(`/entities/counterparties/${id}/counterparty-requisites`);
}
