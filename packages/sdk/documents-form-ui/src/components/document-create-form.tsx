"use client";

import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";

import type { DocumentFormDefinitions } from "../lib/document-form-registry";
import type { DocumentFormOptions } from "../lib/form-options";
import type {
  DocumentFormCreateMutator,
  DocumentFormUpdateMutator,
} from "./typed-form/hooks/use-document-form-submission";

import {
  CreateDocumentTypedFormProvider,
  DocumentTypedFormForm,
  DocumentTypedFormFormError,
  DocumentTypedFormResetButton,
  DocumentTypedFormSections,
  DocumentTypedFormSubmitButton,
} from "./typed-form";

type DocumentCreateFormProps = {
  dealId?: string;
  docType: string;
  docTypeLabel: string;
  initialPayload?: Record<string, unknown>;
  isAdmin: boolean;
  options: DocumentFormOptions;
  formDefinitions: DocumentFormDefinitions;
  buildSuccessHref: (input: { docType: string; documentId: string }) => string;
  createMutator: DocumentFormCreateMutator;
  updateMutator: DocumentFormUpdateMutator;
};

function DocumentCreateFormCard({ docTypeLabel }: { docTypeLabel: string }) {
  return (
    <Card className="rounded-sm">
      <CardHeader className="border-b">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle>{`Создать ${docTypeLabel}`}</CardTitle>
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

export function DocumentCreateForm({
  buildSuccessHref,
  createMutator,
  dealId,
  docType,
  docTypeLabel,
  formDefinitions,
  initialPayload,
  isAdmin,
  options,
  updateMutator,
}: DocumentCreateFormProps) {
  const router = useRouter();

  return (
    <CreateDocumentTypedFormProvider
      createDealId={dealId}
      createMutator={createMutator}
      docType={docType}
      formDefinitions={formDefinitions}
      initialPayload={initialPayload}
      isAdmin={isAdmin}
      options={options}
      updateMutator={updateMutator}
      onSuccess={(document) => {
        router.push(
          buildSuccessHref({
            docType: document.docType,
            documentId: document.id,
          }),
        );
      }}
    >
      <DocumentCreateFormCard docTypeLabel={docTypeLabel} />
    </CreateDocumentTypedFormProvider>
  );
}
