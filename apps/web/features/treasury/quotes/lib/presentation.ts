import { minorToAmountString } from "@bedrock/shared/money";

import { buildDocumentDetailsHref } from "@/features/documents/lib/routes";
import type { DocumentDetailsDto } from "@/features/operations/documents/lib/schemas";
import { getFinancialLineBucketLabel } from "@/features/documents/lib/fx-quote-preview";
import { formatDate, formatMajorAmount } from "@/lib/format";

import type { FxQuoteDetailsResult, FxQuoteListItem } from "./queries";
import { presentFxQuoteStage, type FxQuoteStageView } from "./stage";

export function formatFxQuoteMinorAmount(input: {
  amountMinor: string;
  currency: string;
}) {
  return `${formatMajorAmount(
    minorToAmountString(input.amountMinor, {
      currency: input.currency,
    }),
  )} ${input.currency}`;
}

export function getFxQuoteStatusLabel(status: FxQuoteListItem["status"]) {
  switch (status) {
    case "active":
      return "Активна";
    case "used":
      return "Использована";
    case "expired":
      return "Истекла";
    case "cancelled":
      return "Отменена";
  }
}

export function getFxQuoteStatusVariant(
  status: FxQuoteListItem["status"],
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "active":
      return "default";
    case "used":
      return "secondary";
    case "expired":
      return "destructive";
    case "cancelled":
      return "outline";
  }
}

export function getFxQuotePricingModeLabel(mode: FxQuoteListItem["pricingMode"]) {
  return mode === "auto_cross" ? "Автоматический маршрут" : "Явный маршрут";
}

export function getFxQuoteLegSourceKindLabel(sourceKind: string) {
  switch (sourceKind) {
    case "bank":
      return "Банк";
    case "cb":
      return "ЦБ";
    case "manual":
      return "Ручной";
    case "derived":
      return "Производный";
    case "market":
      return "Рынок";
    default:
      return sourceKind;
  }
}

export function getFxQuoteSettlementModeLabel(mode: string | undefined) {
  switch (mode) {
    case "in_ledger":
      return "В учете";
    case "separate_payment_order":
      return "Отдельным платежом";
    default:
      return "—";
  }
}

export function resolveUsedFxDocumentArtifact(usedByRef: string | null) {
  if (!usedByRef || !usedByRef.startsWith("fx_execute:")) {
    return null;
  }

  const documentId = usedByRef.slice("fx_execute:".length);
  if (!documentId) {
    return null;
  }

  const href = buildDocumentDetailsHref("fx_execute", documentId);
  if (!href) {
    return null;
  }

  return {
    documentId,
    href,
    label: "FX документ",
  };
}

export type FxQuoteListRow = FxQuoteListItem & {
  linkedArtifact: {
    href: string;
    label: string;
  } | null;
  stage: FxQuoteStageView;
};

export function presentFxQuotesTableResult(input: {
  linkedDocumentsById: Record<string, DocumentDetailsDto | null>;
  result: {
    data: FxQuoteListItem[];
    total: number;
    limit: number;
    offset: number;
  };
}) {
  return {
    ...input.result,
    data: input.result.data.map((quote) => {
      const artifact = resolveUsedFxDocumentArtifact(quote.usedByRef);
      const linkedDocument = artifact
        ? input.linkedDocumentsById[artifact.documentId] ?? null
        : null;

      return {
        ...quote,
        linkedArtifact: artifact
          ? {
              href: artifact.href,
              label: linkedDocument?.document.docNo ?? artifact.label,
            }
          : null,
        stage: presentFxQuoteStage({
          quote,
          linkedDocument,
        }),
      };
    }),
  };
}

function formatRate(rateNum: string, rateDen: string) {
  const numerator = Number(rateNum);
  const denominator = Number(rateDen);
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return "—";
  }

  return (numerator / denominator).toFixed(6);
}

export function presentFxQuoteDetail(details: FxQuoteDetailsResult) {
  const artifact = resolveUsedFxDocumentArtifact(details.quote.usedByRef);
  const fromAmountLabel = formatFxQuoteMinorAmount({
    amountMinor: details.quote.fromAmountMinor,
    currency: details.quote.fromCurrency,
  });
  const toAmountLabel = formatFxQuoteMinorAmount({
    amountMinor: details.quote.toAmountMinor,
    currency: details.quote.toCurrency,
  });

  return {
    header: {
      title: `${details.quote.fromCurrency} / ${details.quote.toCurrency}`,
      summary: `${fromAmountLabel} -> ${toAmountLabel} · ${getFxQuoteStatusLabel(
        details.quote.status,
      )}`,
    },
    summary: [
      {
        label: "Quote ref",
        value: details.quote.idempotencyKey,
        tone: "mono" as const,
      },
      {
        label: "Статус",
        value: getFxQuoteStatusLabel(details.quote.status),
      },
      {
        label: "Модель",
        value: getFxQuotePricingModeLabel(details.quote.pricingMode),
      },
      {
        label: "Эффективный курс",
        value: formatRate(details.quote.rateNum, details.quote.rateDen),
      },
      {
        label: "Отдать",
        value: fromAmountLabel,
      },
      {
        label: "Получить",
        value: toAmountLabel,
      },
      {
        label: "Создана",
        value: formatDate(details.quote.createdAt),
      },
      {
        label: "Истекает",
        value: formatDate(details.quote.expiresAt),
      },
      {
        label: "Использована",
        value: details.quote.usedAt ? formatDate(details.quote.usedAt) : "—",
      },
    ],
    legs: details.legs.map((leg) => ({
      id: leg.id,
      stepLabel: `Шаг ${leg.idx}`,
      pairLabel: `${leg.fromCurrency} -> ${leg.toCurrency}`,
      fromAmountLabel: formatFxQuoteMinorAmount({
        amountMinor: leg.fromAmountMinor,
        currency: leg.fromCurrency,
      }),
      toAmountLabel: formatFxQuoteMinorAmount({
        amountMinor: leg.toAmountMinor,
        currency: leg.toCurrency,
      }),
      rateLabel: formatRate(leg.rateNum, leg.rateDen),
      sourceLabel: getFxQuoteLegSourceKindLabel(leg.sourceKind),
      sourceRefLabel: leg.sourceRef ?? "—",
      asOfLabel: formatDate(leg.asOf),
    })),
    feeComponents: details.feeComponents.map((component) => ({
      id: component.id,
      kindLabel: component.kind,
      amountLabel: formatFxQuoteMinorAmount({
        amountMinor: component.amountMinor,
        currency: component.currency,
      }),
      sourceLabel: component.source === "rule" ? "Правило" : "Ручной",
      accountingTreatmentLabel:
        component.accountingTreatment === "income"
          ? "Доход"
          : component.accountingTreatment === "expense"
            ? "Расход"
            : component.accountingTreatment === "pass_through"
              ? "Транзит"
              : "—",
      settlementModeLabel: getFxQuoteSettlementModeLabel(component.settlementMode),
      memoLabel: component.memo ?? "—",
    })),
    financialLines: details.financialLines.map((line) => ({
      id: line.id,
      bucketLabel: getFinancialLineBucketLabel(line.bucket),
      amountLabel: formatFxQuoteMinorAmount({
        amountMinor: line.amountMinor,
        currency: line.currency,
      }),
      sourceLabel: line.source === "rule" ? "Правило" : "Ручной",
      settlementModeLabel: getFxQuoteSettlementModeLabel(line.settlementMode),
      memoLabel: line.memo ?? "—",
    })),
    artifact,
    pricingTrace: details.pricingTrace,
  };
}
