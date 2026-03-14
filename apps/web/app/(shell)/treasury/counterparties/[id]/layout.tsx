import { redirect } from "next/navigation";

export default async function TreasuryCounterpartyLayout({
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/treasury/organizations/${id}`);
}
