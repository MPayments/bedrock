import { notFound } from "next/navigation";

import { DocumentDetailsView } from "@/features/documents/components/document-details-view";
import { getDocumentFormOptions } from "@/features/documents/lib/form-options";
import { getDocumentDetails } from "@/features/operations/documents/lib/queries";
import { getServerSessionSnapshot } from "@/lib/auth/session";

interface PageProps {
  params: Promise<{ docType: string; id: string }>;
}

export default async function DocumentsDetailsPage({ params }: PageProps) {
  const { docType, id } = await params;
  const session = await getServerSessionSnapshot();
  const [details, formOptions] = await Promise.all([
    getDocumentDetails(docType, id),
    getDocumentFormOptions().catch(() => ({
      counterparties: [],
      organizations: [],
      currencies: [],
    })),
  ]);

  if (!details) {
    notFound();
  }

  return (
    <DocumentDetailsView
      details={details}
      documentBasePath="/documents"
      userRole={session.role}
      formOptions={formOptions}
    />
  );
}
