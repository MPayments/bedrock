import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRightLeft, ChevronDown, FileText, Plus } from "lucide-react";

import {
  ButtonGroup,
  ButtonGroupSeparator,
} from "@multihansa/ui/components/button-group";
import { Button } from "@multihansa/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@multihansa/ui/components/dropdown-menu";

import { DataTableSkeleton } from "@/components/data-table/skeleton";
import { EntityListPageShell } from "@/components/entities/entity-list-page-shell";
import { DocumentsTable } from "@/features/documents/components/documents-table";
import {
  canCreateDocumentType,
  getDocumentTypeLabel,
  getDocumentsWorkspaceTypesForFamily,
  isDocumentsWorkspaceFamily,
  type DocumentsWorkspaceFamily,
} from "@/features/documents/lib/doc-types";
import {
  buildDocumentCreateHref,
  buildDocumentTypeHref,
} from "@/features/documents/lib/routes";
import { getDocuments } from "@/features/operations/documents/lib/queries";
import { getServerSessionSnapshot } from "@/lib/auth/session";

interface FamilyPageProps {
  params: Promise<{ family: string }>;
}

export default async function DocumentsFamilyPage({
  params,
}: FamilyPageProps) {
  const { family } = await params;

  if (!isDocumentsWorkspaceFamily(family)) {
    notFound();
  }

  const session = await getServerSessionSnapshot();
  const typeOptions = getDocumentsWorkspaceTypesForFamily(family, session.role);

  if (typeOptions.length === 0) {
    notFound();
  }

  const familyDocTypes = typeOptions.map((option) => option.value);
  const config = FAMILY_CONFIG[family];
  const createOptions = typeOptions.filter((option) =>
    canCreateDocumentType(option.value, session.role),
  );
  const primaryCreateOption = createOptions[0] ?? null;
  const primaryCreateHref = primaryCreateOption
    ? buildDocumentCreateHref(primaryCreateOption.value)
    : null;

  return (
    <EntityListPageShell
      icon={config.icon}
      title={config.title}
      description={config.description}
      actions={
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href="/documents" />}
          >
            Хаб документов
          </Button>
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href="/documents/journal" />}
          >
            Журнал операций
          </Button>
          {primaryCreateHref ? (
            <ButtonGroup>
              <Button
                size="lg"
                nativeButton={false}
                render={<Link href={primaryCreateHref} />}
              >
                <Plus className="h-4 w-4" />
                <span className="hidden md:block">Создать</span>
              </Button>
              {createOptions.length > 1 ? (
                <>
                  <ButtonGroupSeparator />
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button size="lg" aria-label="Открыть меню создания документа" />
                      }
                    >
                      <ChevronDown className="h-4 w-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      {createOptions.slice(1).map((option) => {
                        const createHref = buildDocumentCreateHref(option.value);
                        if (!createHref) {
                          return null;
                        }

                        return (
                          <DropdownMenuItem
                            key={option.value}
                            render={<Link href={createHref} />}
                          >
                            <Plus className="h-4 w-4" />
                            <span>{getDocumentTypeLabel(option.value)}</span>
                          </DropdownMenuItem>
                        );
                      })}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              ) : null}
            </ButtonGroup>
          ) : null}
          {typeOptions.map((option) => (
            <Button
              key={option.value}
              variant="outline"
              nativeButton={false}
              render={<Link href={buildDocumentTypeHref(option.value)!} />}
            >
              {getDocumentTypeLabel(option.value)}
            </Button>
          ))}
        </div>
      }
      fallback={
        <DataTableSkeleton columnCount={7} rowCount={10} filterCount={4} />
      }
    >
      <DocumentsTable
        promise={getDocuments({
          page: 1,
          perPage: 20,
          docType: familyDocTypes,
        })}
      />
    </EntityListPageShell>
  );
}

const FAMILY_CONFIG: Record<
  DocumentsWorkspaceFamily,
  {
    icon: typeof ArrowRightLeft | typeof FileText;
    title: string;
    description: string;
  }
> = {
  transfers: {
    icon: ArrowRightLeft,
    title: "Переводы",
    description:
      "Transfer workflow для intra/intercompany переводов и transfer resolution.",
  },
  ifrs: {
    icon: FileText,
    title: "IFRS",
    description:
      "Семейство routed IFRS-документов без общего списка по всем документам.",
  },
};
