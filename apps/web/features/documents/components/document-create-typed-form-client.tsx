"use client";

import { startTransition } from "react";
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
import type { DocumentFormValues } from "@/features/documents/lib/document-form-registry";
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
  docType: string;
  userRole: UserRole;
  options: DocumentFormOptions;
  initialValues?: DocumentFormValues;
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
  docType,
  userRole,
  options,
  initialValues,
}: DocumentCreateTypedFormClientProps) {
  const router = useRouter();

  return (
    <CreateDocumentTypedFormProvider
      docType={docType}
      userRole={userRole}
      options={options}
      initialValues={initialValues}
      onSuccess={(document) => {
        const href =
          buildDocumentDetailsHref(document.docType, document.id) ?? "/documents";

        startTransition(() => {
          router.push(href);
          router.refresh();
        });
      }}
    >
      <DocumentCreateTypedFormCard docType={docType} />
    </CreateDocumentTypedFormProvider>
  );
}
