"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";

import { Badge } from "@bedrock/sdk-ui/components/badge";
import { Button } from "@bedrock/sdk-ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldTitle,
} from "@bedrock/sdk-ui/components/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@bedrock/sdk-ui/components/select";
import type { PaymentRouteCalculation } from "@bedrock/treasury/contracts";

import { formatCurrencyMinorAmount } from "../lib/format";
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
  setParticipantBinding,
  setParticipantOption,
  updateAdditionalFee,
  updateLegFee,
} from "../lib/state";
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
  const canInsertHop =
    options.organizations.length > 0 || options.counterparties.length > 0;

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
          disabled={!canInsertHop}
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
          options.currencies.find(
            (currency) => currency.id === leg.fromCurrencyId,
          ) ?? null;
        const toCurrency =
          options.currencies.find(
            (currency) => currency.id === leg.toCurrencyId,
          ) ?? null;

        return (
            <Card key={leg.id} className="border-border/70">
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <Badge variant="outline">Шаг {index + 1}</Badge>
                      <CardTitle className="min-w-0 truncate text-base">
                        {participant.displayName} → {destination.displayName}
                      </CardTitle>
                    </div>
                  <div className="text-sm text-muted-foreground">
                    Переход от клиента к бенефициару через связанные операции
                    маршрута.
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
              <FieldGroup className="grid gap-4 xl:grid-cols-2">
                <Field>
                  <FieldTitle>Откуда</FieldTitle>
                  <ParticipantSelector
                    index={index}
                    options={options}
                    participant={participant}
                    state={state}
                    onBindingChange={(binding) =>
                      onStateChange(
                        setParticipantBinding({
                          binding,
                          index,
                          options,
                          state,
                        }),
                      )
                    }
                    onKindChange={(entityKind) =>
                      onStateChange(
                        changeParticipantKind({
                          entityKind,
                          index,
                          options,
                          state,
                        }),
                      )
                    }
                    onEntityChange={(entityId) =>
                      onStateChange(
                        setParticipantOption({
                          entityId,
                          entityKind:
                            participant.entityKind === null
                              ? "customer"
                              : participant.entityKind,
                          index,
                          options,
                          state,
                        }),
                      )
                    }
                  />
                </Field>
                <Field>
                  <FieldTitle>Куда</FieldTitle>
                  <ParticipantSelector
                    index={index + 1}
                    options={options}
                    participant={destination}
                    state={state}
                    onBindingChange={(binding) =>
                      onStateChange(
                        setParticipantBinding({
                          binding,
                          index: index + 1,
                          options,
                          state,
                        }),
                      )
                    }
                    onKindChange={(entityKind) =>
                      onStateChange(
                        changeParticipantKind({
                          entityKind,
                          index: index + 1,
                          options,
                          state,
                        }),
                      )
                    }
                    onEntityChange={(entityId) =>
                      onStateChange(
                        setParticipantOption({
                          entityId,
                          entityKind:
                            destination.entityKind === null
                              ? "organization"
                              : destination.entityKind,
                          index: index + 1,
                          options,
                          state,
                        }),
                      )
                    }
                  />
                </Field>
              </FieldGroup>

              <FieldGroup className="grid gap-4 xl:grid-cols-[180px_minmax(0,1fr)_minmax(0,1fr)]">
                <Field>
                  <FieldTitle>Операция</FieldTitle>
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
                      <SelectValue>{getLegKindLabel(leg.kind)}</SelectValue>
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
                </Field>
                <Field>
                  <FieldTitle>Валюта входа</FieldTitle>
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
                </Field>
                <Field>
                  <FieldTitle>Валюта выхода</FieldTitle>
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
                </Field>
              </FieldGroup>

              <CalculationHint
                text={
                  calculation && fromCurrency && toCurrency
                    ? `${formatCurrencyMinorAmount(
                        calculation.inputAmountMinor,
                        fromCurrency,
                      )} → ${formatCurrencyMinorAmount(
                        calculation.netOutputMinor,
                        toCurrency,
                      )}`
                    : null
                }
              />

              <Field>
                <FieldTitle>Комиссии шага</FieldTitle>
                <FeeListEditor
                  fallbackCurrencyId={leg.fromCurrencyId}
                  fees={leg.fees}
                  options={options}
                  onAdd={() => onStateChange(addLegFee(state, leg.id))}
                  onRemove={(feeId) =>
                    onStateChange(removeLegFee(state, leg.id, feeId))
                  }
                  onChange={(feeId, updater) =>
                    onStateChange(updateLegFee(state, leg.id, feeId, updater))
                  }
                />
              </Field>
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
            onRemove={(feeId) =>
              onStateChange(removeAdditionalFee(state, feeId))
            }
            onChange={(feeId, updater) =>
              onStateChange(updateAdditionalFee(state, feeId, updater))
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
