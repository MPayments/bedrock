"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";

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
import { useFetchedOptions } from "@/lib/hooks/useFetchedOptions";

interface User {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
}

interface UserComboboxProps {
  value?: string;
  onValueChange?: (value: string | undefined) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function UserCombobox({
  value,
  onValueChange,
  placeholder = "Выберите исполнителя...",
  className,
  disabled = false,
}: UserComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");

  const fetchUsers = React.useCallback(async (): Promise<User[]> => {
    const res = await fetch(`${API_BASE_URL}/agents`, {
      credentials: "include",
    });

    if (!res.ok) {
      throw new Error(`Ошибка загрузки: ${res.status}`);
    }

    const raw = await res.json();
    return Array.isArray(raw) ? raw : raw.data ?? [];
  }, []);

  const { items: users, loading } = useFetchedOptions<User>({
    fetcher: fetchUsers,
    open,
    value,
  });

  const selectedUser = users.find((user) => user.id === value);

  // Фильтрация пользователей по поисковому запросу
  const filteredUsers = React.useMemo(() => {
    if (!searchQuery) return users;
    const query = searchQuery.toLowerCase();
    return users.filter(
      (user) =>
        user.name.toLowerCase().includes(query) ||
        (user.email && user.email.toLowerCase().includes(query))
    );
  }, [users, searchQuery]);

  // Обработчик выбора пользователя
  const handleSelect = (userId: string) => {
    if (value === userId) {
      // Если выбран тот же пользователь - снимаем выбор
      onValueChange?.(undefined);
    } else {
      onValueChange?.(userId);
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
            className={cn("w-[250px] justify-between", className)}
            disabled={disabled}
          />
        }
      >
        {selectedUser ? (
          <OverflowTooltip tooltipText={selectedUser.name} disabled={open}>
            {selectedUser.name}
          </OverflowTooltip>
        ) : (
          <span className="text-muted-foreground">{placeholder}</span>
        )}
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-full max-h-[284px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Поиск пользователя..."
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            {loading ? (
              <div className="py-6 text-center text-sm">Загрузка...</div>
            ) : filteredUsers.length === 0 ? (
              <CommandEmpty>Пользователи не найдены</CommandEmpty>
            ) : (
              <CommandGroup>
                {filteredUsers.map((user) => (
                  <CommandItem
                    key={user.id}
                    value={user.id.toString()}
                    onSelect={() => handleSelect(user.id)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === user.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex flex-col min-w-0">
                      <OverflowTooltip tooltipText={user.isAdmin ? `${user.name} (Админ)` : user.name} className="font-medium">
                        {user.name}
                        {user.isAdmin && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            (Админ)
                          </span>
                        )}
                      </OverflowTooltip>
                      {user.email && (
                        <span className="text-xs text-muted-foreground">
                          {user.email}
                        </span>
                      )}
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
