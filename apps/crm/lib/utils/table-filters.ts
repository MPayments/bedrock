import type { ColumnFiltersState } from "@tanstack/react-table";

/**
 * Глубокое сравнение двух массивов фильтров колонок.
 * Используется для предотвращения ненужных ререндеров при работе с useReactTable.
 */
export function areFiltersEqual(
  a: ColumnFiltersState,
  b: ColumnFiltersState
): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i]!;
    const bi = b[i]!;
    if (ai.id !== bi.id) return false;
    if (JSON.stringify(ai.value) !== JSON.stringify(bi.value)) return false;
  }
  return true;
}
