import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRightLeft,
  ChevronDown,
  FileText,
  Plus,
  ReceiptText,
} from "lucide-react";

import { Button } from "@bedrock/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@bedrock/ui/components/dropdown-menu";

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
import { buildDocumentCreateHref } from "@/features/documents/lib/routes";
import { getDocuments } from "@/features/operations/documents/lib/queries";
import { searchParamsCache } from "@/features/operations/documents/lib/validations";
import { getServerSessionSnapshot } from "@/lib/auth/session";

interface FamilyPageProps {
  params: Promise<{ family: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function normalizeDocTypeFilter(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }

  if (typeof value === "string") {
    return [value];
  }

  return [];
}

export default async function DocumentsFamilyPage({
  params,
  searchParams,
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

  const parsedSearch = await searchParamsCache.parse(searchParams);
  const familyDocTypes = typeOptions.map((option) => option.value);
  const familyDocTypeSet = new Set<string>(familyDocTypes);
  const requestedDocTypes = normalizeDocTypeFilter(parsedSearch.docType);
  const selectedDocTypes = requestedDocTypes.filter((docType) =>
    familyDocTypeSet.has(docType),
  );

  if (requestedDocTypes.length > 0 && selectedDocTypes.length === 0) {
    notFound();
  }

  const scopedSearch = {
    ...parsedSearch,
    docType: selectedDocTypes.length > 0 ? selectedDocTypes : familyDocTypes,
  };
  const config = FAMILY_CONFIG[family];
  const createOptions = typeOptions.filter((option) =>
    canCreateDocumentType(option.value, session.role),
  );

  return (
    <EntityListPageShell
      icon={config.icon}
      title={config.title}
      description={config.description}
      actions={
        createOptions.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button size="lg" aria-label="Открыть меню создания документа" />
              }
            >
              <Plus className="h-4 w-4" />
              <span className="hidden md:block">Создать</span>
              <ChevronDown className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {createOptions.map((option) => {
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
        ) : null
      }
      fallback={
        <DataTableSkeleton columnCount={7} rowCount={10} filterCount={4} />
      }
    >
      <DocumentsTable
        promise={getDocuments(scopedSearch)}
        docTypeOptions={typeOptions}
      />
    </EntityListPageShell>
  );
}

const FAMILY_CONFIG: Record<
  DocumentsWorkspaceFamily,
  {
    icon: typeof ArrowRightLeft | typeof FileText | typeof ReceiptText;
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
  commercial: {
    icon: ReceiptText,
    title: "Коммерческие документы",
    description:
      "Инвойсы, обмены и акты по клиентским операциям и FX-кейсам.",
  },
  ifrs: {
    icon: FileText,
    title: "Учетные документы",
    description:
      "Семейство учетных документов без общего списка по всем документам.",
  },
};
