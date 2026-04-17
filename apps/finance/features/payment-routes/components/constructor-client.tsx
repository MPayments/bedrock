"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, GitBranch, LoaderCircle, Save } from "lucide-react";

import { Button } from "@bedrock/sdk-ui/components/button";
import { ButtonGroup } from "@bedrock/sdk-ui/components/button-group";
import { Card, CardContent } from "@bedrock/sdk-ui/components/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "@bedrock/sdk-ui/components/field";
import { Input } from "@bedrock/sdk-ui/components/input";
import { toast } from "@bedrock/sdk-ui/components/sonner";
import { cn } from "@bedrock/sdk-ui/lib/utils";
import type { PaymentRouteTemplate } from "@bedrock/treasury/contracts";

import {
  formatCurrencyMinorAmount,
  getPaymentRouteRateLines,
} from "../lib/format";
import {
  createPaymentRouteTemplate,
  previewPaymentRoute,
  updatePaymentRouteTemplate,
} from "../lib/mutations";
import type { PaymentRouteConstructorOptions } from "../lib/queries";
import {
  getPaymentRouteRequisiteWarnings,
  syncPaymentRouteDraftRequisites,
} from "../lib/requisites";
import {
  getPaymentRouteAdditionalFeeTotals,
  getPaymentRoutePureAmountOutMinor,
  getPaymentRouteTotalClientCostInMinor,
} from "../lib/cost-summary";
import {
  applyCalculation,
  createPaymentRouteEditorStateFromTemplate,
  createPaymentRouteSeed,
  setEditorMode,
  setLockedSide,
  setRouteAmount,
  setRouteCurrency,
  setRouteName,
  type PaymentRouteEditorState,
} from "../lib/state";
import { usePaymentRouteRequisites } from "../lib/use-payment-route-requisites";
import { BufferedMinorAmountInput, CurrencySelector } from "./editor-shared";
import { PaymentRouteManualEditor } from "./manual-editor";
import { PaymentRouteWorkspaceLayout } from "./payment-route-workspace-layout";
import { PaymentRouteSummaryRail } from "./summary-rail";

const PaymentRouteGraphEditor = dynamic(
  () =>
    import("./graph-editor").then((module) => module.PaymentRouteGraphEditor),
  {
    loading: () => (
      <div className="flex h-[640px] items-center justify-center rounded-2xl border border-dashed text-sm text-muted-foreground">
        Загрузка графа маршрута...
      </div>
    ),
    ssr: false,
  },
);

type PaymentRouteConstructorClientProps = {
  options: PaymentRouteConstructorOptions;
  template: PaymentRouteTemplate | null;
};

function createPreviewRequestKey(draft: PaymentRouteEditorState["draft"]) {
  return JSON.stringify({
    additionalFees: draft.additionalFees,
    amountMinor:
      draft.lockedSide === "currency_in"
        ? draft.amountInMinor
        : draft.amountOutMinor,
    currencies: {
      in: draft.currencyInId,
      out: draft.currencyOutId,
    },
    legs: draft.legs.map((leg) => ({
      fees: leg.fees,
      fromCurrencyId: leg.fromCurrencyId,
      id: leg.id,
      toCurrencyId: leg.toCurrencyId,
    })),
    lockedSide: draft.lockedSide,
    participants: draft.participants.map((participant) => ({
      binding: participant.binding,
      entityId: participant.entityId,
      entityKind: participant.entityKind,
      role: participant.role,
    })),
  });
}

function createInitialState(
  options: PaymentRouteConstructorOptions,
  template: PaymentRouteTemplate | null,
) {
  if (template) {
    return createPaymentRouteEditorStateFromTemplate(template);
  }

  return createPaymentRouteSeed(options);
}

export function PaymentRouteConstructorClient({
  options,
  template,
}: PaymentRouteConstructorClientProps) {
  const router = useRouter();
  const initialState = React.useMemo(
    () => createInitialState(options, template),
    [options, template],
  );
  const [state, setState] = React.useState<PaymentRouteEditorState | null>(
    initialState,
  );
  const [previewError, setPreviewError] = React.useState<string | null>(null);
  const [previewPending, setPreviewPending] = React.useState(false);
  const [previewIndicatorVisible, setPreviewIndicatorVisible] =
    React.useState(false);
  const [savePending, startSaveTransition] = React.useTransition();
  const previewRequestIdRef = React.useRef(0);
  const previewDraft = state?.draft ?? null;
  const requisites = usePaymentRouteRequisites({
    draft: previewDraft ?? initialState?.draft ?? null,
    options,
  });
  const previewDraftRef = React.useRef(previewDraft);
  const previewRequestKey = React.useMemo(
    () => (previewDraft ? createPreviewRequestKey(previewDraft) : null),
    [previewDraft],
  );
  const deferredPreviewRequestKey = React.useDeferredValue(previewRequestKey);

  React.useEffect(() => {
    previewDraftRef.current = previewDraft;
  }, [previewDraft]);

  React.useEffect(() => {
    setState((current) => {
      if (!current) {
        return current;
      }

      const draft = syncPaymentRouteDraftRequisites({
        draft: current.draft,
        options,
        requisitesByOwner: requisites.requisitesByOwner,
        statusByOwner: requisites.statusByOwner,
      });

      if (draft === current.draft) {
        return current;
      }

      return {
        ...current,
        draft,
      };
    });
  }, [options, requisites.requisitesByOwner, requisites.statusByOwner]);

  React.useEffect(() => {
    if (!deferredPreviewRequestKey) {
      setPreviewPending(false);
      return;
    }

    const draft = previewDraftRef.current;
    if (
      !draft ||
      createPreviewRequestKey(draft) !== deferredPreviewRequestKey
    ) {
      return;
    }

    const controller = new AbortController();
    const requestId = ++previewRequestIdRef.current;
    const timeout = window.setTimeout(() => {
      setPreviewPending(true);
      void (async () => {
        try {
          const calculation = await previewPaymentRoute(
            draft,
            controller.signal,
          );
          setPreviewError(null);
          setState((current) => {
            if (!current) {
              return current;
            }

            if (
              createPreviewRequestKey(current.draft) !==
              deferredPreviewRequestKey
            ) {
              return current;
            }

            return applyCalculation(current, calculation);
          });
        } catch (error) {
          if (error instanceof Error && error.name === "AbortError") {
            return;
          }

          setPreviewError(
            error instanceof Error && error.message.length > 0
              ? error.message
              : "Не удалось выполнить предварительный расчет маршрута",
          );
        } finally {
          if (
            previewRequestIdRef.current === requestId &&
            !controller.signal.aborted
          ) {
            setPreviewPending(false);
          }
        }
      })();
    }, 250);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [deferredPreviewRequestKey]);

  React.useEffect(() => {
    if (!previewPending) {
      setPreviewIndicatorVisible(false);
      return;
    }

    const timeout = window.setTimeout(() => {
      setPreviewIndicatorVisible(true);
    }, 180);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [previewPending]);

  const editorState = state;
  const isGraphMode = editorState?.mode === "graph";
  const currencyIn =
    editorState
      ? options.currencies.find(
          (currency) => currency.id === editorState.draft.currencyInId,
        ) ?? null
      : null;
  const currencyOut =
    editorState
      ? options.currencies.find(
          (currency) => currency.id === editorState.draft.currencyOutId,
        ) ?? null
      : null;
  const totalClientCostInMinor = getPaymentRouteTotalClientCostInMinor(
    editorState?.calculation ?? null,
  );
  const pureAmountOutMinor = getPaymentRoutePureAmountOutMinor(
    editorState?.calculation ?? null,
  );
  const rateLines = editorState?.calculation
    ? getPaymentRouteRateLines({
        amountInMinor: editorState.calculation.amountInMinor,
        cleanAmountOutMinor:
          pureAmountOutMinor ?? editorState.calculation.amountOutMinor,
        costInclusiveAmountInMinor: totalClientCostInMinor,
        effectiveAmountOutMinor: editorState.calculation.amountOutMinor,
        currencyIn,
        currencyOut,
      })
    : {
        cleanForward: null,
        cleanReverse: null,
        effectiveForward: null,
        effectiveReverse: null,
      };
  const additionalFeeTotals = getPaymentRouteAdditionalFeeTotals(
    editorState?.calculation ?? null,
  );
  const additionalFeeSummary = additionalFeeTotals
    .map((feeTotal) =>
      formatCurrencyMinorAmount(
        feeTotal.amountMinor,
        options.currencies.find((currency) => currency.id === feeTotal.currencyId) ??
          null,
      ),
    )
    .join(" • ");
  const displayAmountOut =
    editorState?.calculation?.amountOutMinor ??
    editorState?.draft.amountOutMinor ??
    "0";
  const workspaceTitle = editorState?.name.trim() || "Новый маршрут";
  const workspaceSubtitle = editorState?.templateId
    ? "Редактирование шаблона маршрута"
    : "Создание шаблона маршрута";
  const requisiteWarnings = React.useMemo(
    () => {
      if (!editorState) {
        return [];
      }

      return getPaymentRouteRequisiteWarnings({
        draft: editorState.draft,
        options,
        requisitesByOwner: requisites.requisitesByOwner,
        statusByOwner: requisites.statusByOwner,
      });
    },
    [editorState, options, requisites.requisitesByOwner, requisites.statusByOwner],
  );

  React.useEffect(() => {
    if (!isGraphMode) {
      return;
    }

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [isGraphMode]);

  React.useEffect(() => {
    if (!isGraphMode) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setState((current) =>
          current ? setEditorMode(current, "manual") : current,
        );
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isGraphMode]);

  if (!editorState) {
    return (
      <Card className="border-dashed">
        <CardContent className="space-y-3 px-6 py-10">
          <div className="text-lg font-medium">Маршрут пока не собрать</div>
          <div className="text-sm text-muted-foreground">
            Для конструктора нужна хотя бы одна валюта. Клиентов, организации и
            контрагентов можно привязать позже.
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              nativeButton={false}
              render={<Link href="/entities/currencies" />}
            >
              Валюты
            </Button>
            <Button
              nativeButton={false}
              variant="outline"
              render={<Link href="/entities/customers" />}
            >
              Клиенты
            </Button>
            <Button
              nativeButton={false}
              variant="outline"
              render={<Link href="/treasury/organizations" />}
            >
              Организации
            </Button>
            <Button
              nativeButton={false}
              variant="outline"
              render={<Link href="/entities/counterparties" />}
            >
              Контрагенты
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  function handleSave() {
    const currentState = editorState;

    if (!currentState) {
      return;
    }

    startSaveTransition(async () => {
      const payload = {
        draft: currentState.draft,
        name: currentState.name.trim() || "Маршрут без названия",
        visual: currentState.visual,
      };

      const result = currentState.templateId
        ? await updatePaymentRouteTemplate(currentState.templateId, payload)
        : await createPaymentRouteTemplate(payload);

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success(
        currentState.templateId ? "Маршрут сохранен" : "Маршрут создан",
      );
      setState(
        setEditorMode(
          createPaymentRouteEditorStateFromTemplate(result.data),
          currentState.mode,
        ),
      );

      if (!currentState.templateId) {
        router.replace(`/routes/constructor/${result.data.id}`);
      }

      router.refresh();
    });
  }

  return (
    <>
      <PaymentRouteWorkspaceLayout
        title={workspaceTitle}
        subtitle={workspaceSubtitle}
        headerControls={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setState(setEditorMode(editorState, "graph"))}
            >
              <GitBranch className="size-4" />
              Граф маршрута
            </Button>
            <Button onClick={handleSave} disabled={savePending}>
              {savePending ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              Сохранить
            </Button>
          </div>
        }
      >
        <div
          className={cn(
            "grid gap-6",
            isGraphMode ? null : "xl:grid-cols-[minmax(0,1fr)_360px]",
          )}
        >
          <div className="space-y-6">
            <Card className="rounded-2xl border-border/70">
              <CardContent className="grid gap-4 p-5">
                <FieldGroup className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
                  <Field>
                    <FieldLabel htmlFor="payment-route-name">
                      Название маршрута
                    </FieldLabel>
                    <Input
                      id="payment-route-name"
                      value={editorState.name}
                      onChange={(event) =>
                        setState(setRouteName(editorState, event.target.value))
                      }
                      placeholder="Например, USDT → AED через Дубай и США"
                    />
                  </Field>
                  <Field>
                    <FieldTitle>Фиксировать</FieldTitle>
                    <ButtonGroup className="w-full">
                      <Button
                        type="button"
                        variant={
                          editorState.draft.lockedSide === "currency_in"
                            ? "default"
                            : "outline"
                        }
                        className="flex-1"
                        onClick={() =>
                          setState(setLockedSide(editorState, "currency_in"))
                        }
                      >
                        Сумму списания
                      </Button>
                      <Button
                        type="button"
                        variant={
                          editorState.draft.lockedSide === "currency_out"
                            ? "default"
                            : "outline"
                        }
                        className="flex-1"
                        onClick={() =>
                          setState(setLockedSide(editorState, "currency_out"))
                        }
                      >
                        Сумму получения
                      </Button>
                    </ButtonGroup>
                  </Field>
                </FieldGroup>

                <FieldGroup className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
                  <Field>
                    <FieldTitle>Сумма списания</FieldTitle>
                    <FieldDescription>
                      Сколько отправить в первый шаг маршрута. Доплаты сверх
                      маршрута считаются отдельно.
                    </FieldDescription>
                    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_140px]">
                      <BufferedMinorAmountInput
                        ariaLabel="Сумма списания"
                        currencyId={editorState.draft.currencyInId}
                        options={options}
                        valueMinor={editorState.draft.amountInMinor}
                        onCommit={(amountMinor) =>
                          setState(
                            setRouteAmount({
                              amountMinor,
                              side: "in",
                              state: editorState,
                            }),
                          )
                        }
                      />
                      <CurrencySelector
                        ariaLabel="Валюта списания"
                        options={options}
                        value={editorState.draft.currencyInId}
                        onChange={(currencyId) =>
                          setState(
                            setRouteCurrency({
                              currencyId,
                              side: "in",
                              state: editorState,
                            }),
                          )
                        }
                      />
                    </div>
                  </Field>
                  <div className="flex items-center justify-center text-sm text-muted-foreground">
                    <GitBranch className="size-4" />
                  </div>
                  <Field>
                    <FieldTitle>Сумма получения</FieldTitle>
                    <FieldDescription>
                      Сколько должен получить бенефициар. Доплаты сверх
                      маршрута эту сумму не уменьшают.
                    </FieldDescription>
                    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_140px]">
                      <BufferedMinorAmountInput
                        ariaLabel="Сумма получения"
                        currencyId={editorState.draft.currencyOutId}
                        options={options}
                        valueMinor={editorState.draft.amountOutMinor}
                        onCommit={(amountMinor) =>
                          setState(
                            setRouteAmount({
                              amountMinor,
                              side: "out",
                              state: editorState,
                            }),
                          )
                        }
                      />
                      <CurrencySelector
                        ariaLabel="Валюта получения"
                        options={options}
                        value={editorState.draft.currencyOutId}
                        onChange={(currencyId) =>
                          setState(
                            setRouteCurrency({
                              currencyId,
                              side: "out",
                              state: editorState,
                            }),
                          )
                        }
                      />
                    </div>
                  </Field>
                </FieldGroup>

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/20 px-4 py-3 text-sm">
                  <div className="space-y-1">
                    <div className="font-medium">Курс</div>
                    <div className="text-muted-foreground">
                      {rateLines.cleanForward ? (
                        <>
                          {rateLines.cleanForward ? (
                            <div>Прямой чистый курс: {rateLines.cleanForward}</div>
                          ) : null}
                          {rateLines.cleanReverse ? (
                            <div>Обратный чистый курс: {rateLines.cleanReverse}</div>
                          ) : null}
                          {rateLines.effectiveForward ? (
                            <div>
                              Прямой курс с себестоимостью: {rateLines.effectiveForward}
                            </div>
                          ) : null}
                          {rateLines.effectiveReverse ? (
                            <div>
                              Обратный курс с себестоимостью: {rateLines.effectiveReverse}
                            </div>
                          ) : null}
                        </>
                      ) : (
                        "После предварительного расчета здесь появится текущий маршрутный курс."
                      )}
                    </div>
                    {additionalFeeTotals.length > 0 ? (
                      <div className="text-xs text-amber-700">
                        Доплаты сверх маршрута оплачиваются отдельно:{" "}
                        {additionalFeeSummary}.
                      </div>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    {previewIndicatorVisible ? (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <LoaderCircle className="size-4 animate-spin" />
                        Пересчет
                      </div>
                    ) : null}
                    {previewError ? (
                      <div className="text-right text-sm text-red-600">
                        {previewError}
                      </div>
                    ) : null}
                  </div>
                </div>
              </CardContent>
            </Card>

            {editorState.mode === "manual" ? (
              <PaymentRouteManualEditor
                onStateChange={setState}
                options={options}
                requisites={requisites}
                state={editorState}
              />
            ) : null}
          </div>

          {isGraphMode ? null : (
            <div className="order-last xl:order-none">
              <PaymentRouteSummaryRail
                calculation={editorState.calculation}
                draft={editorState.draft}
                options={options}
                warnings={requisiteWarnings}
              />
            </div>
          )}
        </div>
      </PaymentRouteWorkspaceLayout>

      {isGraphMode ? (
        <div
          className="fixed inset-0 z-50 bg-background"
          role="dialog"
          aria-modal="true"
          aria-label="Полноэкранный граф маршрута"
        >
          <div className="flex h-dvh flex-col bg-[radial-gradient(circle_at_top_left,#eef6ff,transparent_28%),radial-gradient(circle_at_top_right,#eefbf4,transparent_22%),linear-gradient(180deg,#fafcff_0%,#f6f8fc_100%)]">
            <div className="border-b border-border/70 bg-background/90 backdrop-blur">
              <div className="mx-auto flex h-16 max-w-[1800px] items-center justify-between gap-4 px-4 sm:px-6">
                <div className="min-w-0">
                  <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    Граф маршрута
                  </div>
                  <div className="truncate text-sm font-semibold">
                    {editorState.name.trim() || "Маршрут без названия"}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setState(setEditorMode(editorState, "manual"))
                    }
                  >
                    <ArrowLeft className="size-4" />
                    Закрыть граф
                  </Button>
                  <Button onClick={handleSave} disabled={savePending}>
                    {savePending ? (
                      <LoaderCircle className="size-4 animate-spin" />
                    ) : (
                      <Save className="size-4" />
                    )}
                    Сохранить
                  </Button>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 px-4 py-4 sm:px-6">
              <div className="mx-auto flex h-full max-w-[1800px] flex-col gap-4">
                <div className="grid gap-3 rounded-2xl border border-border/70 bg-background/80 px-4 py-3 text-sm shadow-sm lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.4fr)]">
                  <div className="space-y-1">
                    <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                      Доплаты сверх маршрута
                    </div>
                    {additionalFeeTotals.length > 0 ? (
                      <div className="font-semibold">{additionalFeeSummary}</div>
                    ) : (
                      <div className="font-medium text-muted-foreground">
                        Нет отдельных доплат
                      </div>
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                      Бенефициар получит
                    </div>
                    <div className="font-semibold">
                      {formatCurrencyMinorAmount(displayAmountOut, currencyOut)}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                      Курс
                    </div>
                    <div className="space-y-1 font-medium">
                      {rateLines.cleanForward ? (
                        <>
                          {rateLines.cleanForward ? (
                            <div>Прямой чистый курс: {rateLines.cleanForward}</div>
                          ) : null}
                          {rateLines.cleanReverse ? (
                            <div>Обратный чистый курс: {rateLines.cleanReverse}</div>
                          ) : null}
                          {rateLines.effectiveForward ? (
                            <div>
                              Прямой курс с себестоимостью: {rateLines.effectiveForward}
                            </div>
                          ) : null}
                          {rateLines.effectiveReverse ? (
                            <div>
                              Обратный курс с себестоимостью: {rateLines.effectiveReverse}
                            </div>
                          ) : null}
                        </>
                      ) : (
                        "После предварительного расчета здесь появится текущий маршрутный курс."
                      )}
                    </div>
                    {additionalFeeTotals.length > 0 ? (
                      <div className="text-xs text-amber-700">
                        Доплаты сверх маршрута оплачиваются отдельно:{" "}
                        {additionalFeeSummary}.
                      </div>
                    ) : null}
                    {previewError ? (
                      <div className="text-sm text-red-600">{previewError}</div>
                    ) : null}
                  </div>
                </div>

                <div className="min-h-0 flex-1">
                  <PaymentRouteGraphEditor
                    onStateChange={setState}
                    options={options}
                    requisites={requisites}
                    state={editorState}
                    className="h-full min-h-0 xl:grid-cols-[minmax(0,1fr)_400px]"
                    canvasClassName="h-full min-h-[58dvh] rounded-[28px] border-border/70 bg-[radial-gradient(circle_at_top,#f9fbff,white_58%,#edf3ff)] shadow-[0_24px_80px_rgba(15,23,42,0.08)]"
                    sidebarClassName="min-h-0 overflow-y-auto pr-1"
                    sidebarChildren={
                      <PaymentRouteSummaryRail
                        calculation={editorState.calculation}
                        draft={editorState.draft}
                        options={options}
                        sticky={false}
                        className="border-border/70 bg-background/90"
                        warnings={requisiteWarnings}
                      />
                    }
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
