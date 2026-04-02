"use client";

import Link from "next/link";
import { Eye, MoreHorizontal, ScanSearch } from "lucide-react";
import { useState } from "react";

import { Button } from "@bedrock/sdk-ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@bedrock/sdk-ui/components/dropdown-menu";

import { DealWorkflowDialog } from "@/features/treasury/deals/components/deal-preview-dialog";

type FinanceDealRowActionsProps = {
  applicantName: string | null;
  dealId: string;
};

export function FinanceDealRowActions({
  applicantName,
  dealId,
}: FinanceDealRowActionsProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const itemLabel =
    applicantName?.trim().length ? applicantName.trim() : `сделки ${dealId}`;

  return (
    <>
      <div className="flex justify-end" onDoubleClick={(event) => event.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                size="icon"
                variant="ghost"
                type="button"
                aria-label={`Действия для ${itemLabel}`}
              />
            }
          >
            <MoreHorizontal size={16} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-36">
            <DropdownMenuItem render={<Link href={`/treasury/deals/${dealId}`} />}>
              <Eye size={16} />
              Открыть
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setPreviewOpen(true)}>
              <ScanSearch size={16} />
              Просмотр
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <DealWorkflowDialog
        dealId={dealId}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        showTrigger={false}
      />
    </>
  );
}

