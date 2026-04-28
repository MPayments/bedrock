"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@bedrock/sdk-ui/components/button";

import { CreateTreasuryOrderDialog } from "./create-treasury-order-dialog";

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

      <CreateTreasuryOrderDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
