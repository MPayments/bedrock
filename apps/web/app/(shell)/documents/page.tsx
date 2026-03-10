import Link from "next/link";
import { BookOpen } from "lucide-react";

import { Button } from "@multihansa/ui/components/button";

import { EntityListPageShell } from "@/components/entities/entity-list-page-shell";
import {
  getDocumentsWorkspaceFamilyLabel,
  getDocumentsWorkspaceTypesForFamily,
} from "@/features/documents/lib/doc-types";
import { buildDocumentsFamilyHref } from "@/features/documents/lib/routes";
import { getServerSessionSnapshot } from "@/lib/auth/session";

export default async function DocumentsPage() {
  const session = await getServerSessionSnapshot();
  const familyOptions = (["transfers", "ifrs"] as const)
    .map((family) => ({
      family,
      types: getDocumentsWorkspaceTypesForFamily(family, session.role),
    }))
    .filter((item) => item.types.length > 0);

  return (
    <EntityListPageShell
      icon={BookOpen}
      title="Документы"
      description="Рабочая зона документов без общего списка и общего create-экрана."
      actions={
        <div className="flex flex-wrap gap-2">
          {familyOptions.map(({ family, types }) => (
            <Button
              key={family}
              nativeButton={false}
              render={<Link href={buildDocumentsFamilyHref(family)} />}
            >
              {getDocumentsWorkspaceFamilyLabel(family)}
              {` (${types.length})`}
            </Button>
          ))}
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href="/documents/journal" />}
          >
            Журнал операций
          </Button>
        </div>
      }
      fallback={null}
    >
      {null}
    </EntityListPageShell>
  );
}
