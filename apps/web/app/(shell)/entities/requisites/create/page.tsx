import Link from "next/link";
import { Building2, Landmark, Wallet } from "lucide-react";

import { Button } from "@bedrock/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bedrock/ui/components/card";

import { EntityWorkspaceLayout } from "@/components/entities/workspace-layout";
import { CreateCounterpartyRequisiteFormClient } from "@/features/entities/counterparty-requisites/components/create-counterparty-requisite-form-client";
import { getCounterpartyRequisiteFormOptions } from "@/features/entities/counterparty-requisites/lib/queries";
import { CreateOrganizationRequisiteFormClient } from "@/features/entities/organization-requisites/components/create-organization-requisite-form-client";
import { getOrganizationRequisiteFormOptions } from "@/features/entities/organization-requisites/lib/queries";

interface CreateRequisitePageProps {
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

export default async function CreateRequisitePage({
  searchParams,
}: CreateRequisitePageProps) {
  const params = await searchParams;
  const ownerType = readSingleSearchValue(params.ownerType);
  const ownerId = readSingleSearchValue(params.ownerId);

  if (ownerType === "counterparty") {
    const options = await getCounterpartyRequisiteFormOptions();

    return (
      <EntityWorkspaceLayout
        title="Новый реквизит"
        subtitle="Карточка реквизита контрагента"
        icon={Wallet}
      >
        <CreateCounterpartyRequisiteFormClient
          options={options}
          initialValues={ownerId ? { ownerId } : undefined}
          ownerReadonly={Boolean(ownerId)}
        />
      </EntityWorkspaceLayout>
    );
  }

  if (ownerType === "organization") {
    const options = await getOrganizationRequisiteFormOptions();

    return (
      <EntityWorkspaceLayout
        title="Новый реквизит"
        subtitle="Карточка реквизита организации"
        icon={Wallet}
      >
        <CreateOrganizationRequisiteFormClient
          options={options}
          initialValues={ownerId ? { ownerId } : undefined}
          ownerReadonly={Boolean(ownerId)}
        />
      </EntityWorkspaceLayout>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Реквизит контрагента</CardTitle>
          <CardDescription>
            Для внешних получателей и контрагентов без бухгалтерской binding.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            nativeButton={false}
            render={<Link href="/entities/requisites/create?ownerType=counterparty" />}
          >
            <Building2 className="h-4 w-4" />
            Открыть форму
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Реквизит организации</CardTitle>
          <CardDescription>
            Для собственных организаций с возможной accounting binding.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            nativeButton={false}
            render={<Link href="/entities/requisites/create?ownerType=organization" />}
          >
            <Landmark className="h-4 w-4" />
            Открыть форму
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
