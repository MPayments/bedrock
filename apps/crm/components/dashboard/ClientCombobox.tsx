"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
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
import { OverflowTooltip } from "@/components/ui/overflow-tooltip";
import { API_BASE_URL } from "@/lib/constants";

interface Client {
  id: number;
  orgName: string;
  inn: string | null;
  directorName: string | null;
}

interface ClientComboboxProps {
  value?: number;
  onValueChange?: (value: number | undefined) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

// Custom hook для debounce
function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = React.useState<T>(value);

  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export function ClientCombobox({
  value,
  onValueChange,
  placeholder = "Выберите клиента...",
  className,
  disabled = false,
}: ClientComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [clients, setClients] = React.useState<Client[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [hasMore, setHasMore] = React.useState(true);
  const [offset, setOffset] = React.useState(0);
  const listRef = React.useRef<HTMLDivElement>(null);

  // Debounced search query с задержкой 500ms
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 500);

  // Найти выбранного клиента
  const selectedClient = clients.find((client) => client.id === value);

  // Загрузка клиентов с сервера
  const fetchClients = React.useCallback(
    async (query: string, currentOffset: number, append = false) => {
      try {
        if (append) {
          setLoadingMore(true);
        } else {
          setLoading(true);
        }

        const url = `${API_BASE_URL}/clients/search?q=${encodeURIComponent(
          query
        )}&offset=${currentOffset}&limit=20`;
        const res = await fetch(url, {
          credentials: "include",
        });

        if (!res.ok) {
          throw new Error(`Ошибка загрузки: ${res.status}`);
        }

        const data = await res.json();
        const items: Client[] = data.data ?? data.items ?? [];

        if (append) {
          setClients((prev) => [...prev, ...items]);
        } else {
          setClients(items);
        }

        // Если получили меньше 20 элементов, значит больше нет
        setHasMore(items.length === 20);
      } catch (err) {
        console.error("Client search error:", err);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    []
  );

  // Загружаем клиентов при открытии или изменении debounced запроса
  React.useEffect(() => {
    if (open) {
      // Сбрасываем offset и загружаем заново
      setOffset(0);
      setHasMore(true);
      fetchClients(debouncedSearchQuery, 0, false);
    }
  }, [open, debouncedSearchQuery, fetchClients]);

  // Обработчик скролла для загрузки следующей порции
  const handleScroll = React.useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const target = e.currentTarget;
      const scrolledToBottom =
        target.scrollHeight - target.scrollTop <= target.clientHeight + 50;

      if (scrolledToBottom && hasMore && !loading && !loadingMore) {
        const newOffset = offset + 20;
        setOffset(newOffset);
        fetchClients(debouncedSearchQuery, newOffset, true);
      }
    },
    [hasMore, loading, loadingMore, offset, debouncedSearchQuery, fetchClients]
  );

  // Обработчик выбора клиента
  const handleSelect = (clientId: number) => {
    if (value === clientId) {
      // Если выбран тот же клиент - снимаем выбор
      onValueChange?.(undefined);
    } else {
      onValueChange?.(clientId);
    }
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen} modal={true}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn("w-[300px] justify-between", className)}
            disabled={disabled}
          />
        }
      >
        {selectedClient ? (
          <OverflowTooltip tooltipText={selectedClient.orgName} disabled={open}>
            {selectedClient.orgName}
          </OverflowTooltip>
        ) : (
          <span className="text-muted-foreground">{placeholder}</span>
        )}
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent
        className="max-h-[284px] p-0"
        align="start"
        style={{ width: "var(--anchor-width)" }}
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Поиск клиента..."
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList ref={listRef} onScroll={handleScroll}>
            {loading && clients.length === 0 ? (
              <div className="py-6 text-center text-sm">Загрузка...</div>
            ) : clients.length === 0 ? (
              <CommandEmpty>Клиенты не найдены</CommandEmpty>
            ) : (
              <>
                <CommandGroup>
                  {clients.map((client) => (
                    <CommandItem
                      key={client.id}
                      value={client.id.toString()}
                      onSelect={() => handleSelect(client.id)}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value === client.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div className="flex flex-col min-w-0">
                        <OverflowTooltip tooltipText={client.orgName} className="font-medium">
                          {client.orgName}
                        </OverflowTooltip>
                        {client.inn && (
                          <span className="text-xs text-muted-foreground">
                            ИНН: {client.inn}
                          </span>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
                {loadingMore && (
                  <div className="flex items-center justify-center py-2">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                )}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
