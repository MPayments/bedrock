import { redirect } from "next/navigation";

interface ProviderPageProps {
  params: Promise<{ id: string }>;
}

export default async function LegacyProviderPage({
  params,
}: ProviderPageProps) {
  await params;
  redirect("/entities/counterparty-requisites");
}
