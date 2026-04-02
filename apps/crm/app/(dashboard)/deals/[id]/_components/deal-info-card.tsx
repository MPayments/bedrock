import { Edit, FileText, Save, X } from "lucide-react";
import { Button } from "@bedrock/sdk-ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@bedrock/sdk-ui/components/card";
import { Textarea } from "@bedrock/sdk-ui/components/textarea";

import { DEAL_TYPE_LABELS } from "./constants";
import { formatCurrency, formatDate } from "./format";
import type { ApiDealDetails, ApiCurrency } from "./types";

type DealInfoCardProps = {
  deal: ApiDealDetails;
  requestedCurrency: ApiCurrency | null;
  isEditingComment: boolean;
  commentValue: string;
  isSavingComment: boolean;
  onEditComment: () => void;
  onCancelEdit: () => void;
  onCommentChange: (value: string) => void;
  onSaveComment: () => void;
};

export function DealInfoCard({
  deal,
  requestedCurrency,
  isEditingComment,
  commentValue,
  isSavingComment,
  onEditComment,
  onCancelEdit,
  onCommentChange,
  onSaveComment,
}: DealInfoCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-muted-foreground" />
          Сделка
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <div className="text-sm font-medium text-muted-foreground">Тип</div>
            <div className="text-base">{DEAL_TYPE_LABELS[deal.type]}</div>
          </div>
          <div>
            <div className="text-sm font-medium text-muted-foreground">
              Дата создания
            </div>
            <div className="text-base">{formatDate(deal.createdAt)}</div>
          </div>
          <div>
            <div className="text-sm font-medium text-muted-foreground">
              Последнее обновление
            </div>
            <div className="text-base">{formatDate(deal.updatedAt)}</div>
          </div>
          <div>
            <div className="text-sm font-medium text-muted-foreground">
              Запрошенная сумма
            </div>
            <div className="text-base font-medium">
              {formatCurrency(deal.requestedAmount, requestedCurrency?.code ?? null)}
            </div>
          </div>
          {deal.reason && (
            <div className="md:col-span-2">
              <div className="text-sm font-medium text-muted-foreground">
                Основание
              </div>
              <div className="text-base">{deal.reason}</div>
            </div>
          )}
          {deal.intakeComment && (
            <div className="md:col-span-2">
              <div className="text-sm font-medium text-muted-foreground">
                Комментарий к анкете
              </div>
              <div className="text-base">{deal.intakeComment}</div>
            </div>
          )}
        </div>

        <div className="border-t pt-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="text-sm font-medium text-muted-foreground">
              Комментарий
            </div>
            {!isEditingComment && (
              <Button variant="outline" size="sm" onClick={onEditComment}>
                <Edit className="mr-2 h-4 w-4" />
                {deal.comment ? "Редактировать" : "Добавить"}
              </Button>
            )}
          </div>

          {isEditingComment ? (
            <div className="space-y-3">
              <Textarea
                disabled={isSavingComment}
                onChange={(event) => onCommentChange(event.target.value)}
                placeholder="Комментарий по сделке"
                rows={4}
                value={commentValue}
              />
              <div className="flex gap-2">
                <Button disabled={isSavingComment} onClick={onSaveComment} size="sm">
                  <Save className="mr-2 h-4 w-4" />
                  {isSavingComment ? "Сохранение..." : "Сохранить"}
                </Button>
                <Button
                  disabled={isSavingComment}
                  onClick={onCancelEdit}
                  size="sm"
                  variant="outline"
                >
                  <X className="mr-2 h-4 w-4" />
                  Отмена
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-base">
              {deal.comment || (
                <span className="italic text-muted-foreground">
                  Комментарий отсутствует
                </span>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
