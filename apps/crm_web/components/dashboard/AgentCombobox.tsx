"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { OverflowTooltip } from "@/components/ui/overflow-tooltip";
import { API_BASE_URL } from "@/lib/constants";

interface Agent {
  id: string;
  name: string;
  email: string;
}

interface AgentComboboxProps {
  value?: string;
  onValueChange?: (value: string | undefined) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function AgentCombobox({
  value,
  onValueChange,
  placeholder = "Выберите агента...",
  className,
  disabled = false,
}: AgentComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [agents, setAgents] = React.useState<Agent[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");

  // Найти выбранного агента
  const selectedAgent = agents.find((agent) => agent.id === value);

  // Загрузка агентов с сервера
  const fetchAgents = React.useCallback(async () => {
    try {
      setLoading(true);

      const url = `${API_BASE_URL}/agents`;
      const res = await fetch(url, {
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error(`Ошибка загрузки: ${res.status}`);
      }

      const data = await res.json();
      setAgents(data.data ?? data);
    } catch (err) {
      console.error("Agents fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Загружаем агентов при открытии
  React.useEffect(() => {
    if (open) {
      fetchAgents();
    }
  }, [open, fetchAgents]);

  // Фильтрация агентов по поисковому запросу
  const filteredAgents = React.useMemo(() => {
    if (!searchQuery) return agents;
    const query = searchQuery.toLowerCase();
    return agents.filter(
      (agent) =>
        agent.name.toLowerCase().includes(query) ||
        agent.email.toLowerCase().includes(query)
    );
  }, [agents, searchQuery]);

  // Обработчик выбора агента
  const handleSelect = (agentId: string) => {
    if (value === agentId) {
      // Если выбран тот же агент - снимаем выбор
      onValueChange?.(undefined);
    } else {
      onValueChange?.(agentId);
    }
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen} modal={true}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-[250px] justify-between", className)}
          disabled={disabled}
        >
          {selectedAgent ? (
            <OverflowTooltip tooltipText={selectedAgent.name} disabled={open}>
              {selectedAgent.name}
            </OverflowTooltip>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full max-h-[284px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Поиск агента..."
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            {loading ? (
              <div className="py-6 text-center text-sm">Загрузка...</div>
            ) : filteredAgents.length === 0 ? (
              <CommandEmpty>Агенты не найдены</CommandEmpty>
            ) : (
              <CommandGroup>
                {filteredAgents.map((agent) => (
                  <CommandItem
                    key={agent.id}
                    value={agent.id.toString()}
                    onSelect={() => handleSelect(agent.id)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === agent.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex flex-col min-w-0">
                      <OverflowTooltip tooltipText={agent.name} className="font-medium">
                        {agent.name}
                      </OverflowTooltip>
                      <span className="text-xs text-muted-foreground">
                        {agent.email}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
