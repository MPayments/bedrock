"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { ChevronDown, Download, Loader2 } from "lucide-react";

import { Button } from "@bedrock/sdk-ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@bedrock/sdk-ui/components/dropdown-menu";
import { toast } from "@bedrock/sdk-ui/components/sonner";

import { API_BASE_URL } from "@/lib/constants";

type Variant = {
  label: string;
  lang: "ru" | "en";
  format: "pdf" | "docx";
};

const VARIANTS: ReadonlyArray<Variant> = [
  { format: "pdf", label: "Счёт на оплату · PDF", lang: "ru" },
  { format: "docx", label: "Счёт на оплату · DOCX", lang: "ru" },
  { format: "pdf", label: "Инвойс · PDF", lang: "en" },
  { format: "docx", label: "Инвойс · DOCX", lang: "en" },
];

function createIdempotencyKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `idem-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

interface DealInvoiceGenerateButtonProps {
  dealId: string;
  disabled?: boolean;
}

export function DealInvoiceGenerateButton({
  dealId,
  disabled,
}: DealInvoiceGenerateButtonProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleSelect(variant: Variant) {
    setBusy(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/deals/${encodeURIComponent(dealId)}/documents/invoice/generate`,
        {
          body: JSON.stringify({
            format: variant.format,
            lang: variant.lang,
          }),
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": createIdempotencyKey(),
          },
          method: "POST",
        },
      );
      if (!response.ok) {
        const payload = await response
          .json()
          .catch(() => ({ message: "Не удалось сформировать документ" }));
        toast.error(
          typeof payload.message === "string"
            ? payload.message
            : typeof payload.error === "string"
              ? payload.error
              : "Не удалось сформировать документ",
        );
        return;
      }
      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition");
      let filename = `invoice.${variant.format}`;
      if (disposition) {
        const match = disposition.match(/filename="?([^";]+)"?/);
        if (match?.[1]) filename = decodeURIComponent(match[1]);
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      router.refresh();
    } catch (error) {
      console.error("Invoice generate error:", error);
      toast.error("Не удалось сформировать документ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            size="sm"
            variant="outline"
            disabled={disabled || busy}
            data-testid={`crm-deal-invoice-generate-${dealId}`}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Сформировать
            <ChevronDown className="h-4 w-4 opacity-60" />
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        {VARIANTS.map((variant) => (
          <DropdownMenuItem
            key={`${variant.lang}-${variant.format}`}
            disabled={busy}
            onClick={() => handleSelect(variant)}
          >
            {variant.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
