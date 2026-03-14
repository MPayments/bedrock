import { DynamicBreadcrumb } from "@/components/dynamic-breadcrumb";
import { buildDocumentCreateBreadcrumbItems } from "@/features/documents/lib/breadcrumbs";

interface CreateDocumentBreadcrumbPageProps {
  params: Promise<{ docType: string }>;
}

export default async function CreateDocumentBreadcrumbPage({
  params,
}: CreateDocumentBreadcrumbPageProps) {
  const { docType } = await params;

  return <DynamicBreadcrumb items={buildDocumentCreateBreadcrumbItems(docType)} />;
}
