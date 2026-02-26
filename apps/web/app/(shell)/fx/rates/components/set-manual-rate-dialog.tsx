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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@bedrock/ui/components/select";
import { toast } from "@bedrock/ui/components/sonner";

import { apiClient } from "@/lib/api-client";
import { executeMutation } from "@/lib/resources/http";

import type { CurrencyOption } from "../lib/queries";

type SetManualRateDialogProps = {
  children: React.ReactNode;
  currencies: CurrencyOption[];
};

export function SetManualRateDialog({
  children,
  currencies,
}: SetManualRateDialogProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  const [base, setBase] = React.useState<string | null>(null);
  const [quote, setQuote] = React.useState<string | null>(null);
  const [rate, setRate] = React.useState("");

  const baseCurrencyOptions = currencies.filter(
    (currency) => currency.code !== quote,
  );
  const quoteCurrencyOptions = currencies.filter(
    (currency) => currency.code !== base,
  );

  function resetForm() {
    setBase(null);
    setQuote(null);
    setRate("");
  }

  async function handleSubmit(e: React.SubmitEvent) {
    e.preventDefault();

    if (!base || !quote || !rate.trim()) {
      toast.error("Заполните все обязательные поля");
      return;
    }

    if (base === quote) {
      toast.error("Базовая и котируемая валюты должны отличаться");
      return;
    }

    let fraction: { num: bigint; den: bigint };
    try {
      fraction = parseDecimalToFraction(rate, { allowScientific: false });
    } catch {
      toast.error("Введите корректный курс больше 0, например 92.345");
      return;
    }

    setSubmitting(true);

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

    setSubmitting(false);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    toast.success("Курс добавлен");
    resetForm();
    setOpen(false);
    router.refresh();
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
          <DialogTitle>Добавить ручной курс</DialogTitle>
          <DialogDescription>
            Укажите валютную пару и курс. Ручной курс имеет наивысший приоритет.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Базовая валюта</Label>
              <Select value={base} onValueChange={setBase}>
                <SelectTrigger className="w-full" disabled={submitting}>
                  <SelectValue placeholder="Выберите валюту" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {baseCurrencyOptions.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.code} — {c.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Котируемая валюта</Label>
              <Select value={quote} onValueChange={setQuote}>
                <SelectTrigger className="w-full" disabled={submitting}>
                  <SelectValue placeholder="Выберите валюту" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {quoteCurrencyOptions.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.code} — {c.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="manual-rate-value">Курс</Label>
            <Input
              id="manual-rate-value"
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
