import Link from "next/link";

import { Badge } from "@bedrock/sdk-ui/components/badge";
import { Button } from "@bedrock/sdk-ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";

import { getFinanceDealTypeLabel } from "@/features/treasury/deals/labels";
import {
  getRouteTemplateStatusLabel,
  getRouteTemplateStatusVariant,
} from "@/features/treasury/route-templates/labels";
import type { FinanceRouteTemplateSummary } from "@/features/treasury/route-templates/lib/queries";
import { formatDate } from "@/lib/format";

type RouteTemplatesListProps = {
  templates: FinanceRouteTemplateSummary[];
};

const SECTION_ORDER = ["draft", "published", "archived"] as const;

export function RouteTemplatesList({ templates }: RouteTemplatesListProps) {
  if (templates.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Шаблонов пока нет</CardTitle>
          <CardDescription>
            Создайте первый route template, чтобы собирать типовые multi-leg сделки
            без ручного ввода каждого маршрута с нуля.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {SECTION_ORDER.map((status) => {
        const items = templates.filter((template) => template.status === status);

        if (items.length === 0) {
          return null;
        }

        return (
          <section key={status} className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h4 className="text-lg font-semibold">
                  {getRouteTemplateStatusLabel(status)}
                </h4>
                <p className="text-sm text-muted-foreground">
                  {items.length} шаблонов
                </p>
              </div>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              {items.map((template) => (
                <Card key={template.id}>
                  <CardHeader className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={getRouteTemplateStatusVariant(template.status)}>
                        {getRouteTemplateStatusLabel(template.status)}
                      </Badge>
                      <Badge variant="outline">
                        {getFinanceDealTypeLabel(template.dealType)}
                      </Badge>
                      <Badge variant="outline">Code: {template.code}</Badge>
                    </div>
                    <div>
                      <CardTitle>{template.name}</CardTitle>
                      <CardDescription>
                        {template.description ??
                          "Описание не заполнено. Откройте шаблон, чтобы добавить контекст маршрута и economics defaults."}
                      </CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent className="flex items-center justify-between gap-4">
                    <div className="space-y-1 text-sm text-muted-foreground">
                      <p>Обновлен: {formatDate(template.updatedAt)}</p>
                      <p>Создан: {formatDate(template.createdAt)}</p>
                    </div>
                    <Button
                      variant="outline"
                      nativeButton={false}
                      render={
                        <Link href={`/route-templates/${template.id}`} />
                      }
                    >
                      Открыть
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
