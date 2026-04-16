"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";

import { Badge } from "@bedrock/sdk-ui/components/badge";
import { Button } from "@bedrock/sdk-ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@bedrock/sdk-ui/components/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@bedrock/sdk-ui/components/select";
import type { PaymentRouteCalculation } from "@bedrock/treasury/contracts";

import type { PaymentRouteConstructorOptions } from "../lib/queries";
import type { PaymentRouteEditorState } from "../lib/state";
import {
  addAdditionalFee,
  addLegFee,
  changeParticipantKind,
  insertIntermediateParticipant,
  moveIntermediateParticipant,
  removeAdditionalFee,
  removeIntermediateParticipant,
  removeLegFee,
  setLegField,
  setParticipantOption,
  updateAdditionalFee,
  updateLegFee,
} from "../lib/state";
import { formatCurrencyMinorAmount } from "../lib/format";
import {
  CalculationHint,
  CurrencySelector,
  FeeListEditor,
  getLegKindLabel,
  ParticipantSelector,
} from "./editor-shared";

type PaymentRouteManualEditorProps = {
  onStateChange: (state: PaymentRouteEditorState) => void;
  options: PaymentRouteConstructorOptions;
  state: PaymentRouteEditorState;
};

function getLegCalculation(
  calculation: PaymentRouteCalculation | null,
  legId: string,
) {
  return calculation?.legs.find((leg) => leg.id === legId) ?? null;
}

export function PaymentRouteManualEditor({
  onStateChange,
  options,
  state,
}: PaymentRouteManualEditorProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium">Цепочка операций</div>
          <div className="text-sm text-muted-foreground">
            Каждый шаг описывает переход между соседними участниками маршрута.
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            onStateChange(
              insertIntermediateParticipant({
                afterLegIndex: state.draft.legs.length - 1,
                options,
                state,
              }),
            )
          }
        >
          <Plus className="size-4" />
          Добавить операцию
        </Button>
      </div>

      {state.draft.legs.map((leg, index) => {
        const participant = state.draft.participants[index]!;
        const destination = state.draft.participants[index + 1]!;
        const calculation = getLegCalculation(state.calculation, leg.id);
        const fromCurrency =
          options.currencies.find((currency) => currency.id === leg.fromCurrencyId) ?? null;
        const toCurrency =
          options.currencies.find((currency) => currency.id === leg.toCurrencyId) ?? null;

        return (
          <Card key={leg.id} className="border-border/70">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">Шаг {index + 1}</Badge>
                    <CardTitle className="text-base">
                      {participant.displayName} to {destination.displayName}
                    </CardTitle>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    От intake-клиента до beneficiary через связанные treasury-операции.
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={index === 0}
                    onClick={() =>
                      onStateChange(
                        moveIntermediateParticipant({
                          direction: "up",
                          participantIndex: index + 1,
                          state,
                        }),
                      )
                    }
                  >
                    <ArrowUp className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={index >= state.draft.legs.length - 1}
                    onClick={() =>
                      onStateChange(
                        moveIntermediateParticipant({
                          direction: "down",
                          participantIndex: index + 1,
                          state,
                        }),
                      )
                    }
                  >
                    <ArrowDown className="size-4" />
                  </Button>
                  {index < state.draft.legs.length - 1 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        onStateChange(
                          removeIntermediateParticipant(state, index + 1),
                        )
                      }
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  ) : null}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 xl:grid-cols-2">
                <div className="space-y-2">
                  <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    Откуда
                  </div>
                  <ParticipantSelector
                    index={index}
                    options={options}
                    participant={participant}
                    state={state}
                    onKindChange={(kind) =>
                      onStateChange(
                        changeParticipantKind({
                          index,
                          kind,
                          options,
                          state,
                        }),
                      )
                    }
                    onEntityChange={(entityId) =>
                      onStateChange(
                        setParticipantOption({
                          entityId,
                          index,
                          kind: participant.kind,
                          options,
                          state,
                        }),
                      )
                    }
                  />
                </div>
                <div className="space-y-2">
                  <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    Куда
                  </div>
                  <ParticipantSelector
                    index={index + 1}
                    options={options}
                    participant={destination}
                    state={state}
                    onKindChange={(kind) =>
                      onStateChange(
                        changeParticipantKind({
                          index: index + 1,
                          kind,
                          options,
                          state,
                        }),
                      )
                    }
                    onEntityChange={(entityId) =>
                      onStateChange(
                        setParticipantOption({
                          entityId,
                          index: index + 1,
                          kind: destination.kind,
                          options,
                          state,
                        }),
                      )
                    }
                  />
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-[180px_minmax(0,1fr)_minmax(0,1fr)]">
                <div className="space-y-2">
                  <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    Операция
                  </div>
                  <Select
                    value={leg.kind}
                    onValueChange={(kind) => {
                      if (!kind) {
                        return;
                      }

                      onStateChange(
                        setLegField(state, leg.id, {
                          kind: kind as typeof leg.kind,
                        }),
                      );
                    }}
                  >
                    <SelectTrigger aria-label="Тип операции">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(
                        [
                          "collect",
                          "exchange",
                          "transfer",
                          "intercompany",
                          "cross_company",
                          "payout",
                        ] as const
                      ).map((kind) => (
                        <SelectItem key={kind} value={kind}>
                          {getLegKindLabel(kind)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    Валюта входа
                  </div>
                  <CurrencySelector
                    ariaLabel="Валюта входа"
                    options={options}
                    value={leg.fromCurrencyId}
                    onChange={(currencyId) =>
                      onStateChange(
                        setLegField(state, leg.id, {
                          fromCurrencyId: currencyId,
                        }),
                      )
                    }
                  />
                </div>
                <div className="space-y-2">
                  <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    Валюта выхода
                  </div>
                  <CurrencySelector
                    ariaLabel="Валюта выхода"
                    options={options}
                    value={leg.toCurrencyId}
                    onChange={(currencyId) =>
                      onStateChange(
                        setLegField(state, leg.id, {
                          toCurrencyId: currencyId,
                        }),
                      )
                    }
                  />
                </div>
              </div>

              <CalculationHint
                text={
                  calculation && fromCurrency && toCurrency
                    ? `${formatCurrencyMinorAmount(
                        calculation.inputAmountMinor,
                        fromCurrency,
                      )} to ${formatCurrencyMinorAmount(
                        calculation.netOutputMinor,
                        toCurrency,
                      )}`
                    : null
                }
              />

              <div className="space-y-2">
                <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  Комиссии шага
                </div>
                <FeeListEditor
                  fallbackCurrencyId={leg.fromCurrencyId}
                  fees={leg.fees}
                  options={options}
                  onAdd={() => onStateChange(addLegFee(state, leg.id))}
                  onRemove={(feeId) => onStateChange(removeLegFee(state, leg.id, feeId))}
                  onChange={(feeId, updater) =>
                    onStateChange(updateLegFee(state, leg.id, feeId, updater))
                  }
                />
              </div>
            </CardContent>
          </Card>
        );
      })}

      <Card className="border-border/70">
        <CardHeader>
          <CardTitle className="text-base">Дополнительные расходы</CardTitle>
        </CardHeader>
        <CardContent>
          <FeeListEditor
            addLabel="Добавить расход"
            fallbackCurrencyId={state.draft.currencyOutId}
            fees={state.draft.additionalFees}
            options={options}
            onAdd={() => onStateChange(addAdditionalFee(state))}
            onRemove={(feeId) => onStateChange(removeAdditionalFee(state, feeId))}
            onChange={(feeId, updater) =>
              onStateChange(updateAdditionalFee(state, feeId, updater))
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
