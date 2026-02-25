"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

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

export function SetManualRateDialog({ children, currencies }: SetManualRateDialogProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  const [base, setBase] = React.useState<string | null>(null);
  const [quote, setQuote] = React.useState<string | null>(null);
  const [rateNum, setRateNum] = React.useState("");
  const [rateDen, setRateDen] = React.useState("1");

  function resetForm() {
    setBase(null);
    setQuote(null);
    setRateNum("");
    setRateDen("1");
  }

  async function handleSubmit(e: React.SubmitEvent) {
    e.preventDefault();

    if (!base || !quote || !rateNum.trim() || !rateDen.trim()) {
      toast.error("Заполните все обязательные поля");
      return;
    }

    setSubmitting(true);

    const result = await executeMutation({
      request: () =>
        apiClient.v1.fx.rates.manual.$post({
          json: {
            base,
            quote,
            rateNum: rateNum.trim(),
            rateDen: rateDen.trim(),
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
      <DialogTrigger render={React.isValidElement(children) ? children : undefined}>
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
                    {currencies.map((c) => (
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
                    {currencies.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.code} — {c.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="manual-rate-num">Числитель (rate num)</Label>
              <Input
                id="manual-rate-num"
                placeholder="92345"
                value={rateNum}
                onChange={(e) => setRateNum(e.target.value)}
                disabled={submitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="manual-rate-den">Знаменатель (rate den)</Label>
              <Input
                id="manual-rate-den"
                placeholder="1000"
                value={rateDen}
                onChange={(e) => setRateDen(e.target.value)}
                disabled={submitting}
              />
            </div>
          </div>

          {rateNum && rateDen && Number(rateDen) !== 0 && (
            <p className="text-muted-foreground text-sm">
              Курс: <span className="font-mono">{(Number(rateNum) / Number(rateDen)).toFixed(6)}</span>
            </p>
          )}

          <DialogFooter>
            <DialogClose
              render={<Button variant="outline" type="button" disabled={submitting} />}
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
