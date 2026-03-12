"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { parseDecimalToFraction } from "@bedrock/kernel/math";
import { Button } from "@bedrock/ui/components/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@bedrock/ui/components/dialog";
import { Input } from "@bedrock/ui/components/input";
import { Label } from "@bedrock/ui/components/label";
import { toast } from "@bedrock/ui/components/sonner";

import { apiClient } from "@/lib/api-client";
import { executeMutation } from "@/lib/resources/http";

type SetPairManualRateDialogProps = {
  children: React.ReactNode;
  base: string;
  quote: string;
};

export function SetPairManualRateDialog({
  children,
  base,
  quote,
}: SetPairManualRateDialogProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [submitting, startTransition] = React.useTransition();
  const [rate, setRate] = React.useState("");

  function resetForm() {
    setRate("");
  }

  function handleSubmit(e: React.SubmitEvent) {
    e.preventDefault();

    if (!rate.trim()) {
      toast.error("Введите курс");
      return;
    }

    let fraction: { num: bigint; den: bigint };
    try {
      fraction = parseDecimalToFraction(rate, { allowScientific: false });
    } catch {
      toast.error("Введите корректный курс больше 0, например 92.345");
      return;
    }

    startTransition(async () => {
      const result = await executeMutation({
        request: () =>
          apiClient.v1.fx.rates.manual.$post({
            json: {
              base,
              quote,
              rateNum: fraction.num.toString(),
              rateDen: fraction.den.toString(),
            },
          }),
        fallbackMessage: "Не удалось добавить курс",
      });

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success("Курс добавлен");
      resetForm();
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={React.isValidElement(children) ? children : undefined}
      >
        {!React.isValidElement(children) && children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Добавить ручной курс для {base}/{quote}
          </DialogTitle>
          <DialogDescription>
            Ручной курс имеет наивысший приоритет и будет использован вместо
            автоматических источников.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pair-manual-rate-value">Курс</Label>
            <Input
              id="pair-manual-rate-value"
              placeholder="92.345"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              disabled={submitting}
              inputMode="decimal"
            />
            <p className="text-muted-foreground text-xs">
              Можно вводить с точкой или запятой, например: 92.345 или 92,345
            </p>
          </div>

          {rate.trim() && Number(rate.replace(",", ".")) > 0 && (
            <p className="text-muted-foreground text-sm">
              Курс:{" "}
              <span className="font-mono">
                {Number(rate.replace(",", ".")).toFixed(6)}
              </span>
            </p>
          )}

          <DialogFooter>
            <DialogClose
              render={
                <Button variant="outline" type="button" disabled={submitting} />
              }
            >
              Отмена
            </DialogClose>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Добавить
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
