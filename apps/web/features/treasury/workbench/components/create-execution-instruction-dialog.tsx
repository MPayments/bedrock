"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { Button } from "@bedrock/sdk-ui/components/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@bedrock/sdk-ui/components/dialog";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@bedrock/sdk-ui/components/input-group";
import { Label } from "@bedrock/sdk-ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@bedrock/sdk-ui/components/select";
import { toast } from "@bedrock/sdk-ui/components/sonner";

import { apiClient } from "@/lib/api-client";
import { executeMutation } from "@/lib/resources/http";

import {
  buildExecutionInstructionDialogModel,
  formatPreviewMajorAmount,
  parseTreasuryAmountInput,
  resolveTreasuryAmountValidationMessage,
} from "../lib/dialogs";
import type {
  CounterpartyEndpointListItem,
  TreasuryAccountListItem,
  TreasuryEndpointListItem,
  TreasuryOperationTimeline,
} from "../lib/queries";
import { TreasuryDialogFactList, TreasuryDialogHintCard, TreasuryDialogLayout, TreasuryDialogSection, TreasuryDialogSidebar } from "./dialog-primitives";

const UNSELECTED_ENDPOINT = "__none__";

function renderSelectText(input: {
  placeholder: string;
  value: string | null;
}) {
  return (
    <span
      className={
        input.value
          ? "truncate text-left text-foreground"
          : "text-muted-foreground truncate text-left"
      }
    >
      {input.value ?? input.placeholder}
    </span>
  );
}

export function CreateExecutionInstructionDialog({
  accounts,
  assetLabels,
  children,
  counterpartyEndpoints,
  counterpartyLabels,
  operationTimeline,
  treasuryEndpoints,
  triggerSize = "default",
  triggerVariant = "default",
}: {
  accounts: TreasuryAccountListItem[];
  assetLabels: Record<string, string>;
  children: React.ReactNode;
  counterpartyEndpoints: CounterpartyEndpointListItem[];
  counterpartyLabels: Record<string, string>;
  operationTimeline: TreasuryOperationTimeline;
  treasuryEndpoints: TreasuryEndpointListItem[];
  triggerSize?: React.ComponentProps<typeof Button>["size"];
  triggerVariant?: React.ComponentProps<typeof Button>["variant"];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [submitting, startTransition] = React.useTransition();
  const model = React.useMemo(
    () =>
      buildExecutionInstructionDialogModel({
        accounts,
        assetLabels,
        counterpartyEndpoints,
        counterpartyLabels,
        operationTimeline,
        treasuryEndpoints,
      }),
    [
      accounts,
      assetLabels,
      counterpartyEndpoints,
      counterpartyLabels,
      operationTimeline,
      treasuryEndpoints,
    ],
  );
  const [amountMajor, setAmountMajor] = React.useState(model.amountMajor);
  const [destinationEndpointId, setDestinationEndpointId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) {
      setAmountMajor(model.amountMajor);
      setDestinationEndpointId(null);
    }
  }, [model.amountMajor, open]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    let amountMinor: string;
    try {
      amountMinor = parseTreasuryAmountInput({
        amountMajor,
        assetCode: model.assetCode,
      });
    } catch (error) {
      const message =
        error instanceof Error && error.message.length > 0
          ? resolveTreasuryAmountValidationMessage(error.message)
          : "Введите корректную положительную сумму";
      toast.error(message);
      return;
    }

    startTransition(async () => {
      const result = await executeMutation({
        request: () =>
          apiClient.v1.treasury["execution-instructions"].$post({
            json: {
              amountMinor,
              destinationEndpointId: destinationEndpointId ?? null,
              operationId: operationTimeline.operation.id,
            },
          }),
        fallbackMessage: "Не удалось создать инструкцию на исполнение",
      });

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success("Инструкция на исполнение создана");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={(props) => (
          <Button
            {...props}
            size={triggerSize}
            variant={triggerVariant}
          >
            {children}
          </Button>
        )}
      >
        {children}
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Создать инструкцию на исполнение</DialogTitle>
          <DialogDescription>
            Инструкция переводит сценарий из уровня операции в конкретный маршрут
            исполнения: сколько денег идет и по каким реквизитам.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <TreasuryDialogLayout
            aside={
              <TreasuryDialogSidebar>
                <div className="rounded-xl border bg-muted/30 px-4 py-4">
                  <div className="mb-3 text-sm font-semibold">
                    Что будет создано
                  </div>
                  <TreasuryDialogFactList facts={model.facts} />
                </div>
                <TreasuryDialogHintCard hint={model.nextStepHint} />
                <TreasuryDialogHintCard hint={model.endpointHint} />
              </TreasuryDialogSidebar>
            }
          >
            <div className="space-y-4">
              <TreasuryDialogSection
                title="Параметры инструкции"
                description="Сумма вводится в обычных денежных единицах. Валюта уже определяется сценарием операции."
              >
                <div className="space-y-2">
                  <Label htmlFor="instruction-amount">Сумма инструкции</Label>
                  <InputGroup>
                    <InputGroupInput
                      id="instruction-amount"
                      value={amountMajor}
                      onChange={(event) => setAmountMajor(event.target.value)}
                      disabled={submitting}
                      inputMode="decimal"
                      placeholder="1000,00"
                    />
                    <InputGroupAddon align="inline-end">
                      <InputGroupText>{model.assetCode ?? "—"}</InputGroupText>
                    </InputGroupAddon>
                  </InputGroup>
                  <div className="text-muted-foreground flex items-center justify-between text-xs">
                    <span>Основные единицы</span>
                    <span>
                      {formatPreviewMajorAmount(amountMajor)
                        ? `${formatPreviewMajorAmount(amountMajor)}${model.assetCode ? ` ${model.assetCode}` : ""}`
                        : model.amountLabel}
                    </span>
                  </div>
                </div>
              </TreasuryDialogSection>

              <TreasuryDialogSection
                title="Маршрут исполнения"
                description={model.routeRule}
              >
                <div className="space-y-2">
                  <Label>Реквизиты назначения</Label>
                  <Select
                    value={destinationEndpointId ?? UNSELECTED_ENDPOINT}
                    onValueChange={(value) =>
                      setDestinationEndpointId(
                        value === UNSELECTED_ENDPOINT ? null : value,
                      )
                    }
                  >
                    <SelectTrigger className="w-full" disabled={submitting}>
                      {renderSelectText({
                        placeholder: "Не выбраны",
                        value:
                          model.endpointOptions.find(
                            (option) => option.id === destinationEndpointId,
                          )?.label ?? null,
                      })}
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={UNSELECTED_ENDPOINT}>
                        Без реквизитов
                      </SelectItem>
                      {model.endpointOptions.map((endpoint) => (
                        <SelectItem key={endpoint.id} value={endpoint.id}>
                          <div className="space-y-0.5">
                            <div>{endpoint.label}</div>
                            <div className="text-muted-foreground text-xs">
                              {endpoint.description}
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </TreasuryDialogSection>
            </div>
          </TreasuryDialogLayout>

          <DialogFooter>
            <DialogClose
              render={
                <Button type="button" variant="outline" disabled={submitting} />
              }
            >
              Отмена
            </DialogClose>
            <Button type="submit" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Создать
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
