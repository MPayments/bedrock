"use client";

import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";

import type { UserRole } from "@/lib/auth/types";
import { getDocumentTypeLabel } from "@/features/documents/lib/doc-types";
import type { DocumentFormOptions } from "@/features/documents/lib/form-options";
import { buildDocumentDetailsHref } from "@/features/documents/lib/routes";

import {
  CreateDocumentTypedFormProvider,
  DocumentTypedFormForm,
  DocumentTypedFormFormError,
  DocumentTypedFormResetButton,
  DocumentTypedFormSections,
  DocumentTypedFormSubmitButton,
} from "./forms/document-typed-form";

type DocumentCreateTypedFormClientProps = {
  dealId?: string;
  docType: string;
  initialPayload?: Record<string, unknown>;
  userRole: UserRole;
  options: DocumentFormOptions;
  reconciliationAdjustmentExceptionId?: string;
  successHref?: string;
};

function DocumentCreateTypedFormCard({ docType }: { docType: string }) {
  return (
    <Card className="rounded-sm">
      <CardHeader className="border-b">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle>{`Создать ${getDocumentTypeLabel(docType)}`}</CardTitle>
            <CardDescription>
              Заполните поля формы и создайте черновик документа.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <DocumentTypedFormSubmitButton />
            <DocumentTypedFormResetButton />
          </div>
        </div>
      </CardHeader>
      <CardContent className="py-6">
        <DocumentTypedFormForm className="space-y-6">
          <DocumentTypedFormSections />
          <DocumentTypedFormFormError />
        </DocumentTypedFormForm>
      </CardContent>
    </Card>
  );
}

export function DocumentCreateTypedFormClient({
  dealId,
  docType,
  initialPayload,
  userRole,
  options,
  reconciliationAdjustmentExceptionId,
  successHref,
}: DocumentCreateTypedFormClientProps) {
  const router = useRouter();

  return (
    <CreateDocumentTypedFormProvider
      createDealId={dealId}
      docType={docType}
      initialPayload={initialPayload}
      userRole={userRole}
      options={options}
      onSuccess={(document) => {
        const detailsHref = buildDocumentDetailsHref(document.docType, document.id, {
          reconciliationExceptionId: reconciliationAdjustmentExceptionId,
          returnTo: successHref,
        });

        router.push(
          reconciliationAdjustmentExceptionId
            ? detailsHref ?? "/documents"
            : successHref ?? detailsHref ?? "/documents",
        );
      }}
    >
      <DocumentCreateTypedFormCard docType={docType} />
    </CreateDocumentTypedFormProvider>
  );
}
