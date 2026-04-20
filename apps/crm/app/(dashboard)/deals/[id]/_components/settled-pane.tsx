"use client";

import { Check, Download, Info, Mail } from "lucide-react";

import { Button } from "@bedrock/sdk-ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";

import { formatCurrency } from "./format";
import type {
  ApiAttachment,
  ApiFormalDocument,
  CalculationView,
  DealStatus,
} from "./types";

type SettledPaneProps = {
  attachments: ApiAttachment[];
  calculation: CalculationView | null;
  closedAt: string | null;
  createdAt: string | null;
  formalDocuments: ApiFormalDocument[];
  netMarginInBase: number | null;
  onDownloadPack?: () => void;
  onSendStatement?: () => void;
  plannedNetMarginInBase?: number | null;
  reason?: string | null;
  status: DealStatus;
};

export function SettledPane({
  attachments,
  calculation,
  closedAt,
  createdAt,
  formalDocuments,
  netMarginInBase,
  onDownloadPack,
  onSendStatement,
  plannedNetMarginInBase,
  reason,
  status,
}: SettledPaneProps) {
  const isCancelled = status === "cancelled" || status === "rejected";

  if (isCancelled) {
    return (
      <div className="stage-pane">
        <Card>
          <CardContent className="flex flex-col gap-3 p-4">
            <div className="callout neg">
              <Info className="callout-icon h-[14px] w-[14px]" />
              <span>
                Сделка завершена без исполнения
                {status === "rejected" ? " · отклонена" : " · отменена"}
                {reason ? ` — ${reason}` : "."}
              </span>
            </div>
            <p className="text-[13px] text-muted-foreground">
              История и даты доступны в блоке Key dates справа.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="stage-pane">
      <ClosingStatementCard
        attachments={attachments}
        calculation={calculation}
        closedAt={closedAt}
        createdAt={createdAt}
        formalDocuments={formalDocuments}
        netMarginInBase={netMarginInBase}
        onDownloadPack={onDownloadPack}
        onSendStatement={onSendStatement}
        plannedNetMarginInBase={plannedNetMarginInBase ?? null}
      />
    </div>
  );
}

function ClosingStatementCard({
  attachments,
  calculation,
  closedAt,
  createdAt,
  formalDocuments,
  netMarginInBase,
  onDownloadPack,
  onSendStatement,
  plannedNetMarginInBase,
}: {
  attachments: ApiAttachment[];
  calculation: CalculationView | null;
  closedAt: string | null;
  createdAt: string | null;
  formalDocuments: ApiFormalDocument[];
  netMarginInBase: number | null;
  onDownloadPack?: () => void;
  onSendStatement?: () => void;
  plannedNetMarginInBase: number | null;
}) {
  const settlementDate = closedAt ? formatLongDate(closedAt) : "—";
  const tPlusN = deriveTPlusN(createdAt, closedAt);
  const marginTone =
    netMarginInBase == null
      ? ""
      : netMarginInBase > 0
        ? "pos"
        : netMarginInBase < 0
          ? "neg"
          : "";
  const marginText =
    netMarginInBase == null
      ? "—"
      : `${netMarginInBase > 0 ? "+" : netMarginInBase < 0 ? "−" : ""}${formatCurrency(
          Math.abs(netMarginInBase),
          calculation?.baseCurrencyCode ?? null,
        )}`;

  const invoice = formalDocuments.find((doc) => doc.docType === "invoice");
  const invoiceLabel = invoice
    ? `${invoice.docType.toUpperCase()} · ${invoice.approvalStatus}`
    : "—";

  const primaryAttachmentType = attachments[0]?.purpose
    ? String(attachments[0].purpose).toUpperCase()
    : null;
  const proofLabel =
    attachments.length > 0
      ? primaryAttachmentType
        ? `${primaryAttachmentType} · ${attachments.length} доку́м.`
        : `${attachments.length} доку́м.`
      : "—";

  const varianceInfo = (() => {
    if (plannedNetMarginInBase == null || netMarginInBase == null) return null;
    const delta = netMarginInBase - plannedNetMarginInBase;
    const pct = plannedNetMarginInBase
      ? (delta / plannedNetMarginInBase) * 100
      : null;
    const sign = delta > 0 ? "+" : delta < 0 ? "−" : "";
    const ccy = calculation?.baseCurrencyCode ?? null;
    const amountText =
      formatCurrency(Math.abs(delta).toFixed(2), ccy) ?? "—";
    return {
      text:
        pct == null
          ? `${sign}${amountText}`
          : `${sign}${amountText} (${pct >= 0 ? "+" : "−"}${Math.abs(pct).toFixed(1)}%)`,
      tone: delta > 0 ? "pos" : delta < 0 ? "neg" : "",
    };
  })();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Check className="h-4 w-4 text-[oklch(0.52_0.12_155)]" />
          Closing statement
        </CardTitle>
        <CardDescription>
          Сделка закрыта — финансовые и документальные итоги
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="kv-grid cols-3">
          <div>
            <div className="kv-label">Settlement date</div>
            <div className="kv-value">{settlementDate}</div>
          </div>
          <div>
            <div className="kv-label">Actual T+n</div>
            <div className="kv-value">{tPlusN}</div>
          </div>
          <div>
            <div className="kv-label">Realized margin</div>
            <div className={`kv-value ${marginTone}`}>{marginText}</div>
          </div>
          <div>
            <div className="kv-label">Variance vs plan</div>
            <div className={`kv-value ${varianceInfo?.tone ?? ""}`}>
              {varianceInfo?.text ?? "—"}
            </div>
          </div>
          <div>
            <div className="kv-label">Proof attached</div>
            <div className="kv-value">{proofLabel}</div>
          </div>
          <div>
            <div className="kv-label">Customer invoice</div>
            <div className="kv-value">{invoiceLabel}</div>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onDownloadPack}
            disabled={!onDownloadPack}
          >
            <Download className="h-4 w-4" />
            Выгрузить пакет
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={onSendStatement}
            disabled={!onSendStatement}
          >
            <Mail className="h-4 w-4" />
            Отправить клиенту
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

const longDateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  month: "short",
  year: "numeric",
});

function formatLongDate(value: string): string {
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return "—";
  return longDateFormatter.format(d);
}

function deriveTPlusN(
  createdAt: string | null,
  closedAt: string | null,
): string {
  if (!createdAt || !closedAt) return "—";
  const start = new Date(createdAt).getTime();
  const end = new Date(closedAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return "—";
  const days = Math.max(0, Math.ceil((end - start) / 86_400_000));
  return `T+${days}`;
}
