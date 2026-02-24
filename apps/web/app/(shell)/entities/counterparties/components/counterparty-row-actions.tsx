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
import { CounterpartyDeleteDialog } from "./counterparty-delete-dialog";

type CounterpartyRowActionModel = {
  id: string;
  shortName: string;
};

type CounterpartyRowActionsProps = {
  counterparty: CounterpartyRowActionModel;
  detailsBasePath?: string;
};

export function CounterpartyRowActions({
  counterparty,
  detailsBasePath = "/entities/counterparties",
}: CounterpartyRowActionsProps) {
  const router = useRouter();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete(): Promise<boolean> {
    setDeleting(true);

    try {
      const res = await apiClient.v1.counterparties[":id"].$delete({
        param: { id: counterparty.id },
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
          "Не удалось удалить контрагента",
        );
        toast.error(message);
        return false;
      }

      toast.success("Контрагент удален");
      router.refresh();
      return true;
    } catch (deleteError) {
      const message =
        deleteError instanceof Error
          ? deleteError.message
          : "Не удалось удалить контрагента";
      toast.error(message);
      return false;
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              size="icon"
              variant="ghost"
              type="button"
              aria-label={`Действия для контрагента ${counterparty.shortName}`}
              disabled={deleting}
            />
          }
        >
          <MoreHorizontal size={16} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-34">
          <DropdownMenuItem
            render={<Link href={`${detailsBasePath}/${counterparty.id}`} />}
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

      <CounterpartyDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        deleting={deleting}
        onDelete={handleDelete}
      />
    </div>
  );
}
