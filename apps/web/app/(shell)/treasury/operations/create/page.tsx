import * as React from "react";
import { Landmark, Plus } from "lucide-react";

import { Button } from "@bedrock/sdk-ui/components/button";

import { DataTableSkeleton } from "@/components/data-table/skeleton";
import { EntityListPageShell } from "@/components/entities/entity-list-page-shell";
import { getOrganizations } from "@/features/entities/organizations/lib/queries";
import { TreasuryOperationCreateForm } from "@/features/treasury/workbench/components/create-operation-form";
import { getTreasuryReferenceData } from "@/features/treasury/workbench/lib/reference-data";
import { listTreasuryAccounts } from "@/features/treasury/workbench/lib/queries";

const TREASURY_OPERATION_CREATE_FORM_ID = "treasury-operation-create-form";

export default async function TreasuryOperationCreatePage() {
  const [accounts, organizations, references] = await Promise.all([
    listTreasuryAccounts(),
    getOrganizations({ page: 1, perPage: 200 }),
    getTreasuryReferenceData(),
  ]);

  return (
    <EntityListPageShell
      icon={Landmark}
      title="Новая операция казначейства"
      description="Ручная казначейская операция без смены валюты."
      actions={
        <div className="shrink-0">
          <Button form={TREASURY_OPERATION_CREATE_FORM_ID} size="lg" type="submit">
            <Plus className="h-4 w-4" />
            <span className="hidden md:block">Создать</span>
          </Button>
        </div>
      }
      fallback={
        <DataTableSkeleton columnCount={6} rowCount={8} filterCount={0} />
      }
    >
      <TreasuryOperationCreateForm
        accounts={accounts}
        assetLabels={references.assetLabels}
        formId={TREASURY_OPERATION_CREATE_FORM_ID}
        organizationLabels={references.organizationLabels}
        organizations={organizations.data.map((organization) => ({
          id: organization.id,
          label: organization.shortName,
        }))}
      />
    </EntityListPageShell>
  );
}
