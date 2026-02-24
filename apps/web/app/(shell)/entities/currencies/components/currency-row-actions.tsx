"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Eye, MoreHorizontal, Trash2 } from "lucide-react";

import { Button } from "@bedrock/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@bedrock/ui/components/dropdown-menu";
import { toast } from "@bedrock/ui/components/sonner";

import { apiClient } from "@/lib/api-client";
import { resolveApiErrorMessage } from "@/lib/api-error";
import { CurrencyDeleteDialog } from "./currency-delete-dialog";

type CurrencyRowActionModel = {
  id: string;
  code: string;
};

type CurrencyRowActionsProps = {
  currency: CurrencyRowActionModel;
};

export function CurrencyRowActions({ currency }: CurrencyRowActionsProps) {
  const router = useRouter();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete(): Promise<boolean> {
    setDeleting(true);

    try {
      const res = await apiClient.v1.currencies[":id"].$delete({
        param: { id: currency.id },
      });

      if (!res.ok) {
        let payload: unknown = null;
        try {
          payload = await res.json();
        } catch {
          // Ignore non-JSON error payloads.
        }

        const message = resolveApiErrorMessage(
          res.status,
          payload,
          "Не удалось удалить валюту",
        );
        toast.error(message);
        return false;
      }

      toast.success("Валюта удалена");
      router.refresh();
      return true;
    } catch (deleteError) {
      const message =
        deleteError instanceof Error
          ? deleteError.message
          : "Не удалось удалить валюту";
      toast.error(message);
      return false;
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div
      className="flex justify-end"
      onDoubleClick={(event) => event.stopPropagation()}
    >
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              size="icon"
              variant="ghost"
              type="button"
              aria-label={`Действия для валюты ${currency.code}`}
              disabled={deleting}
            />
          }
        >
          <MoreHorizontal size={16} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-34">
          <DropdownMenuItem
            render={<Link href={`/entities/currencies/${currency.id}`} />}
          >
            <Eye size={16} />
            Открыть
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            disabled={deleting}
            onClick={() => setDeleteDialogOpen(true)}
          >
            <Trash2 size={16} />
            Удалить
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CurrencyDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        deleting={deleting}
        onDelete={handleDelete}
      />
    </div>
  );
}
