export interface ListResult<TData> {
  data: TData[];
  total: number;
  limit: number;
  offset: number;
}
