import { redirect } from "next/navigation";

interface CreateAccountPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function readSingleSearchValue(
  value: string | string[] | undefined,
): string | undefined {
  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized ? normalized : undefined;
  }

  if (Array.isArray(value) && value.length > 0) {
    const normalized = value[0]?.trim();
    return normalized ? normalized : undefined;
  }

  return undefined;
}

export default async function LegacyCreateAccountPage({
  searchParams,
}: CreateAccountPageProps) {
  const params = await searchParams;
  const counterpartyId = readSingleSearchValue(params.counterpartyId);
  const query = new URLSearchParams();

  if (counterpartyId) {
    query.set("counterpartyId", counterpartyId);
  }

  redirect(
    query.size > 0
      ? `/entities/counterparty-requisites/create?${query.toString()}`
      : "/entities/counterparty-requisites/create",
  );
}
