"use client";

import {
  useDeferredValue,
  useEffect,
  useState,
} from "react";
import { ChevronsUpDown } from "lucide-react";

import {
  type ParticipantLookupItem,
  ParticipantLookupResponseSchema,
} from "@bedrock/parties/contracts";
import { Button } from "@bedrock/sdk-ui/components/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@bedrock/sdk-ui/components/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@bedrock/sdk-ui/components/popover";
import { toast } from "@bedrock/sdk-ui/components/sonner";

type ParticipantLookupComboboxProps = {
  disabled?: boolean;
  kind?: "counterparty" | "customer" | "organization" | "sub_agent";
  onSelect: (item: ParticipantLookupItem | null) => void;
  placeholder: string;
  valueLabel: string | null;
};

export function ParticipantLookupCombobox({
  disabled = false,
  kind,
  onSelect,
  placeholder,
  valueLabel,
}: ParticipantLookupComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<ParticipantLookupItem[]>([]);
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    if (!open || disabled) {
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    async function loadParticipants() {
      setLoading(true);

      try {
        const search = new URLSearchParams({
          activeOnly: "true",
          limit: "12",
          q: deferredQuery,
        });

        if (kind) {
          search.set("kind", kind);
        }

        const response = await fetch(`/v1/participants/lookup?${search.toString()}`, {
          cache: "no-store",
          credentials: "include",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Не удалось загрузить участников");
        }

        const payload = ParticipantLookupResponseSchema.parse(
          await response.json(),
        );

        if (!cancelled) {
          setItems(payload.data);
        }
      } catch (error) {
        if (
          !cancelled &&
          !(error instanceof DOMException && error.name === "AbortError")
        ) {
          toast.error(
            error instanceof Error ? error.message : "Не удалось загрузить участников",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadParticipants();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [deferredQuery, disabled, kind, open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            className="w-full justify-between font-normal"
            disabled={disabled}
          />
        }
      >
        <span className="truncate">{valueLabel ?? placeholder}</span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[360px] p-0">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Начните вводить название"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>
              {loading ? "Поиск..." : "Совпадений не найдено"}
            </CommandEmpty>
            <CommandGroup className="max-h-72 overflow-y-auto">
              {valueLabel ? (
                <CommandItem
                  onSelect={() => {
                    onSelect(null);
                    setOpen(false);
                  }}
                >
                  Очистить выбор
                </CommandItem>
              ) : null}
              {items.map((item) => (
                <CommandItem
                  key={item.id}
                  onSelect={() => {
                    onSelect(item);
                    setOpen(false);
                  }}
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium">{item.displayName}</div>
                    <div className="text-muted-foreground truncate text-xs">
                      {item.legalName} · {item.participantKind}
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
