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
import type { DocumentFormValues } from "@/features/documents/lib/document-form-registry";
import type { DocumentFormOptions } from "@/features/documents/lib/form-options";
import {
  CreateDocumentTypedFormProvider,
  DocumentTypedFormForm,
  DocumentTypedFormFormError,
  DocumentTypedFormResetButton,
  DocumentTypedFormSections,
  DocumentTypedFormSubmitButton,
} from "@/features/documents/components/forms/document-typed-form";

import { resolveTreasuryFxCreatedDocumentHref } from "../lib/fx-artifacts";

type TreasuryFxCreateFormProps = {
  options: DocumentFormOptions;
  userRole: UserRole;
  initialValues?: DocumentFormValues;
};

export function TreasuryFxCreateForm({
  options,
  userRole,
  initialValues,
}: TreasuryFxCreateFormProps) {
  const router = useRouter();

  return (
    <CreateDocumentTypedFormProvider
      docType="fx_execute"
      userRole={userRole}
      options={options}
      initialValues={initialValues}
      onSuccess={(document) => {
        void resolveTreasuryFxCreatedDocumentHref({
          documentId: document.id,
          fallbackHref: "/treasury/quotes",
        }).then((href) => {
          startTransition(() => {
            router.push(href);
            router.refresh();
          });
        });
      }}
    >
      <Card className="rounded-sm">
        <CardHeader className="border-b">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle>Казначейский FX</CardTitle>
              <CardDescription>
                Оформите конверсию через FX-документ из treasury workspace.
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
    </CreateDocumentTypedFormProvider>
  );
}
