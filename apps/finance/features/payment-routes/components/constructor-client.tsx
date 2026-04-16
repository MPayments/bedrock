"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, GitBranch, LayoutList, LoaderCircle, Save } from "lucide-react";

import { Button } from "@bedrock/sdk-ui/components/button";
import { ButtonGroup } from "@bedrock/sdk-ui/components/button-group";
import { Card, CardContent } from "@bedrock/sdk-ui/components/card";
import { Input } from "@bedrock/sdk-ui/components/input";
import { toast } from "@bedrock/sdk-ui/components/sonner";
import type { PaymentRouteTemplate } from "@bedrock/treasury/contracts";

import { formatCurrencyRatio } from "../lib/format";
import {
  createPaymentRouteTemplate,
  previewPaymentRoute,
  updatePaymentRouteTemplate,
} from "../lib/mutations";
import type { PaymentRouteConstructorOptions } from "../lib/queries";
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
import {
  BufferedMinorAmountInput,
  CurrencySelector,
} from "./editor-shared";
import { PaymentRouteManualEditor } from "./manual-editor";
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
  const [previewPending, startPreviewTransition] = React.useTransition();
  const [savePending, startSaveTransition] = React.useTransition();
  const deferredDraft = React.useDeferredValue(state?.draft ?? null);
  const runPreview = React.useEffectEvent(async (draft: PaymentRouteEditorState["draft"]) => {
    const controller = new AbortController();

    try {
      const calculation = await previewPaymentRoute(draft, controller.signal);
      setPreviewError(null);
      startPreviewTransition(() => {
        setState((current) => (current ? applyCalculation(current, calculation) : current));
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }

      setPreviewError(
        error instanceof Error && error.message.length > 0
          ? error.message
          : "Не удалось выполнить preview маршрута",
      );
    }

    return () => controller.abort();
  });

  React.useEffect(() => {
    if (!deferredDraft) {
      return;
    }

    const timeout = window.setTimeout(() => {
      void runPreview(deferredDraft);
    }, 250);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [deferredDraft, runPreview]);

  if (!state) {
    return (
      <Card className="border-dashed">
        <CardContent className="space-y-3 px-6 py-10">
          <div className="text-lg font-medium">Маршрут пока не собрать</div>
          <div className="text-sm text-muted-foreground">
            Для конструктора нужен как минимум один клиент, одна организация или контрагент и хотя бы одна валюта.
          </div>
          <div className="flex flex-wrap gap-2">
            <Button render={<Link href="/entities/customers" />}>Клиенты</Button>
            <Button variant="outline" render={<Link href="/entities/counterparties" />}>
              Контрагенты
            </Button>
            <Button variant="outline" render={<Link href="/treasury/organizations" />}>
              Организации
            </Button>
            <Button variant="outline" render={<Link href="/entities/currencies" />}>
              Валюты
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const editorState = state;
  const currencyIn =
    options.currencies.find((currency) => currency.id === editorState.draft.currencyInId) ?? null;
  const currencyOut =
    options.currencies.find((currency) => currency.id === editorState.draft.currencyOutId) ?? null;
  const rateContext = editorState.calculation
    ? formatCurrencyRatio({
        amountInMinor: editorState.calculation.amountInMinor,
        amountOutMinor: editorState.calculation.netAmountOutMinor,
        currencyIn,
        currencyOut,
      })
    : null;

  function handleSave() {
    startSaveTransition(async () => {
      const payload = {
        draft: editorState.draft,
        name: editorState.name.trim() || "Маршрут без названия",
        visual: editorState.visual,
      };

      const result = editorState.templateId
        ? await updatePaymentRouteTemplate(editorState.templateId, payload)
        : await createPaymentRouteTemplate(payload);

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success(editorState.templateId ? "Маршрут сохранен" : "Маршрут создан");
      setState(createPaymentRouteEditorStateFromTemplate(result.data));

      if (!editorState.templateId) {
        router.replace(`/routes/constructor/${result.data.id}`);
      }

      router.refresh();
    });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ArrowLeft className="size-4" />
              <Link href="/routes/list" className="hover:text-foreground">
                Назад к каталогу
              </Link>
            </div>
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold">Конструктор маршрута</h1>
              <p className="text-sm text-muted-foreground">
                Единый редактор route template для collect, exchange, transfer, intercompany и payout-сценариев.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" render={<Link href="/routes/list" />}>
              <LayoutList className="size-4" />
              Список маршрутов
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

        <Card className="rounded-2xl border-border/70">
          <CardContent className="grid gap-4 p-5">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
              <div className="space-y-2">
                <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  Название маршрута
                </div>
                <Input
                  value={editorState.name}
                  onChange={(event) =>
                    setState(setRouteName(editorState, event.target.value))
                  }
                  placeholder="Например, USDT to AED via Dubai and USA"
                />
              </div>
              <div className="space-y-2">
                <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  Lock side
                </div>
                <ButtonGroup className="w-full">
                  <Button
                    type="button"
                    variant={
                      editorState.draft.lockedSide === "currency_in" ? "default" : "outline"
                    }
                    className="flex-1"
                    onClick={() =>
                      setState(setLockedSide(editorState, "currency_in"))
                    }
                  >
                    Currency In
                  </Button>
                  <Button
                    type="button"
                    variant={
                      editorState.draft.lockedSide === "currency_out" ? "default" : "outline"
                    }
                    className="flex-1"
                    onClick={() =>
                      setState(setLockedSide(editorState, "currency_out"))
                    }
                  >
                    Currency Out
                  </Button>
                </ButtonGroup>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
              <div className="space-y-2">
                <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  Списать
                </div>
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
              </div>
              <div className="flex items-center justify-center text-sm text-muted-foreground">
                <GitBranch className="size-4" />
              </div>
              <div className="space-y-2">
                <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  Получить
                </div>
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
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/20 px-4 py-3 text-sm">
              <div className="space-y-1">
                <div className="font-medium">Realtime расчет</div>
                <div className="text-muted-foreground">
                  {rateContext ?? "После preview здесь появится текущий маршрутный курс."}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {previewPending ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <LoaderCircle className="size-4 animate-spin" />
                    Пересчет
                  </div>
                ) : null}
                {previewError ? (
                  <div className="text-right text-sm text-red-600">{previewError}</div>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="text-sm font-medium">Режим редактора</div>
            <ButtonGroup>
              <Button
                type="button"
                variant={editorState.mode === "manual" ? "default" : "outline"}
                onClick={() => setState(setEditorMode(editorState, "manual"))}
              >
                Ручной
              </Button>
              <Button
                type="button"
                variant={editorState.mode === "graph" ? "default" : "outline"}
                onClick={() => setState(setEditorMode(editorState, "graph"))}
              >
                Граф
              </Button>
            </ButtonGroup>
          </div>

          {editorState.mode === "manual" ? (
            <PaymentRouteManualEditor
              onStateChange={setState}
              options={options}
              state={editorState}
            />
          ) : (
            <PaymentRouteGraphEditor
              onStateChange={setState}
              options={options}
              state={editorState}
            />
          )}
        </div>
      </div>

      <div className="order-last xl:order-none">
        <PaymentRouteSummaryRail
          calculation={editorState.calculation}
          options={options}
        />
      </div>
    </div>
  );
}
