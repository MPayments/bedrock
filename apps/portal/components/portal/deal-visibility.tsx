"use client";

import type { ChangeEvent, RefObject } from "react";
import {
  Briefcase,
  ChevronLeft,
  Download,
  Paperclip,
  Trash2,
  Upload,
} from "lucide-react";

import { Button } from "@bedrock/sdk-ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";
import { Label } from "@bedrock/sdk-ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@bedrock/sdk-ui/components/select";
import { formatCompactId } from "@bedrock/shared/core/uuid";
import {
  formatDecimalString,
  formatFractionDecimal,
  parseDecimalToFraction,
} from "@bedrock/shared/money";

import type {
  PortalDealCalculationSummary,
  PortalDealProjectionResponse,
  PortalDealStatus,
  PortalDealType,
} from "@/lib/portal-deals";

export const PORTAL_DEAL_STATUS_LABELS: Record<PortalDealStatus, string> = {
  draft: "Черновик",
  pricing: "Ценообразование",
  quoted: "Расчет предложен",
  awaiting_customer_approval: "Ожидание согласования клиента",
  awaiting_internal_approval: "Ожидание внутреннего согласования",
  approved_for_execution: "Готова к исполнению",
  executing: "Исполняется",
  partially_executed: "Частично исполнена",
  executed: "Исполнена",
  reconciling: "Сверка",
  closed: "Закрыта",
  failed: "Ошибка исполнения",
  expired: "Истекла",
  rejected: "Отклонена",
  cancelled: "Отменена",
};

export const PORTAL_DEAL_TYPE_LABELS: Record<PortalDealType, string> = {
  payment: "Платеж",
  currency_exchange: "Обмен валюты",
  currency_transit: "Валютный транзит",
  exporter_settlement: "Экспортерское финансирование",
  internal_treasury: "Внутреннее казначейство",
};

export const PORTAL_DEAL_TIMELINE_LABELS: Record<
  PortalDealProjectionResponse["timeline"][number]["type"],
  string
> = {
  deal_created: "Сделка создана",
  participant_changed: "Участники обновлены",
  status_changed: "Статус изменен",
  leg_state_changed: "Статус этапа обновлен",
  execution_requested: "Исполнение запрошено",
  leg_operation_created: "Операция создана",
  instruction_prepared: "Инструкция подготовлена",
  instruction_submitted: "Инструкция отправлена",
  instruction_settled: "Инструкция исполнена",
  instruction_failed: "Ошибка исполнения инструкции",
  instruction_retried: "Инструкция отправлена повторно",
  instruction_voided: "Инструкция отменена",
  return_requested: "Запрошен возврат",
  instruction_returned: "Возврат исполнен",
  deal_closed: "Сделка закрыта",
  quote_created: "Котировка создана",
  quote_expired: "Котировка истекла",
  quote_used: "Котировка использована",
  calculation_attached: "Расчет привязан",
  attachment_uploaded: "Файл загружен",
  attachment_deleted: "Файл удален",
  attachment_ingested: "Файл обработан",
  attachment_ingestion_failed: "Ошибка обработки файла",
  document_created: "Документ создан",
  document_status_changed: "Статус документа обновлен",
  deal_header_updated: "Заголовок сделки обновлен",
  deal_approved: "Сделка одобрена",
  deal_rejected: "Сделка отклонена",
  calculation_created: "Расчет создан",
  calculation_accepted: "Расчет принят",
  calculation_superseded: "Расчет заменен",
};

const ATTACHMENT_PURPOSE_LABELS = {
  contract: "Договор",
  invoice: "Инвойс",
  other: "Другое",
} as const;

const ATTACHMENT_INGESTION_LABELS = {
  applied: "Данные учтены",
  failed: "Не удалось обработать",
  processing: "Распознается",
  unavailable: "Обработка недоступна",
} as const;

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("ru-RU");
}

function formatDate(value: string | null) {
  if (!value) {
    return "Не указана";
  }

  return new Date(value).toLocaleDateString("ru-RU");
}

function formatDecimal(value: string, maximumFractionDigits = 2) {
  try {
    return formatDecimalString(value, {
      minimumFractionDigits: 2,
      maximumFractionDigits,
    });
  } catch {
    return "—";
  }
}

function formatCurrencyAmount(
  value: string,
  currencyCode: string | null | undefined,
) {
  const formattedValue = formatDecimal(value);

  if (!currencyCode || formattedValue === "—") {
    return formattedValue;
  }

  return `${formattedValue} ${currencyCode}`;
}

function formatCalculationRate(calculation: PortalDealCalculationSummary) {
  try {
    const rate = formatDecimalString(calculation.rate, {
      minimumFractionDigits: 6,
      maximumFractionDigits: 6,
    });

    if (
      calculation.currencyCode === "RUB" &&
      calculation.baseCurrencyCode !== "RUB"
    ) {
      const fraction = parseDecimalToFraction(calculation.rate);
      const inverseRate = formatFractionDecimal(fraction.den, fraction.num, {
        scale: 6,
        trimTrailingZeros: false,
      });
      return `1 ${calculation.baseCurrencyCode} = ${inverseRate} ${calculation.currencyCode}`;
    }

    return `1 ${calculation.currencyCode} = ${rate} ${calculation.baseCurrencyCode}`;
  } catch {
    return "—";
  }
}

type PortalDealVisibilityProps = {
  attachmentError: string | null;
  calculationError: string | null;
  data: PortalDealProjectionResponse;
  dealId: string;
  deletingAttachmentId: string | null;
  downloadingFormat: "docx" | "pdf" | null;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onAttachmentDelete: (attachmentId: string) => void;
  onAttachmentDownload: (attachmentId: string) => void;
  onAttachmentSelection: (event: ChangeEvent<HTMLInputElement>) => void;
  onBack: () => void;
  onDownload: (format: "pdf" | "docx") => void;
  onUploadPurposeChange: (value: "invoice" | "contract" | "other") => void;
  uploadPurpose: "invoice" | "contract" | "other";
  uploadingAttachment: boolean;
};

export function PortalDealVisibility({
  attachmentError,
  calculationError,
  data,
  dealId,
  deletingAttachmentId,
  downloadingFormat,
  fileInputRef,
  onAttachmentDelete,
  onAttachmentDownload,
  onAttachmentSelection,
  onBack,
  onDownload,
  onUploadPurposeChange,
  uploadPurpose,
  uploadingAttachment,
}: PortalDealVisibilityProps) {
  const primaryAmountLabel =
    data.summary.type === "payment" ? "Сумма оплаты" : "Сумма сделки";
  const primaryAmountValue =
    data.summary.type === "payment"
      ? data.customerSafeHeader.expectedAmount
      : data.customerSafeHeader.sourceAmount;

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack}>
        <ChevronLeft className="mr-2 h-4 w-4" />
        Назад к сделкам
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-3">
            <span>Сделка #{formatCompactId(data.summary.id)}</span>
            <span className="text-sm font-medium text-muted-foreground">
              {PORTAL_DEAL_STATUS_LABELS[data.summary.status]}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div>
            <p className="text-xs uppercase text-muted-foreground">
              Организация
            </p>
            <p className="text-sm font-medium">
              {data.summary.applicantDisplayName ?? "Не указана"}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase text-muted-foreground">
              Тип сделки
            </p>
            <p className="text-sm font-medium">
              {PORTAL_DEAL_TYPE_LABELS[data.summary.type]}
            </p>
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
            <p className="text-xs uppercase text-muted-foreground">Котировка</p>
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
              {primaryAmountLabel}
            </p>
            <p className="text-sm font-medium">
              {primaryAmountValue ?? "Не указана"}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase text-muted-foreground">Цель</p>
            <p className="text-sm font-medium">
              {data.customerSafeHeader.purpose ?? "Не указана"}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase text-muted-foreground">
              Дата исполнения
            </p>
            <p className="text-sm font-medium">
              {formatDate(data.customerSafeHeader.requestedExecutionDate)}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase text-muted-foreground">
              Номер инвойса
            </p>
            <p className="text-sm font-medium">
              {data.customerSafeHeader.invoiceNumber ?? "Не указан"}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase text-muted-foreground">
              Номер контракта
            </p>
            <p className="text-sm font-medium">
              {data.customerSafeHeader.contractNumber ?? "Не указан"}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase text-muted-foreground">
              Ожидаемая сумма поступления
            </p>
            <p className="text-sm font-medium">
              {data.customerSafeHeader.expectedAmount ?? "Не указана"}
            </p>
          </div>
          <div className="md:col-span-2">
            <p className="text-xs uppercase text-muted-foreground">
              Комментарий клиента
            </p>
            <p className="text-sm">
              {data.customerSafeHeader.customerNote ?? "Не указан"}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2">
              <Paperclip className="h-5 w-5" />
              Документы
            </span>
            <div className="flex items-center gap-2">
              <div className="w-44">
                <Label className="sr-only" htmlFor="portal-attachment-purpose">
                  Тип файла
                </Label>
                <Select
                  value={uploadPurpose}
                  onValueChange={(value) => {
                    if (
                      value === "invoice" ||
                      value === "contract" ||
                      value === "other"
                    ) {
                      onUploadPurposeChange(value);
                    }
                  }}
                >
                  <SelectTrigger id="portal-attachment-purpose">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="invoice">Инвойс</SelectItem>
                    <SelectItem value="contract">Договор</SelectItem>
                    <SelectItem value="other">Другое</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={onAttachmentSelection}
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
          {calculationError ? (
            <p className="text-sm text-destructive">{calculationError}</p>
          ) : null}

          <div className="space-y-3">
            <div>
              <p className="text-xs uppercase text-muted-foreground">
                Загруженные файлы
              </p>
            </div>
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
                      {ATTACHMENT_PURPOSE_LABELS[attachment.purpose ?? "other"]}
                      {attachment.ingestionStatus
                        ? ` · ${ATTACHMENT_INGESTION_LABELS[attachment.ingestionStatus]}`
                        : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(attachment.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onAttachmentDownload(attachment.id)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={deletingAttachmentId === attachment.id}
                      onClick={() => onAttachmentDelete(attachment.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="border-t pt-4">
            <div className="flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs uppercase text-muted-foreground">
                Расчет сделки
              </p>
            </div>
            {data.calculationSummary ? (
              <>
                <p className="mt-2 text-sm text-muted-foreground">
                  Расчет привязан к сделке, показан ниже и доступен для
                  выгрузки.
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-md bg-muted/40 px-3 py-2">
                    <div className="text-xs text-muted-foreground">
                      Дата расчета
                    </div>
                    <div className="text-sm font-medium">
                      {formatDateTime(data.calculationSummary.calculationTimestamp)}
                    </div>
                  </div>
                  <div className="rounded-md bg-muted/40 px-3 py-2">
                    <div className="text-xs text-muted-foreground">
                      Сумма без комиссии
                    </div>
                    <div className="text-sm font-medium">
                      {formatCurrencyAmount(
                        data.calculationSummary.originalAmount,
                        data.calculationSummary.currencyCode,
                      )}
                    </div>
                  </div>
                  <div className="rounded-md bg-muted/40 px-3 py-2">
                    <div className="text-xs text-muted-foreground">
                      Договорная комиссия
                    </div>
                    <div className="text-sm font-medium">
                      {data.calculationSummary.agreementFeePercentage}% (
                      {formatCurrencyAmount(
                        data.calculationSummary.agreementFeeAmount,
                        data.calculationSummary.currencyCode,
                      )}
                      )
                    </div>
                  </div>
                  <div className="rounded-md bg-muted/40 px-3 py-2">
                    <div className="text-xs text-muted-foreground">
                      Надбавка к котировке
                    </div>
                    <div className="text-sm font-medium">
                      {data.calculationSummary.quoteMarkupPercentage}% (
                      {formatCurrencyAmount(
                        data.calculationSummary.quoteMarkupAmount,
                        data.calculationSummary.currencyCode,
                      )}
                      )
                    </div>
                  </div>
                  <div className="rounded-md bg-muted/40 px-3 py-2">
                    <div className="text-xs text-muted-foreground">
                      Суммарная комиссия
                    </div>
                    <div className="text-sm font-medium">
                      {data.calculationSummary.totalFeePercentage}% (
                      {formatCurrencyAmount(
                        data.calculationSummary.totalFeeAmount,
                        data.calculationSummary.currencyCode,
                      )}
                      )
                    </div>
                  </div>
                  <div className="rounded-md bg-muted/40 px-3 py-2">
                    <div className="text-xs text-muted-foreground">
                      Итого к списанию
                    </div>
                    <div className="text-sm font-semibold">
                      {formatCurrencyAmount(
                        data.calculationSummary.totalAmount,
                        data.calculationSummary.currencyCode,
                      )}
                    </div>
                  </div>
                  <div className="rounded-md bg-muted/40 px-3 py-2">
                    <div className="text-xs text-muted-foreground">
                      Финальный курс клиента
                    </div>
                    <div className="text-sm font-medium">
                      {formatCalculationRate(data.calculationSummary)}
                    </div>
                  </div>
                  <div className="rounded-md bg-muted/40 px-3 py-2">
                    <div className="text-xs text-muted-foreground">
                      Доп. расходы
                    </div>
                    <div className="text-sm font-medium">
                      {formatCurrencyAmount(
                        data.calculationSummary.additionalExpenses,
                        data.calculationSummary.additionalExpensesCurrencyCode ??
                          data.calculationSummary.baseCurrencyCode,
                      )}
                    </div>
                  </div>
                  <div className="rounded-md bg-muted/40 px-3 py-2">
                    <div className="text-xs text-muted-foreground">
                      Фиксированная комиссия
                    </div>
                    <div className="text-sm font-medium">
                      {data.calculationSummary.fixedFeeCurrencyCode
                        ? formatCurrencyAmount(
                            data.calculationSummary.fixedFeeAmount,
                            data.calculationSummary.fixedFeeCurrencyCode,
                          )
                        : "Нет"}
                    </div>
                  </div>
                  <div className="rounded-md bg-muted/40 px-3 py-2">
                    <div className="text-xs text-muted-foreground">
                      Итого без расходов
                    </div>
                    <div className="text-sm font-medium">
                      {formatCurrencyAmount(
                        data.calculationSummary.totalInBase,
                        data.calculationSummary.baseCurrencyCode,
                      )}
                    </div>
                  </div>
                  <div className="rounded-md bg-muted/40 px-3 py-2">
                    <div className="text-xs text-muted-foreground">
                      Комиссия в базовой валюте
                    </div>
                    <div className="text-sm font-medium">
                      {formatCurrencyAmount(
                        data.calculationSummary.totalFeeAmountInBase,
                        data.calculationSummary.baseCurrencyCode,
                      )}
                    </div>
                  </div>
                  <div className="rounded-md bg-muted/40 px-3 py-2">
                    <div className="text-xs text-muted-foreground">
                      Итого к оплате
                    </div>
                    <div className="text-sm font-medium">
                      {formatCurrencyAmount(
                        data.calculationSummary.totalWithExpensesInBase,
                        data.calculationSummary.baseCurrencyCode,
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 pt-3">
                  <Button
                    variant="outline"
                    disabled={downloadingFormat !== null}
                    onClick={() => onDownload("pdf")}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    {downloadingFormat === "pdf"
                      ? "Загрузка PDF…"
                      : "Скачать PDF"}
                  </Button>
                  <Button
                    variant="outline"
                    disabled={downloadingFormat !== null}
                    onClick={() => onDownload("docx")}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    {downloadingFormat === "docx"
                      ? "Загрузка DOCX…"
                      : "Скачать DOCX"}
                  </Button>
                </div>
              </>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                Расчет пока не подготовлен.
              </p>
            )}
          </div>
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
                    {PORTAL_DEAL_TIMELINE_LABELS[event.type]}
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
