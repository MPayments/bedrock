"use client";

import { useMemo } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";

import type { UserRole } from "@/lib/auth/types";
import { getDocumentTypeLabel } from "@/features/documents/lib/doc-types";
import { getDocumentFormDefinitionForRole } from "@/features/documents/lib/document-form-registry";
import type { DocumentFormOptions } from "@/features/documents/lib/form-options";

import {
  DocumentTypedFormForm,
  DocumentTypedFormFormError,
  DocumentTypedFormResetButton,
  DocumentTypedFormSections,
  DocumentTypedFormSubmitButton,
  EditDocumentTypedFormProvider,
  useDocumentTypedForm,
} from "./forms/document-typed-form";

type DocumentWorkbenchCardProps = {
  docType: string;
  documentId: string;
  payload: Record<string, unknown>;
  allowedActions: string[];
  userRole: UserRole;
  options: DocumentFormOptions;
};

export function DocumentWorkbenchCard({
  docType,
  documentId,
  payload,
  allowedActions,
  userRole,
  options,
}: DocumentWorkbenchCardProps) {
  const definition = useMemo(
    () => getDocumentFormDefinitionForRole({ docType, role: userRole }),
    [docType, userRole],
  );

  const canEditDraft = allowedActions.includes("edit");

  function DocumentWorkbenchTypedForm() {
    const {
      state: { definition: activeDefinition },
    } = useDocumentTypedForm();

    return (
      <Card className="rounded-sm">
        <CardHeader className="border-b">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle>Редактирование</CardTitle>
              <CardDescription>
                {activeDefinition
                  ? `Типизированная форма редактирования ${getDocumentTypeLabel(docType)}.`
                  : "Для этого типа документа типизированная форма редактирования недоступна."}
              </CardDescription>
            </div>
            {activeDefinition ? (
              <div className="flex items-center gap-2">
                <DocumentTypedFormSubmitButton />
                <DocumentTypedFormResetButton />
              </div>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-6 py-6">
          <DocumentTypedFormForm className="space-y-6">
            <DocumentTypedFormSections />
            <DocumentTypedFormFormError />
          </DocumentTypedFormForm>
        </CardContent>
      </Card>
    );
  }

  return (
    <EditDocumentTypedFormProvider
      docType={docType}
      userRole={userRole}
      options={options}
      initialPayload={payload}
      documentId={documentId}
      disabled={!canEditDraft}
    >
      {definition ? (
        <DocumentWorkbenchTypedForm />
      ) : (
        <Card className="rounded-sm">
          <CardHeader className="border-b">
            <div className="space-y-1">
              <CardTitle>Редактирование</CardTitle>
              <CardDescription>
                Для этого типа документа типизированная форма редактирования
                недоступна.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-6 py-6">
            <DocumentTypedFormForm className="space-y-6">
              <DocumentTypedFormSections />
            </DocumentTypedFormForm>
          </CardContent>
        </Card>
      )}
    </EditDocumentTypedFormProvider>
  );
}
