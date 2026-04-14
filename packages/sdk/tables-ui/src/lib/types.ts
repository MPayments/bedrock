import type { ColumnSort, RowData } from "@tanstack/react-table";

import type { DataTableConfig } from "@bedrock/sdk-tables-ui/lib/config";
import type { FilterItemSchema } from "@bedrock/sdk-tables-ui/lib/parsers";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- TanStack interface augmentation keeps generic parameter.
  interface TableMeta<TData extends RowData> {
    queryKeys?: QueryKeys;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- TanStack interface augmentation keeps generic parameters.
  interface ColumnMeta<TData extends RowData, TValue> {
    label?: string;
    placeholder?: string;
    variant?: FilterVariant;
    options?: Option[];
    filterContentClassName?: string;
    lockedFilterValues?: string[];
    range?: [number, number];
    unit?: string;
    icon?: React.FC<React.SVGProps<SVGSVGElement>>;
  }
}

interface QueryKeys {
  page: string;
  perPage: string;
  sort: string;
  filters: string;
  joinOperator: string;
}

export interface Option {
  label: string;
  value: string;
  count?: number;
  icon?: React.FC<React.SVGProps<SVGSVGElement>>;
}

export type FilterOperator = DataTableConfig["operators"][number];
export type FilterVariant = DataTableConfig["filterVariants"][number];

export interface ExtendedColumnSort<TData> extends Omit<ColumnSort, "id"> {
  id: Extract<keyof TData, string>;
}

export interface ExtendedColumnFilter<TData> extends FilterItemSchema {
  id: Extract<keyof TData, string>;
}
