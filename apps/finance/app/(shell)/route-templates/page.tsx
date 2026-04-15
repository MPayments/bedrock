import Link from "next/link";
import { Plus, Workflow } from "lucide-react";

import { Button } from "@bedrock/sdk-ui/components/button";
import { EntityListPageShell } from "@/components/entities/entity-list-page-shell";
import { RouteTemplatesList } from "@/features/treasury/route-templates/components/list";
import { listFinanceRouteTemplates } from "@/features/treasury/route-templates/lib/queries";

export default async function RouteTemplatesPage() {
  const templates = await listFinanceRouteTemplates();

  return (
    <EntityListPageShell
      icon={Workflow}
      title="Шаблоны маршрутов"
      description="Reusable route templates для типовых казначейских схем исполнения и economics defaults."
      actions={
        <Button
          nativeButton={false}
          render={<Link href="/route-templates/new" />}
        >
          <Plus className="mr-2 h-4 w-4" />
          Создать шаблон
        </Button>
      }
      fallback={<div className="h-24 rounded-xl border bg-muted/40" />}
    >
      <RouteTemplatesList templates={templates} />
    </EntityListPageShell>
  );
}
