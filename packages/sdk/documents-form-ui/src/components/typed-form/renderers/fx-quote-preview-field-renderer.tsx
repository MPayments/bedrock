"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";
import { Field } from "@bedrock/sdk-ui/components/field";
import { Spinner } from "@bedrock/sdk-ui/components/spinner";

import type { DocumentFormValues } from "../../../lib/document-form-registry";
import {
  buildFxQuotePreviewRequest,
  fetchFxQuotePreview,
  formatFxQuotePreviewMinorAmount,
  formatFxQuotePreviewTimestamp,
  getFinancialLineBucketLabel,
  type QuotePreviewResponse,
} from "../../../lib/fx-quote-preview";
import { formatRate } from "../../../lib/format";

import { readValueAsString } from "../helpers";
import {
  type DocumentTypedFormFieldRendererProps,
  useDocumentTypedFormDisabledState,
} from "./shared";

type FxQuotePreviewState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      preview: QuotePreviewResponse;
    };

export function FxQuotePreviewFieldRenderer({
  className,
  field,
}: DocumentTypedFormFieldRendererProps<"fxQuotePreview">) {
  const { control } = useFormContext<DocumentFormValues>();
  const { disabled, submitting } = useDocumentTypedFormDisabledState();
  const amount = readValueAsString(
    useWatch({
      control,
      name: field.amountFieldName as never,
    }),
  ).trim();
  const fromCurrency = readValueAsString(
    useWatch({
      control,
      name: field.fromCurrencyFieldName as never,
    }),
  )
    .trim()
    .toUpperCase();
  const toCurrency = readValueAsString(
    useWatch({
      control,
      name: field.toCurrencyFieldName as never,
    }),
  )
    .trim()
    .toUpperCase();
  const request = useMemo(
    () =>
      buildFxQuotePreviewRequest({
        amount,
        fromCurrency,
        toCurrency,
      }),
    [amount, fromCurrency, toCurrency],
  );
  const requestKey = request
    ? `${request.fromCurrency}:${request.toCurrency}:${request.fromAmountMinor}`
    : null;
  const [state, setState] = useState<FxQuotePreviewState>({
    status: "idle",
  });
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!request || disabled || submitting) {
      setState({ status: "idle" });
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      setState({ status: "loading" });

      fetchFxQuotePreview({
        request,
        signal: controller.signal,
      })
        .then((preview) => {
          if (requestIdRef.current !== requestId) {
            return;
          }

          setState({
            status: "ready",
            preview,
          });
        })
        .catch((error) => {
          if (controller.signal.aborted || requestIdRef.current !== requestId) {
            return;
          }

          setState({
            status: "error",
            message:
              error instanceof Error
                ? error.message
                : "Не удалось загрузить текущую котировку",
          });
        });
    }, 350);

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [disabled, request, requestKey, submitting]);

  return (
    <Field key={field.name} className={className}>
      <Card size="sm" className="rounded-sm">
        <CardHeader className="border-b">
          <CardTitle>{field.label}</CardTitle>
          <CardDescription>
            Индикативная котировка обновляется автоматически по текущим рыночным
            данным.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-3">
          {state.status === "idle" ? (
            <p className="text-sm text-muted-foreground">
              Заполните сумму и валютную пару, чтобы увидеть текущую котировку.
            </p>
          ) : null}

          {state.status === "loading" ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner className="size-4" />
              <span>Обновляем котировку…</span>
            </div>
          ) : null}

          {state.status === "error" ? (
            <p className="text-sm text-destructive">{state.message}</p>
          ) : null}

          {state.status === "ready" ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-sm border p-3">
                  <p className="text-xs text-muted-foreground">Списание</p>
                  <p className="font-medium">
                    {state.preview.fromAmount} {state.preview.fromCurrency}
                  </p>
                </div>
                <div className="rounded-sm border p-3">
                  <p className="text-xs text-muted-foreground">Получение</p>
                  <p className="font-medium">
                    {state.preview.toAmount} {state.preview.toCurrency}
                  </p>
                </div>
                <div className="rounded-sm border p-3">
                  <p className="text-xs text-muted-foreground">Курс</p>
                  <p className="font-medium">
                    {formatRate(state.preview.rateNum, state.preview.rateDen)}
                  </p>
                </div>
                <div className="rounded-sm border p-3">
                  <p className="text-xs text-muted-foreground">Действует до</p>
                  <p className="font-medium">
                    {formatFxQuotePreviewTimestamp(state.preview.expiresAt)}
                  </p>
                </div>
              </div>

              {typeof state.preview.pricingTrace.summary === "string" &&
              state.preview.pricingTrace.summary.length > 0 ? (
                <p className="text-sm text-muted-foreground">
                  {state.preview.pricingTrace.summary}
                </p>
              ) : null}

              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Маршрут
                </p>
                <div className="space-y-2">
                  {state.preview.legs.map((leg) => (
                    <div
                      key={`${leg.idx}:${leg.fromCurrency}:${leg.toCurrency}`}
                      className="rounded-sm border p-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-medium">
                          {leg.fromCurrency} → {leg.toCurrency}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {formatRate(leg.rateNum, leg.rateDen)}
                        </p>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {formatFxQuotePreviewMinorAmount({
                          amountMinor: leg.fromAmountMinor,
                          currency: leg.fromCurrency,
                        })}{" "}
                        →{" "}
                        {formatFxQuotePreviewMinorAmount({
                          amountMinor: leg.toAmountMinor,
                          currency: leg.toCurrency,
                        })}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {state.preview.feeComponents.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Fee components
                  </p>
                  <div className="space-y-2">
                    {state.preview.feeComponents.map((component) => (
                      <div key={component.id} className="rounded-sm border p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-medium">
                            {component.memo ?? component.kind}
                          </p>
                          <p className="text-sm">
                            {formatFxQuotePreviewMinorAmount({
                              amountMinor: component.amountMinor,
                              currency: component.currency,
                            })}
                          </p>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {component.source}
                          {component.accountingTreatment
                            ? ` · ${component.accountingTreatment}`
                            : ""}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {state.preview.financialLines.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Generated financial lines
                  </p>
                  <div className="space-y-2">
                    {state.preview.financialLines.map((line) => (
                      <div key={line.id} className="rounded-sm border p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-medium">
                            {getFinancialLineBucketLabel(line.bucket)}
                          </p>
                          <p className="text-sm">
                            {formatFxQuotePreviewMinorAmount({
                              amountMinor: line.amountMinor,
                              currency: line.currency,
                            })}
                          </p>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {line.source}
                          {line.memo ? ` · ${line.memo}` : ""}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          ) : null}
        </CardContent>
      </Card>
    </Field>
  );
}
