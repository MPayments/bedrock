import { Building2 } from "lucide-react";

import { Separator } from "@bedrock/ui/components/separator";

import { CreateCounterpartyGroupFormClient } from "@/features/entities/counterparties/components/create-counterparty-group-form-client";
import { getCounterpartyGroups } from "@/features/entities/counterparties/lib/queries";

export default async function CreateCounterpartyGroupPage() {
  let groupOptions: Awaited<ReturnType<typeof getCounterpartyGroups>> = [];
  let initialLoadError: string | null = null;

  try {
    groupOptions = await getCounterpartyGroups();
  } catch {
    initialLoadError = "Не удалось загрузить список групп";
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex w-full flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="bg-muted rounded-lg p-2.5">
            <Building2 className="text-muted-foreground h-5 w-5" />
          </div>
          <div>
            <h3 className="mb-1 text-xl font-semibold">Новая группа</h3>
            <p className="text-muted-foreground text-sm hidden md:block">
              Создание группы контрагентов в организационной ветке.
            </p>
          </div>
        </div>
      </div>
      <Separator className="w-full h-px" />
      <CreateCounterpartyGroupFormClient
        initialGroupOptions={groupOptions}
        initialLoadError={initialLoadError}
      />
    </div>
  );
}
