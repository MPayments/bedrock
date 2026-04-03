import { redirect } from "next/navigation";

interface TreasuryCounterpartyPageProps {
  params: Promise<{ id: string }>;
}

export default async function TreasuryCounterpartyPage({
  params,
}: TreasuryCounterpartyPageProps) {
  const { id } = await params;
  redirect(`/treasury/organizations/${id}`);
}
