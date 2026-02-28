"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@bedrock/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@bedrock/ui/components/dialog";

import type { FundingFormOptions } from "../lib/queries";
import { FundingPageClient } from "./funding-page-client";

interface CreateFundingDialogProps {
  formOptions: FundingFormOptions;
}

export function CreateFundingDialog({
  formOptions,
}: CreateFundingDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="lg" />}>
        <Plus className="h-4 w-4" />
        <span className="hidden md:block">Создать пополнение</span>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Новое внешнее пополнение</DialogTitle>
          <DialogDescription>
            Создает ledger operation по сценарию external funding или opening
            balance.
          </DialogDescription>
        </DialogHeader>
        <FundingPageClient formOptions={formOptions} />
      </DialogContent>
    </Dialog>
  );
}
