"use client";

import { useMemo, type ReactNode } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";

import { getDocumentFormDefinitionForRole } from "../lib/document-form-registry";
import type { DocumentFormOptions } from "../lib/form-options";

import {
  DocumentTypedFormForm,
  DocumentTypedFormFormError,
  DocumentTypedFormResetButton,
  DocumentTypedFormSections,
  DocumentTypedFormSubmitButton,
  EditDocumentTypedFormProvider,
  useDocumentTypedForm,
} from "./typed-form/index";
import type {
  DocumentFormCreateMutator,
  DocumentFormUpdateMutator,
} from "./typed-form/hooks/use-document-form-submission";

type DocumentWorkbenchCardProps = {
  docType: string;
  docTypeLabel: string;
  documentId: string;
  payload: Record<string, unknown>;
  allowedActions: string[];
  isAdmin: boolean;
  options: DocumentFormOptions;
  createMutator: DocumentFormCreateMutator;
  headerActions?: ReactNode;
  updateMutator: DocumentFormUpdateMutator;
};

export function DocumentWorkbenchCard({
  allowedActions,
  createMutator,
  docType,
  docTypeLabel,
  documentId,
  headerActions,
  isAdmin,
  options,
  payload,
  updateMutator,
}: DocumentWorkbenchCardProps) {
  const definition = useMemo(
    () =>
      getDocumentFormDefinitionForRole({
        docType,
        isAdmin,
      }),
    [docType, isAdmin],
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
              <CardTitle>Поля документа</CardTitle>
              <CardDescription>
                {activeDefinition
                  ? `Типизированная форма ${docTypeLabel.toLowerCase()}.`
                  : "Для этого типа документа типизированная форма недоступна."}
              </CardDescription>
            </div>
            {activeDefinition && canEditDraft ? (
              <div className="flex items-center gap-2">
                {headerActions}
                <DocumentTypedFormSubmitButton />
                <DocumentTypedFormResetButton />
              </div>
            ) : headerActions ? (
              <div className="flex items-center gap-2">{headerActions}</div>
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
      isAdmin={isAdmin}
      options={options}
      initialPayload={payload}
      documentId={documentId}
      disabled={!canEditDraft}
      createMutator={createMutator}
      updateMutator={updateMutator}
    >
      {definition ? (
        <DocumentWorkbenchTypedForm />
      ) : (
        <Card className="rounded-sm">
          <CardHeader className="border-b">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <CardTitle>Поля документа</CardTitle>
                <CardDescription>
                  Для этого типа документа типизированная форма недоступна.
                </CardDescription>
              </div>
              {headerActions ? (
                <div className="flex items-center gap-2">{headerActions}</div>
              ) : null}
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
