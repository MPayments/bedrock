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
import { toast } from "@bedrock/sdk-ui/components/sonner";

import { apiClient } from "@/lib/api-client";
import { executeMutation } from "@/lib/resources/http";

import {
  buildPositionSettlementDialogModel,
  formatPreviewMajorAmount,
  parseTreasuryAmountInput,
  resolveTreasuryAmountValidationMessage,
} from "../lib/dialogs";
import {
  TreasuryDialogFactList,
  TreasuryDialogHintCard,
  TreasuryDialogLayout,
  TreasuryDialogSection,
  TreasuryDialogSidebar,
} from "./dialog-primitives";

type SettlePositionDialogPosition = {
  assetCode: string | null;
  id: string;
  kindLabel: string;
  meaning: string;
  ownerLabel: string;
  relatedPartyLabel: string;
  remainingLabel: string;
  remainingMinor: string;
};

export function SettlePositionDialog({
  children,
  position,
  triggerSize = "default",
  triggerVariant = "default",
}: {
  children: React.ReactNode;
  position: SettlePositionDialogPosition;
  triggerSize?: React.ComponentProps<typeof Button>["size"];
  triggerVariant?: React.ComponentProps<typeof Button>["variant"];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [submitting, startTransition] = React.useTransition();
  const model = React.useMemo(
    () =>
      buildPositionSettlementDialogModel({
        amountMinor: position.remainingMinor,
        assetCode: position.assetCode,
        kindLabel: position.kindLabel,
        meaning: position.meaning,
        ownerLabel: position.ownerLabel,
        relatedPartyLabel: position.relatedPartyLabel,
      }),
    [position],
  );
  const [amountMajor, setAmountMajor] = React.useState(model.amountMajor);

  React.useEffect(() => {
    if (!open) {
      setAmountMajor(model.amountMajor);
    }
  }, [model.amountMajor, open]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    let amountMinor: string;
    try {
      amountMinor = parseTreasuryAmountInput({
        amountMajor,
        assetCode: position.assetCode,
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
          apiClient.v1.treasury.positions[":positionId"].settle.$post({
            param: { positionId: position.id },
            json: { amountMinor },
          }),
        fallbackMessage: "Не удалось погасить позицию",
      });

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success("Позиция погашена");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={(props) => (
          <Button {...props} size={triggerSize} variant={triggerVariant}>
            {children}
          </Button>
        )}
      >
        {children}
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Погасить позицию</DialogTitle>
          <DialogDescription>
            Закройте внутренний остаток после исполнения, когда экономический
            смысл движения денег уже завершен.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <TreasuryDialogLayout
            aside={
              <TreasuryDialogSidebar>
                <div className="rounded-xl border bg-muted/30 px-4 py-4">
                  <div className="mb-3 text-sm font-semibold">
                    Что закрываем
                  </div>
                  <TreasuryDialogFactList facts={model.facts} />
                </div>
                <TreasuryDialogHintCard hint={model.explanation} />
                <div className="rounded-xl border bg-muted/30 px-4 py-4">
                  <div className="text-sm font-medium">Почему позиция существует</div>
                  <div className="text-muted-foreground mt-1 text-sm leading-6">
                    {model.meaning}
                  </div>
                </div>
              </TreasuryDialogSidebar>
            }
          >
            <div className="space-y-4">
              <TreasuryDialogSection
                title="Сумма погашения"
                description="Обычно погашают полный остаток. Если закрывается только часть, укажите фактическую закрываемую сумму."
              >
                <div className="space-y-2">
                  <Label htmlFor={`settle-position-${position.id}`}>Сумма</Label>
                  <InputGroup>
                    <InputGroupInput
                      id={`settle-position-${position.id}`}
                      value={amountMajor}
                      onChange={(event) => setAmountMajor(event.target.value)}
                      disabled={submitting}
                      inputMode="decimal"
                      placeholder="1000,00"
                    />
                    <InputGroupAddon align="inline-end">
                      <InputGroupText>{position.assetCode ?? "—"}</InputGroupText>
                    </InputGroupAddon>
                  </InputGroup>
                  <div className="text-muted-foreground flex items-center justify-between text-xs">
                    <span>Текущий остаток</span>
                    <span>{position.remainingLabel}</span>
                  </div>
                  <div className="text-muted-foreground flex items-center justify-between text-xs">
                    <span>Будет отправлено</span>
                    <span>
                      {formatPreviewMajorAmount(amountMajor)
                        ? `${formatPreviewMajorAmount(amountMajor)}${position.assetCode ? ` ${position.assetCode}` : ""}`
                        : position.remainingLabel}
                    </span>
                  </div>
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
              Погасить
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
