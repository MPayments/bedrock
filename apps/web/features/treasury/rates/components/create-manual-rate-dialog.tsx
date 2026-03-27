"use client";

import { Plus } from "lucide-react";

import type { CurrencyOption } from "../lib/queries";
import { SetManualRateDialog } from "./set-manual-rate-dialog";

interface CreateManualRateDialogProps {
  currencies: CurrencyOption[];
}

export function CreateManualRateDialog({
  currencies,
}: CreateManualRateDialogProps) {
  return (
    <SetManualRateDialog currencies={currencies} triggerSize="lg">
      <>
        <Plus className="h-4 w-4" />
        <span className="hidden md:block">Ручной курс</span>
      </>
    </SetManualRateDialog>
  );
}
