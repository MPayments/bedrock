"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@bedrock/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bedrock/ui/components/card";
import { toast } from "@bedrock/ui/components/sonner";

import type { UserRole } from "@/lib/auth/types";
import { getDocumentTypeLabel } from "@/features/documents/lib/doc-types";
import { getDocumentFormDefinitionForRole } from "@/features/documents/lib/document-form-registry";
import type { DocumentFormOptions } from "@/features/documents/lib/form-options";
import {
  approveDocument,
  postDocument,
  rejectDocument,
  repostDocument,
  submitDocument,
  voidDocument,
} from "@/features/operations/documents/lib/mutations";

import { DocumentTypedForm } from "./forms/document-typed-form";

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
  const router = useRouter();
  const [activeAction, setActiveAction] = useState<string | null>(null);

  const definition = useMemo(
    () => getDocumentFormDefinitionForRole({ docType, role: userRole }),
    [docType, userRole],
  );

  const canEditDraft = allowedActions.includes("edit");
  const canSubmit = allowedActions.includes("submit");
  const canApprove = allowedActions.includes("approve");
  const canReject = canApprove;
  const canPost = allowedActions.includes("post");
  const canCancel = allowedActions.includes("cancel");
  const canRepost = allowedActions.includes("repost");

  const hasBlockingMutation = Boolean(activeAction);

  async function runAction(input: {
    actionId: string;
    title: string;
    execute: () => Promise<{ ok: boolean; message?: string }>;
  }) {
    setActiveAction(input.actionId);

    const result = await input.execute();

    if (!result.ok) {
      toast.error(result.message ?? `Не удалось выполнить действие ${input.title}`);
      setActiveAction(null);
      return;
    }

    toast.success(`Документ: ${input.title}`);
    setActiveAction(null);
    router.refresh();
  }

  return (
    <Card className="rounded-sm">
      <CardHeader className="border-b">
        <CardTitle>Редактирование и действия</CardTitle>
        <CardDescription>
          {definition
            ? `Типизированная форма редактирования ${getDocumentTypeLabel(docType)} и действия документа.`
            : "Для этого типа документа типизированная форма редактирования недоступна. Доступны только действия документа."}
        </CardDescription>
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
            disabled={!canEditDraft || hasBlockingMutation}
            submitLabel="Сохранить черновик"
            submittingLabel="Сохранение..."
            onSuccess={() => {
              router.refresh();
            }}
          />
        ) : (
          <div className="rounded-sm border border-dashed p-3 text-sm text-muted-foreground">
            Документ не поддерживает типизированное редактирование черновика в текущем интерфейсе.
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {canSubmit ? (
            <Button
              type="button"
              variant="outline"
              disabled={hasBlockingMutation}
              onClick={() =>
                runAction({
                  actionId: "submit",
                  title: "отправка",
                  execute: () => submitDocument({ docType, documentId }),
                })
              }
            >
              {activeAction === "submit" ? "Отправка..." : "Отправить"}
            </Button>
          ) : null}
          {canApprove ? (
            <Button
              type="button"
              variant="outline"
              disabled={hasBlockingMutation}
              onClick={() =>
                runAction({
                  actionId: "approve",
                  title: "согласование",
                  execute: () => approveDocument({ docType, documentId }),
                })
              }
            >
              {activeAction === "approve" ? "Согласование..." : "Согласовать"}
            </Button>
          ) : null}
          {canReject ? (
            <Button
              type="button"
              variant="destructive"
              disabled={hasBlockingMutation}
              onClick={() =>
                runAction({
                  actionId: "reject",
                  title: "отклонение",
                  execute: () => rejectDocument({ docType, documentId }),
                })
              }
            >
              {activeAction === "reject" ? "Отклонение..." : "Отклонить"}
            </Button>
          ) : null}
          {canPost ? (
            <Button
              type="button"
              disabled={hasBlockingMutation}
              onClick={() =>
                runAction({
                  actionId: "post",
                  title: "проведение",
                  execute: () => postDocument({ docType, documentId }),
                })
              }
            >
              {activeAction === "post" ? "Проведение..." : "Провести"}
            </Button>
          ) : null}
          {canCancel ? (
            <Button
              type="button"
              variant="destructive"
              disabled={hasBlockingMutation}
              onClick={() =>
                runAction({
                  actionId: "cancel",
                  title: "отмена",
                  execute: () => voidDocument({ docType, documentId }),
                })
              }
            >
              {activeAction === "cancel" ? "Отмена..." : "Отменить"}
            </Button>
          ) : null}
          {canRepost ? (
            <Button
              type="button"
              variant="outline"
              disabled={hasBlockingMutation}
              onClick={() =>
                runAction({
                  actionId: "repost",
                  title: "перепроведение",
                  execute: () => repostDocument({ docType, documentId }),
                })
              }
            >
              {activeAction === "repost" ? "Перепроведение..." : "Перепровести"}
            </Button>
          ) : null}
          {!canSubmit &&
          !canApprove &&
          !canReject &&
          !canPost &&
          !canCancel &&
          !canRepost ? (
            <div className="rounded-sm border border-dashed px-3 py-2 text-sm text-muted-foreground">
              Для текущего статуса документа доступных действий нет.
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
