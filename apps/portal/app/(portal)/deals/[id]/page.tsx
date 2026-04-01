"use client";

import {
  Briefcase,
  ChevronLeft,
  Download,
  Loader2,
  Paperclip,
  Trash2,
  Upload,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { type ChangeEvent, useEffect, useRef, useState } from "react";

import { Button } from "@bedrock/sdk-ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";
import { getUuidPrefix } from "@bedrock/shared/core/uuid";

import { API_BASE_URL } from "@/lib/constants";
import {
  buildPortalDealAttachmentDownloadUrl,
  deletePortalDealAttachment,
  type PortalDealProjectionResponse,
  type PortalDealStatus,
  type PortalDealType,
  requestPortalDealProjection,
  uploadPortalDealAttachment,
} from "@/lib/portal-deals";

const STATUS_LABELS: Record<PortalDealStatus, string> = {
  draft: "Черновик",
  submitted: "Отправлена",
  rejected: "Отклонена",
  preparing_documents: "Подготовка документов",
  awaiting_funds: "Ожидание средств",
  awaiting_payment: "Ожидание оплаты",
  closing_documents: "Закрытие документов",
  done: "Завершена",
  cancelled: "Отменена",
};

const TYPE_LABELS: Record<PortalDealType, string> = {
  payment: "Платеж",
  currency_exchange: "Обмен валюты",
  currency_transit: "Валютный транзит",
  exporter_settlement: "Экспортерское финансирование",
};

const TIMELINE_LABELS: Record<
  PortalDealProjectionResponse["timeline"][number]["type"],
  string
> = {
  deal_created: "Сделка создана",
  intake_saved: "Анкета сохранена",
  participant_changed: "Участники обновлены",
  status_changed: "Статус изменен",
  quote_created: "Котировка создана",
  quote_accepted: "Котировка принята",
  quote_expired: "Котировка истекла",
  quote_used: "Котировка использована",
  calculation_attached: "Расчет привязан",
  attachment_uploaded: "Файл загружен",
  attachment_deleted: "Файл удален",
  document_created: "Документ создан",
  document_status_changed: "Статус документа обновлен",
};

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("ru-RU");
}

function formatDate(value: string | null) {
  if (!value) {
    return "Не указана";
  }

  return new Date(value).toLocaleDateString("ru-RU");
}

export default function PortalDealDetailPage() {
  const params = useParams();
  const router = useRouter();
  const dealId = String(params.id ?? "");

  const [data, setData] = useState<PortalDealProjectionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [deletingAttachmentId, setDeletingAttachmentId] = useState<string | null>(
    null,
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function loadProjection() {
    try {
      setLoading(true);
      setError(null);
      const result = await requestPortalDealProjection(dealId);
      setData(result);
    } catch (fetchError) {
      console.error("Deal fetch error:", fetchError);
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Ошибка загрузки данных",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (dealId) {
      void loadProjection();
    }
  }, [dealId]);

  async function handleAttachmentSelection(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      setUploadingAttachment(true);
      setAttachmentError(null);
      await uploadPortalDealAttachment({
        dealId,
        file,
      });
      await loadProjection();
    } catch (uploadError) {
      setAttachmentError(
        uploadError instanceof Error
          ? uploadError.message
          : "Не удалось загрузить вложение",
      );
    } finally {
      setUploadingAttachment(false);
      event.target.value = "";
    }
  }

  async function handleAttachmentDelete(attachmentId: string) {
    try {
      setDeletingAttachmentId(attachmentId);
      setAttachmentError(null);
      await deletePortalDealAttachment({
        attachmentId,
        dealId,
      });
      await loadProjection();
    } catch (deleteError) {
      setAttachmentError(
        deleteError instanceof Error
          ? deleteError.message
          : "Не удалось удалить вложение",
      );
    } finally {
      setDeletingAttachmentId(null);
    }
  }

  async function handleDownload(format: "pdf" | "docx") {
    if (!data?.calculationSummary) {
      return;
    }

    const response = await fetch(
      `${API_BASE_URL}/calculations/${data.calculationSummary.id}/export?format=${format}`,
      {
        credentials: "include",
      },
    );

    if (!response.ok) {
      throw new Error("Ошибка загрузки документа");
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `deal-calculation-${data.calculationSummary.id}.${format}`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => router.push("/deals")}>
          <ChevronLeft className="mr-2 h-4 w-4" />
          Назад
        </Button>
        <Card className="border-destructive">
          <CardContent className="py-6">
            <p className="text-sm text-destructive">
              {error ?? "Данные не найдены"}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => router.push("/deals")}>
        <ChevronLeft className="mr-2 h-4 w-4" />
        Назад к сделкам
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-3">
            <span>Сделка #{getUuidPrefix(data.summary.id)}</span>
            <span className="text-sm font-medium text-muted-foreground">
              {STATUS_LABELS[data.summary.status]}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div>
            <p className="text-xs uppercase text-muted-foreground">Организация</p>
            <p className="text-sm font-medium">
              {data.summary.applicantDisplayName ?? "Не указана"}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase text-muted-foreground">Тип сделки</p>
            <p className="text-sm font-medium">{TYPE_LABELS[data.summary.type]}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-muted-foreground">Создана</p>
            <p className="text-sm font-medium">
              {formatDateTime(data.summary.createdAt)}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase text-muted-foreground">
              Следующее действие
            </p>
            <p className="text-sm font-medium">{data.nextAction}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-muted-foreground">
              Полнота подачи
            </p>
            <p className="text-sm font-medium">
              {data.submissionCompleteness.complete
                ? "Заявка заполнена"
                : "Требуются действия клиента"}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase text-muted-foreground">
              Котировка
            </p>
            <p className="text-sm font-medium">
              {data.quoteSummary?.expiresAt
                ? `Действует до ${formatDate(data.quoteSummary.expiresAt)}`
                : "Еще не выпущена"}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Действия клиента</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.requiredActions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Ожидайте следующий этап обработки сделки.
            </p>
          ) : (
            data.requiredActions.map((action) => (
              <div
                key={action}
                className="rounded-md border bg-muted/30 px-3 py-2 text-sm"
              >
                {action}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            Данные заявки
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div>
            <p className="text-xs uppercase text-muted-foreground">
              Сумма источника
            </p>
            <p className="text-sm font-medium">
              {data.customerSafeIntake.sourceAmount ?? "Не указана"}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase text-muted-foreground">Цель</p>
            <p className="text-sm font-medium">
              {data.customerSafeIntake.purpose ?? "Не указана"}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase text-muted-foreground">
              Дата исполнения
            </p>
            <p className="text-sm font-medium">
              {formatDate(data.customerSafeIntake.requestedExecutionDate)}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase text-muted-foreground">
              Номер инвойса
            </p>
            <p className="text-sm font-medium">
              {data.customerSafeIntake.invoiceNumber ?? "Не указан"}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase text-muted-foreground">
              Номер контракта
            </p>
            <p className="text-sm font-medium">
              {data.customerSafeIntake.contractNumber ?? "Не указан"}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase text-muted-foreground">
              Ожидаемая сумма поступления
            </p>
            <p className="text-sm font-medium">
              {data.customerSafeIntake.expectedAmount ?? "Не указана"}
            </p>
          </div>
          <div className="md:col-span-2">
            <p className="text-xs uppercase text-muted-foreground">
              Комментарий клиента
            </p>
            <p className="text-sm">
              {data.customerSafeIntake.customerNote ?? "Не указан"}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2">
              <Paperclip className="h-5 w-5" />
              Вложения
            </span>
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleAttachmentSelection}
              />
              <Button
                variant="outline"
                size="sm"
                disabled={uploadingAttachment}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="mr-2 h-4 w-4" />
                {uploadingAttachment ? "Загрузка…" : "Загрузить"}
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {attachmentError ? (
            <p className="text-sm text-destructive">{attachmentError}</p>
          ) : null}
          {data.attachments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Пока нет загруженных документов клиента.
            </p>
          ) : (
            data.attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="flex items-center justify-between gap-3 rounded-lg border p-3"
              >
                <div>
                  <p className="text-sm font-medium">{attachment.fileName}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(attachment.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      window.location.href = buildPortalDealAttachmentDownloadUrl({
                        attachmentId: attachment.id,
                        dealId,
                      });
                    }}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={deletingAttachmentId === attachment.id}
                    onClick={() => void handleAttachmentDelete(attachment.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            Расчет сделки
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.calculationSummary ? (
            <>
              <p className="text-sm text-muted-foreground">
                Расчет привязан к сделке и доступен для выгрузки.
              </p>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => void handleDownload("pdf")}>
                  <Download className="mr-2 h-4 w-4" />
                  Скачать PDF
                </Button>
                <Button variant="outline" onClick={() => void handleDownload("docx")}>
                  <Download className="mr-2 h-4 w-4" />
                  Скачать DOCX
                </Button>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Расчет пока не подготовлен.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Таймлайн</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.timeline.length === 0 ? (
            <p className="text-sm text-muted-foreground">Событий пока нет.</p>
          ) : (
            data.timeline.map((event) => (
              <div key={event.id} className="border-l pl-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium">
                    {TIMELINE_LABELS[event.type]}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(event.occurredAt)}
                  </p>
                </div>
                {event.actor?.label ? (
                  <p className="text-xs text-muted-foreground">
                    {event.actor.label}
                  </p>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
