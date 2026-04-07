import { CreateCounterpartyFormClient } from "@/features/entities/counterparties/components/create-counterparty-form-client";
import { getCounterpartyGroups } from "@/features/entities/counterparties/lib/queries";

interface CreateCounterpartyPageProps {
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

export default async function CreateCounterpartyPage({
  searchParams,
}: CreateCounterpartyPageProps) {
  const params = await searchParams;
  const customerId = readSingleSearchValue(params.customerId);

  try {
    const groupOptions = await getCounterpartyGroups();
    const managedGroupId =
      customerId
        ? groupOptions.find((group) => group.code === `customer:${customerId}`)?.id
        : undefined;

    return (
      <CreateCounterpartyFormClient
        initialGroupOptions={groupOptions}
        initialGroupIds={managedGroupId ? [managedGroupId] : []}
        lockedGroupIds={managedGroupId ? [managedGroupId] : []}
      />
    );
  } catch {
    return (
      <CreateCounterpartyFormClient
        initialGroupOptions={[]}
        initialLoadError="Не удалось загрузить группы"
      />
    );
  }
}
