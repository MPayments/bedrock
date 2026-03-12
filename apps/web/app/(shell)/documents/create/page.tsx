import Link from "next/link";
import { FilePlus2 } from "lucide-react";

import { Button } from "@bedrock/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bedrock/ui/components/card";

import { EntityListPageShell } from "@/components/entities/entity-list-page-shell";
import { getServerSessionSnapshot } from "@/lib/auth/session";
import { getCreateDocumentTypeOptions } from "@/features/documents/lib/doc-types";

function groupLabel(family: string): string {
  if (family === "transfers") {
    return "Переводы";
  }

  if (family === "ifrs") {
    return "Бухгалтерский учет";
  }

  return family;
}

export default async function DocumentsCreatePage() {
  const session = await getServerSessionSnapshot();
  const options = getCreateDocumentTypeOptions(session.role);
  const grouped = new Map<string, typeof options>();

  for (const option of options) {
    const familyOptions = grouped.get(option.family) ?? [];
    familyOptions.push(option);
    grouped.set(option.family, familyOptions);
  }

  return (
    <EntityListPageShell
      icon={FilePlus2}
      title="Создать документ"
      description="Выберите тип документа и откройте отдельную typed-форму создания."
      fallback={null}
    >
      <Card className="rounded-sm">
        <CardHeader className="border-b">
          <CardTitle>Выбор типа документа</CardTitle>
          <CardDescription>
            Для каждого типа используется отдельная форма.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 py-6">
          {[...grouped.entries()].map(([family, familyOptions]) => (
            <div key={family} className="space-y-3">
              <p className="text-sm font-medium">{groupLabel(family)}</p>
              <div className="flex flex-wrap gap-2">
                {familyOptions.map((option) => (
                  <Button
                    key={option.value}
                    variant="outline"
                    nativeButton={false}
                    render={
                      <Link
                        href={`/documents/create/${encodeURIComponent(option.value)}`}
                      />
                    }
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </EntityListPageShell>
  );
}
