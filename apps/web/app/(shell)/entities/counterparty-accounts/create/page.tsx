import { CreateAccountFormClient } from "@/features/entities/counterparty-accounts/components/create-account-form-client";
import { getAccountFormOptions } from "@/features/entities/counterparty-accounts/lib/queries";

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

export default async function CreateAccountPage({
  searchParams,
}: CreateAccountPageProps) {
  const [params, options] = await Promise.all([
    searchParams,
    getAccountFormOptions(),
  ]);
  const prefilledCounterpartyId = readSingleSearchValue(params.counterpartyId);

  return (
    <CreateAccountFormClient
      options={options}
      initialValues={
        prefilledCounterpartyId
          ? { counterpartyId: prefilledCounterpartyId }
          : undefined
      }
    />
  );
}
