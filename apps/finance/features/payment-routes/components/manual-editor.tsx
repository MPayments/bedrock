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
  FieldGroup,
  FieldTitle,
} from "@bedrock/sdk-ui/components/field";
import { derivePaymentRouteLegSemantics } from "@bedrock/treasury/contracts";

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
  setParticipantRequisiteId,
  updateAdditionalFee,
  updateLegFee,
} from "../lib/state";
import type { PaymentRouteRequisitesState } from "../lib/use-payment-route-requisites";
import {
  CurrencySelector,
  FeeListEditor,
  ParticipantRequisiteField,
  ParticipantSelector,
} from "./editor-shared";
import { PaymentRouteLegSemanticChip } from "./leg-semantic-chip";
import { Separator } from "@bedrock/sdk-ui/components/separator";

type PaymentRouteManualEditorProps = {
  onStateChange: (state: PaymentRouteEditorState) => void;
  options: PaymentRouteConstructorOptions;
  requisites: PaymentRouteRequisitesState;
  state: PaymentRouteEditorState;
};

export function PaymentRouteManualEditor({
  onStateChange,
  options,
  requisites,
  state,
}: PaymentRouteManualEditorProps) {
  const canInsertHop =
    options.organizations.length > 0 || options.counterparties.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium">Цепочка операций</div>
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
        const semantics = derivePaymentRouteLegSemantics({
          draft: state.draft,
          legIndex: index,
        });

        return (
          <Card key={leg.id} className="border-border/70">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <Badge variant="outline">Шаг {index + 1}</Badge>
                    {semantics.map((tag) => (
                      <PaymentRouteLegSemanticChip key={tag} tag={tag} />
                    ))}
                    <CardTitle className="min-w-0 truncate text-base">
                      {participant.displayName} → {destination.displayName}
                    </CardTitle>
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
                    options={options}
                    participant={participant}
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
                  <ParticipantRequisiteField
                    index={index}
                    options={options}
                    participant={participant}
                    requisites={requisites}
                    state={state}
                    onChange={(requisiteId) =>
                      onStateChange(
                        setParticipantRequisiteId({
                          index,
                          requisiteId,
                          state,
                        }),
                      )
                    }
                  />
                </Field>
                <Field>
                  <FieldTitle>Куда</FieldTitle>
                  <ParticipantSelector
                    options={options}
                    participant={destination}
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
                  <ParticipantRequisiteField
                    index={index + 1}
                    options={options}
                    participant={destination}
                    requisites={requisites}
                    state={state}
                    onChange={(requisiteId) =>
                      onStateChange(
                        setParticipantRequisiteId({
                          index: index + 1,
                          requisiteId,
                          state,
                        }),
                      )
                    }
                  />
                </Field>
              </FieldGroup>

              <FieldGroup className="grid gap-4 xl:grid-cols-2">
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

              <Separator orientation="horizontal" className="h-px" />

              <FeeListEditor
                allowFxSpread={leg.fromCurrencyId !== leg.toCurrencyId}
                fallbackCurrencyId={leg.fromCurrencyId}
                fees={leg.fees}
                options={options}
                title="Комиссии шага"
                onAdd={() => onStateChange(addLegFee(state, leg.id))}
                onRemove={(feeId) =>
                  onStateChange(removeLegFee(state, leg.id, feeId))
                }
                onChange={(feeId, updater) =>
                  onStateChange(updateLegFee(state, leg.id, feeId, updater))
                }
              />
            </CardContent>
          </Card>
        );
      })}

      <Card className="border-border/70">
        <CardContent className="pt-6">
          <FeeListEditor
            addLabel="Добавить расход"
            allowFxSpread={false}
            fallbackCurrencyId={state.draft.currencyInId}
            feeScope="additional"
            fees={state.draft.additionalFees}
            options={options}
            title="Доплаты сверх маршрута"
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
