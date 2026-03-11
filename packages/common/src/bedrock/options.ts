type OptionListInput<TItem> = readonly TItem[] | { data: readonly TItem[] };

function resolveItems<TItem>(input: OptionListInput<TItem>): readonly TItem[] {
  if ("data" in input) {
    return input.data;
  }

  return input;
}

export function buildOptionsResponse<TItem, TOption>(
  input: OptionListInput<TItem>,
  mapFn: (item: TItem) => TOption,
): { data: TOption[] } {
  return {
    data: resolveItems(input).map(mapFn),
  };
}
