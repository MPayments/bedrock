"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@bedrock/sdk-ui/components/button";

import { CreateStepDialog } from "@/features/treasury/steps/components/create-step-dialog";

export function TreasuryOperationsActions() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        size="sm"
        onClick={() => setOpen(true)}
        data-testid="finance-treasury-operations-create"
      >
        <Plus className="mr-1 size-3" />
        Создать ордер
      </Button>

      <CreateStepDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
