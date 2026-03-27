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
import { Input } from "@bedrock/sdk-ui/components/input";
import { Label } from "@bedrock/sdk-ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@bedrock/sdk-ui/components/select";
import { toast } from "@bedrock/sdk-ui/components/sonner";
import { cn } from "@bedrock/sdk-ui/lib/utils";

import { apiClient } from "@/lib/api-client";
import { executeMutation } from "@/lib/resources/http";

import {
  buildExecutionEventDescriptors,
  type TreasuryDialogFact,
  type TreasuryDialogHint,
} from "../lib/dialogs";
import { EXECUTION_EVENT_KIND_OPTIONS } from "../lib/labels";
import {
  TreasuryDialogFactList,
  TreasuryDialogHintCard,
  TreasuryDialogLayout,
  TreasuryDialogSection,
  TreasuryDialogSidebar,
} from "./dialog-primitives";

type ExecutionInstructionOption = {
  description?: string;
  id: string;
  label: string;
};

const UNSELECTED_INSTRUCTION_VALUE = "__unselected__";

function renderSelectText(input: {
  placeholder: string;
  value: string | null;
}) {
  return (
    <span
      className={cn(
        "truncate text-left",
        input.value ? "text-foreground" : "text-muted-foreground",
      )}
    >
      {input.value ?? input.placeholder}
    </span>
  );
}

export function RecordExecutionEventDialog({
  children,
  contextFacts,
  contextHint,
  defaultEventKind = "submitted",
  defaultExternalRecordId = "",
  description = "Зафиксируйте фактический статус инструкции и при необходимости привяжите внешнюю запись.",
  instructions,
  submitLabel = "Записать",
  title = "Зафиксировать событие исполнения",
  triggerSize = "default",
  triggerVariant = "default",
}: {
  children: React.ReactNode;
  contextFacts?: TreasuryDialogFact[];
  contextHint?: TreasuryDialogHint;
  defaultEventKind?: (typeof EXECUTION_EVENT_KIND_OPTIONS)[number];
  defaultExternalRecordId?: string;
  description?: string;
  instructions: ExecutionInstructionOption[];
  submitLabel?: string;
  title?: string;
  triggerSize?: React.ComponentProps<typeof Button>["size"];
  triggerVariant?: React.ComponentProps<typeof Button>["variant"];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [submitting, startTransition] = React.useTransition();
  const [instructionId, setInstructionId] = React.useState<string | null>(
    instructions[0]?.id ?? null,
  );
  const [eventKind, setEventKind] = React.useState<
    (typeof EXECUTION_EVENT_KIND_OPTIONS)[number]
  >(defaultEventKind);
  const [externalRecordId, setExternalRecordId] = React.useState(
    defaultExternalRecordId,
  );

  const eventDescriptors = React.useMemo(
    () => buildExecutionEventDescriptors(),
    [],
  );
  const selectedInstruction = React.useMemo(
    () =>
      instructions.find((instruction) => instruction.id === instructionId) ?? null,
    [instructionId, instructions],
  );
  const selectedEvent = React.useMemo(
    () => eventDescriptors.find((descriptor) => descriptor.kind === eventKind),
    [eventDescriptors, eventKind],
  );

  function resetState() {
    setInstructionId(instructions[0]?.id ?? null);
    setEventKind(defaultEventKind);
    setExternalRecordId(defaultExternalRecordId);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!instructionId) {
      toast.error("Выберите инструкцию");
      return;
    }

    startTransition(async () => {
      const result = await executeMutation({
        request: () =>
          apiClient.v1.treasury["execution-events"].$post({
            json: {
              instructionId,
              eventKind,
              externalRecordId: externalRecordId.trim() || null,
            },
          }),
        fallbackMessage: "Не удалось зафиксировать событие исполнения",
      });

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success("Событие исполнения зафиксировано");
      resetState();
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          resetState();
        }
      }}
    >
      <DialogTrigger
        render={(props) => (
          <Button {...props} size={triggerSize} variant={triggerVariant}>
            {children}
          </Button>
        )}
      >
        {children}
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <TreasuryDialogLayout
            aside={
              <TreasuryDialogSidebar>
                {selectedEvent ? (
                  <div className="rounded-xl border bg-muted/30 px-4 py-4">
                    <div className="mb-3 text-sm font-semibold">
                      Что означает выбранное событие
                    </div>
                    <div className="space-y-2">
                      <div className="text-sm font-medium">
                        {selectedEvent.label}
                      </div>
                      <div className="text-muted-foreground text-sm leading-6">
                        {selectedEvent.description}
                      </div>
                      <div className="rounded-lg border bg-background/70 px-3 py-2 text-sm">
                        {selectedEvent.outcome}
                      </div>
                    </div>
                  </div>
                ) : null}

                {selectedInstruction ? (
                  <div className="rounded-xl border bg-muted/30 px-4 py-4">
                    <div className="mb-3 text-sm font-semibold">
                      К какой инструкции относится факт
                    </div>
                    <TreasuryDialogFactList
                      facts={[
                        {
                          label: "Инструкция",
                          value: selectedInstruction.label,
                        },
                        {
                          label: "Контекст",
                          value:
                            selectedInstruction.description ??
                            "Маршрут исполнения описан в выбранной инструкции.",
                        },
                      ]}
                    />
                  </div>
                ) : null}

                {contextFacts?.length ? (
                  <div className="rounded-xl border bg-muted/30 px-4 py-4">
                    <div className="mb-3 text-sm font-semibold">
                      Контекст внешней записи
                    </div>
                    <TreasuryDialogFactList facts={contextFacts} />
                  </div>
                ) : null}

                {contextHint ? <TreasuryDialogHintCard hint={contextHint} /> : null}
              </TreasuryDialogSidebar>
            }
          >
            <div className="space-y-4">
              <TreasuryDialogSection
                title="К какой инструкции относится факт"
                description="Сначала выберите конкретную инструкцию, по которой реально изменился статус исполнения."
              >
                <div className="space-y-2">
                  <Label>Инструкция</Label>
                  <Select
                    value={instructionId ?? UNSELECTED_INSTRUCTION_VALUE}
                    onValueChange={(value) =>
                      setInstructionId(
                        value === UNSELECTED_INSTRUCTION_VALUE ? null : value,
                      )
                    }
                  >
                    <SelectTrigger className="w-full" disabled={submitting}>
                      {renderSelectText({
                        placeholder: "Выберите инструкцию",
                        value: selectedInstruction?.label ?? null,
                      })}
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem disabled value={UNSELECTED_INSTRUCTION_VALUE}>
                        Выберите инструкцию
                      </SelectItem>
                      {instructions.map((instruction) => (
                        <SelectItem key={instruction.id} value={instruction.id}>
                          <div className="space-y-0.5">
                            <div>{instruction.label}</div>
                            {instruction.description ? (
                              <div className="text-muted-foreground text-xs">
                                {instruction.description}
                              </div>
                            ) : null}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </TreasuryDialogSection>

              <TreasuryDialogSection
                title="Что произошло"
                description="Выберите фактический результат исполнения, а не предполагаемое состояние."
              >
                <div className="grid gap-2 md:grid-cols-2">
                  {eventDescriptors.map((descriptor) => (
                    <button
                      key={descriptor.kind}
                      type="button"
                      onClick={() => setEventKind(descriptor.kind)}
                      className={cn(
                        "rounded-xl border px-4 py-3 text-left transition-colors",
                        eventKind === descriptor.kind
                          ? "border-foreground/20 bg-foreground text-background"
                          : "border-border bg-muted/30 hover:border-foreground/15 hover:bg-muted/60",
                      )}
                    >
                      <div className="text-sm font-semibold">
                        {descriptor.label}
                      </div>
                      <div
                        className={cn(
                          "mt-1 text-xs leading-5",
                          eventKind === descriptor.kind
                            ? "text-background/75"
                            : "text-muted-foreground",
                        )}
                      >
                        {descriptor.description}
                      </div>
                    </button>
                  ))}
                </div>
              </TreasuryDialogSection>

              <TreasuryDialogSection
                title="Внешняя запись"
                description="Если событие подтверждается записью из сверки, привяжите ее здесь. Для чисто ручного факта поле можно оставить пустым."
              >
                <div className="space-y-2">
                  <Label htmlFor="external-record-id">
                    Идентификатор внешней записи
                  </Label>
                  <Input
                    id="external-record-id"
                    value={externalRecordId}
                    onChange={(event) => setExternalRecordId(event.target.value)}
                    placeholder="Необязательно"
                    disabled={submitting}
                  />
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
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
