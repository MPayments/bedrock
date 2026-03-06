"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save, X } from "lucide-react";

import { Button } from "@bedrock/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bedrock/ui/components/card";
import { Spinner } from "@bedrock/ui/components/spinner";

import type { UserRole } from "@/lib/auth/types";
import { getDocumentTypeLabel } from "@/features/documents/lib/doc-types";
import type { DocumentFormOptions } from "@/features/documents/lib/form-options";

import {
  DocumentTypedForm,
  type DocumentTypedFormActionState,
} from "./forms/document-typed-form";

type DocumentCreateTypedFormClientProps = {
  docType: string;
  userRole: UserRole;
  options: DocumentFormOptions;
};

export function DocumentCreateTypedFormClient({
  docType,
  userRole,
  options,
}: DocumentCreateTypedFormClientProps) {
  const router = useRouter();
  const formId = `document-create-form-${docType}`;
  const [actionState, setActionState] = useState<DocumentTypedFormActionState>({
    submitting: false,
    submitDisabled: true,
    resetDisabled: true,
  });

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
            <Button
              type="submit"
              form={formId}
              disabled={actionState.submitDisabled}
            >
              {actionState.submitting ? (
                <Spinner className="size-4" />
              ) : (
                <Save className="size-4" />
              )}
              {actionState.submitting ? "Создание..." : "Создать документ"}
            </Button>
            <Button
              variant="outline"
              type="reset"
              form={formId}
              disabled={actionState.resetDisabled}
            >
              <X className="size-4" />
              Отменить
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="py-6">
        <DocumentTypedForm
          mode="create"
          docType={docType}
          userRole={userRole}
          options={options}
          formId={formId}
          actionsPlacement="external"
          onActionStateChange={setActionState}
          onSuccess={(document) => {
            router.push(`/documents/${document.docType}/${document.id}`);
          }}
        />
      </CardContent>
    </Card>
  );
}
