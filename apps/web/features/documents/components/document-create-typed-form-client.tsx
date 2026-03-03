"use client";

import { useRouter } from "next/navigation";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bedrock/ui/components/card";

import type { UserRole } from "@/lib/auth/types";
import { getDocumentTypeLabel } from "@/features/documents/lib/doc-types";
import type { DocumentFormOptions } from "@/features/documents/lib/form-options";

import { DocumentTypedForm } from "./forms/document-typed-form";

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

  return (
    <Card className="rounded-sm">
      <CardHeader className="border-b">
        <CardTitle>{`Создать ${getDocumentTypeLabel(docType)}`}</CardTitle>
        <CardDescription>
          Заполните поля формы и создайте черновик документа без JSON-редактора.
        </CardDescription>
      </CardHeader>
      <CardContent className="py-6">
        <DocumentTypedForm
          mode="create"
          docType={docType}
          userRole={userRole}
          options={options}
          onSuccess={(document) => {
            router.push(`/documents/${document.docType}/${document.id}`);
          }}
        />
      </CardContent>
    </Card>
  );
}
