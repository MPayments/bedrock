import { useEffect, useMemo, useState } from "react";
import { Column } from "@tanstack/react-table";
import { Input } from "@bedrock/sdk-ui/components/input";
import { Search, X } from "lucide-react";

interface DataTableTextFilterProps<TData, TValue> {
  column?: Column<TData, TValue>;
  title?: string;
}

export function DataTableTextFilter<TData, TValue>({
  column,
  title,
}: DataTableTextFilterProps<TData, TValue>) {
  const valueFromTable = (column?.getFilterValue() as string) ?? "";
  const [inputValue, setInputValue] = useState<string>(valueFromTable);

  // Синхронизация при внешнем сбросе фильтра
  useEffect(() => {
    setInputValue(valueFromTable);
  }, [valueFromTable]);

  // Debounce 300ms
  useEffect(() => {
    const id = setTimeout(() => {
      column?.setFilterValue(inputValue || undefined);
    }, 300);
    return () => clearTimeout(id);
  }, [inputValue, column]);

  return (
    <div className="relative flex items-center">
      <Search className="absolute mx-3 size-4" />
      <Input
        placeholder={title}
        value={inputValue}
        onChange={(event) => setInputValue(event.target.value)}
        className="w-full h-8 max-w-sm pl-10"
      />
      {inputValue && (
        <X
          className="absolute right-0 mx-3 cursor-pointer size-4"
          onClick={() => setInputValue("")}
        />
      )}
    </div>
  );
}
