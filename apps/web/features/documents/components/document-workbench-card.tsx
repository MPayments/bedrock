"use client";

import { useMemo, useState } from "react";
import { Save, X } from "lucide-react";

import { Button } from "@bedrock/sdk-ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";
import { Spinner } from "@bedrock/sdk-ui/components/spinner";

import type { UserRole } from "@/lib/auth/types";
import { getDocumentTypeLabel } from "@/features/documents/lib/doc-types";
import { getDocumentFormDefinitionForRole } from "@/features/documents/lib/document-form-registry";
import type { DocumentFormOptions } from "@/features/documents/lib/form-options";

import {
  DocumentTypedForm,
  type DocumentTypedFormActionState,
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
  const [formActionState, setFormActionState] =
    useState<DocumentTypedFormActionState>({
      submitting: false,
      submitDisabled: true,
      resetDisabled: true,
    });

  const definition = useMemo(
    () => getDocumentFormDefinitionForRole({ docType, role: userRole }),
    [docType, userRole],
  );

  const canEditDraft = allowedActions.includes("edit");
  const formId = `document-edit-form-${documentId}`;

  return (
    <Card className="rounded-sm">
      <CardHeader className="border-b">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle>Редактирование</CardTitle>
            <CardDescription>
              {definition
                ? `Типизированная форма редактирования ${getDocumentTypeLabel(docType)}.`
                : "Для этого типа документа типизированная форма редактирования недоступна."}
            </CardDescription>
          </div>
          {definition ? (
            <div className="flex items-center gap-2">
              <Button
                type="submit"
                form={formId}
                disabled={formActionState.submitDisabled}
              >
                {formActionState.submitting ? (
                  <Spinner className="size-4" />
                ) : (
                  <Save className="size-4" />
                )}
                {formActionState.submitting
                  ? "Сохранение..."
                  : "Сохранить черновик"}
              </Button>
              <Button
                variant="outline"
                type="reset"
                form={formId}
                disabled={formActionState.resetDisabled}
              >
                <X className="size-4" />
                Отменить
              </Button>
            </div>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-6 py-6">
        {definition ? (
          <DocumentTypedForm
            mode="edit"
            docType={docType}
            userRole={userRole}
            options={options}
            initialPayload={payload}
            documentId={documentId}
            disabled={!canEditDraft}
            submitLabel="Сохранить черновик"
            submittingLabel="Сохранение..."
            formId={formId}
            actionsPlacement="external"
            onActionStateChange={setFormActionState}
          />
        ) : (
          <div className="rounded-sm border border-dashed p-3 text-sm text-muted-foreground">
            Документ не поддерживает типизированное редактирование черновика в текущем интерфейсе.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
